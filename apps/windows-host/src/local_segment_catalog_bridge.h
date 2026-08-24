#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace zterminal::local_segment_catalog {

struct Request {
    std::wstring root;
    std::uint32_t symbol_id{};
    std::uint64_t interval_ns{};
    std::size_t maximum_entries{};
};

enum class Status {
    Available,
    Unavailable,
    BridgeFailure,
};

struct Entry {
    std::uint64_t start_ns{};
    std::uint64_t bytes{};
    std::uint64_t last_access{};
};

struct Result {
    Status status{Status::Unavailable};
    bool truncated{};
    std::size_t malformed_metadata_entries{};
    std::size_t missing_payload_entries{};
    std::size_t corrupt_payload_entries{};
    std::vector<Entry> entries;
    std::wstring diagnostic;
};

/// Invokes the packaged local-only catalog command once. Returned entries are
/// individually verified records, not a claim of contiguous or fresh history.
[[nodiscard]] Result load(const Request& request);

[[nodiscard]] const wchar_t* status_label(Status status);

} // namespace zterminal::local_segment_catalog
