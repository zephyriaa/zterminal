#include "native_account.h"
#include <bcrypt.h>
#include <wincrypt.h>
#include <wincred.h>
#include <winhttp.h>
#include <ws2tcpip.h>
#include <algorithm>
#include <array>
#include <chrono>
#include <cctype>
#include <map>
#include <sstream>
#include <vector>

namespace zterminal::native_account {
namespace {
std::string base64(const unsigned char* data,DWORD size) {
    DWORD n{};
    if(!CryptBinaryToStringA(data,size,CRYPT_STRING_BASE64|CRYPT_STRING_NOCRLF,nullptr,&n))throw std::runtime_error("Account encoding failed");
    std::string out(n,'\0');
    if(!CryptBinaryToStringA(data,size,CRYPT_STRING_BASE64|CRYPT_STRING_NOCRLF,out.data(),&n))throw std::runtime_error("Account encoding failed");
    out.resize(n);while(!out.empty()&&(out.back()=='\0'||out.back()=='='))out.pop_back();
    std::replace(out.begin(),out.end(),'+','-');std::replace(out.begin(),out.end(),'/','_');return out;
}
std::string encode(const std::string& s) {
    std::string out;constexpr char hex[]="0123456789ABCDEF";
    for(unsigned char c:s){if(std::isalnum(c)||c=='-'||c=='_'||c=='.'||c=='~')out+=c;else {out+='%';out+=hex[c>>4];out+=hex[c&15];}}return out;
}
bool opaque(const std::string& s) {return s.size()==43&&std::all_of(s.begin(),s.end(),[](unsigned char c){return (c<128&&std::isalnum(c))||c=='_'||c=='-';});}
bool equal(const std::string& a,const std::string& b) {if(a.size()!=b.size())return false;unsigned diff{};for(size_t i=0;i<a.size();++i)diff|=a[i]^b[i];return !diff;}
struct HttpHandle { HINTERNET value{};~HttpHandle(){if(value)WinHttpCloseHandle(value);} };
struct Socket { SOCKET value;~Socket(){if(value!=INVALID_SOCKET)closesocket(value);} };
std::wstring target(const std::wstring& root) {
    int n=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,root.data(),int(root.size()),nullptr,0,nullptr,nullptr);
    if(!n)throw std::runtime_error("Account storage identity unavailable");
    std::string bytes(n,'\0');WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,root.data(),int(root.size()),bytes.data(),n,nullptr,nullptr);
    auto hash=challenge(bytes);return L"ZTerminal/NativeAccount/"+std::wstring(hash.begin(),hash.end());
}
void network() {
    struct Runtime { Runtime(){WSADATA data{};if(WSAStartup(MAKEWORD(2,2),&data))throw std::runtime_error("Local sign-in callback unavailable");}~Runtime(){WSACleanup();} };
    static Runtime runtime;
}
}
std::string random_token() {
    std::array<unsigned char,32> bytes{};
    if(BCryptGenRandom(nullptr,bytes.data(),DWORD(bytes.size()),BCRYPT_USE_SYSTEM_PREFERRED_RNG)<0)throw std::runtime_error("Secure sign-in randomness unavailable");
    return base64(bytes.data(),DWORD(bytes.size()));
}
std::string challenge(const std::string& verifier) {
    BCRYPT_ALG_HANDLE algorithm{};BCRYPT_HASH_HANDLE hash{};std::array<unsigned char,32> digest{};
    if(BCryptOpenAlgorithmProvider(&algorithm,BCRYPT_SHA256_ALGORITHM,nullptr,0)<0)throw std::runtime_error("Secure account hashing unavailable");
    auto result=BCryptCreateHash(algorithm,&hash,nullptr,0,nullptr,0,0);
    if(result>=0)result=BCryptHashData(hash,reinterpret_cast<PUCHAR>(const_cast<char*>(verifier.data())),ULONG(verifier.size()),0);
    if(result>=0)result=BCryptFinishHash(hash,digest.data(),ULONG(digest.size()),0);
    if(hash)BCryptDestroyHash(hash);BCryptCloseAlgorithmProvider(algorithm,0);
    if(result<0)throw std::runtime_error("Secure account hashing unavailable");
    return base64(digest.data(),DWORD(digest.size()));
}
std::string callback_code(const std::string& request,const std::string& state,const std::string& host) {
    if(request.size()>8192||!request.ends_with("\r\n\r\n"))return {};
    auto end=request.find("\r\n");if(end==std::string::npos)return {};
    auto line=request.substr(0,end);const std::string prefix="GET /native/callback?";
    if(!line.starts_with(prefix)||!line.ends_with(" HTTP/1.1"))return {};
    std::map<std::string,std::string> headers;
    size_t pos=end+2;
    while((end=request.find("\r\n",pos))!=std::string::npos&&end!=pos) {
        auto field=request.substr(pos,end-pos);auto colon=field.find(':');if(colon==std::string::npos)return {};
        auto name=field.substr(0,colon),value=field.substr(colon+1);std::transform(name.begin(),name.end(),name.begin(),[](unsigned char c){return char(std::tolower(c));});
        while(!value.empty()&&value.front()==' ')value.erase(0,1);
        if(!headers.emplace(name,value).second)return {};pos=end+2;
    }
    if(headers["host"]!=host||headers.contains("origin")||headers.contains("transfer-encoding"))return {};
    auto query=line.substr(prefix.size(),line.size()-prefix.size()-9);std::map<std::string,std::string> values;
    std::istringstream pairs(query);std::string pair;
    while(std::getline(pairs,pair,'&')) {auto eq=pair.find('=');if(eq==std::string::npos||!values.emplace(pair.substr(0,eq),pair.substr(eq+1)).second)return {};}
    if(values.size()!=2||!equal(values["state"],state))return {};
    if(values.contains("code")&&opaque(values["code"]))return values["code"];
    if(values.contains("error")&&values["error"]=="access_denied")return "access_denied";
    return {};
}
std::string request(const wchar_t* method,const wchar_t* path,const std::string& body) {
    if(body.size()>4096)throw std::runtime_error("Account request exceeds limit");
    auto deadline=std::chrono::steady_clock::now()+std::chrono::seconds(20);
    HttpHandle session{WinHttpOpen(L"ZTerminal-Windows/1",WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,WINHTTP_NO_PROXY_NAME,WINHTTP_NO_PROXY_BYPASS,0)};
    if(!session.value)throw std::runtime_error("Account service unavailable; local work remains available");
    WinHttpSetTimeouts(session.value,5000,5000,5000,5000);
    HttpHandle connection{WinHttpConnect(session.value,origin_host,INTERNET_DEFAULT_HTTPS_PORT,0)};
    HttpHandle operation{connection.value?WinHttpOpenRequest(connection.value,method,path,nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,WINHTTP_FLAG_SECURE):nullptr};
    if(!operation.value)throw std::runtime_error("Account service unavailable; local work remains available");
    DWORD disabled=WINHTTP_DISABLE_COOKIES|WINHTTP_DISABLE_REDIRECTS;
    if(!WinHttpSetOption(operation.value,WINHTTP_OPTION_DISABLE_FEATURE,&disabled,sizeof(disabled)))throw std::runtime_error("Secure account transport unavailable");
    if(!WinHttpSendRequest(operation.value,L"Content-Type: application/json\r\nAccept: application/json\r\n",DWORD(-1L),body.empty()?WINHTTP_NO_REQUEST_DATA:const_cast<char*>(body.data()),DWORD(body.size()),DWORD(body.size()),0)||!WinHttpReceiveResponse(operation.value,nullptr))throw std::runtime_error("Account service unreachable. Retry or continue offline.");
    DWORD status{},size=sizeof(status);
    if(!WinHttpQueryHeaders(operation.value,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,WINHTTP_HEADER_NAME_BY_INDEX,&status,&size,WINHTTP_NO_HEADER_INDEX))throw std::runtime_error("Account response unavailable");
    if(status!=200)throw HttpError(status);
    std::string result;std::array<char,2048> buffer{};DWORD got{};
    do {if(std::chrono::steady_clock::now()>deadline)throw std::runtime_error("Account response timed out. Retry or continue offline.");if(!WinHttpReadData(operation.value,buffer.data(),DWORD(buffer.size()),&got))throw std::runtime_error("Account response interrupted");result.append(buffer.data(),got);if(result.size()>8192)throw std::runtime_error("Account response exceeds limit");}while(got);
    return result;
}
std::string credentials(const std::wstring& root) {
    PCREDENTIALW credential{};
    if(!CredReadW(target(root).c_str(),CRED_TYPE_GENERIC,0,&credential)) {if(GetLastError()==ERROR_NOT_FOUND)return {};throw std::runtime_error("Windows account storage unavailable");}
    std::string result(reinterpret_cast<char*>(credential->CredentialBlob),credential->CredentialBlobSize);CredFree(credential);return result;
}
void save_credentials(const std::wstring& root,const std::string& json) {
    if(json.empty()||json.size()>CRED_MAX_CREDENTIAL_BLOB_SIZE)throw std::runtime_error("Invalid protected account record");
    auto name=target(root);CREDENTIALW record{};record.Type=CRED_TYPE_GENERIC;record.TargetName=name.data();record.Persist=CRED_PERSIST_LOCAL_MACHINE;
    record.CredentialBlob=reinterpret_cast<LPBYTE>(const_cast<char*>(json.data()));record.CredentialBlobSize=DWORD(json.size());
    if(!CredWriteW(&record,0))throw std::runtime_error("Windows could not protect the account. Sign-in was not saved.");
}
void erase_credentials(const std::wstring& root) {
    if(!CredDeleteW(target(root).c_str(),CRED_TYPE_GENERIC,0)&&GetLastError()!=ERROR_NOT_FOUND)throw std::runtime_error("Windows could not remove the account record");
}
Flow::Flow():verifier(random_token()),state(random_token()) {
    network();Socket socket{::socket(AF_INET,SOCK_STREAM,IPPROTO_TCP)};
    if(socket.value==INVALID_SOCKET)throw std::runtime_error("Local callback unavailable");
    BOOL exclusive=TRUE;sockaddr_in address{};address.sin_family=AF_INET;address.sin_addr.s_addr=htonl(INADDR_LOOPBACK);
    if(setsockopt(socket.value,SOL_SOCKET,SO_EXCLUSIVEADDRUSE,reinterpret_cast<char*>(&exclusive),sizeof(exclusive))||bind(socket.value,reinterpret_cast<sockaddr*>(&address),sizeof(address))||listen(socket.value,4))throw std::runtime_error("Exclusive local callback unavailable");
    int size=sizeof(address);if(getsockname(socket.value,reinterpret_cast<sockaddr*>(&address),&size))throw std::runtime_error("Local callback address unavailable");
    host="127.0.0.1:"+std::to_string(ntohs(address.sin_port));redirect_uri="http://"+host+"/native/callback";listener=socket.value;socket.value=INVALID_SOCKET;
}
Flow::~Flow(){if(listener!=INVALID_SOCKET)closesocket(listener);SecureZeroMemory(verifier.data(),verifier.size());}
std::wstring Flow::authorization_url() const {
    auto value=std::string("https://zterminal.dpdns.org/api/native/auth/authorize?client_id=zterminal-windows&code_challenge_method=S256&code_challenge=")+challenge(verifier)+"&state="+state+"&redirect_uri="+encode(redirect_uri);
    return std::wstring(value.begin(),value.end());
}
std::string Flow::wait() {
    auto deadline=std::chrono::steady_clock::now()+std::chrono::minutes(3);unsigned attempts{};
    while(!cancelled&&std::chrono::steady_clock::now()<deadline) {
        fd_set readers;FD_ZERO(&readers);FD_SET(listener,&readers);timeval timeout{0,100000};auto ready=select(0,&readers,nullptr,nullptr,&timeout);
        if(ready==SOCKET_ERROR)throw std::runtime_error("Local callback interrupted");if(!ready)continue;
        Socket client{accept(listener,nullptr,nullptr)};if(client.value==INVALID_SOCKET)continue;
        if(++attempts>32)throw std::runtime_error("Too many invalid callbacks. Start sign-in again.");
        DWORD milliseconds=500;setsockopt(client.value,SOL_SOCKET,SO_RCVTIMEO,reinterpret_cast<char*>(&milliseconds),sizeof(milliseconds));
        std::string message;std::array<char,1024> buffer{};
        auto clientDeadline=std::chrono::steady_clock::now()+std::chrono::seconds(2);
        while(message.size()<8192&&!message.ends_with("\r\n\r\n")&&!cancelled&&std::chrono::steady_clock::now()<clientDeadline) {auto n=recv(client.value,buffer.data(),int(buffer.size()),0);if(n<=0)break;message.append(buffer.data(),n);}
        auto code=callback_code(message,state,host);const char* response=code.empty()?"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n":"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nCache-Control: no-store\r\nContent-Length: 41\r\nConnection: close\r\n\r\nReturn to ZTerminal to finish signing in.";
        send(client.value,response,int(strlen(response)),0);
        if(!code.empty()&&!cancelled){closesocket(listener);listener=INVALID_SOCKET;return code;}
    }
    throw std::runtime_error(cancelled?"Sign-in cancelled. Local work remains available.":"Sign-in timed out. Retry or continue offline.");
}
}
