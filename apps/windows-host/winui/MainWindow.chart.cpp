#include "pch.h"
#include "MainWindow.xaml.h"
#include "native_store.h"
#include "native_chart_host.h"
#include <winrt/Microsoft.UI.Xaml.Automation.Peers.h>
namespace winrt::ZTerminal::implementation {
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Controls;
using Windows::Data::Json::JsonObject;
using Windows::Data::Json::JsonValue;
void MainWindow::ApplyPresentation(JsonObject value) {
    using namespace zterminal::native_chart;
    if(value.GetNamedNumber(L"version")!=1||value.GetNamedString(L"chartId")!=L"primary-chart")throw std::runtime_error("Unsupported native presentation identity");
    auto s=value.GetNamedObject(L"settings");Appearance a;
    auto type=value.GetNamedString(L"chartType");a.type=type==L"candles"?ChartType::Candles:type==L"bars"?ChartType::Bars:type==L"line"?ChartType::Line:type==L"area"?ChartType::Area:throw std::runtime_error("Unknown chart type");
    auto scale=s.GetNamedString(L"scaleMode");a.scale=scale==L"normal"?zterminal::chart::ScaleMode::Normal:scale==L"logarithmic"?zterminal::chart::ScaleMode::Logarithmic:scale==L"percentage"?zterminal::chart::ScaleMode::Percentage:throw std::runtime_error("Unknown scale mode");
    auto color=[&](const wchar_t* key){auto text=to_string(s.GetNamedString(key));if(text.size()!=7||text[0]!='#'||text.find_first_not_of("0123456789abcdefABCDEF",1)!=std::string::npos)throw std::runtime_error("Invalid chart color");auto n=std::stoul(text.substr(1),nullptr,16);return std::array<float,4>{float((n>>16)&255)/255,float((n>>8)&255)/255,float(n&255)/255,1};};
    a.up=color(L"candleUpColor");a.down=color(L"candleDownColor");a.border_up=color(L"candleBorderUpColor");a.border_down=color(L"candleBorderDownColor");a.wick_up=color(L"candleWickUpColor");a.wick_down=color(L"candleWickDownColor");a.background=color(L"backgroundColor");
    a.grid_opacity=s.GetNamedNumber(L"gridOpacity");a.margin_top=s.GetNamedNumber(L"scaleMarginTop");a.margin_bottom=s.GetNamedNumber(L"scaleMarginBottom");a.future_bars=unsigned(s.GetNamedNumber(L"futureBars"));
    a.grid=s.GetNamedBoolean(L"showGrid");a.price_line=s.GetNamedBoolean(L"showPriceLine");a.crosshair=s.GetNamedBoolean(L"showCrosshair");a.borders=s.GetNamedBoolean(L"showCandleBorders");a.wicks=s.GetNamedBoolean(L"showCandleWicks");a.inverted=s.GetNamedBoolean(L"invertScale");a.volume=value.GetNamedBoolean(L"volumeVisible");a.volume_ratio=value.GetNamedNumber(L"volumeRatio");
    configure(a);
}
winrt::fire_and_forget MainWindow::ShowSettings() {
    if(busy||strategyDialogOpen||!workspace)co_return;auto lifetime=get_strong();
    if(!co_await SaveBeforeNavigate())co_return;
    if(!presentation||!defaultPresentation){Status().Text(L"Chart settings could not be read. Reload this workspace and retry.");co_return;}
    ContentDialog dialog;dialog.XamlRoot(Root().XamlRoot());dialog.Title(box_value(L"Chart appearance"));dialog.PrimaryButtonText(L"Apply");dialog.SecondaryButtonText(L"Reset defaults");dialog.CloseButtonText(L"Cancel");
    StackPanel content;content.Spacing(12);TextBlock scope,message;scope.Text(L"Saved with this workspace. Cancel leaves saved settings unchanged.");scope.TextWrapping(TextWrapping::Wrap);content.Children().Append(scope);
    std::map<std::wstring,CheckBox> checks;std::map<std::wstring,TextBox> colors;std::map<std::wstring,NumberBox> numbers;
    ComboBox type,scale;type.Header(box_value(L"Chart type"));for(auto text:{L"Candles",L"OHLC bars",L"Line",L"Area"})type.Items().Append(box_value(text));content.Children().Append(type);
    scale.Header(box_value(L"Price scale"));for(auto text:{L"Normal",L"Logarithmic (positive prices)",L"Percentage (nonzero base)"})scale.Items().Append(box_value(text));content.Children().Append(scale);
    auto check=[&](const wchar_t* key,const wchar_t* title){CheckBox box;box.Content(box_value(title));checks.emplace(key,box);content.Children().Append(box);};
    check(L"showGrid",L"Grid");check(L"showPriceLine",L"Last-price line");check(L"showCrosshair",L"Crosshair");check(L"showCandleBorders",L"Candle borders");check(L"showCandleWicks",L"Candle wicks");check(L"invertScale",L"Invert price scale");check(L"volumeVisible",L"Volume pane");
    auto numeric=[&](const wchar_t* key,const wchar_t* title,double low,double high,double step){NumberBox box;box.Header(box_value(title));box.Minimum(low);box.Maximum(high);box.SmallChange(step);numbers.emplace(key,box);content.Children().Append(box);};
    numeric(L"futureBars",L"Future-bar space",0,200,1);numeric(L"gridOpacity",L"Grid opacity",0,1,.025);numeric(L"scaleMarginTop",L"Top scale margin",0,.4,.01);numeric(L"scaleMarginBottom",L"Bottom scale margin",0,.4,.01);numeric(L"volumeRatio",L"Volume pane proportion",.1,.5,.01);
    for(auto pair:{std::pair{L"candleUpColor",L"Up candle"},std::pair{L"candleDownColor",L"Down candle"},std::pair{L"candleBorderUpColor",L"Up border"},std::pair{L"candleBorderDownColor",L"Down border"},std::pair{L"candleWickUpColor",L"Up wick"},std::pair{L"candleWickDownColor",L"Down wick"},std::pair{L"backgroundColor",L"Chart background"}}){TextBox box;box.Header(box_value(pair.second));box.MaxLength(7);box.PlaceholderText(L"#RRGGBB");colors.emplace(pair.first,box);content.Children().Append(box);}
    message.TextWrapping(TextWrapping::Wrap);Automation::AutomationProperties::SetLiveSetting(message,Automation::Peers::AutomationLiveSetting::Polite);content.Children().Append(message);
    ScrollViewer scroll;scroll.Content(content);scroll.MaxHeight(std::max(120.0,Root().ActualHeight()-220));dialog.Content(scroll);
    auto load=[checks,colors,numbers,type,scale](JsonObject p){auto s=p.GetNamedObject(L"settings");auto t=p.GetNamedString(L"chartType");type.SelectedIndex(t==L"candles"?0:t==L"bars"?1:t==L"line"?2:3);auto mode=s.GetNamedString(L"scaleMode");scale.SelectedIndex(mode==L"normal"?0:mode==L"logarithmic"?1:2);for(auto [key,box]:checks)box.IsChecked(key==L"volumeVisible"?p.GetNamedBoolean(key):s.GetNamedBoolean(key));for(auto [key,box]:colors)box.Text(s.GetNamedString(key));for(auto [key,box]:numbers)box.Value(key==L"volumeRatio"?p.GetNamedNumber(key):s.GetNamedNumber(key));};
    auto candidate=[this,checks,colors,numbers,type,scale](){
            auto p=JsonObject::Parse(presentation.Stringify());auto s=p.GetNamedObject(L"settings");
            const wchar_t* types[]={L"candles",L"bars",L"line",L"area"};const wchar_t* scales[]={L"normal",L"logarithmic",L"percentage"};
            zterminal::native_store::text(p,L"chartType",types[type.SelectedIndex()]);zterminal::native_store::text(s,L"scaleMode",scales[scale.SelectedIndex()]);
            for(auto [key,box]:checks){auto value=JsonValue::CreateBooleanValue(box.IsChecked().Value());if(key==L"volumeVisible")p.Insert(key,value);else s.Insert(key,value);}
            for(auto [key,box]:colors)zterminal::native_store::text(s,key.c_str(),box.Text());
            for(auto [key,box]:numbers){auto n=box.Value();if(!std::isfinite(n)||(key==L"futureBars"&&std::floor(n)!=n))throw std::runtime_error("Enter finite settings and a whole number of future bars");auto value=JsonValue::CreateNumberValue(n);if(key==L"volumeRatio")p.Insert(key,value);else s.Insert(key,value);}
            p.Insert(L"settings",s);return p;
    };
    Button preview;preview.Content(box_value(L"Preview"));preview.Click([this,candidate,message](auto&&,auto&&){try{ApplyPresentation(candidate());UpdateState();message.Text(L"Preview only. Apply saves; Cancel restores saved settings.");}catch(std::exception const& e){message.Text(to_hstring(e.what()));}catch(hresult_error const& e){message.Text(e.message());}});content.Children().Append(preview);
    load(presentation);auto defaults=defaultPresentation;
    dialog.SecondaryButtonClick([this,load,defaults,message](auto&&,ContentDialogButtonClickEventArgs const& e){e.Cancel(true);load(defaults);ApplyPresentation(defaults);UpdateState();message.Text(L"Defaults loaded. Apply to save, or Cancel to keep your settings.");});
    strategyDialogOpen=true;
    while(co_await dialog.ShowAsync()==ContentDialogResult::Primary){
        try {
            auto p=candidate();JsonObject r;auto document=workspace.GetNamedObject(L"document");zterminal::native_store::text(r,L"command",L"save_presentation");zterminal::native_store::text(r,L"id",document.GetNamedString(L"id"));auto revision=zterminal::native_store::revision(workspace);zterminal::native_store::text(r,L"revision",to_hstring(revision));r.Insert(L"presentation",p);
            // Transient preview never writes; one Apply is one CAS write.
            co_await Perform(r);
            if(zterminal::native_store::revision(workspace)!=revision||presentation.Stringify()==p.Stringify())break;
            message.Text(Status().Text());
        }catch(std::exception const& e){message.Text(to_hstring(e.what()));}catch(hresult_error const& e){message.Text(e.message());}
    }
    strategyDialogOpen=false;if(presentation){ApplyPresentation(presentation);UpdateState();}
}
}
