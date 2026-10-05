#include "execution_vault.h"
#include <windows.h>
#include <aclapi.h>
#include <dpapi.h>
#include <sddl.h>

#include <algorithm>
#include <array>
#include <fstream>
#include <iostream>
#include <vector>

using namespace zterminal::execution;

namespace {
int failures{};
void check(bool passed,const char* label) {
    std::cout << (passed ? "PASS " : "FAIL ") << label << '\n';
    if (!passed) ++failures;
}
}

int main() {
    const auto root = CredentialVault::default_directory().parent_path()
        / (L"ZTerminalVaultTest-" + std::to_wstring(GetCurrentProcessId()));
    CredentialVault vault(root);
    check(vault.initialize() == VaultError::none,"owner-only vault creation");
    check(vault.initialize() == VaultError::none,"owner-only vault reopen");
    const std::string key = "synthetic-key-do-not-log";
    const std::string secret = "synthetic-secret-do-not-log";
    const auto bytes = [](const std::string& text) { return std::span(
        reinterpret_cast<const unsigned char*>(text.data()),text.size()); };
    const auto stored = vault.store(bytes(key),bytes(secret));
    check(stored.error == VaultError::none && stored.credential_reference.size() == 32,"opaque reference only");
    const auto file = root / (std::wstring(stored.credential_reference.begin(),stored.credential_reference.end()) + L".ztcred");
    std::ifstream input(file,std::ios::binary);
    std::vector<unsigned char> ciphertext((std::istreambuf_iterator<char>(input)),{});
    input.close();
    if (ciphertext.size() <= 8) {
        check(false,"DPAPI blob has a complete header and payload");
        return 1;
    }
    check(std::search(ciphertext.begin(),ciphertext.end(),key.begin(),key.end()) == ciphertext.end()
        && std::search(ciphertext.begin(),ciphertext.end(),secret.begin(),secret.end()) == ciphertext.end(),"no plaintext at rest");
    constexpr unsigned char entropy_bytes[] = "ZTerminal native MEXC vault v1";
    DATA_BLOB encrypted{static_cast<DWORD>(ciphertext.size() > 8 ? ciphertext.size()-8 : 0),ciphertext.data()+8};
    DATA_BLOB entropy{static_cast<DWORD>(sizeof(entropy_bytes)),const_cast<unsigned char*>(entropy_bytes)};
    DATA_BLOB decrypted{};
    const bool recovered = CryptUnprotectData(&encrypted,nullptr,&entropy,nullptr,nullptr,CRYPTPROTECT_UI_FORBIDDEN,&decrypted) != FALSE;
    check(recovered && decrypted.cbData == key.size()+secret.size()+8
        && std::equal(key.begin(),key.end(),decrypted.pbData+8),"same-user DPAPI round trip (test only)");
    if (decrypted.pbData) { SecureZeroMemory(decrypted.pbData,decrypted.cbData); LocalFree(decrypted.pbData); }
    if (!ciphertext.empty()) ciphertext.back() ^= 0xff;
    decrypted = {};
    check(!CryptUnprotectData(&encrypted,nullptr,&entropy,nullptr,nullptr,CRYPTPROTECT_UI_FORBIDDEN,&decrypted),"tampered ciphertext rejected");
    if (decrypted.pbData) { SecureZeroMemory(decrypted.pbData,decrypted.cbData); LocalFree(decrypted.pbData); }
    check(vault.erase("../../invalid") == VaultError::invalid_input,"path traversal reference rejected");
    check(vault.store({},bytes(secret)).error == VaultError::invalid_input,"empty credentials rejected");
    const auto replacement = vault.store(bytes(key),bytes(secret));
    check(replacement.error == VaultError::none && replacement.credential_reference != stored.credential_reference,"replacement allocates distinct reference");
    check(vault.erase(stored.credential_reference) == VaultError::none && !std::filesystem::exists(file),"delete by owned handle");
    check(vault.erase(replacement.credential_reference) == VaultError::none,"replacement cleanup");

    PSECURITY_DESCRIPTOR descriptor{};
    check(ConvertStringSecurityDescriptorToSecurityDescriptorW(L"D:P(A;;FA;;;WD)",SDDL_REVISION_1,&descriptor,nullptr) != FALSE,
        "permissive ACL fixture");
    PACL dacl{}; BOOL present{},defaulted{};
    if (descriptor && GetSecurityDescriptorDacl(descriptor,&present,&dacl,&defaulted)) {
        check(SetNamedSecurityInfoW(const_cast<wchar_t*>(root.c_str()),SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,nullptr,nullptr,dacl,nullptr) == ERROR_SUCCESS,"install permissive ACL fixture");
        check(vault.initialize() == VaultError::unsafe_permissions,"permissive vault rejected, never repaired silently");
        check(vault.store(bytes(key),bytes(secret)).error == VaultError::unsafe_permissions,"permissive vault cannot store secrets");
    }
    if (descriptor) LocalFree(descriptor);
    // Test-owned directory only, no recursion and no user vault touched.
    check(RemoveDirectoryW(root.c_str()) != FALSE,"test directory removed");
    return failures == 0 ? 0 : 1;
}
