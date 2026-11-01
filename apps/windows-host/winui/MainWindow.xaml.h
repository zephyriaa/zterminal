#pragma once
#include "MainWindow.g.h"
#include <winrt/Windows.Data.Json.h>
#include "native_account.h"
#include <map>
namespace winrt::ZTerminal::implementation {
struct MainWindow : MainWindowT<MainWindow> {
    MainWindow();
private:
    void Route(const std::wstring& name);
    winrt::fire_and_forget RefreshHome();
    winrt::fire_and_forget WorkspaceAction(winrt::Windows::Data::Json::JsonObject record,std::wstring action);
    winrt::fire_and_forget StudyEditor(std::wstring id=L"");
    uint64_t workspacePage{}, studyPage{};
    bool updatingTabs{};
    bool navigationPrompt{}, allowClose{};
    winrt::Windows::Data::Json::JsonObject currentNavigation{nullptr};
    std::map<std::wstring,winrt::Windows::Data::Json::JsonObject> homePreviews;
    winrt::fire_and_forget RequestClose();
    void UpdateTabs(winrt::Windows::Data::Json::JsonObject navigation);
    winrt::Windows::Foundation::IAsyncOperation<bool> SaveBeforeNavigate();
    winrt::fire_and_forget Navigate(winrt::Windows::Data::Json::JsonObject request);
    winrt::fire_and_forget CloseTab(std::wstring id);
    winrt::fire_and_forget Startup();
    winrt::fire_and_forget CompleteOnboarding();
    winrt::fire_and_forget ConnectAccount();
    winrt::fire_and_forget RefreshAccount(bool signOut=false,bool interactive=true);
    std::shared_ptr<zterminal::native_account::Flow> loginFlow;
    std::wstring route;
    bool accountBusy{};
    Microsoft::UI::Dispatching::DispatcherQueueTimer accountExpiry{nullptr};
    void StartChart();
    void ResizeChart();
    void Layout();
    winrt::fire_and_forget ShowSettings();
    winrt::fire_and_forget Workspaces();
    winrt::fire_and_forget CreateWorkspace();
    winrt::fire_and_forget ImportHistory();
    winrt::fire_and_forget EditStrategy();
    winrt::fire_and_forget ShowDataset();
    winrt::fire_and_forget SaveStrategy(
        Microsoft::UI::Xaml::Controls::ContentDialog dialog,
        Microsoft::UI::Xaml::Controls::ContentDialogButtonClickEventArgs args,
        Microsoft::UI::Xaml::Controls::TextBox source,
        Microsoft::UI::Xaml::Controls::TextBox parameters,
        Microsoft::UI::Xaml::Controls::TextBlock message,
        std::string originalSource, winrt::hstring initialSource);
    winrt::Windows::Foundation::IAsyncAction Perform(winrt::Windows::Data::Json::JsonObject request);
    void RequestRender();
    void UpdateState();
    winrt::Windows::Data::Json::JsonObject workspace{nullptr};
    winrt::Windows::Data::Json::JsonObject presentation{nullptr},defaultPresentation{nullptr};
    void ApplyPresentation(winrt::Windows::Data::Json::JsonObject value);
    std::wstring storeRoot;
    bool busy{};
    bool viewportDirty{};
    bool strategyDialogOpen{};
    std::pair<int64_t,int64_t> savedView{};
    std::pair<int64_t,int64_t> reportedView{};
    HWND owner{};
    bool chartReady{}, closing{};
    Microsoft::UI::Dispatching::DispatcherQueueTimer timer{nullptr};
};
}
namespace winrt::ZTerminal::factory_implementation {
struct MainWindow : MainWindowT<MainWindow, implementation::MainWindow> {};
}
