#pragma once

#include "local_scene_bridge.h"

#include <cstddef>
#include <cstdint>
#include <string>

namespace zterminal::local_monte_carlo {

struct Request {
    std::wstring root;
    std::uint32_t symbol_id{};
    std::uint64_t interval_ns{};
    std::uint64_t start_ns{};
    std::uint64_t freshness_budget_ns{};
    std::size_t simulations{};
    std::size_t horizon_bars{};
    std::uint64_t seed{};
};

enum class Kind {
    NotRequested,
    Complete,
    Withheld,
    BridgeFailure,
};

struct Result {
    Kind kind{Kind::NotRequested};
    local_scene::Availability availability{local_scene::Availability::Unavailable};
    std::uint64_t age_ns{};
    std::size_t retained_bars{};
    std::uint16_t algorithm_version{};
    std::uint64_t seed{};
    std::size_t source_bars{};
    std::size_t source_returns{};
    std::size_t simulations{};
    std::size_t horizon_bars{};
    std::int64_t minimum_return_bps{};
    std::int64_t p05_return_bps{};
    std::int64_t median_return_bps{};
    std::int64_t p95_return_bps{};
    std::int64_t maximum_return_bps{};
    std::int64_t mean_return_bps{};
    std::wstring diagnostic;
};

/// Runs the packaged local-only research command exactly once for an explicit,
/// bounded immutable segment. A research failure never falls back to provider,
/// cloud, account, strategy, or execution behavior and does not alter chart data.
[[nodiscard]] Result load(const Request& request);

[[nodiscard]] const wchar_t* kind_label(Kind kind);

} // namespace zterminal::local_monte_carlo
