#include "local_monte_carlo_bridge.h"

#include <windows.h>

#include <chrono>
#include <filesystem>
#include <fstream>
#include <limits>
#include <regex>
#include <sstream>
#include <string_view>

namespace zterminal::local_monte_carlo {
namespace {

constexpr unsigned long kCommandSchemaVersion = 1;
constexpr std::size_t kMaximumSimulations = 10'000;
constexpr std::size_t kMaximumHorizonBars = 1'000;
constexpr std::size_t kMaximumWorkItems = 1'000'000;
constexpr std::size_t kMaximumHistorySegments = 16;
constexpr DWORD kMaximumBridgeWaitMilliseconds = 15'000;

[[nodiscard]] Result bridge_failure(std::wstring diagnostic) {
    return {
        .kind = Kind::BridgeFailure,
        .availability = local_scene::Availability::BridgeFailure,
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

[[nodiscard]] bool json_i64(std::string_view output, const char* field, std::int64_t& value) {
    const std::string prefix = std::string("\"") + field + "\":";
    const std::size_t field_start = output.find(prefix);
    if (field_start == std::string_view::npos) {
        return false;
    }
    const std::size_t value_start = field_start + prefix.size();
    std::size_t value_end = value_start;
    if (value_end < output.size() && output[value_end] == '-') {
        ++value_end;
    }
    const std::size_t digit_start = value_end;
    while (value_end < output.size() && output[value_end] >= '0' && output[value_end] <= '9') {
        ++value_end;
    }
    return value_end > digit_start
        && parse_i64(std::string(output.substr(value_start, value_end - value_start)), value);
}

[[nodiscard]] local_scene::Availability parse_availability(const std::string& label, bool& known) {
    known = true;
    if (label == "live") return local_scene::Availability::Live;
    if (label == "cached") return local_scene::Availability::Cached;
    if (label == "stale") return local_scene::Availability::Stale;
    if (label == "gap") return local_scene::Availability::Gap;
    if (label == "unavailable") return local_scene::Availability::Unavailable;
    if (label == "corrupt") return local_scene::Availability::Corrupt;
    known = false;
    return local_scene::Availability::BridgeFailure;
}

[[nodiscard]] bool representable_size(std::uint64_t value, std::size_t& result) {
    if (value > std::numeric_limits<std::size_t>::max()) {
        return false;
    }
    result = static_cast<std::size_t>(value);
    return true;
}

[[nodiscard]] Result parse_command_output(const std::string& output) {
    std::uint64_t schema_version{};
    if (!json_u64(output, "schema_version", schema_version) || schema_version != kCommandSchemaVersion) {
        return bridge_failure(L"local Monte Carlo command returned an unsupported schema version");
    }
    const std::regex kind_expression(R"json("kind":"(complete|withheld)")json");
    const std::regex availability_expression(R"json("availability":"([a-z]+)")json");
    std::smatch kind_match;
    std::smatch availability_match;
    if (!std::regex_search(output, kind_match, kind_expression)
        || !std::regex_search(output, availability_match, availability_expression)) {
        return bridge_failure(L"local Monte Carlo command omitted required result status fields");
    }
    bool known_availability{};
    const local_scene::Availability availability = parse_availability(availability_match[1].str(), known_availability);
    if (!known_availability) {
        return bridge_failure(L"local Monte Carlo command returned an unknown availability");
    }
    std::uint64_t age_ns{};
    if (!json_u64(output, "age_ns", age_ns)) {
        return bridge_failure(L"local Monte Carlo command omitted availability age");
    }
    if (kind_match[1].str() == "withheld") {
        std::uint64_t retained_bars{};
        std::size_t retained_bars_size{};
        if (!json_u64(output, "retained_bars", retained_bars)
            || !representable_size(retained_bars, retained_bars_size)) {
            return bridge_failure(L"local Monte Carlo command omitted bounded withheld source count");
        }
        return {
            .kind = Kind::Withheld,
            .availability = availability,
            .age_ns = age_ns,
            .retained_bars = retained_bars_size,
        };
    }
    if (availability != local_scene::Availability::Live && availability != local_scene::Availability::Cached) {
        return bridge_failure(L"local Monte Carlo command attempted analysis from degraded local data");
    }

    std::uint64_t algorithm_version{};
    std::uint64_t seed{};
    std::uint64_t source_segments{};
    std::uint64_t source_bars{};
    std::uint64_t source_returns{};
    std::uint64_t simulations{};
    std::uint64_t horizon_bars{};
    std::int64_t minimum_return_bps{};
    std::int64_t p05_return_bps{};
    std::int64_t median_return_bps{};
    std::int64_t p95_return_bps{};
    std::int64_t maximum_return_bps{};
    std::int64_t mean_return_bps{};
    std::size_t source_segments_size{};
    std::size_t source_bars_size{};
    std::size_t source_returns_size{};
    std::size_t simulations_size{};
    std::size_t horizon_bars_size{};
    if (!json_u64(output, "algorithm_version", algorithm_version)
        || algorithm_version == 0 || algorithm_version > std::numeric_limits<std::uint16_t>::max()
        || !json_u64(output, "seed", seed) || seed == 0
        || !json_u64(output, "source_segments", source_segments) || !representable_size(source_segments, source_segments_size)
        || !json_u64(output, "source_bars", source_bars) || !representable_size(source_bars, source_bars_size)
        || !json_u64(output, "source_returns", source_returns) || !representable_size(source_returns, source_returns_size)
        || !json_u64(output, "simulations", simulations) || !representable_size(simulations, simulations_size)
        || !json_u64(output, "horizon_bars", horizon_bars) || !representable_size(horizon_bars, horizon_bars_size)
        || !json_i64(output, "minimum_return_bps", minimum_return_bps)
        || !json_i64(output, "p05_return_bps", p05_return_bps)
        || !json_i64(output, "median_return_bps", median_return_bps)
        || !json_i64(output, "p95_return_bps", p95_return_bps)
        || !json_i64(output, "maximum_return_bps", maximum_return_bps)
        || !json_i64(output, "mean_return_bps", mean_return_bps)) {
        return bridge_failure(L"local Monte Carlo command omitted or malformed required summary fields");
    }
    if (simulations_size == 0 || simulations_size > kMaximumSimulations
        || horizon_bars_size == 0 || horizon_bars_size > kMaximumHorizonBars
        || simulations_size > kMaximumWorkItems / horizon_bars_size
        || source_segments_size == 0 || source_segments_size > kMaximumHistorySegments
        || source_bars_size < 2 || source_bars_size > 100'000
        || source_returns_size + 1 != source_bars_size
        || minimum_return_bps > p05_return_bps || p05_return_bps > median_return_bps
        || median_return_bps > p95_return_bps || p95_return_bps > maximum_return_bps) {
        return bridge_failure(L"local Monte Carlo command returned a summary outside its bounded contract");
    }
    return {
        .kind = Kind::Complete,
        .availability = availability,
        .age_ns = age_ns,
        .algorithm_version = static_cast<std::uint16_t>(algorithm_version),
        .seed = seed,
        .source_segments = source_segments_size,
        .source_bars = source_bars_size,
        .source_returns = source_returns_size,
        .simulations = simulations_size,
        .horizon_bars = horizon_bars_size,
        .minimum_return_bps = minimum_return_bps,
        .p05_return_bps = p05_return_bps,
        .median_return_bps = median_return_bps,
        .p95_return_bps = p95_return_bps,
        .maximum_return_bps = maximum_return_bps,
        .mean_return_bps = mean_return_bps,
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
    if (request.root.empty() || request.interval_ns == 0 || request.simulations == 0
        || request.simulations > kMaximumSimulations || request.horizon_bars == 0
        || request.horizon_bars > kMaximumHorizonBars || request.seed == 0
        || request.history_segments == 0 || request.history_segments > kMaximumHistorySegments
        || request.simulations > kMaximumWorkItems / request.horizon_bars) {
        return bridge_failure(L"local Monte Carlo request is outside its bounded contract");
    }
    const std::filesystem::path command_path = std::filesystem::path(executable_directory()) / L"zt-local-monte-carlo.exe";
    if (!std::filesystem::is_regular_file(command_path)) {
        return bridge_failure(L"local Monte Carlo command executable is absent");
    }
    wchar_t temporary_directory[MAX_PATH]{};
    if (GetTempPathW(MAX_PATH, temporary_directory) == 0) {
        return bridge_failure(L"Windows temporary directory is unavailable");
    }
    wchar_t temporary_name[MAX_PATH]{};
    if (GetTempFileNameW(temporary_directory, L"ZTM", 0, temporary_name) == 0) {
        return bridge_failure(L"could not allocate local Monte Carlo output file");
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
        return bridge_failure(L"could not open local Monte Carlo output file");
    }

    std::wstringstream command;
    command << quote_argument(command_path.wstring())
            << L" --root " << quote_argument(request.root)
            << L" --symbol-id " << request.symbol_id
            << L" --interval-ns " << request.interval_ns
            << L" --start-ns " << request.start_ns
            << L" --now-ns " << utc_now_ns()
            << L" --freshness-budget-ns " << request.freshness_budget_ns
            << L" --simulations " << request.simulations
            << L" --horizon-bars " << request.horizon_bars
            << L" --seed " << request.seed
            << L" --history-segments " << request.history_segments;
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
        return bridge_failure(L"could not start local Monte Carlo command process");
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
        return bridge_failure(L"local Monte Carlo command exceeded its 15-second local process bound");
    }
    if (wait_result != WAIT_OBJECT_0 || exit_code != 0) {
        return bridge_failure(L"local Monte Carlo command rejected the requested local research");
    }
    Result result = parse_command_output(response);
    if (result.kind == Kind::Complete && result.source_segments != request.history_segments) {
        return bridge_failure(L"local Monte Carlo command returned a history segment count different from the explicit request");
    }
    return result;
}

const wchar_t* kind_label(Kind kind) {
    switch (kind) {
    case Kind::NotRequested: return L"RESEARCH NOT REQUESTED";
    case Kind::Complete: return L"LOCAL MC COMPLETE";
    case Kind::Withheld: return L"LOCAL MC WITHHELD";
    case Kind::BridgeFailure: return L"LOCAL MC BRIDGE FAILURE";
    }
    return L"LOCAL MC WITHHELD";
}

} // namespace zterminal::local_monte_carlo
