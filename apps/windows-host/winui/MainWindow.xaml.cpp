#include "pch.h"
#include "MainWindow.xaml.h"
#include "MainWindow.g.cpp"
#include "native_chart_host.h"
#include "native_store.h"
#include <microsoft.ui.xaml.window.h>
#include <microsoft.ui.xaml.media.dxinterop.h>
#include <algorithm>
#include <cmath>
#include <ctime>
namespace winrt::ZTerminal::implementation {
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;
namespace {
std::wstring utc(uint64_t ms) {
    std::time_t seconds=static_cast<std::time_t>(ms/1000); std::tm value{};
    if(gmtime_s(&value,&seconds))return L"UTC time unavailable";
    wchar_t formatted[32]{}; std::wcsftime(formatted,32,L"%Y-%m-%d %H:%M UTC",&value); return formatted;
}
std::wstring interval_name(uint64_t ms) {
    if(ms%86400000==0)return std::to_wstring(ms/86400000)+L"d";
    if(ms%3600000==0)return std::to_wstring(ms/3600000)+L"h";
    return std::to_wstring(ms/60000)+L"m";
}
}
MainWindow::MainWindow() {
    InitializeComponent();
    check_hresult(this->m_inner.as<::IWindowNative>()->get_WindowHandle(&owner));
    ExtendsContentIntoTitleBar(true); SetTitleBar(TitleArea());
    MONITORINFO monitor{sizeof(monitor)};
    if(GetMonitorInfoW(MonitorFromWindow(owner,MONITOR_DEFAULTTONEAREST),&monitor)) {
        auto scale=GetDpiForWindow(owner)/96.0;
        auto width=std::min(int(std::round(600*scale)),int(monitor.rcWork.right-monitor.rcWork.left)-32);
        auto height=std::min(int(std::round(650*scale)),int(monitor.rcWork.bottom-monitor.rcWork.top)-32);
        AppWindow().MoveAndResize({monitor.rcWork.left+(monitor.rcWork.right-monitor.rcWork.left-width)/2,monitor.rcWork.top+(monitor.rcWork.bottom-monitor.rcWork.top-height)/2,width,height});
    }
    Root().Loaded([this](auto&&, auto&&) { Startup(); });
    HomeButton().Click([this](auto&&,auto&&){Navigate(nullptr);});
    WorkspaceTabs().SelectionChanged([this](auto&&,auto&&){if(updatingTabs)return;auto tab=WorkspaceTabs().SelectedItem().try_as<TabViewItem>();if(!tab)return;auto id=unbox_value<hstring>(tab.Tag());if(id.empty())Navigate(nullptr);else {Windows::Data::Json::JsonObject r;zterminal::native_store::text(r,L"command",L"open");zterminal::native_store::text(r,L"id",id);Navigate(r);}});
    WorkspaceTabs().TabCloseRequested([this](auto&&,TabViewTabCloseRequestedEventArgs const& e){CloseTab(unbox_value<hstring>(e.Tab().Tag()).c_str());});
    HomeWorkspacesButton().Click([this](auto&&,auto&&){CreateWorkspace();});
    HomeSearchButton().Click([this](auto&&,auto&&){workspacePage=studyPage=0;RefreshHome();});
    HomeSort().SelectionChanged([this](auto&&,auto&&){if(route==L"home"){workspacePage=studyPage=0;RefreshHome();}});
    PreviousWorkspaces().Click([this](auto&&,auto&&){if(workspacePage)--workspacePage;RefreshHome();});
    NextWorkspaces().Click([this](auto&&,auto&&){++workspacePage;RefreshHome();});
    PreviousStudies().Click([this](auto&&,auto&&){if(studyPage)--studyPage;RefreshHome();});
    NextStudies().Click([this](auto&&,auto&&){++studyPage;RefreshHome();});
    NewStudyButton().Click([this](auto&&,auto&&){StudyEditor();});
    RecoverWorkspaceButton().Click([this](auto&&,auto&&){WorkspaceAction(nullptr,L"recover");});
    ContinueAccountButton().Click([this](auto&&,auto&&){RefreshAccount();});
    ContinueOfflineButton().Click([this](auto&&,auto&&){if(loginFlow)loginFlow->cancel();CompleteOnboarding();});
    ConnectAccountButton().Click([this](auto&&,auto&&){RefreshAccount();});
    CancelAccountButton().Click([this](auto&&,auto&&){if(loginFlow)loginFlow->cancel();CancelAccountButton().Visibility(Visibility::Collapsed);AccountStatus().Text(L"Cancelling account connection… Local work remains available.");});
    DisconnectAccountButton().Click([this](auto&&,auto&&){RefreshAccount(true);});
    Root().SizeChanged([this](auto&&, auto&&) { Layout(); });
    ChartSurface().SizeChanged([this](auto&&, auto&&) { ResizeChart(); });
    ChartSurface().CompositionScaleChanged([this](auto&&, auto&&) { ResizeChart(); });
    Preset().SelectionChanged([this](auto&&, auto&&) { Layout(); });
    SettingsButton().Click([this](auto&&, auto&&) { ShowSettings(); });
    WorkspacesButton().Click([this](auto&&,auto&&){Workspaces();});
    NewWorkspaceButton().Click([this](auto&&,auto&&){CreateWorkspace();});
    ImportButton().Click([this](auto&&,auto&&){ImportHistory();});
    ResearchButton().Click([this](auto&&,auto&&){EditStrategy();});
    EditStrategyButton().Click([this](auto&&,auto&&){EditStrategy();});
    DatasetsButton().Click([this](auto&&,auto&&){ShowDataset();});
    ChartsButton().Click([this](auto&&,auto&&){Preset().SelectedIndex(1);ChartFocus().Focus(FocusState::Programmatic);});
    AppWindow().Closing([this](auto&&,Microsoft::UI::Windowing::AppWindowClosingEventArgs const& args) {
        if(allowClose)return;
        if(strategyDialogOpen||busy||navigationPrompt) { args.Cancel(true); Status().Text(L"Finish the current operation or close the strategy editor before closing the workspace."); }
        else if(route==L"workspace"&&viewportDirty){args.Cancel(true);RequestClose();}
    });
    LoadButton().Click([this](auto&&,auto&&){ if(workspace&&!busy) { Windows::Data::Json::JsonObject r; zterminal::native_store::text(r,L"command",L"open"); zterminal::native_store::text(r,L"id",workspace.GetNamedObject(L"document").GetNamedString(L"id")); Perform(r); } });
    SaveButton().Click([this](auto&&,auto&&){ if(workspace&&!busy) { zterminal::native_chart::cancel_drag(); Windows::Data::Json::JsonObject r; auto d=workspace.GetNamedObject(L"document"); zterminal::native_store::text(r,L"command",L"save"); zterminal::native_store::text(r,L"id",d.GetNamedString(L"id")); zterminal::native_store::text(r,L"revision",to_hstring(zterminal::native_store::revision(workspace))); zterminal::native_store::text(r,L"name",d.GetNamedString(L"name")); if(zterminal::native_chart::available()) { auto range=zterminal::native_chart::semantic_viewport(); zterminal::native_store::text(r,L"from",to_hstring(range.first)); zterminal::native_store::text(r,L"to",to_hstring(range.second)); } Perform(r); } });
    FitButton().Click([this](auto&&,auto&&){ zterminal::native_chart::fit(); RequestRender(); });
    ChartFocus().IsTabStop(true);
    Root().KeyDown([this](auto&&,Input::KeyRoutedEventArgs const& e){
        if(busy||route!=L"workspace")return;
        auto source=e.OriginalSource().try_as<DependencyObject>();
        while(source) {
            if(source.try_as<TextBox>()||source.try_as<ComboBox>()||source.try_as<Button>()||source.try_as<ContentDialog>())return;
            source=Media::VisualTreeHelper::GetParent(source);
        }
        auto key=unsigned(e.Key()); if(key==VK_ESCAPE)zterminal::native_chart::cancel_drag();
        else if(key==VK_ADD||key==VK_OEM_PLUS)zterminal::native_chart::zoom(120);
        else if(key==VK_SUBTRACT||key==VK_OEM_MINUS)zterminal::native_chart::zoom(-120);
        else if(key=='F')zterminal::native_chart::fit();
        else if(key==VK_HOME||key==VK_END||key==VK_LEFT||key==VK_RIGHT||key==VK_PRIOR||key==VK_NEXT)zterminal::native_chart::navigate(key);
        else return;
        RequestRender(); e.Handled(true);
    });
    ChartFocus().LostFocus([this](auto&&,auto&&){zterminal::native_chart::cancel_drag(); RequestRender();});
    Activated([this](auto&&,WindowActivatedEventArgs const& e){ if(e.WindowActivationState()==WindowActivationState::Deactivated)zterminal::native_chart::cancel_drag(); else if(route==L"welcome"&&!busy&&!accountBusy)ContinueAccountButton().Focus(FocusState::Programmatic); RequestRender(); });
    ChartSurface().PointerMoved([this](auto&&, Input::PointerRoutedEventArgs const& e) {
        auto p=e.GetCurrentPoint(ChartSurface()).Position();
        zterminal::native_chart::pointer_move(static_cast<int>(p.X*ChartSurface().CompositionScaleX()),static_cast<int>(p.Y*ChartSurface().CompositionScaleY()));
        RequestRender();
    });
    ChartSurface().PointerPressed([this](auto&&, Input::PointerRoutedEventArgs const& e) {
        if(e.GetCurrentPoint(ChartSurface()).Properties().IsLeftButtonPressed()) {
            auto p=e.GetCurrentPoint(ChartSurface()).Position(); ChartFocus().Focus(FocusState::Pointer);
            auto x=static_cast<int>(p.X*ChartSurface().CompositionScaleX()),y=static_cast<int>(p.Y*ChartSurface().CompositionScaleY());
            zterminal::native_chart::pointer_move(x,y);
            if(zterminal::native_chart::begin_drag(x)) {
                if(!ChartSurface().CapturePointer(e.Pointer()))zterminal::native_chart::cancel_drag();
                e.Handled(true);
            }
            RequestRender();
        }
    });
    ChartSurface().PointerReleased([this](auto&&, Input::PointerRoutedEventArgs const& e) { zterminal::native_chart::end_drag(); ChartSurface().ReleasePointerCapture(e.Pointer()); RequestRender(); });
    ChartSurface().PointerCaptureLost([this](auto&&,auto&&) { zterminal::native_chart::cancel_drag(); RequestRender(); });
    ChartSurface().PointerExited([this](auto&&,auto&&) { zterminal::native_chart::pointer_leave(); RequestRender(); });
    ChartSurface().PointerWheelChanged([this](auto&&,Input::PointerRoutedEventArgs const& e) { auto point=e.GetCurrentPoint(ChartSurface()); auto p=point.Position(); zterminal::native_chart::pointer_move(int(p.X*ChartSurface().CompositionScaleX()),int(p.Y*ChartSurface().CompositionScaleY())); zterminal::native_chart::zoom(point.Properties().MouseWheelDelta()); RequestRender(); e.Handled(true); });
    ChartArea().DoubleTapped([this](auto&&,auto&&){zterminal::native_chart::fit(); RequestRender();});
    Closed([this](auto&&, auto&&) { closing=true; if(loginFlow)loginFlow->cancel(); if(accountExpiry)accountExpiry.Stop(); if(timer)timer.Stop(); zterminal::native_chart::shutdown(); });
}
void MainWindow::StartChart() {
    if(chartReady||closing)return;
    auto panel=ChartSurface().as<::ISwapChainPanelNative>();
    chartReady=zterminal::native_chart::initialize(owner,[panel](IDXGISwapChain* swap) { return panel->SetSwapChain(swap); },GetCommandLineW());
    ChartAvailability().Text(zterminal::native_chart::availability_text());
    ChartEmpty().Visibility(zterminal::native_chart::available()?Visibility::Collapsed:Visibility::Visible);
    Status().Text(chartReady?L"Local · "+zterminal::native_chart::availability_text():L"Chart unavailable · "+zterminal::native_chart::diagnostic());
    ResizeChart();
    timer=DispatcherQueue().CreateTimer(); timer.Interval(std::chrono::milliseconds(16));
    timer.IsRepeating(false);
    timer.Tick([this](auto&&,auto&&) { if(chartReady&&!closing&&route==L"workspace"&&zterminal::native_chart::needs_render()) { zterminal::native_chart::render(); Automation::AutomationProperties::SetHelpText(ChartArea(),zterminal::native_chart::readout()); } });
    RequestRender();
}
void MainWindow::ResizeChart() {
    if(!chartReady||closing)return;
    auto surface=ChartSurface();
    zterminal::native_chart::set_scale(surface.CompositionScaleX());
    auto width=static_cast<unsigned>(std::max(1.0,std::round(surface.ActualWidth()*surface.CompositionScaleX())));
    auto height=static_cast<unsigned>(std::max(1.0,std::round(surface.ActualHeight()*surface.CompositionScaleY())));
    if(!zterminal::native_chart::resize(width,height))Status().Text(L"Chart resize failed · "+zterminal::native_chart::diagnostic());
    RequestRender();
}
void MainWindow::RequestRender() {
    if(route==L"workspace"&&workspace&&!busy&&zterminal::native_chart::available()) {
        auto view=zterminal::native_chart::semantic_viewport();
        if(view!=savedView) { if(!viewportDirty||view!=reportedView)Status().Text(L"Local · Imported history · Unsaved chart view"); viewportDirty=true; reportedView=view; }
        else if(viewportDirty) { viewportDirty=false; Status().Text(L"Local · Saved chart view restored"); }
    }
    if(timer&&chartReady&&!closing&&zterminal::native_chart::needs_render()&&!timer.IsRunning())timer.Start();
}
void MainWindow::UpdateState() {
    HomeSearch().IsEnabled(!busy);HomeSort().IsEnabled(!busy);HomeSearchButton().IsEnabled(!busy);HomeWorkspacesButton().IsEnabled(!busy);NewStudyButton().IsEnabled(!busy);RecoverWorkspaceButton().IsEnabled(!busy);WorkspaceTabs().IsEnabled(!busy);
    NewWorkspaceButton().IsEnabled(!busy); WorkspacesButton().IsEnabled(!busy); ImportButton().IsEnabled(!busy&&bool(workspace)); LoadButton().IsEnabled(!busy&&bool(workspace)); SaveButton().IsEnabled(!busy&&bool(workspace));
    ChartFocus().IsEnabled(!busy);
    ChartEmpty().Visibility(zterminal::native_chart::available()?Visibility::Collapsed:Visibility::Visible);
    ChartAvailability().Text(zterminal::native_chart::availability_text());
    ResearchButton().IsEnabled(!busy&&bool(workspace)); EditStrategyButton().IsEnabled(!busy&&bool(workspace));
    DatasetsButton().IsEnabled(!busy&&bool(workspace)); FitButton().IsEnabled(!busy&&zterminal::native_chart::available());
    WorkspaceLabel().Text(workspace?workspace.GetNamedObject(L"document").GetNamedString(L"name"):L"Local research workspace");
    InstrumentLabel().Text(L"No instrument selected");
    DatasetContext().Text(L"No historical dataset selected. Import a local CSV to start inspection."); DatasetIdentity().Text(L"");
    StrategySummary().Text(L"No saved strategy");
    StrategyPreview().Text(L""); StrategyPreview().Visibility(Visibility::Collapsed);
    if(workspace) {
        auto data=workspace.GetNamedValue(L"dataset");
        if(data.ValueType()==Windows::Data::Json::JsonValueType::Object) {
            auto d=data.GetObject(); auto interval=uint64_t(d.GetNamedNumber(L"intervalMs")); auto count=uint64_t(d.GetNamedNumber(L"count")); auto start=uint64_t(d.GetNamedNumber(L"fromMs"));
            InstrumentLabel().Text(d.GetNamedString(L"symbol")+L" · "+interval_name(interval)+L" · Imported history");
            auto exact=d.GetNamedObject(L"exactUnits",nullptr);
            auto price=exact?exact.GetNamedString(L"priceStep"):to_hstring(d.GetNamedNumber(L"tickSize"));
            auto quantity=exact?exact.GetNamedString(L"quantityStep"):to_hstring(d.GetNamedNumber(L"quantityStep"));
            DatasetContext().Text(to_hstring(count)+L" closed bars · CSV / spot\n"+utc(start)+L" → "+utc(start+count*interval)+L" (exclusive)\nPrice step "+price+L" · Quantity step "+quantity+L"\nStructure and stored integrity verified. Exchange origin unverified. No live connection.");
            DatasetIdentity().Text(L"Source: "+d.GetNamedString(L"sourceName")+L"\nSource SHA-256: "+d.GetNamedObject(L"source").GetNamedString(L"sha256")+L"\nDataset SHA-256: "+d.GetNamedObject(L"segment").GetNamedString(L"sha256"));
        }
        auto strategy=workspace.GetNamedObject(L"strategy",nullptr);
        if(strategy) {
            auto document=strategy.GetNamedObject(L"document");
            StrategySummary().Text(L"Saved strategy · revision "+to_hstring(uint64_t(document.GetNamedNumber(L"revision"))));
            Automation::AutomationProperties::SetHelpText(StrategySummary(),L"Source SHA-256: "+document.GetNamedObject(L"source").GetNamedString(L"sha256"));
            StrategyPreview().Text(strategy.GetNamedString(L"source")); StrategyPreview().Visibility(Visibility::Visible);
        }
    }
    RequestRender();
}
winrt::fire_and_forget MainWindow::ShowDataset() {
    if(busy||strategyDialogOpen||!workspace)co_return; auto lifetime=get_strong();
    ContentDialog dialog; dialog.XamlRoot(Root().XamlRoot()); dialog.Title(box_value(L"Selected dataset")); dialog.CloseButtonText(L"Done");
    StackPanel body; body.Spacing(12); TextBlock context,identity;
    context.Text(DatasetContext().Text()); context.TextWrapping(TextWrapping::Wrap);
    identity.Text(DatasetIdentity().Text()); identity.TextWrapping(TextWrapping::Wrap); identity.IsTextSelectionEnabled(true);
    body.Children().Append(context);body.Children().Append(identity); ScrollViewer scroll;scroll.Content(body);dialog.Content(scroll);
    co_await dialog.ShowAsync();
}
winrt::fire_and_forget MainWindow::EditStrategy() {
    if(busy||strategyDialogOpen||!workspace)co_return; auto lifetime=get_strong(); strategyDialogOpen=true;
    try {
        ContentDialog dialog; dialog.XamlRoot(Root().XamlRoot()); dialog.Title(box_value(L"Workspace strategy"));
        dialog.PrimaryButtonText(L"Save strategy"); dialog.SecondaryButtonText(L"Discard edits"); dialog.CloseButtonText(L"Close");
        TextBox source,parameters; TextBlock message; StackPanel body; body.Spacing(12);
        source.Header(box_value(L"Python source")); source.AcceptsReturn(true); source.TextWrapping(TextWrapping::NoWrap); source.Height(260); source.MaxLength(256000);
        source.FontFamily(Media::FontFamily(L"Assets/GeistMono.ttf#Geist Mono")); source.FontSize(13);
        Automation::AutomationProperties::SetName(source,L"Python source");
        parameters.Header(box_value(L"Parameters (JSON object)")); parameters.AcceptsReturn(true);parameters.Height(80);parameters.MaxLength(16384);
        Automation::AutomationProperties::SetName(parameters,L"Strategy parameters");
        std::string originalSource; auto strategy=workspace.GetNamedObject(L"strategy",nullptr);
        if(strategy) { originalSource=to_string(strategy.GetNamedString(L"source")); source.Text(strategy.GetNamedString(L"source")); parameters.Text(strategy.GetNamedObject(L"parameters").Stringify()); }
        else parameters.Text(L"{}");
        auto initialSource=source.Text(),initialParameters=parameters.Text();
        message.Text(L"Saved locally with this workspace. Source is not executed. Native backtesting is not connected yet.");message.TextWrapping(TextWrapping::Wrap);
        body.Children().Append(source);body.Children().Append(parameters);body.Children().Append(message);
        ScrollViewer scroll;scroll.Content(body);scroll.MaxHeight(std::max(140.0,Root().ActualHeight()-200.0));dialog.Content(scroll);
        dialog.Closing([this,source,parameters,message,initialSource,initialParameters](auto&&,ContentDialogClosingEventArgs const& args) {
            if(busy) { args.Cancel(true); return; }
            if(args.Result()==ContentDialogResult::None&&(source.Text()!=initialSource||parameters.Text()!=initialParameters)) {
                args.Cancel(true);message.Text(L"Unsaved edits. Save the strategy or choose Discard edits to close.");
            }
        });
        dialog.PrimaryButtonClick([this,dialog,source,parameters,message,originalSource,initialSource](auto&&,ContentDialogButtonClickEventArgs const& args) {
            SaveStrategy(dialog,args,source,parameters,message,originalSource,initialSource);
        });
        co_await dialog.ShowAsync();
    } catch(hresult_error const& e) { Status().Text(L"Strategy editor unavailable · "+e.message()); }
    strategyDialogOpen=false;UpdateState();
}
winrt::fire_and_forget MainWindow::SaveStrategy(ContentDialog dialog,ContentDialogButtonClickEventArgs args,TextBox source,TextBox parameters,TextBlock message,std::string originalSource,hstring initialSource) {
    auto lifetime=get_strong(); auto deferral=args.GetDeferral(); apartment_context ui; Windows::Data::Json::JsonObject response{nullptr}; std::wstring failure;
    busy=true;source.IsEnabled(false);parameters.IsEnabled(false);dialog.IsSecondaryButtonEnabled(false);dialog.IsPrimaryButtonEnabled(false);UpdateState();message.Text(L"Saving strategy locally…");
    try {
        Windows::Data::Json::JsonObject request;zterminal::native_store::text(request,L"command",L"save_strategy");
        zterminal::native_store::text(request,L"id",workspace.GetNamedObject(L"document").GetNamedString(L"id"));
        zterminal::native_store::text(request,L"revision",to_hstring(zterminal::native_store::revision(workspace)));
        request.Insert(L"parameters",Windows::Data::Json::JsonObject::Parse(parameters.Text()));
        // Preserve original source bytes when only parameters changed; TextBox may normalize newlines.
        auto captured=source.Text()==initialSource?originalSource:to_string(source.Text()); auto root=storeRoot;
        co_await resume_background();response=zterminal::native_store::save_strategy(root,request,captured);
    } catch(hresult_error const& e) { failure=e.message(); } catch(std::exception const& e) { failure=to_hstring(e.what()); }
    co_await ui;
    try {
        if(!failure.empty())throw std::runtime_error(to_string(failure));
        auto saved=response.GetNamedObject(L"value");
        if(saved.GetNamedObject(L"document").GetNamedString(L"id")!=workspace.GetNamedObject(L"document").GetNamedString(L"id"))throw std::runtime_error("Strategy workspace mismatch");
        workspace=saved;Status().Text(L"Strategy saved locally · workspace revision "+to_hstring(zterminal::native_store::revision(saved)));
    } catch(hresult_error const& e) { args.Cancel(true);message.Text(L"Save failed · "+e.message()); } catch(std::exception const& e) { args.Cancel(true);message.Text(L"Save failed · "+to_hstring(e.what())); }
    busy=false;source.IsEnabled(true);parameters.IsEnabled(true);dialog.IsPrimaryButtonEnabled(true);dialog.IsSecondaryButtonEnabled(true);UpdateState();deferral.Complete();
}
Windows::Foundation::IAsyncAction MainWindow::Perform(Windows::Data::Json::JsonObject request) {
    if(busy||closing)co_return; auto lifetime=get_strong(); apartment_context ui; busy=true; UpdateState(); Status().Text(L"Working locally…");
    auto command=request.GetNamedString(L"command"); auto root=storeRoot;
    Windows::Data::Json::JsonObject response{nullptr},sceneResponse{nullptr},navigation{nullptr},presentationResponse{nullptr}; std::wstring failure;
    try {
        co_await resume_background(); response=zterminal::native_store::call(root,request);
        Windows::Data::Json::JsonObject navRequest;zterminal::native_store::text(navRequest,L"command",L"navigation");navigation=zterminal::native_store::call(root,navRequest).GetNamedObject(L"value");
        auto value=response.GetNamedValue(L"value");
        if(value.ValueType()==Windows::Data::Json::JsonValueType::Object) {
            auto w=value.GetObject(); auto d=w.GetNamedValue(L"dataset");
            Windows::Data::Json::JsonObject appearanceRequest;zterminal::native_store::text(appearanceRequest,L"command",L"presentation");zterminal::native_store::text(appearanceRequest,L"id",w.GetNamedObject(L"document").GetNamedString(L"id"));zterminal::native_store::text(appearanceRequest,L"revision",to_hstring(zterminal::native_store::revision(w)));presentationResponse=zterminal::native_store::call(root,appearanceRequest).GetNamedObject(L"value");
            if(d.ValueType()==Windows::Data::Json::JsonValueType::Object) {
                Windows::Data::Json::JsonObject sceneRequest;
                zterminal::native_store::text(sceneRequest,L"command",L"scene"); zterminal::native_store::text(sceneRequest,L"id",w.GetNamedObject(L"document").GetNamedString(L"id")); zterminal::native_store::text(sceneRequest,L"revision",to_hstring(zterminal::native_store::revision(w)));
                sceneResponse=zterminal::native_store::call(root,sceneRequest);
            }
        }
    } catch(hresult_error const& e) { failure=e.message(); } catch(std::exception const& e) { failure=to_hstring(e.what()); }
    co_await ui; if(closing)co_return;
    try {
        if(!failure.empty())throw std::runtime_error(to_string(failure));
        auto value=response.GetNamedValue(L"value");
        if(value.ValueType()==Windows::Data::Json::JsonValueType::Null) {
            workspace=nullptr; Status().Text(L"Local · Create or open a workspace");
        } else {
            auto w=value.GetObject();
            Route(L"workspace"); StartChart();
            presentation=presentationResponse.GetNamedObject(L"current");defaultPresentation=presentationResponse.GetNamedObject(L"defaults");ApplyPresentation(presentation);
            if(sceneResponse) {
                auto json=sceneResponse.GetNamedObject(L"value"); zterminal::chart::Scene s{};
                if(json.GetNamedNumber(L"version")!=2)throw std::runtime_error("Unsupported native scene version");
                s.version=unsigned(json.GetNamedNumber(L"version")); s.instrument=to_string(json.GetNamedString(L"instrument")); s.hash=to_string(json.GetNamedString(L"datasetHash")); s.price_step=to_string(json.GetNamedString(L"priceStep")); s.quantity_step=to_string(json.GetNamedString(L"quantityStep"));
                s.revision=zterminal::native_store::unsigned_string(json.GetNamedString(L"revision")); s.interval_ns=zterminal::native_store::unsigned_string(json.GetNamedString(L"intervalNs")); s.available_through_ns=zterminal::native_store::unsigned_string(json.GetNamedString(L"availableThroughNs"));
                s.workspace_id=to_string(json.GetNamedString(L"workspaceId")); s.chart_id=to_string(json.GetNamedString(L"chartId")); s.source_hash=to_string(json.GetNamedString(L"sourceHash")); s.availability=to_string(json.GetNamedString(L"availability")); s.dataset_revision=zterminal::native_store::unsigned_string(json.GetNamedString(L"datasetRevision"));
                if(json.GetNamedString(L"workspaceId")!=w.GetNamedObject(L"document").GetNamedString(L"id") || json.GetNamedString(L"chartId")!=w.GetNamedObject(L"chart").GetNamedString(L"id") || json.GetNamedString(L"sourceHash")!=w.GetNamedObject(L"dataset").GetNamedObject(L"source").GetNamedString(L"sha256") || json.GetNamedString(L"availability")!=L"verified imported history")throw std::runtime_error("Scene identity or availability mismatch");
                for(auto v:json.GetNamedArray(L"bars")) { auto b=v.GetObject(); s.bars.push_back({zterminal::native_store::unsigned_string(b.GetNamedString(L"timeNs")),zterminal::native_store::signed_string(b.GetNamedString(L"open")),zterminal::native_store::signed_string(b.GetNamedString(L"high")),zterminal::native_store::signed_string(b.GetNamedString(L"low")),zterminal::native_store::signed_string(b.GetNamedString(L"close")),zterminal::native_store::signed_string(b.GetNamedString(L"volume"))}); }
                auto dataset=w.GetNamedObject(L"dataset"); auto expected=to_string(L"csv:"+dataset.GetNamedString(L"symbol")+L":spot");
                auto interval=zterminal::chart::ms_to_ns(zterminal::native_store::positive_integer(dataset.GetNamedNumber(L"intervalMs")));
                auto exact=dataset.GetNamedObject(L"exactUnits",nullptr);
                if(!interval||s.interval_ns!=*interval||(exact&&(s.price_step!=to_string(exact.GetNamedString(L"priceStep"))||s.quantity_step!=to_string(exact.GetNamedString(L"quantityStep")))))throw std::runtime_error("Scene units or interval mismatch");
                auto datasetRevision=zterminal::native_store::positive_integer(w.GetNamedObject(L"chart").GetNamedObject(L"dataset").GetNamedNumber(L"revision"));
                if(!zterminal::native_chart::select_verified_scene(s,zterminal::native_store::revision(w),expected,to_string(dataset.GetNamedObject(L"segment").GetNamedString(L"sha256")),datasetRevision))throw std::runtime_error("Invalid or stale native scene rejected");
                auto chart=w.GetNamedObject(L"chart"); auto from=chart.GetNamedValue(L"visibleFromMs"),to=chart.GetNamedValue(L"visibleToMs");
                if(from.ValueType()==Windows::Data::Json::JsonValueType::Number && to.ValueType()==Windows::Data::Json::JsonValueType::Number && !zterminal::native_chart::restore_viewport(int64_t(from.GetNumber()),int64_t(to.GetNumber())))throw std::runtime_error("Saved viewport is outside available history");
            } else { zterminal::local_scene::Result empty; zterminal::native_chart::select_scene({},empty); }
            workspace=w;
            UpdateTabs(navigation);
            savedView=zterminal::native_chart::semantic_viewport(); reportedView=savedView; viewportDirty=false;
            Status().Text((command==L"save"?L"Saved locally · revision ":L"Opened locally · revision ")+to_hstring(zterminal::native_store::revision(w))+L" · "+zterminal::native_chart::availability_text());
        }
    } catch(hresult_error const& e) { failure=e.message(); if(command==L"open"||command==L"restore") { zterminal::local_scene::Result empty; zterminal::native_chart::select_scene({},empty); } Status().Text(L"Failed · "+e.message()); } catch(std::exception const& e) { failure=to_hstring(e.what()); if(command==L"open"||command==L"restore") { zterminal::local_scene::Result empty; zterminal::native_chart::select_scene({},empty); } Status().Text(L"Failed · "+to_hstring(e.what())); }
    if(!failure.empty()&&response&&response.GetNamedValue(L"value").ValueType()==Windows::Data::Json::JsonValueType::Object) {
        workspace=response.GetNamedObject(L"value");presentation=nullptr;defaultPresentation=nullptr;zterminal::local_scene::Result empty;zterminal::native_chart::select_scene({},empty);viewportDirty=false;Route(L"workspace");if(navigation)UpdateTabs(navigation);Status().Text(L"Local record retained · chart unavailable · "+failure);
    }
    busy=false; UpdateState();
    if(route==L"home"&&std::wstring(Status().Text()).starts_with(L"Failed ·"))HomeMessage().Text(Status().Text());
}
winrt::fire_and_forget MainWindow::CreateWorkspace() {
    if(busy)co_return; auto lifetime=get_strong();if(!co_await SaveBeforeNavigate())co_return; ContentDialog dialog; dialog.XamlRoot(Root().XamlRoot()); dialog.Title(box_value(L"New local workspace")); dialog.PrimaryButtonText(L"Create"); dialog.CloseButtonText(L"Cancel");
    TextBox name; name.Header(box_value(L"Workspace name")); name.Text(L"Local research"); name.MaxLength(256); dialog.Content(name);
    if(co_await dialog.ShowAsync()!=ContentDialogResult::Primary)co_return;
    Windows::Data::Json::JsonObject r; zterminal::native_store::text(r,L"command",L"create"); auto id=zterminal::native_store::guid(); id=id.substr(1,id.size()-2); zterminal::native_store::text(r,L"id",id); zterminal::native_store::text(r,L"name",name.Text()); Perform(r);
}
winrt::fire_and_forget MainWindow::Workspaces() {
    if(busy)co_return; auto lifetime=get_strong(); apartment_context ui; busy=true; UpdateState(); Windows::Data::Json::JsonObject response{nullptr}; std::wstring error;
    try { Windows::Data::Json::JsonObject r; zterminal::native_store::text(r,L"command",L"list"); auto root=storeRoot; co_await resume_background(); response=zterminal::native_store::call(root,r); } catch(std::exception const& e) { error=to_hstring(e.what()); } catch(hresult_error const& e){error=e.message();}
    co_await ui; busy=false; UpdateState(); if(closing)co_return;
    if(!error.empty()){Status().Text(L"Failed · "+error);co_return;}
    auto list=response.GetNamedArray(L"value"); if(!list.Size()){CreateWorkspace();co_return;}
    ContentDialog dialog; dialog.XamlRoot(Root().XamlRoot()); dialog.Title(box_value(L"Open local workspace")); dialog.PrimaryButtonText(L"Open"); dialog.CloseButtonText(L"Cancel"); ComboBox choice; for(auto v:list)choice.Items().Append(box_value(v.GetObject().GetNamedString(L"name"))); choice.SelectedIndex(0); dialog.Content(choice);
    if(co_await dialog.ShowAsync()!=ContentDialogResult::Primary)co_return;
    Windows::Data::Json::JsonObject r; zterminal::native_store::text(r,L"command",L"open"); zterminal::native_store::text(r,L"id",list.GetAt(unsigned(choice.SelectedIndex())).GetObject().GetNamedString(L"id")); Navigate(r);
}
winrt::fire_and_forget MainWindow::ImportHistory() {
    if(busy||!workspace)co_return; auto lifetime=get_strong();
    ContentDialog dialog; dialog.XamlRoot(Root().XamlRoot()); dialog.Title(box_value(L"Import local CSV history")); dialog.PrimaryButtonText(L"Verify and import"); dialog.CloseButtonText(L"Cancel"); StackPanel content; content.Spacing(8);
    TextBlock help; help.Text(L"Strict t,o,h,l,c,v rows. UTC epoch milliseconds, completed contiguous bars. Exact positive decimal increments; volume may be zero."); help.TextWrapping(TextWrapping::Wrap); content.Children().Append(help);
    TextBox source; source.Header(box_value(L"CSV file path")); source.PlaceholderText(L"Paste a local path or browse"); content.Children().Append(source);
    Button browse; browse.Content(box_value(L"Browse CSV…")); browse.Click([this,source](auto&&,auto&&){try { auto selected=zterminal::native_store::pick_csv(owner); if(!selected.empty())source.Text(selected); }catch(hresult_error const& e){Status().Text(L"Browse failed · "+e.message());}});content.Children().Append(browse);
    TextBox symbol,price,quantity; symbol.Header(box_value(L"Instrument (CSV / spot)")); symbol.PlaceholderText(L"Declared instrument symbol"); symbol.MaxLength(80); price.Header(box_value(L"Price increment")); price.Text(L"0.25"); price.MaxLength(20); quantity.Header(box_value(L"Quantity increment")); quantity.Text(L"1"); quantity.MaxLength(20); content.Children().Append(symbol);content.Children().Append(price);content.Children().Append(quantity);
    ComboBox interval; interval.Header(box_value(L"Bar interval")); for(auto value:{L"1 minute",L"5 minutes",L"15 minutes",L"30 minutes",L"1 hour",L"4 hours",L"1 day"})interval.Items().Append(box_value(value)); interval.SelectedIndex(0); content.Children().Append(interval); dialog.Content(content);
    if(co_await dialog.ShowAsync()!=ContentDialogResult::Primary)co_return;
    uint64_t intervals[]={60000,300000,900000,1800000,3600000,14400000,86400000};
    Windows::Data::Json::JsonObject r; zterminal::native_store::text(r,L"command",L"import"); zterminal::native_store::text(r,L"id",workspace.GetNamedObject(L"document").GetNamedString(L"id")); zterminal::native_store::text(r,L"revision",to_hstring(zterminal::native_store::revision(workspace))); zterminal::native_store::text(r,L"path",source.Text()); zterminal::native_store::text(r,L"symbol",symbol.Text()); zterminal::native_store::text(r,L"priceStep",price.Text()); zterminal::native_store::text(r,L"quantityStep",quantity.Text()); zterminal::native_store::text(r,L"intervalMs",to_hstring(intervals[interval.SelectedIndex()])); Perform(r);
}
void MainWindow::Layout() {
    WelcomeContent().Width(std::max(1.0,std::min(440.0,Root().ActualWidth()-64.0)));
    bool compact=Root().ActualWidth()<1100;
    NavColumn().Width(GridLength{48.0,GridUnitType::Pixel});
    NavigationBody().Padding(Thickness{4,12,4,12});
    bool context=!compact&&Preset().SelectedIndex()!=1;
    ContextColumn().Width(GridLength{context?std::min(420.0,(Root().ActualWidth()-48.0)*.30):0.0,GridUnitType::Pixel});
    ContextArea().Visibility(context?Visibility::Visible:Visibility::Collapsed);
}
}
