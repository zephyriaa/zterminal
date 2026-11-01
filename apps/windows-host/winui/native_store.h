#pragma once
#include <winrt/Windows.Data.Json.h>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <cmath>
#include <stdexcept>
#include <shellapi.h>
#include <shobjidl.h>
namespace zterminal::native_store {
using winrt::Windows::Data::Json::JsonObject;
using winrt::Windows::Data::Json::JsonValue;
inline std::wstring executable_directory() {
    wchar_t path[32768]{}; auto n=GetModuleFileNameW(nullptr,path,32768); if(!n||n==32768)throw std::runtime_error("Executable path unavailable"); return std::filesystem::path(path).parent_path().wstring();
}
inline std::wstring storage_root() {
    int count{}; auto args=CommandLineToArgvW(GetCommandLineW(),&count); std::wstring root;
    if(args) { for(int i=1;i<count;++i) if(std::wstring_view(args[i])==L"--store-root" && i+1<count)root=args[++i]; LocalFree(args); }
    if(!root.empty())return root;
    wchar_t local[32768]{}; auto n=GetEnvironmentVariableW(L"LOCALAPPDATA",local,32768); if(!n||n>=32768)throw std::runtime_error("Local storage unavailable");
    return (std::filesystem::path(local)/L"ZTerminal"/L"native-workstation").wstring();
}
inline std::wstring guid() { GUID id{}; winrt::check_hresult(CoCreateGuid(&id)); wchar_t s[40]{}; StringFromGUID2(id,s,40); return s; }
inline std::wstring quote(const std::wstring& s) {
    std::wstring out=L"\""; unsigned slashes=0;
    for(auto c:s) { if(c==L'\\')++slashes; else { out.append(slashes*(c==L'"'?2:1),L'\\'); slashes=0; if(c==L'"')out+=L'\\'; out+=c; } } out.append(slashes*2,L'\\'); return out+L'"';
}
inline JsonObject call(const std::wstring& root,JsonObject const& request) {
    auto temp=std::filesystem::temp_directory_path()/(L"zt-native-"+guid()); std::filesystem::create_directory(temp);
    struct Cleanup { std::filesystem::path p; ~Cleanup(){std::error_code e; std::filesystem::remove(p/L"request.json",e); std::filesystem::remove(p/L"response.json",e); std::filesystem::remove(p,e);} } cleanup{temp};
    auto in=temp/L"request.json",out=temp/L"response.json"; auto encoded=winrt::to_string(request.Stringify());
    { std::ofstream f(in,std::ios::binary); f<<encoded; if(!f)throw std::runtime_error("Could not write native request"); }
    auto exe=std::filesystem::path(executable_directory())/L"zt-native-store.exe";
    std::wstring cmd=quote(exe.wstring())+L" "+quote(root)+L" "+quote(in.wstring())+L" "+quote(out.wstring());
    STARTUPINFOW startup{sizeof(startup)}; PROCESS_INFORMATION process{};
    if(!CreateProcessW(exe.c_str(),cmd.data(),nullptr,nullptr,FALSE,CREATE_NO_WINDOW,nullptr,exe.parent_path().c_str(),&startup,&process))throw std::runtime_error("Native storage adapter could not start");
    CloseHandle(process.hThread); auto waited=WaitForSingleObject(process.hProcess,30000); DWORD code{};
    if(waited!=WAIT_OBJECT_0) { TerminateProcess(process.hProcess,1); WaitForSingleObject(process.hProcess,5000); CloseHandle(process.hProcess); throw std::runtime_error("Storage completion unknown; reopen to verify before saving again"); }
    GetExitCodeProcess(process.hProcess,&code); CloseHandle(process.hProcess);
    if(code || !std::filesystem::is_regular_file(out) || std::filesystem::file_size(out)>32*1024*1024)throw std::runtime_error("Native storage adapter returned no valid response");
    std::ifstream f(out,std::ios::binary); std::ostringstream bytes; bytes<<f.rdbuf(); auto response=JsonObject::Parse(winrt::to_hstring(bytes.str()));
    if(!response.GetNamedBoolean(L"ok"))throw std::runtime_error(winrt::to_string(response.GetNamedString(L"error")));
    return response;
}
inline void text(JsonObject const& r,const wchar_t* key,winrt::param::hstring const& value) { r.Insert(key,JsonValue::CreateStringValue(value)); }
inline JsonObject save_strategy(const std::wstring& root, JsonObject const& request, const std::string& source) {
    auto temp=std::filesystem::temp_directory_path()/(L"zt-strategy-"+guid()); std::filesystem::create_directory(temp);
    struct Cleanup { std::filesystem::path p; ~Cleanup(){std::error_code e; std::filesystem::remove(p/L"source.py",e); std::filesystem::remove(p,e);} } cleanup{temp};
    auto path=temp/L"source.py";
    { std::ofstream file(path,std::ios::binary); file.write(source.data(),source.size()); if(!file)throw std::runtime_error("Could not capture strategy source"); }
    text(request,L"sourcePath",path.wstring());
    return call(root,request);
}
inline uint64_t unsigned_string(winrt::hstring const& text) {
    auto s=winrt::to_string(text); if(s.empty() || s.find_first_not_of("0123456789")!=std::string::npos)throw std::runtime_error("Invalid exact unsigned integer"); size_t used{}; auto n=std::stoull(s,&used); if(used!=s.size())throw std::runtime_error("Invalid integer"); return n;
}
inline int64_t signed_string(winrt::hstring const& text) {
    auto s=winrt::to_string(text); size_t used{}; auto n=std::stoll(s,&used); if(used!=s.size())throw std::runtime_error("Invalid integer"); return n;
}
inline uint64_t positive_integer(double value) {
    if(!std::isfinite(value)||value<1||value>9007199254740991.0||std::floor(value)!=value)throw std::runtime_error("Invalid positive integer"); return uint64_t(value);
}
inline uint64_t revision(JsonObject const& workspace) {
    return positive_integer(workspace.GetNamedObject(L"document").GetNamedNumber(L"revision"));
}
inline std::wstring pick_csv(HWND owner) {
    winrt::com_ptr<IFileOpenDialog> dialog; winrt::check_hresult(CoCreateInstance(CLSID_FileOpenDialog,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(dialog.put())));
    COMDLG_FILTERSPEC filter{L"CSV history (UTC epoch milliseconds)",L"*.csv"}; dialog->SetFileTypes(1,&filter); dialog->SetTitle(L"Import verified local history");
    auto result=dialog->Show(owner); if(result==HRESULT_FROM_WIN32(ERROR_CANCELLED))return {}; winrt::check_hresult(result);
    winrt::com_ptr<IShellItem> item; winrt::check_hresult(dialog->GetResult(item.put())); PWSTR path{}; winrt::check_hresult(item->GetDisplayName(SIGDN_FILESYSPATH,&path)); std::wstring selected=path; CoTaskMemFree(path); return selected;
}
}
