#include "execution_vault.h"

#include <windows.h>
#include <aclapi.h>
#include <bcrypt.h>
#include <dpapi.h>
#include <sddl.h>
#include <shlobj.h>

#include <algorithm>
#include <array>
#include <cstdint>
#include <vector>

namespace zterminal::execution {
namespace {

constexpr std::array<unsigned char, 8> kMagic{'Z','T','V','A','U','L','T',1};
constexpr unsigned char kEntropy[] = "ZTerminal native MEXC vault v1";
constexpr std::size_t kMaximumKeyBytes = 512;

class Handle final {
public:
    explicit Handle(HANDLE handle = INVALID_HANDLE_VALUE) : value(handle) {}
    ~Handle() { if (value != INVALID_HANDLE_VALUE && value != nullptr) CloseHandle(value); }
    Handle(const Handle&) = delete;
    Handle& operator=(const Handle&) = delete;
    HANDLE value;
};

class LocalBuffer final {
public:
    ~LocalBuffer() { if (value != nullptr) { if (size != 0) SecureZeroMemory(value,size); LocalFree(value); } }
    LocalBuffer() = default;
    LocalBuffer(const LocalBuffer&) = delete;
    LocalBuffer& operator=(const LocalBuffer&) = delete;
    void* value{};
    std::size_t size{};
};

class SensitiveBytes final {
public:
    ~SensitiveBytes() { if (!bytes.empty()) SecureZeroMemory(bytes.data(),bytes.size()); }
    std::vector<unsigned char> bytes;
};

[[nodiscard]] bool reference_valid(const std::string& reference) {
    return reference.size() == 32 && std::all_of(reference.begin(),reference.end(),[](char c) {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
    });
}

class UserSecurity final {
public:
    [[nodiscard]] bool initialize() {
        Handle token;
        if (!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&token.value)) return false;
        DWORD required{};
        (void)GetTokenInformation(token.value,TokenUser,nullptr,0,&required);
        if (required == 0) return false;
        user_buffer.resize(required);
        if (!GetTokenInformation(token.value,TokenUser,user_buffer.data(),required,&required)) return false;
        user_sid = reinterpret_cast<TOKEN_USER*>(user_buffer.data())->User.Sid;
        LocalBuffer sid_string;
        if (!ConvertSidToStringSidW(user_sid,reinterpret_cast<LPWSTR*>(&sid_string.value))) return false;
        // Protected DACL with one explicit full-access ACE for this user only.
        const std::wstring sid = static_cast<wchar_t*>(sid_string.value);
        const std::wstring sddl = L"O:" + sid + L"D:P(A;;FA;;;" + sid + L")";
        if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(),SDDL_REVISION_1,
            &descriptor.value,nullptr)) return false;
        attributes = {sizeof(SECURITY_ATTRIBUTES),descriptor.value,FALSE};
        return true;
    }
    [[nodiscard]] bool verify(HANDLE handle) const {
        PSID owner{};
        PACL dacl{};
        LocalBuffer actual;
        if (GetSecurityInfo(handle,SE_FILE_OBJECT,OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            &owner,nullptr,&dacl,nullptr,reinterpret_cast<PSECURITY_DESCRIPTOR*>(&actual.value)) != ERROR_SUCCESS
            || owner == nullptr || !EqualSid(owner,user_sid) || dacl == nullptr || dacl->AceCount != 1) return false;
        SECURITY_DESCRIPTOR_CONTROL control{};
        DWORD revision{};
        if (!GetSecurityDescriptorControl(actual.value,&control,&revision) || !(control & SE_DACL_PROTECTED)) return false;
        void* ace{};
        if (!GetAce(dacl,0,&ace)) return false;
        const auto allowed = static_cast<ACCESS_ALLOWED_ACE*>(ace);
        return allowed->Header.AceType == ACCESS_ALLOWED_ACE_TYPE
            && !(allowed->Header.AceFlags & INHERITED_ACE)
            && (allowed->Mask & FILE_ALL_ACCESS) == FILE_ALL_ACCESS
            && EqualSid(const_cast<DWORD*>(&allowed->SidStart),user_sid);
    }
    SECURITY_ATTRIBUTES attributes{};
