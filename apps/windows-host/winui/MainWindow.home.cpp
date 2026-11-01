#include "pch.h"
#include "MainWindow.xaml.h"
#include "native_store.h"
#include <ctime>
#include <winrt/Windows.UI.Text.h>
#include <winrt/Microsoft.UI.Xaml.Shapes.h>
#include "native_chart_host.h"
namespace winrt::ZTerminal::implementation {
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;
using Windows::Data::Json::JsonObject;
using Windows::Data::Json::JsonValue;
namespace {
std::wstring modified(JsonObject const& record) {
    auto value=record.GetNamedValue(L"updatedAtMs");
    if(value.ValueType()==Windows::Data::Json::JsonValueType::Null)return L"Modification time unavailable";
    std::time_t time=static_cast<std::time_t>(value.GetNumber()/1000);std::tm date{};wchar_t text[64]{};
    if(localtime_s(&date,&time))return L"Modification time unavailable";
    std::wcsftime(text,64,L"Modified %Y-%m-%d %H:%M",&date);return text;
}
}
void MainWindow::UpdateTabs(JsonObject navigation) {
    currentNavigation=navigation;updatingTabs=true;WorkspaceTabs().TabItems().Clear();
    TabViewItem home;home.Header(box_value(L"Home"));home.Tag(box_value(L""));home.IsClosable(false);WorkspaceTabs().TabItems().Append(home);
    auto selected=home;
    for(auto v:navigation.GetNamedArray(L"tabs")) {
        auto id=v.GetString();hstring title=id;
        for(auto w:navigation.GetNamedArray(L"workspaces")){auto record=w.GetObject();if(record.GetNamedString(L"id")==id){title=record.GetNamedString(L"name");break;}}
        TabViewItem tab;tab.Header(box_value(title));tab.Tag(box_value(id));tab.IsClosable(true);Automation::AutomationProperties::SetName(tab,title);WorkspaceTabs().TabItems().Append(tab);
        if(route==L"workspace"&&workspace&&workspace.GetNamedObject(L"document").GetNamedString(L"id")==id)selected=tab;
    }
    WorkspaceTabs().SelectedItem(selected);updatingTabs=false;
}
Windows::Foundation::IAsyncOperation<bool> MainWindow::SaveBeforeNavigate() {
    if(busy||strategyDialogOpen||navigationPrompt)co_return false;
    if(route!=L"workspace"||!workspace||!viewportDirty)co_return true;
    navigationPrompt=true;auto lifetime=get_strong();ContentDialog dialog;dialog.XamlRoot(Root().XamlRoot());dialog.Title(box_value(L"Save this workspace's chart view?"));dialog.PrimaryButtonText(L"Save view");dialog.SecondaryButtonText(L"Discard view changes");dialog.CloseButtonText(L"Cancel");
    TextBlock text;text.Text(L"The visible range has changed. Saved history and study source are retained.");text.TextWrapping(TextWrapping::Wrap);dialog.Content(text);
    auto result=co_await dialog.ShowAsync();navigationPrompt=false;
    if(result==ContentDialogResult::None)co_return false;
    if(result==ContentDialogResult::Secondary){viewportDirty=false;co_return true;}
    JsonObject r;auto document=workspace.GetNamedObject(L"document");zterminal::native_chart::cancel_drag();auto view=zterminal::native_chart::semantic_viewport();
    zterminal::native_store::text(r,L"command",L"save");zterminal::native_store::text(r,L"id",document.GetNamedString(L"id"));zterminal::native_store::text(r,L"revision",to_hstring(zterminal::native_store::revision(workspace)));zterminal::native_store::text(r,L"name",document.GetNamedString(L"name"));zterminal::native_store::text(r,L"from",to_hstring(view.first));zterminal::native_store::text(r,L"to",to_hstring(view.second));
    co_await Perform(r);co_return !viewportDirty;
}
winrt::fire_and_forget MainWindow::Navigate(JsonObject request) {
    auto lifetime=get_strong();if(!co_await SaveBeforeNavigate()){if(currentNavigation)UpdateTabs(currentNavigation);co_return;}
    if(request)co_await Perform(request);else Route(L"home");
    if(currentNavigation)UpdateTabs(currentNavigation);
}
winrt::fire_and_forget MainWindow::RequestClose() {
    auto lifetime=get_strong();if(co_await SaveBeforeNavigate()){allowClose=true;Close();}
}
winrt::fire_and_forget MainWindow::CloseTab(std::wstring id) {
    if(busy||strategyDialogOpen||navigationPrompt)co_return;auto lifetime=get_strong();
    bool active=route==L"workspace"&&workspace&&workspace.GetNamedObject(L"document").GetNamedString(L"id")==id;
    if(active&&!co_await SaveBeforeNavigate())co_return;
    apartment_context ui;auto root=storeRoot;busy=true;std::wstring failure;JsonObject nav{nullptr};
    try{JsonObject r;zterminal::native_store::text(r,L"command",L"close_tab");zterminal::native_store::text(r,L"id",id);co_await resume_background();zterminal::native_store::call(root,r);JsonObject n;zterminal::native_store::text(n,L"command",L"navigation");nav=zterminal::native_store::call(root,n).GetNamedObject(L"value");}catch(std::exception const& e){failure=to_hstring(e.what());}catch(hresult_error const& e){failure=e.message();}
    co_await ui;busy=false;if(closing)co_return;if(!failure.empty()){Status().Text(L"Tab could not close · "+failure);co_return;}
    if(active)Route(L"home");UpdateTabs(nav);
}
winrt::fire_and_forget MainWindow::RefreshHome() {
    if(busy||closing||route!=L"home")co_return;auto lifetime=get_strong();apartment_context ui;busy=true;
    HomeMessage().Text(L"Loading local library…");UpdateState();
    JsonObject workspaces{nullptr},studies{nullptr},navigation{nullptr};std::wstring failure;
    auto root=storeRoot;auto search=HomeSearch().Text();auto recent=HomeSort().SelectedIndex()==0;auto wp=workspacePage,sp=studyPage;
    auto previews=homePreviews;
    try {
        co_await resume_background();
        auto read=[&](const wchar_t* kind,uint64_t page){JsonObject r;zterminal::native_store::text(r,L"command",L"catalog");zterminal::native_store::text(r,L"kind",kind);zterminal::native_store::text(r,L"search",search);zterminal::native_store::text(r,L"page",to_hstring(page));r.Insert(L"recent",JsonValue::CreateBooleanValue(recent));return zterminal::native_store::call(root,r).GetNamedObject(L"value");};
        workspaces=read(L"workspace",wp);studies=read(L"study",sp);
        JsonObject nav;zterminal::native_store::text(nav,L"command",L"navigation");navigation=zterminal::native_store::call(root,nav).GetNamedObject(L"value");
        Windows::Data::Json::JsonArray missing;
        for(auto result:{workspaces,studies})for(auto v:result.GetNamedArray(L"items")){auto record=v.GetObject();auto key=std::wstring(record.GetNamedString(L"kind"))+L":"+std::wstring(record.GetNamedString(L"id"))+L":"+to_hstring(uint64_t(record.GetNamedNumber(L"revision"))).c_str();if(!previews.contains(key))missing.Append(record);}
        if(missing.Size()){JsonObject r;zterminal::native_store::text(r,L"command",L"catalog_previews");r.Insert(L"records",missing);auto values=zterminal::native_store::call(root,r).GetNamedArray(L"value");for(auto v:values){auto item=v.GetObject();previews[item.GetNamedString(L"key").c_str()]=item.GetNamedObject(L"preview");}}
    }catch(std::exception const& e){failure=to_hstring(e.what());}catch(hresult_error const& e){failure=e.message();}
    co_await ui;busy=false;if(closing)co_return;UpdateState();
    WorkspaceCards().Items().Clear();StudyCards().Items().Clear();
    if(!failure.empty()){HomeMessage().Text(L"Local library could not be read · "+failure);co_return;}
    homePreviews.clear();for(auto result:{workspaces,studies})for(auto v:result.GetNamedArray(L"items")){auto record=v.GetObject();auto key=std::wstring(record.GetNamedString(L"kind"))+L":"+std::wstring(record.GetNamedString(L"id"))+L":"+to_hstring(uint64_t(record.GetNamedNumber(L"revision"))).c_str();auto found=previews.find(key);if(found!=previews.end())homePreviews.emplace(key,found->second);}
    UpdateTabs(navigation);
    auto populate=[this](GridView grid,JsonObject result,bool study){
        for(auto v:result.GetNamedArray(L"items")) {
            auto record=v.GetObject();StackPanel body;body.Width(284);body.Spacing(10);body.Padding({14,14,14,14});
            TextBlock title;title.Text(record.GetNamedString(L"name"));title.FontSize(15);title.FontWeight(Windows::UI::Text::FontWeights::SemiBold());title.TextTrimming(TextTrimming::CharacterEllipsis);body.Children().Append(title);
            TextBlock detail;detail.Text(study?record.GetNamedString(L"kind"):L"Saved research workspace");detail.Opacity(.65);body.Children().Append(detail);
            auto key=std::wstring(record.GetNamedString(L"kind"))+L":"+std::wstring(record.GetNamedString(L"id"))+L":"+to_hstring(uint64_t(record.GetNamedNumber(L"revision"))).c_str();auto found=homePreviews.find(key);
            if(found!=homePreviews.end()){auto preview=found->second;
                if(preview.GetNamedString(L"kind")==L"chart"){
                    Canvas canvas;canvas.Width(256);canvas.Height(68);Shapes::Polyline line;line.Stroke(Media::SolidColorBrush(Windows::UI::Color{255,161,124,220}));line.StrokeThickness(1.5);Media::PointCollection points;
                    auto bars=preview.GetNamedArray(L"bars");double low=DBL_MAX,high=-DBL_MAX;for(auto b:bars){auto close=b.GetObject().GetNamedNumber(L"c");low=std::min(low,close);high=std::max(high,close);}for(uint32_t i=0;i<bars.Size();++i){auto close=bars.GetAt(i).GetObject().GetNamedNumber(L"c");points.Append({float(i*256.0/std::max(1u,bars.Size()-1)),float(high==low?34:64-(close-low)*60/(high-low))});}line.Points(points);canvas.Children().Append(line);Automation::AutomationProperties::SetName(canvas,L"Saved imported history for "+preview.GetNamedString(L"symbol"));body.Children().Append(canvas);
                }else{TextBlock snippet;snippet.Text(preview.GetNamedString(L"text"));snippet.Height(68);snippet.MaxLines(5);snippet.TextWrapping(TextWrapping::Wrap);snippet.FontSize(11);snippet.Opacity(.65);body.Children().Append(snippet);}
            }
            TextBlock time;time.Text(modified(record));time.FontSize(12);time.Opacity(.65);body.Children().Append(time);
            TextBlock local;local.Text(L"Local · revision "+to_hstring(uint64_t(record.GetNamedNumber(L"revision"))));local.FontSize(12);body.Children().Append(local);
            StackPanel actions;actions.Orientation(Orientation::Horizontal);actions.Spacing(8);
            Button open;open.Content(box_value(study?L"Edit source":L"Open workspace"));Automation::AutomationProperties::SetName(open,(study?L"Edit study ":L"Open workspace ")+record.GetNamedString(L"name"));
            open.Click([this,record,study](auto&&,auto&&){if(busy)return;if(study)StudyEditor(record.GetNamedString(L"id").c_str());else{JsonObject r;zterminal::native_store::text(r,L"command",L"open");zterminal::native_store::text(r,L"id",record.GetNamedString(L"id"));Navigate(r);}});actions.Children().Append(open);
            {Button menu;menu.Content(box_value(L"⋯"));Automation::AutomationProperties::SetName(menu,L"Actions for "+record.GetNamedString(L"name"));MenuFlyout flyout;
                for(auto action:{L"rename",L"duplicate",L"delete"}){MenuFlyoutItem item;item.Text(action);item.Click([this,record,action](auto&&,auto&&){WorkspaceAction(record,action);});flyout.Items().Append(item);}menu.Flyout(flyout);actions.Children().Append(menu);}
            body.Children().Append(actions);Border card;card.BorderThickness({1,1,1,1});card.CornerRadius({8,8,8,8});card.BorderBrush(Application::Current().Resources().Lookup(box_value(L"BorderBrush")).try_as<Media::Brush>());card.Background(Application::Current().Resources().Lookup(box_value(L"PanelBrush")).as<Media::Brush>());card.Child(body);grid.Items().Append(card);
        }
    };
    populate(WorkspaceCards(),workspaces,false);populate(StudyCards(),studies,true);
    auto wc=uint64_t(workspaces.GetNamedNumber(L"total")),sc=uint64_t(studies.GetNamedNumber(L"total"));
    WorkspacePage().Text(to_hstring(wc)+L" workspaces · page "+to_hstring(wp+1));StudyPage().Text(to_hstring(sc)+L" studies · page "+to_hstring(sp+1));
    PreviousWorkspaces().IsEnabled(wp>0);NextWorkspaces().IsEnabled((wp+1)*24<wc);PreviousStudies().IsEnabled(sp>0);NextStudies().IsEnabled((sp+1)*24<sc);
    HomeMessage().Text(wc||sc?L"Saved on this computer. Cloud synchronization is unavailable.":L"No matching local records. Create a study or workspace to begin.");
}
winrt::fire_and_forget MainWindow::WorkspaceAction(JsonObject record,std::wstring action) {
    if(busy||strategyDialogOpen)co_return;auto lifetime=get_strong();ContentDialog dialog;dialog.XamlRoot(Root().XamlRoot());dialog.CloseButtonText(L"Cancel");
    TextBox input;input.MaxLength(256);ComboBox recovery;Windows::Data::Json::JsonArray deleted;
    bool isStudy=record&&record.GetNamedString(L"kind")!=L"workspace";
    if(action==L"recover") {
        apartment_context ui;auto root=storeRoot;std::wstring failure;busy=true;
        try{JsonObject r;zterminal::native_store::text(r,L"command",L"trash");co_await resume_background();deleted=zterminal::native_store::call(root,r).GetNamedArray(L"value");}catch(std::exception const& e){failure=to_hstring(e.what());}catch(hresult_error const& e){failure=e.message();}
        co_await ui;busy=false;if(closing)co_return;if(!failure.empty()){HomeMessage().Text(L"Recovery unavailable · "+failure);co_return;}
        if(!deleted.Size()){HomeMessage().Text(L"No deleted local records to recover.");co_return;}
        for(auto v:deleted){auto item=v.GetObject();recovery.Items().Append(box_value(item.GetNamedString(L"name")+L" · "+item.GetNamedString(L"kind")));}recovery.SelectedIndex(0);recovery.Header(box_value(L"Recently deleted local records (up to 100)"));
        dialog.Title(box_value(L"Recover local record"));dialog.PrimaryButtonText(L"Recover");dialog.Content(recovery);
    }
    else if(action==L"delete"){dialog.Title(box_value(isStudy?L"Delete study?":L"Delete workspace?"));dialog.PrimaryButtonText(L"Move to recovery");TextBlock help;help.Text(L"The record moves to local recovery. Shared datasets and source artifacts are retained.");help.TextWrapping(TextWrapping::Wrap);dialog.Content(help);}
    else {dialog.Title(box_value(action==L"rename"?L"Rename local record":L"Duplicate local record"));dialog.PrimaryButtonText(L"Save");input.Header(box_value(L"Name"));input.Text(record.GetNamedString(L"name")+(action==L"duplicate"?L" copy":L""));dialog.Content(input);}
    if(co_await dialog.ShowAsync()!=ContentDialogResult::Primary)co_return;
    apartment_context ui;busy=true;std::wstring failure;auto root=storeRoot;
    try {JsonObject r;zterminal::native_store::text(r,L"command",action==L"recover"?L"restore_catalog":isStudy?L"study_action":L"workspace_action");if(action==L"recover")zterminal::native_store::text(r,L"key",deleted.GetAt(unsigned(recovery.SelectedIndex())).GetObject().GetNamedString(L"key"));else zterminal::native_store::text(r,L"id",record.GetNamedString(L"id"));
        if(record){zterminal::native_store::text(r,L"action",action);zterminal::native_store::text(r,L"revision",to_hstring(uint64_t(record.GetNamedNumber(L"revision"))));zterminal::native_store::text(r,L"name",input.Text());auto id=zterminal::native_store::guid();zterminal::native_store::text(r,L"newId",id.substr(1,id.size()-2));}
        co_await resume_background();zterminal::native_store::call(root,r);
    }catch(std::exception const& e){failure=to_hstring(e.what());}catch(hresult_error const& e){failure=e.message();}
    co_await ui;busy=false;if(closing)co_return;
    if(!failure.empty())HomeMessage().Text(L"Operation failed · "+failure);else RefreshHome();
}
winrt::fire_and_forget MainWindow::StudyEditor(std::wstring id) {
    if(busy||strategyDialogOpen)co_return;auto lifetime=get_strong();apartment_context ui;auto root=storeRoot;JsonObject study{nullptr};std::wstring failure;
    if(!id.empty()){busy=true;try{JsonObject r;zterminal::native_store::text(r,L"command",L"study");zterminal::native_store::text(r,L"id",id);co_await resume_background();study=zterminal::native_store::call(root,r).GetNamedObject(L"value");}catch(std::exception const& e){failure=to_hstring(e.what());}catch(hresult_error const& e){failure=e.message();}co_await ui;busy=false;}
    if(closing)co_return;if(!failure.empty()){HomeMessage().Text(L"Study unavailable · "+failure);co_return;}
    if(id.empty()){id=zterminal::native_store::guid();id=id.substr(1,id.size()-2);}
    ContentDialog dialog;dialog.XamlRoot(Root().XamlRoot());dialog.Title(box_value(study?L"Edit local study":L"New local study"));dialog.PrimaryButtonText(L"Save source");dialog.SecondaryButtonText(L"Discard edits");dialog.CloseButtonText(L"Cancel");
    StackPanel content;content.Spacing(10);TextBox title,source;ComboBox kind;TextBlock message;
    title.Header(box_value(L"Study name"));title.MaxLength(256);title.Text(study?study.GetNamedString(L"name"):L"Untitled study");kind.Header(box_value(L"Study kind"));kind.Items().Append(box_value(L"Indicator"));kind.Items().Append(box_value(L"Strategy"));kind.SelectedIndex(study&&study.GetNamedString(L"kind")==L"strategy"?1:0);
    source.Header(box_value(L"Python source — saved locally, not executed"));source.AcceptsReturn(true);source.TextWrapping(TextWrapping::NoWrap);source.MaxLength(256000);source.Height(300);source.Text(study?study.GetNamedString(L"source"):L"# New local study\n");message.TextWrapping(TextWrapping::Wrap);
    content.Children().Append(title);content.Children().Append(kind);content.Children().Append(source);content.Children().Append(message);dialog.Content(content);
    auto originalSource=source.Text(),originalName=title.Text();auto originalKind=kind.SelectedIndex();
    dialog.Closing([source,title,kind,message,originalSource,originalName,originalKind](auto&&,ContentDialogClosingEventArgs const& args){if(args.Result()==ContentDialogResult::None&&(source.Text()!=originalSource||title.Text()!=originalName||kind.SelectedIndex()!=originalKind)){args.Cancel(true);message.Text(L"Unsaved edits. Save source or choose Discard edits.");}});
    strategyDialogOpen=true;
    while(co_await dialog.ShowAsync()==ContentDialogResult::Primary){
        busy=true;failure.clear();auto bytes=to_string(source.Text());JsonObject r;zterminal::native_store::text(r,L"command",L"save_study");zterminal::native_store::text(r,L"id",id);zterminal::native_store::text(r,L"revision",to_hstring(study?uint64_t(study.GetNamedNumber(L"revision")):0));zterminal::native_store::text(r,L"name",title.Text());zterminal::native_store::text(r,L"kind",kind.SelectedIndex()==0?L"indicator":L"strategy");
        try{co_await resume_background();zterminal::native_store::save_strategy(root,r,bytes);}catch(std::exception const& e){failure=to_hstring(e.what());}catch(hresult_error const& e){failure=e.message();}
        co_await ui;busy=false;if(closing)break;if(failure.empty())break;message.Text(L"Save failed; draft retained · "+failure);
    }
    strategyDialogOpen=false;if(!closing)RefreshHome();
}
}
