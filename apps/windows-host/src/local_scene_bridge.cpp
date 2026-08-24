#include "local_scene_bridge.h"

#include <windows.h>

#include <chrono>
#include <filesystem>
#include <fstream>
#include <limits>
#include <regex>
#include <sstream>
#include <string_view>

namespace zterminal::local_scene {
namespace {

constexpr std::size_t kMaximumVisibleCandles = 2'000;
constexpr unsigned long kBridgeSchemaVersion = 1;

[[nodiscard]] Result bridge_failure(std::wstring diagnostic) {
    return {
        .availability = Availability::BridgeFailure,
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
    // Windows paths cannot contain a quotation mark. The bridge does not accept
    // arbitrary shell syntax; every value is passed as one quoted process token.
    return L"\"" + value + L"\"";
}

[[nodiscard]] std::uint64_t utc_now_ns() {
    const auto elapsed = std::chrono::system_clock::now().time_since_epoch();
    return static_cast<std::uint64_t>(
        std::chrono::duration_cast<std::chrono::nanoseconds>(elapsed).count());
}

[[nodiscard]] bool parse_u64(const std::string& text, std::uint64_t& value) {
    try {
        value = std::stoull(text);
        return true;
    } catch (const std::exception&) {
        return false;
    }
}

[[nodiscard]] bool parse_i64(const std::string& text, std::int64_t& value) {
    try {
        value = std::stoll(text);
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

[[nodiscard]] Availability parse_availability(const std::string& label, bool& known) {
    known = true;
    if (label == "live") return Availability::Live;
    if (label == "cached") return Availability::Cached;
    if (label == "stale") return Availability::Stale;
    if (label == "gap") return Availability::Gap;
    if (label == "unavailable") return Availability::Unavailable;
    if (label == "corrupt") return Availability::Corrupt;
    known = false;
    return Availability::BridgeFailure;
}

[[nodiscard]] Result parse_bridge_output(const std::string& output) {
    std::uint64_t schema_version{};
    if (!json_u64(output, "schema_version", schema_version) || schema_version != kBridgeSchemaVersion) {
        return bridge_failure(L"local scene bridge returned an unsupported schema version");
    }
    const std::regex kind_expression(R"json("kind":"(renderable|withheld)")json");
    const std::regex availability_expression(R"json("availability":"([a-z]+)")json");
    std::smatch kind_match;
    std::smatch availability_match;
    if (!std::regex_search(output, kind_match, kind_expression)
        || !std::regex_search(output, availability_match, availability_expression)) {
        return bridge_failure(L"local scene bridge omitted required scene status fields");
    }
    bool known_availability{};
    const Availability availability = parse_availability(availability_match[1].str(), known_availability);
    if (!known_availability) {
        return bridge_failure(L"local scene bridge returned an unknown availability state");
    }
    std::uint64_t age_ns{};
    if (!json_u64(output, "age_ns", age_ns)) {
        return bridge_failure(L"local scene bridge omitted availability age");
    }

    if (kind_match[1].str() == "withheld") {
        std::uint64_t retained_bars{};
        if (!json_u64(output, "retained_bars", retained_bars)) {
            return bridge_failure(L"local scene bridge omitted withheld retained count");
        }
        return {
            .availability = availability,
            .age_ns = age_ns,
            .retained_bars = static_cast<std::size_t>(retained_bars),
        };
    }

    if (availability != Availability::Live && availability != Availability::Cached) {
        return bridge_failure(L"local scene bridge attempted to render a degraded local range");
    }
    std::uint64_t total_bars{};
    std::uint64_t first_bar{};
    if (!json_u64(output, "total_bars", total_bars) || !json_u64(output, "first_bar", first_bar)) {
        return bridge_failure(L"local scene bridge omitted renderable bounds");
    }
    const std::regex candle_expression(
        R"json(\{"open_time_ns":([0-9]+),"open_ticks":(-?[0-9]+),"high_ticks":(-?[0-9]+),"low_ticks":(-?[0-9]+),"close_ticks":(-?[0-9]+),"volume":(-?[0-9]+)\})json");
    std::vector<Candle> candles;
    for (std::sregex_iterator iterator(output.begin(), output.end(), candle_expression), end; iterator != end; ++iterator) {
        Candle candle{};
        if (!parse_u64((*iterator)[1].str(), candle.open_time_ns)
            || !parse_i64((*iterator)[2].str(), candle.open_ticks)
            || !parse_i64((*iterator)[3].str(), candle.high_ticks)
            || !parse_i64((*iterator)[4].str(), candle.low_ticks)
            || !parse_i64((*iterator)[5].str(), candle.close_ticks)
            || !parse_i64((*iterator)[6].str(), candle.volume)) {
            return bridge_failure(L"local scene bridge returned an unparseable candle");
        }
        if (candle.volume <= 0
            || candle.low_ticks > candle.open_ticks
            || candle.low_ticks > candle.close_ticks
            || candle.high_ticks < candle.open_ticks
            || candle.high_ticks < candle.close_ticks) {
            return bridge_failure(L"local scene bridge returned an invalid candle");
        }
        candles.push_back(candle);
    }
    if (candles.empty() || candles.size() > kMaximumVisibleCandles) {
        return bridge_failure(L"local scene bridge returned a candle count outside the visible bound");
    }
    return {
        .availability = availability,
        .age_ns = age_ns,
        .total_bars = static_cast<std::size_t>(total_bars),
        .first_bar = static_cast<std::size_t>(first_bar),
        .candles = std::move(candles),
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
    if (request.root.empty() || request.interval_ns == 0 || request.visible_bars == 0 || request.visible_bars > kMaximumVisibleCandles) {
        return bridge_failure(L"local scene request is outside its bounded contract");
    }
    const std::filesystem::path bridge_path = std::filesystem::path(executable_directory()) / L"zt-local-scene-bridge.exe";
    if (!std::filesystem::is_regular_file(bridge_path)) {
        return bridge_failure(L"local scene bridge executable is absent");
    }
    wchar_t temporary_directory[MAX_PATH]{};
    if (GetTempPathW(MAX_PATH, temporary_directory) == 0) {
        return bridge_failure(L"Windows temporary directory is unavailable");
    }
    wchar_t temporary_name[MAX_PATH]{};
    if (GetTempFileNameW(temporary_directory, L"ZTS", 0, temporary_name) == 0) {
        return bridge_failure(L"could not allocate local bridge output file");
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
        return bridge_failure(L"could not open local bridge output file");
    }

    std::wstringstream command;
    command << quote_argument(bridge_path.wstring())
            << L" --root " << quote_argument(request.root)
            << L" --symbol-id " << request.symbol_id
            << L" --interval-ns " << request.interval_ns
            << L" --start-ns " << request.start_ns
            << L" --first-bar " << request.first_bar
            << L" --visible-bars " << request.visible_bars
            << L" --now-ns " << utc_now_ns()
            << L" --freshness-budget-ns " << request.freshness_budget_ns;
    std::wstring command_text = command.str();
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    startup.dwFlags = STARTF_USESTDHANDLES;
    startup.hStdOutput = output;
    startup.hStdError = output;
    startup.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    PROCESS_INFORMATION process{};
    const BOOL created = CreateProcessW(
        bridge_path.c_str(), command_text.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW,
        nullptr, nullptr, &startup, &process);
    CloseHandle(output);
    if (created == FALSE) {
        std::error_code error;
        std::filesystem::remove(output_path, error);
        return bridge_failure(L"could not start local scene bridge process");
    }
    (void)WaitForSingleObject(process.hProcess, INFINITE);
    DWORD exit_code{};
    (void)GetExitCodeProcess(process.hProcess, &exit_code);
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    const std::string response = read_text_file(output_path);
    std::error_code error;
    std::filesystem::remove(output_path, error);
    if (exit_code != 0) {
        return bridge_failure(L"local scene bridge rejected the requested local scene");
    }
    return parse_bridge_output(response);
}

const wchar_t* availability_label(Availability availability) {
    switch (availability) {
    case Availability::Live: return L"LOCAL LIVE";
    case Availability::Cached: return L"LOCAL CACHED";
    case Availability::Stale: return L"LOCAL STALE";
    case Availability::Gap: return L"LOCAL GAP";
    case Availability::Unavailable: return L"LOCAL DATA UNAVAILABLE";
    case Availability::Corrupt: return L"LOCAL DATA CORRUPT";
    case Availability::BridgeFailure: return L"LOCAL BRIDGE FAILURE";
    }
    return L"LOCAL DATA UNAVAILABLE";
}

} // namespace zterminal::local_scene
