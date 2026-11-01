#include "native_chart_host.h"
#include <iostream>
#include <filesystem>
#include <fstream>
using namespace zterminal;
int main(int argc,char** argv) {
    std::cout << std::unitbuf;
    int failures=0;
    auto check=[&](bool ok,const char* name){std::cout<<(ok?"PASS ":"FAIL ")<<name<<'\n'; failures+=!ok;};
    auto capture=[&](const char* name) {
        auto raster=native_chart::capture_raster(); check(bool(raster),name);
        if(raster && argc==2) {
            std::filesystem::create_directories(argv[1]);
            std::ofstream out(std::filesystem::path(argv[1])/(std::string(name)+".bmp"),std::ios::binary);
            BITMAPFILEHEADER file{};file.bfType=0x4d42;file.bfOffBits=sizeof(file)+sizeof(BITMAPINFOHEADER);file.bfSize=DWORD(file.bfOffBits+raster->bgra.size());
            BITMAPINFOHEADER info{};info.biSize=sizeof(info);info.biWidth=LONG(raster->width);info.biHeight=-LONG(raster->height);info.biPlanes=1;info.biBitCount=32;info.biCompression=BI_RGB;
            out.write(reinterpret_cast<char*>(&file),sizeof(file));out.write(reinterpret_cast<char*>(&info),sizeof(info));out.write(reinterpret_cast<char*>(raster->bgra.data()),raster->bgra.size());
            check(bool(out),"native raster written");
        }
        return raster;
    };
    auto window=CreateWindowExW(0,L"STATIC",L"TEST ONLY native chart checks",WS_OVERLAPPEDWINDOW,0,0,800,600,nullptr,nullptr,GetModuleHandleW(nullptr),nullptr);
    const bool initialized=native_chart::initialize(window,[](IDXGISwapChain*){return S_OK;},L"");
    check(initialized,"native D3D composition initialization");
    if(!initialized) { DestroyWindow(window); return 1; }
    // An explicit diagnostic palette keeps the existing independent pixel
    // golden meaningful while product defaults follow the web-owned settings.
    native_chart::Appearance appearance;appearance.future_bars=0;appearance.up={27.0f/255,185.0f/255,144.0f/255,1};appearance.wick_up=appearance.up;
    native_chart::configure(appearance);
    check(native_chart::resize(800,600),"native resize");
    native_chart::render();capture("empty");
    chart::Scene scene{2,"csv:TEST ONLY:spot",std::string(64,'a'),"0.25","1",1,60000000000ULL,60060000000000ULL,{}};
    scene.workspace_id="TEST ONLY";scene.chart_id="primary-chart";scene.source_hash=std::string(64,'b');scene.availability="verified imported history";scene.dataset_revision=1;
    for(uint64_t i=0;i<1000;++i)scene.bars.push_back({(i+1)*scene.interval_ns,400,480,360,440,int64_t(i%10)});
    check(native_chart::select_verified_scene(scene,1,scene.instrument,scene.hash,1),"verified rich scene accepted");
    auto initial=native_chart::semantic_viewport();
    check(initial.first==901*scene.interval_ns/1000000 && initial.second==1001*scene.interval_ns/1000000,"new scene opens last 100 completed bars");
    native_chart::fit();
    check(native_chart::semantic_viewport().first==60000 && native_chart::semantic_viewport().second==60060000,"explicit fit retains full available history");
    check(native_chart::restore_viewport(initial.first,initial.second),"recent range remains restorable");
    native_chart::pointer_move(300,200);native_chart::begin_drag(300);native_chart::pointer_move(600,200);
    check(native_chart::semantic_viewport()!=initial,"native adapter drag changes semantic viewport");
    native_chart::cancel_drag();check(native_chart::semantic_viewport()==initial,"capture/Escape/focus cancellation restores viewport");
    native_chart::begin_drag(300);native_chart::pointer_move(600,200);native_chart::resize(900,600);
    check(native_chart::semantic_viewport()==initial,"resize during drag restores viewport");
    native_chart::begin_drag(300);native_chart::pointer_move(600,200);native_chart::end_drag(); auto dragged=native_chart::semantic_viewport();native_chart::cancel_drag();
    check(dragged!=initial&&native_chart::semantic_viewport()==dragged,"released drag remains committed in view");
    native_chart::zoom(120);check(native_chart::semantic_viewport().second-native_chart::semantic_viewport().first<dragged.second-dragged.first,"native zoom changes span");
    auto zoomed=native_chart::semantic_viewport(); check(native_chart::restore_viewport(zoomed.first,zoomed.second),"semantic range restore");
    native_chart::render(true);check(!native_chart::needs_render(),"static frame consumes invalidation");
    auto bad=scene;bad.revision=2;check(!native_chart::select_verified_scene(bad,1,bad.instrument,bad.hash,1),"stale scene rejected without view change");
    check(native_chart::semantic_viewport()==zoomed,"rejected scene preserves viewport");
    bad=scene;bad.dataset_revision=2;
    check(!native_chart::select_verified_scene(bad,1,bad.instrument,bad.hash,1),"mismatched dataset revision rejected");
    check(native_chart::select_verified_scene(scene,1,scene.instrument,scene.hash,1),"restore verified fixture after revision check");
    native_chart::pointer_move(300,200);
    check(native_chart::readout().find(L"O 100.00 H 120.00 L 90.00 C 110.00")!=std::wstring::npos,"accessible pointer readout retains exact OHLC");
    check(native_chart::readout().find(L"Last visible close 110.00")!=std::wstring::npos,"last visible price is identified exactly");
    auto before_axis=native_chart::semantic_viewport();
    native_chart::pointer_move(899,200);native_chart::begin_drag(899);native_chart::pointer_move(1200,200);native_chart::end_drag();
    check(native_chart::semantic_viewport()==before_axis,"price axis press cannot begin data pan");
    native_chart::restore_viewport(before_axis.first,before_axis.second);
    native_chart::pointer_move(300,599);native_chart::begin_drag(300);native_chart::pointer_move(600,599);native_chart::end_drag();
    check(native_chart::semantic_viewport()==before_axis,"time axis press cannot begin data pan");
    // A completed first bar is the only available observation. Future extremes
    // must never reach autoscale, readout, geometry or accessible summaries.
    scene.available_through_ns=120000000000ULL;
    check(native_chart::select_verified_scene(scene,1,scene.instrument,scene.hash,1),"cutoff scene accepted");native_chart::render(true);
    auto before=capture("single-volume-zero");
    if(before) { auto i=(250*before->width+400)*4; check(before->bgra[i]==144&&before->bgra[i+1]==185&&before->bgra[i+2]==27,"independently expected candle pixel BGRA 144 185 27"); }
    auto cutoff_range=native_chart::semantic_viewport();auto cutoff_readout=native_chart::readout();
    for(size_t i=1;i<scene.bars.size();++i){scene.bars[i].open=1;scene.bars[i].close=1;scene.bars[i].high=INT64_MAX;scene.bars[i].low=INT64_MIN;scene.bars[i].volume=INT64_MAX;}
    check(native_chart::select_verified_scene(scene,1,scene.instrument,scene.hash,1),"adversarial future values withheld before projection");native_chart::render(true);
    auto after=capture("future-extremes-withheld");check(before&&after&&before->bgra==after->bgra,"future extrema leave entire native raster byte-identical");
    check(native_chart::semantic_viewport()==cutoff_range&&native_chart::readout()==cutoff_readout,"cutoff geometry inputs and accessibility invariant");
    scene.bars.resize(1);scene.bars[0].close=scene.bars[0].open;
    check(native_chart::select_verified_scene(scene,1,scene.instrument,scene.hash,1),"single doji accepted");native_chart::render();capture("single-doji");
    scene.bars[0].high=scene.bars[0].low=scene.bars[0].close;
    check(native_chart::select_verified_scene(scene,1,scene.instrument,scene.hash,1),"equal OHLC accepted");native_chart::render();capture("equal-price");
    scene.bars[0]={60000000000ULL,-400,-360,-480,-440,3};
    check(native_chart::select_verified_scene(scene,1,scene.instrument,scene.hash,1),"negative price accepted");native_chart::render();capture("negative-price-volume");
    scene.bars.push_back({180000000000ULL,-440,-360,-480,-400,4});scene.available_through_ns=240000000000ULL;
    check(native_chart::select_verified_scene(scene,1,scene.instrument,scene.hash,1),"real timestamp gap preserved");native_chart::pointer_move(300,250);native_chart::render();capture("gap-crosshair");
    check(native_chart::semantic_viewport()==std::pair<int64_t,int64_t>{60000,240000},"gap viewport uses actual timestamp boundaries");
    check(native_chart::restore_viewport(120000,240000),"fractional viewport across a gap restores");
    check(native_chart::semantic_viewport()==std::pair<int64_t,int64_t>{120000,240000},"gap viewport round trip independently expected");
    scene.bars={{60000000000ULL,400,480,360,440,3},{120000000000ULL,440,520,400,480,4}};scene.available_through_ns=180000000000ULL;
    appearance.crosshair=false;native_chart::pointer_leave();native_chart::configure(appearance);
    check(native_chart::select_verified_scene(scene,1,scene.instrument,scene.hash,1),"type fixture accepted");native_chart::render();auto candle_raster=capture("type-candles");
    std::optional<native_chart::RasterSnapshot> line_raster;
    for(auto type:{native_chart::ChartType::Bars,native_chart::ChartType::Line,native_chart::ChartType::Area}){
        appearance.type=type;native_chart::configure(appearance);native_chart::render();auto raster=capture(type==native_chart::ChartType::Bars?"type-bars":type==native_chart::ChartType::Line?"type-line":"type-area");
        check(candle_raster&&raster&&candle_raster->bgra!=raster->bgra,"chart type changes actual native geometry");
        if(type==native_chart::ChartType::Line)line_raster=raster;
        if(type==native_chart::ChartType::Area)check(line_raster&&raster&&line_raster->bgra!=raster->bgra,"area fill differs from line raster");
    }
    appearance.scale=chart::ScaleMode::Logarithmic;native_chart::configure(appearance);check(native_chart::available(),"positive log projection available");native_chart::render();capture("logarithmic");
    scene.bars[0].low=-4;check(native_chart::select_verified_scene(scene,1,scene.instrument,scene.hash,1),"non-positive range remains retained");check(!native_chart::available(),"unsupported log projection visibly withheld");
    scene.bars={{60000000000ULL,0,4,-4,0,3}};appearance.scale=chart::ScaleMode::Percentage;native_chart::configure(appearance);check(native_chart::select_verified_scene(scene,1,scene.instrument,scene.hash,1),"zero-base data retained");check(!native_chart::available(),"zero-base percentage projection withheld");
    appearance.scale=chart::ScaleMode::Normal;native_chart::configure(appearance);check(native_chart::available(),"normal scale recovers retained zero/negative data");
    auto retained=native_chart::semantic_viewport();appearance.future_bars=200;native_chart::configure(appearance);native_chart::pointer_move(700,200);
    check(native_chart::semantic_viewport()==retained&&native_chart::readout().find(L"Future time · no observation")!=std::wstring::npos,"future space neither manufactures data nor changes saved viewport");
    native_chart::shutdown();
    auto stopped=native_chart::semantic_viewport();native_chart::zoom(120);
    check(native_chart::semantic_viewport()==stopped,"zoom after renderer shutdown is ignored");
    DestroyWindow(window);return failures?1:0;
}
