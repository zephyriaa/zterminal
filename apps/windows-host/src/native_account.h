#pragma once
#include <winsock2.h>
#include <windows.h>
#include <atomic>
#include <memory>
#include <stdexcept>
#include <string>

namespace zterminal::native_account {
inline constexpr wchar_t origin_host[]=L"zterminal.dpdns.org";
struct HttpError : std::runtime_error { unsigned status; explicit HttpError(unsigned code):std::runtime_error("Account service did not verify this request"),status(code){} };
std::string random_token();
std::string challenge(const std::string& verifier);
std::string callback_code(const std::string& request,const std::string& state,const std::string& host);
std::string request(const wchar_t* method,const wchar_t* path,const std::string& body={});
std::string credentials(const std::wstring& root);
void save_credentials(const std::wstring& root,const std::string& json);
void erase_credentials(const std::wstring& root);

// One temporary, exclusive IPv4 loopback listener; no registered URI handler.
class Flow {
public:
    Flow();
    ~Flow();
    Flow(const Flow&)=delete;
    Flow& operator=(const Flow&)=delete;
    std::string verifier,state,redirect_uri;
    std::wstring authorization_url() const;
    std::string wait();
    void cancel(){cancelled=true;}
    bool is_cancelled() const{return cancelled;}
private:
    SOCKET listener{INVALID_SOCKET};
    std::atomic<bool> cancelled{};
    std::string host;
};
}
