#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace zterminal::local_scene {

enum class Availability {
    Live,
    Cached,
    Stale,
    Gap,
    Unavailable,
    Corrupt,
    BridgeFailure,
};

struct Candle {
    std::uint64_t open_time_ns{};
    std::int64_t open_ticks{};
    std::int64_t high_ticks{};
    std::int64_t low_ticks{};
    std::int64_t close_ticks{};
    std::int64_t volume{};
};

struct Request {
    std::wstring root;
    std::uint32_t symbol_id{};
    std::uint64_t interval_ns{};
    std::uint64_t start_ns{};
    std::size_t first_bar{};
    std::size_t visible_bars{};
    std::uint64_t freshness_budget_ns{};
};

struct Result {
    Availability availability{Availability::Unavailable};
    std::uint64_t age_ns{};
    std::size_t total_bars{};
    std::size_t first_bar{};
    std::size_t retained_bars{};
    std::vector<Candle> candles;
    std::wstring diagnostic;
};

/// Invokes the packaged local-only bridge exactly once for a bounded requested
/// window. A bridge failure is distinct from provider unavailability and never
/// causes a server or provider fallback.
[[nodiscard]] Result load(const Request& request);

[[nodiscard]] const wchar_t* availability_label(Availability availability);

} // namespace zterminal::local_scene
