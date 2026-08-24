#include "local_segment_catalog_bridge.h"

#include <windows.h>

#include <filesystem>
#include <fstream>
#include <limits>
#include <regex>
#include <sstream>
#include <string_view>

namespace zterminal::local_segment_catalog {
namespace {

constexpr unsigned long kCommandSchemaVersion = 1;
constexpr std::size_t kMaximumEntries = 256;
constexpr DWORD kMaximumBridgeWaitMilliseconds = 15'000;

[[nodiscard]] Result bridge_failure(std::wstring diagnostic) {
    return {
        .status = Status::BridgeFailure,
        .diagnostic = std::move(diagnostic),
    };
}

[[nodiscard]] std::wstring executable_directory() {
    std::wstring buffer(MAX_PATH, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (length == 0 || length >= buffer.size()) {
        return {};
    }
    buffer.resize(length);
    return std::filesystem::path(buffer).parent_path().wstring();
}

[[nodiscard]] std::wstring quote_argument(const std::wstring& value) {
    return L"\"" + value + L"\"";
}

[[nodiscard]] bool parse_u64(const std::string& text, std::uint64_t& value) {
    try {
        value = std::stoull(text);
        return true;
    } catch (const std::exception&) {
        return false;
    }
}

[[nodiscard]] bool json_u64(std::string_view output, const char* field, std::uint64_t& value) {
    const std::string prefix = std::string("\"") + field + "\":";
    const std::size_t field_start = output.find(prefix);
    if (field_start == std::string_view::npos) {
        return false;
    }
    const std::size_t value_start = field_start + prefix.size();
    std::size_t value_end = value_start;
    while (value_end < output.size() && output[value_end] >= '0' && output[value_end] <= '9') {
        ++value_end;
    }
    return value_end > value_start
        && parse_u64(std::string(output.substr(value_start, value_end - value_start)), value);
}

[[nodiscard]] bool json_bool(std::string_view output, const char* field, bool& value) {
    const std::string prefix = std::string("\"") + field + "\":";
    const std::size_t field_start = output.find(prefix);
    if (field_start == std::string_view::npos) {
        return false;
    }
    const std::string_view remainder = output.substr(field_start + prefix.size());
    if (remainder.starts_with("true")) {
        value = true;
        return true;
    }
    if (remainder.starts_with("false")) {
        value = false;
        return true;
    }
    return false;
}

[[nodiscard]] bool representable_size(std::uint64_t value, std::size_t& result) {
    if (value > std::numeric_limits<std::size_t>::max()) {
        return false;
    }
    result = static_cast<std::size_t>(value);
    return true;
}

[[nodiscard]] bool known_data_status(const std::string& status) {
    return status == "live" || status == "stale" || status == "gap" || status == "unavailable";
}

[[nodiscard]] Result parse_command_output(const std::string& output) {
    std::uint64_t schema_version{};
    if (!json_u64(output, "schema_version", schema_version) || schema_version != kCommandSchemaVersion) {
        return bridge_failure(L"local segment catalog returned an unsupported schema version");
    }
    const std::regex kind_expression(R"json("kind":"catalog")json");
    const std::regex layout_expression(R"json("layout":"(available|unavailable)")json");
    std::smatch layout_match;
    if (!std::regex_search(output, kind_expression)
        || !std::regex_search(output, layout_match, layout_expression)) {
        return bridge_failure(L"local segment catalog omitted required result status fields");
    }
    bool truncated{};
    std::uint64_t malformed_metadata{};
    std::uint64_t missing_payload{};
    std::uint64_t corrupt_payload{};
    std::size_t malformed_metadata_size{};
    std::size_t missing_payload_size{};
    std::size_t corrupt_payload_size{};
    if (!json_bool(output, "truncated", truncated)
        || !json_u64(output, "malformed_metadata_entries", malformed_metadata)
        || !json_u64(output, "missing_payload_entries", missing_payload)
        || !json_u64(output, "corrupt_payload_entries", corrupt_payload)
        || !representable_size(malformed_metadata, malformed_metadata_size)
        || !representable_size(missing_payload, missing_payload_size)
        || !representable_size(corrupt_payload, corrupt_payload_size)) {
        return bridge_failure(L"local segment catalog omitted bounded omission accounting");
    }
    if (layout_match[1].str() == "unavailable") {
        const std::regex entry_expression(R"json(\{"start_ns":([0-9]+),"bytes":([0-9]+),"last_access":([0-9]+),"data_status":"([a-z]+)"\})json");
        if (std::regex_search(output, entry_expression) || truncated || malformed_metadata_size != 0
            || missing_payload_size != 0 || corrupt_payload_size != 0) {
            return bridge_failure(L"unavailable local segment catalog returned unavailable-state entries");
        }
        return {.status = Status::Unavailable};
    }

    const std::regex entry_expression(
        R"json(\{"start_ns":([0-9]+),"bytes":([0-9]+),"last_access":([0-9]+),"data_status":"([a-z]+)"\})json");
    std::vector<Entry> entries;
    std::uint64_t prior_start{};
    bool has_prior{};
    for (std::sregex_iterator iterator(output.begin(), output.end(), entry_expression), end; iterator != end; ++iterator) {
        Entry entry{};
        if (!parse_u64((*iterator)[1].str(), entry.start_ns)
            || !parse_u64((*iterator)[2].str(), entry.bytes)
            || !parse_u64((*iterator)[3].str(), entry.last_access)
            || !known_data_status((*iterator)[4].str())
            || (has_prior && entry.start_ns <= prior_start)) {
            return bridge_failure(L"local segment catalog returned an invalid ordered immutable entry");
        }
        prior_start = entry.start_ns;
        has_prior = true;
        entries.push_back(entry);
    }
    if (entries.size() > kMaximumEntries) {
        return bridge_failure(L"local segment catalog returned entries outside its bounded contract");
    }
    return {
        .status = Status::Available,
        .truncated = truncated,
        .malformed_metadata_entries = malformed_metadata_size,
        .missing_payload_entries = missing_payload_size,
        .corrupt_payload_entries = corrupt_payload_size,
        .entries = std::move(entries),
    };
}

[[nodiscard]] std::string read_text_file(const std::filesystem::path& path) {
    std::ifstream input(path, std::ios::binary);
    std::ostringstream output;
    output << input.rdbuf();
    return output.str();
}

} // namespace

Result load(const Request& request) {
    if (request.root.empty() || request.interval_ns == 0 || request.maximum_entries == 0
        || request.maximum_entries > kMaximumEntries) {
        return bridge_failure(L"local segment catalog request is outside its bounded contract");
    }
    const std::filesystem::path command_path = std::filesystem::path(executable_directory()) / L"zt-local-segment-catalog.exe";
    if (!std::filesystem::is_regular_file(command_path)) {
        return bridge_failure(L"local segment catalog command executable is absent");
    }
    wchar_t temporary_directory[MAX_PATH]{};
    if (GetTempPathW(MAX_PATH, temporary_directory) == 0) {
        return bridge_failure(L"Windows temporary directory is unavailable");
    }
    wchar_t temporary_name[MAX_PATH]{};
    if (GetTempFileNameW(temporary_directory, L"ZTC", 0, temporary_name) == 0) {
        return bridge_failure(L"could not allocate local segment catalog output file");
    }
    const std::filesystem::path output_path(temporary_name);
    SECURITY_ATTRIBUTES inheritable{};
    inheritable.nLength = sizeof(inheritable);
    inheritable.bInheritHandle = TRUE;
    HANDLE output = CreateFileW(
        output_path.c_str(), GENERIC_WRITE, FILE_SHARE_READ, &inheritable, CREATE_ALWAYS,
        FILE_ATTRIBUTE_TEMPORARY, nullptr);
    if (output == INVALID_HANDLE_VALUE) {
        std::error_code error;
        std::filesystem::remove(output_path, error);
        return bridge_failure(L"could not open local segment catalog output file");
    }

    std::wstringstream command;
    command << quote_argument(command_path.wstring())
            << L" --root " << quote_argument(request.root)
            << L" --symbol-id " << request.symbol_id
            << L" --interval-ns " << request.interval_ns
            << L" --maximum-entries " << request.maximum_entries;
    std::wstring command_text = command.str();
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    startup.dwFlags = STARTF_USESTDHANDLES;
    startup.hStdOutput = output;
    startup.hStdError = output;
    startup.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    PROCESS_INFORMATION process{};
    const BOOL created = CreateProcessW(
        command_path.c_str(), command_text.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW,
        nullptr, nullptr, &startup, &process);
    CloseHandle(output);
    if (created == FALSE) {
        std::error_code error;
        std::filesystem::remove(output_path, error);
        return bridge_failure(L"could not start local segment catalog command process");
    }
    const DWORD wait_result = WaitForSingleObject(process.hProcess, kMaximumBridgeWaitMilliseconds);
    if (wait_result == WAIT_TIMEOUT) {
        (void)TerminateProcess(process.hProcess, 2);
        (void)WaitForSingleObject(process.hProcess, 1'000);
    }
    DWORD exit_code{};
    (void)GetExitCodeProcess(process.hProcess, &exit_code);
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    const std::string response = read_text_file(output_path);
    std::error_code error;
    std::filesystem::remove(output_path, error);
    if (wait_result == WAIT_TIMEOUT) {
        return bridge_failure(L"local segment catalog command exceeded its 15-second local process bound");
    }
    if (wait_result != WAIT_OBJECT_0 || exit_code != 0) {
        return bridge_failure(L"local segment catalog command rejected the requested local history");
    }
    return parse_command_output(response);
}

const wchar_t* status_label(Status status) {
    switch (status) {
    case Status::Available: return L"LOCAL HISTORY AVAILABLE";
    case Status::Unavailable: return L"LOCAL HISTORY UNAVAILABLE";
    case Status::BridgeFailure: return L"LOCAL HISTORY BRIDGE FAILURE";
    }
    return L"LOCAL HISTORY UNAVAILABLE";
}

} // namespace zterminal::local_segment_catalog
