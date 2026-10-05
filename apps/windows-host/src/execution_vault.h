#pragma once

#include <filesystem>
#include <span>
#include <string>

namespace zterminal::execution {

// Static categories only: callers must never log credential-bearing input.
enum class VaultError { none, invalid_input, unsafe_path, unsafe_permissions, storage, protection };

struct VaultWriteResult {
    VaultError error{VaultError::storage};
    std::string credential_reference;
};

// Native engine-owned primitive. No saved-secret reveal/export API exists.
// SQLite reference publication and deployment pausing belong to the engine;
// only erase an old blob after its replacement reference commits durably.
class CredentialVault final {
public:
    [[nodiscard]] static std::filesystem::path default_directory();
    explicit CredentialVault(std::filesystem::path private_directory);
    [[nodiscard]] VaultError initialize();
    [[nodiscard]] VaultWriteResult store(std::span<const unsigned char> access_key,
                                         std::span<const unsigned char> secret_key);
    [[nodiscard]] VaultError erase(const std::string& credential_reference);

private:
    std::filesystem::path directory_;
};

} // namespace zterminal::execution
