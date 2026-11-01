#include "pch.h"
#include "MainWindow.xaml.h"
#include "native_store.h"
#include "native_chart_host.h"
#include <algorithm>
#include <ctime>
#include <iomanip>

namespace winrt::ZTerminal::implementation {
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;
using Windows::Data::Json::JsonObject;
using Windows::Data::Json::JsonValue;
namespace {
JsonObject account_record(const std::string& bytes) {
    auto value=JsonObject::Parse(to_hstring(bytes));auto user=value.GetNamedObject(L"user");
    auto valid=[](hstring const& token){auto s=to_string(token);return s.size()==43&&s.find_first_not_of("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")==std::string::npos;};
    if(value.GetNamedString(L"token_type")!=L"Bearer"||value.GetNamedString(L"scope")!=L"native:identity"||!valid(value.GetNamedString(L"access_token"))||!valid(value.GetNamedString(L"refresh_token"))||user.GetNamedString(L"id").empty()||user.GetNamedString(L"id").size()>100||value.GetNamedString(L"session_id").size()>100)throw std::runtime_error("The account response could not be verified");
    return value;
}
std::chrono::seconds remaining(JsonObject const& value) {
    auto text=to_string(value.GetNamedString(L"access_expires_at"));std::tm date{};std::istringstream stream(text);stream>>std::get_time(&date,"%Y-%m-%dT%H:%M:%S");
    if(stream.fail()||!text.ends_with("Z"))throw std::runtime_error("Invalid account expiry");
    auto seconds=_mkgmtime64(&date)-std::time(nullptr);
    if(seconds<=0||seconds>600)throw std::runtime_error("Account verification expired. Check the PC clock and sign in again.");
    return std::chrono::seconds(seconds);
}
}
void MainWindow::Route(const std::wstring& name) {
    route=name;
    StartupView().Visibility(name==L"startup"?Visibility::Visible:Visibility::Collapsed);
    WelcomeView().Visibility(name==L"welcome"?Visibility::Visible:Visibility::Collapsed);
    HomeView().Visibility(name==L"home"?Visibility::Visible:Visibility::Collapsed);
    WorkspaceGrid().Visibility(name==L"workspace"?Visibility::Visible:Visibility::Collapsed);
    WorkspaceCaption().Visibility(Visibility::Collapsed);
    TabCaption().Visibility(name==L"home"||name==L"workspace"?Visibility::Visible:Visibility::Collapsed);
    WorkspaceStatusBar().Visibility(name==L"workspace"?Visibility::Visible:Visibility::Collapsed);
    Root().Background(Application::Current().Resources().Lookup(box_value(L"WorkspaceBrush")).as<Media::Brush>());
    if(name==L"startup")SetTitleBar(StartupTitle());else if(name==L"welcome")SetTitleBar(WelcomeTitle());else SetTitleBar(TabDrag());
    if(name!=L"workspace") {zterminal::native_chart::cancel_drag();if(timer)timer.Stop();}
    auto presenter=AppWindow().Presenter().try_as<Microsoft::UI::Windowing::OverlappedPresenter>();
    if(presenter)presenter.IsMaximizable(name!=L"welcome");
    if(name==L"welcome"||name==L"home") {
        MONITORINFO monitor{sizeof(monitor)};
        if(GetMonitorInfoW(MonitorFromWindow(owner,MONITOR_DEFAULTTONEAREST),&monitor)) {
            auto scale=GetDpiForWindow(owner)/96.0;bool welcome=name==L"welcome";
            auto w=std::min(int((welcome?600:1440)*scale),int(monitor.rcWork.right-monitor.rcWork.left)-32);
            auto h=std::min(int((welcome?650:900)*scale),int(monitor.rcWork.bottom-monitor.rcWork.top)-32);
            AppWindow().MoveAndResize({monitor.rcWork.left+(monitor.rcWork.right-monitor.rcWork.left-w)/2,monitor.rcWork.top+(monitor.rcWork.bottom-monitor.rcWork.top-h)/2,w,h});
        }
    }
    if(name==L"home"){HomeWorkspacesButton().Focus(FocusState::Programmatic);RefreshHome();}
    else if(name==L"welcome")ContinueAccountButton().Focus(FocusState::Programmatic);
    Layout();
}
winrt::fire_and_forget MainWindow::Startup() {
    auto lifetime=get_strong();apartment_context ui;Route(L"startup");busy=true;
    ContinueAccountButton().IsEnabled(false);ContinueOfflineButton().IsEnabled(false);WelcomeStatus().Text(L"Opening local preferences…");
    bool completed{};std::wstring failure;
    try {storeRoot=zterminal::native_store::storage_root();auto root=storeRoot;co_await resume_background();JsonObject request;zterminal::native_store::text(request,L"command",L"startup");completed=zterminal::native_store::call(root,request).GetNamedObject(L"value").GetNamedBoolean(L"onboardingComplete");}
    catch(std::exception const& e){failure=to_hstring(e.what());}catch(hresult_error const&){failure=L"Local preferences could not be read. Your work has not been removed.";}
    co_await ui;if(closing)co_return;busy=false;ContinueAccountButton().IsEnabled(true);ContinueOfflineButton().IsEnabled(true);WelcomeStatus().Text(failure);
    Route(completed?L"home":L"welcome");
    if(completed)RefreshAccount(false,false);
}
winrt::fire_and_forget MainWindow::CompleteOnboarding() {
    if(busy||closing)co_return;auto lifetime=get_strong();apartment_context ui;busy=true;
    ContinueOfflineButton().IsEnabled(false);ContinueAccountButton().IsEnabled(false);std::wstring failure;
    try {auto root=storeRoot;co_await resume_background();JsonObject request;zterminal::native_store::text(request,L"command",L"complete_onboarding");zterminal::native_store::call(root,request);}
    catch(std::exception const& e){failure=to_hstring(e.what());}catch(hresult_error const&){failure=L"Could not save first-open preferences. Your existing work is retained.";}
    co_await ui;if(closing)co_return;busy=false;ContinueOfflineButton().IsEnabled(true);ContinueAccountButton().IsEnabled(true);
    if(failure.empty())Route(L"home");else WelcomeStatus().Text(failure);
}
winrt::fire_and_forget MainWindow::ConnectAccount() {
    if(loginFlow||accountBusy||busy||closing)co_return;
    auto lifetime=get_strong();apartment_context ui;std::shared_ptr<zterminal::native_account::Flow> attempt;
    try {attempt=std::make_shared<zterminal::native_account::Flow>();}catch(std::exception const&){WelcomeStatus().Text(L"Secure local sign-in could not start. Retry or continue offline.");AccountStatus().Text(L"Secure local sign-in could not start. Local work remains available.");co_return;}
    loginFlow=attempt;accountBusy=true;CancelAccountButton().Visibility(Visibility::Visible);
    ContinueAccountButton().IsEnabled(false);ConnectAccountButton().IsEnabled(false);WelcomeStatus().Text(L"Checking account connection…");AccountStatus().Text(L"Checking account connection…");
    std::wstring failure;JsonObject result{nullptr};std::chrono::seconds expires{};
    try {
        co_await resume_background();
        auto capability=JsonObject::Parse(to_hstring(zterminal::native_account::request(L"GET",L"/api/native/auth")));
        if(!capability.GetNamedBoolean(L"enabled")||capability.GetNamedNumber(L"protocol")!=1)throw std::runtime_error("Native account connection is not available on this service yet. Continue offline or retry later.");
        co_await ui;if(closing||attempt->is_cancelled()) {accountBusy=false;loginFlow.reset();if(!closing){ContinueAccountButton().IsEnabled(true);ConnectAccountButton().IsEnabled(true);CancelAccountButton().Visibility(Visibility::Collapsed);AccountStatus().Text(L"Account connection cancelled. Local work remains available.");}co_return;}
        auto url=attempt->authorization_url();
        if(INT_PTR(ShellExecuteW(owner,L"open",url.c_str(),nullptr,nullptr,SW_SHOWNORMAL))<=32)throw std::runtime_error("The system browser could not open. Retry or continue offline.");
        WelcomeStatus().Text(L"Approve this Windows device in your browser. You can continue offline to cancel.");AccountStatus().Text(L"Approve this Windows device in your browser.");
        co_await resume_background();auto code=attempt->wait();
        if(code=="access_denied")throw std::runtime_error("Account connection cancelled. Retry or continue offline.");
        JsonObject request;zterminal::native_store::text(request,L"grant_type",L"authorization_code");zterminal::native_store::text(request,L"client_id",L"zterminal-windows");zterminal::native_store::text(request,L"code",to_hstring(code));zterminal::native_store::text(request,L"code_verifier",to_hstring(attempt->verifier));zterminal::native_store::text(request,L"redirect_uri",to_hstring(attempt->redirect_uri));
        result=account_record(zterminal::native_account::request(L"POST",L"/api/native/auth/token",to_string(request.Stringify())));expires=remaining(result);
    } catch(zterminal::native_account::HttpError const&){failure=L"Native account connection is unavailable or was not approved. Retry or continue offline.";}
      catch(std::exception const& e){failure=to_hstring(e.what());}catch(hresult_error const&){failure=L"The account response could not be verified. Retry or continue offline.";}
    co_await ui;
    bool abandoned=closing||attempt->is_cancelled();
    if(!abandoned&&failure.empty()) {try {zterminal::native_account::save_credentials(storeRoot,to_string(result.Stringify()));}catch(std::exception const&){failure=L"Windows could not protect the account. Sign-in was not completed.";}}
    if(result&&(abandoned||!failure.empty())) {
        auto root=storeRoot;result.Insert(L"pending_revoke",JsonValue::CreateBooleanValue(true));
        try {zterminal::native_account::save_credentials(root,to_string(result.Stringify()));}catch(...){}
        co_await resume_background();
        try {JsonObject revoke;revoke.Insert(L"refresh_token",result.GetNamedValue(L"refresh_token"));zterminal::native_account::request(L"POST",L"/api/native/auth/revoke",to_string(revoke.Stringify()));zterminal::native_account::erase_credentials(root);}catch(...){}
        co_await ui;
    }
    if(abandoned||closing) {accountBusy=false;loginFlow.reset();if(!closing){ContinueAccountButton().IsEnabled(true);ConnectAccountButton().IsEnabled(true);CancelAccountButton().Visibility(Visibility::Collapsed);AccountStatus().Text(L"Account connection cancelled. Local work remains available.");}co_return;}
    accountBusy=false;loginFlow.reset();CancelAccountButton().Visibility(Visibility::Collapsed);ContinueAccountButton().IsEnabled(true);ConnectAccountButton().IsEnabled(true);
    if(!failure.empty()){WelcomeStatus().Text(failure);AccountStatus().Text(failure);co_return;}
    auto name=result.GetNamedObject(L"user").GetNamedString(L"name",L"ZTerminal account");AccountStatus().Text(L"Connected as "+name+L" · local work stays on this PC");DisconnectAccountButton().Visibility(Visibility::Visible);ConnectAccountButton().Content(box_value(L"Refresh account"));
    if(accountExpiry)accountExpiry.Stop();accountExpiry=DispatcherQueue().CreateTimer();accountExpiry.Interval(expires);accountExpiry.IsRepeating(false);accountExpiry.Tick([this](auto&&,auto&&){AccountStatus().Text(L"Account verification expired · reconnect when ready. Local work remains available.");});accountExpiry.Start();
    if(route==L"welcome")CompleteOnboarding();
}
winrt::fire_and_forget MainWindow::RefreshAccount(bool signOut,bool interactive) {
    if(accountBusy||loginFlow||closing)co_return;auto lifetime=get_strong();apartment_context ui;accountBusy=true;
    ConnectAccountButton().IsEnabled(false);ContinueAccountButton().IsEnabled(false);DisconnectAccountButton().IsEnabled(false);WelcomeStatus().Text(L"Checking account connection…");if(accountExpiry)accountExpiry.Stop();
    std::wstring message;bool connected{},startSignIn{};JsonObject result{nullptr};std::chrono::seconds expires{};
    try {
        auto root=storeRoot;co_await resume_background();auto bytes=zterminal::native_account::credentials(root);
        if(bytes.empty()) {startSignIn=!signOut&&interactive;message=L"Local mode · no account connected";}
        else {
            auto stored=account_record(bytes);bool pending=stored.GetNamedBoolean(L"pending_revoke",false);
            JsonObject request;request.Insert(L"refresh_token",stored.GetNamedValue(L"refresh_token"));
            if(signOut||pending) {
                stored.Insert(L"pending_revoke",JsonValue::CreateBooleanValue(true));zterminal::native_account::save_credentials(root,to_string(stored.Stringify()));
                zterminal::native_account::request(L"POST",L"/api/native/auth/revoke",to_string(request.Stringify()));zterminal::native_account::erase_credentials(root);
                message=L"Signed out · local work is retained";startSignIn=!signOut&&interactive;
            } else {
                zterminal::native_store::text(request,L"grant_type",L"refresh_token");zterminal::native_store::text(request,L"client_id",L"zterminal-windows");
                result=account_record(zterminal::native_account::request(L"POST",L"/api/native/auth/token",to_string(request.Stringify())));expires=remaining(result);
                zterminal::native_account::save_credentials(root,to_string(result.Stringify()));connected=true;
            }
        }
    } catch(zterminal::native_account::HttpError const& e) {
        if(e.status==400||e.status==401) {try{zterminal::native_account::erase_credentials(storeRoot);}catch(...){}message=L"Account session expired or was removed. Sign in again; local work is available.";}
        else message=signOut?L"Sign-out is pending server revocation. Local work is retained; reconnect to finish.":L"Account verification is unavailable. Retry when connected; local work is available.";
    } catch(std::exception const&){message=signOut?L"Sign-out is pending. Retry when connected; local work is retained.":L"Account storage or connection is unavailable. Retry; local work is retained.";}
      catch(hresult_error const&){message=L"Saved account data could not be verified. Local work is retained.";}
    co_await ui;if(closing)co_return;accountBusy=false;ConnectAccountButton().IsEnabled(true);ContinueAccountButton().IsEnabled(true);DisconnectAccountButton().IsEnabled(true);
    if(connected) {
        AccountStatus().Text(L"Connected as "+result.GetNamedObject(L"user").GetNamedString(L"name",L"ZTerminal account")+L" · local work stays on this PC");ConnectAccountButton().Content(box_value(L"Refresh account"));DisconnectAccountButton().Visibility(Visibility::Visible);
        accountExpiry=DispatcherQueue().CreateTimer();accountExpiry.Interval(expires);accountExpiry.IsRepeating(false);accountExpiry.Tick([this](auto&&,auto&&){AccountStatus().Text(L"Account verification expired · reconnect when ready. Local work remains available.");});accountExpiry.Start();
    } else {WelcomeStatus().Text(message);AccountStatus().Text(message);ConnectAccountButton().Content(box_value(L"Connect account"));DisconnectAccountButton().Visibility(Visibility::Collapsed);}
    if(connected&&route==L"welcome")CompleteOnboarding();
    if(startSignIn&&(route==L"home"||route==L"welcome"))ConnectAccount();
}
}