private:
    std::vector<unsigned char> user_buffer;
    PSID user_sid{};
    LocalBuffer descriptor;
};

[[nodiscard]] bool safe_components(const std::filesystem::path& path) {
    if (!path.is_absolute() || path.wstring().starts_with(L"\\\\")) return false;
    auto current = path.root_path();
    for (const auto& part : path.relative_path()) {
        if (part == L".." || part == L".") return false;
        current /= part;
        const DWORD attributes = GetFileAttributesW(current.c_str());
        if (attributes == INVALID_FILE_ATTRIBUTES || !(attributes & FILE_ATTRIBUTE_DIRECTORY)
            || (attributes & FILE_ATTRIBUTE_REPARSE_POINT)) return false;
    }
    return true;
}

[[nodiscard]] VaultError open_directory(const std::filesystem::path& path, const UserSecurity& security,
                                        Handle& handle) {
    if (!safe_components(path)) return VaultError::unsafe_path;
    // Keep the directory open without delete sharing while accessing child blobs.
    handle.value = CreateFileW(path.c_str(),FILE_READ_ATTRIBUTES | READ_CONTROL,
        FILE_SHARE_READ | FILE_SHARE_WRITE,nullptr,OPEN_EXISTING,
        FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,nullptr);
    if (handle.value == INVALID_HANDLE_VALUE) return VaultError::storage;
    if (!security.verify(handle.value)) return VaultError::unsafe_permissions;
    return VaultError::none;
}

[[nodiscard]] std::filesystem::path blob_path(const std::filesystem::path& directory,const std::string& reference) {
    return directory / (std::wstring(reference.begin(),reference.end()) + L".ztcred");
}

} // namespace

std::filesystem::path CredentialVault::default_directory() {
    PWSTR local{};
    if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData,KF_FLAG_DEFAULT,nullptr,&local))) return {};
    const std::filesystem::path base(local);
    CoTaskMemFree(local);
    // One separate root, never a research/export/roaming or web-storage subtree.
    return base / L"ZTerminalExecutionVault";
}

CredentialVault::CredentialVault(std::filesystem::path private_directory) : directory_(std::move(private_directory)) {}

VaultError CredentialVault::initialize() {
    if (directory_.empty() || !safe_components(directory_.parent_path())) return VaultError::unsafe_path;
    UserSecurity security;
    if (!security.initialize()) return VaultError::unsafe_permissions;
    if (!CreateDirectoryW(directory_.c_str(),&security.attributes) && GetLastError() != ERROR_ALREADY_EXISTS) return VaultError::storage;
    Handle directory;
    return open_directory(directory_,security,directory);
}

VaultWriteResult CredentialVault::store(std::span<const unsigned char> access_key,
                                      std::span<const unsigned char> secret_key) {
    if (access_key.empty() || secret_key.empty() || access_key.size() > kMaximumKeyBytes || secret_key.size() > kMaximumKeyBytes)
        return {VaultError::invalid_input,{}};
    UserSecurity security;
    if (!security.initialize()) return {VaultError::unsafe_permissions,{}};
    Handle directory;
    const auto directory_error = open_directory(directory_,security,directory);
    if (directory_error != VaultError::none) return {directory_error,{}};
    SensitiveBytes plaintext;
    plaintext.bytes.reserve(8 + access_key.size() + secret_key.size());
    for (const std::size_t size : {access_key.size(),secret_key.size()}) {
        for (unsigned int shift = 0; shift < 32; shift += 8) plaintext.bytes.push_back(static_cast<unsigned char>(size >> shift));
    }
    plaintext.bytes.insert(plaintext.bytes.end(),access_key.begin(),access_key.end());
    plaintext.bytes.insert(plaintext.bytes.end(),secret_key.begin(),secret_key.end());
    DATA_BLOB input{static_cast<DWORD>(plaintext.bytes.size()),plaintext.bytes.data()};
    DATA_BLOB entropy{static_cast<DWORD>(sizeof(kEntropy)),const_cast<unsigned char*>(kEntropy)};
    DATA_BLOB encrypted{};
    // CURRENT USER only. CRYPTPROTECT_LOCAL_MACHINE is deliberately absent.
    if (!CryptProtectData(&input,nullptr,&entropy,nullptr,nullptr,CRYPTPROTECT_UI_FORBIDDEN,&encrypted))
        return {VaultError::protection,{}};
    LocalBuffer encrypted_buffer;
    encrypted_buffer.value = encrypted.pbData;
    encrypted_buffer.size = encrypted.cbData;
    std::array<unsigned char,16> nonce{};
    if (BCryptGenRandom(nullptr,nonce.data(),static_cast<ULONG>(nonce.size()),BCRYPT_USE_SYSTEM_PREFERRED_RNG) < 0)
        return {VaultError::protection,{}};
    constexpr char hex[] = "0123456789abcdef";
    std::string reference;
    for (const unsigned char byte : nonce) { reference.push_back(hex[byte >> 4]); reference.push_back(hex[byte & 15]); }
    const auto path = blob_path(directory_,reference);
    Handle file(CreateFileW(path.c_str(),GENERIC_WRITE | READ_CONTROL,0,&security.attributes,
        CREATE_NEW,FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_WRITE_THROUGH,nullptr));
    if (file.value == INVALID_HANDLE_VALUE) return {VaultError::storage,{}};
    if (!security.verify(file.value)) return {VaultError::unsafe_permissions,{}};
    DWORD written{};
    if (!WriteFile(file.value,kMagic.data(),static_cast<DWORD>(kMagic.size()),&written,nullptr) || written != kMagic.size()
        || !WriteFile(file.value,encrypted.pbData,encrypted.cbData,&written,nullptr) || written != encrypted.cbData
        || !FlushFileBuffers(file.value)) {
        // A failed write never publishes a reference; remove partial ciphertext.
        CloseHandle(file.value); file.value = INVALID_HANDLE_VALUE;
        (void)DeleteFileW(path.c_str());
        return {VaultError::storage,{}};
    }
    return {VaultError::none,std::move(reference)};
}

VaultError CredentialVault::erase(const std::string& credential_reference) {
    if (!reference_valid(credential_reference)) return VaultError::invalid_input;
    UserSecurity security;
    if (!security.initialize()) return VaultError::unsafe_permissions;
    Handle directory;
    const auto error = open_directory(directory_,security,directory);
    if (error != VaultError::none) return error;
    Handle file(CreateFileW(blob_path(directory_,credential_reference).c_str(),DELETE | READ_CONTROL | FILE_READ_ATTRIBUTES,
        0,nullptr,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT,nullptr));
    if (file.value == INVALID_HANDLE_VALUE) return VaultError::storage;
    FILE_ATTRIBUTE_TAG_INFO info{};
    if (!GetFileInformationByHandleEx(file.value,FileAttributeTagInfo,&info,sizeof(info))
        || (info.FileAttributes & (FILE_ATTRIBUTE_REPARSE_POINT | FILE_ATTRIBUTE_DIRECTORY))) return VaultError::unsafe_path;
    if (!security.verify(file.value)) return VaultError::unsafe_permissions;
    FILE_DISPOSITION_INFO disposition{TRUE};
    return SetFileInformationByHandle(file.value,FileDispositionInfo,&disposition,sizeof(disposition))
        ? VaultError::none : VaultError::storage;
}

} // namespace zterminal::execution
