#include "chart_math.h"
#include <cmath>
#include <iostream>
#include <limits>
using namespace zterminal::chart;
int main() {
    int failures = 0;
    auto check = [&](bool ok, const char* name) { std::cout << (ok ? "PASS " : "FAIL ") << name << '\n'; failures += !ok; };
    LinearPrice p{100, 120, 0, 200};
    check(p.y(100)==200 && p.y(110)==100 && p.y(120)==0, "independent linear golden");
    check(std::abs(p.price(p.y(113.25))-113.25)<1e-10, "inverse");
    auto log=PriceProjection::make(ScaleMode::Logarithmic,false,100,0,-50,100,0,300,0,0);
    check(log&&std::abs(log->y(0)-150)<1e-9,"independent log doubling midpoint");
    check(log&&std::abs(log->price(log->y(25))-25)<1e-9,"log inverse shares render transform");
    check(!PriceProjection::make(ScaleMode::Logarithmic,false,100,0,-100,1,0,300,0,0),"non-positive log range withheld");
    auto percent=PriceProjection::make(ScaleMode::Percentage,false,100,0,-10,10,0,200,0,0);
    check(percent&&percent->forward(10)==10&&percent->y(0)==100,"first-visible percentage anchor");
    check(!PriceProjection::make(ScaleMode::Percentage,false,0,0,-10,10,0,200,0,0),"zero percentage base withheld");
    auto inverted=PriceProjection::make(ScaleMode::Normal,true,0,0,-10,10,0,200,0,0);
    check(inverted&&inverted->y(-10)==0&&inverted->y(10)==200&&inverted->price(50)==-5,"inverted signed price golden");
    auto precise=PriceProjection::make(ScaleMode::Logarithmic,false,9007199254740992LL,1,0,2,0,200,0,0);
    check(precise&&std::abs(precise->price(precise->y(1))-1)<1e-10&&precise->y(0)>precise->y(1)&&precise->y(1)>precise->y(2),"adjacent huge ticks remain distinct on log scale");
    auto line=clip_line({0,0,100,100},{-100,50},{200,50});
    check(line&&line->first.x==0&&line->second.x==100,"extrapolated line clips to pane");
    check(!clip_line({0,0,100,100},{-10,-10},{-5,-5}),"outside line withheld");
    auto ray=clip_line({0,0,100,100},{20,50},{40,50},false,true);
    check(ray&&ray->first.x==20&&ray->second.x==100,"ray extends to right pane edge");
    auto ext=clip_line({0,0,100,100},{20,50},{40,50},true,true);
    check(ext&&ext->first.x==0&&ext->second.x==100,"extended-line clips across both pane edges");
    check(std::abs(distance_to_segment({50,53},{20,50},{80,50})-3.0)<1e-10,"segment perpendicular hit distance");
    auto sma=evaluate_sma({10,20,30},2);
    check(!sma[0].has_value()&&sma[1]==15.0&&sma[2]==25.0,"causal SMA warm-up null and values");
    auto ema=evaluate_ema({10,16},2);
    check(ema[0]==10.0&&std::abs(*ema[1]-14.0)<1e-10,"causal EMA values");
    auto doji=project_candle(110,115,105,110,0,50,10,p,250,300,6);
    check(doji.wick==Rect{49.5,50,50.5,150} && doji.body.top==100 && doji.body.bottom==101, "independent doji geometry");
    check(!clipped(doji.volume,{0,250,100,300}), "zero volume draws no fabricated bar");
    auto rising=project_candle(100,120,100,110,3,50,10,p,250,300,6);
    check(rising.body.top==100 && rising.body.bottom==200 && rising.volume.top==275 && rising.volume.bottom==300, "independent candle and volume geometry");
    check(clipped({-10,-20,30,40},{0,0,20,30})==Rect{0,0,20,30}, "pane clipping golden");
    LinearPrice negative{-10,10,0,200}; check(negative.y(-10)==200&&negative.y(0)==100&&negative.y(10)==0,"negative linear range");
    auto v = zoom_at({10,100}, 0.25, 50, 1000);
    check(std::abs(v.first+v.count*.25-35)<1e-10, "cursor zoom logical anchor");
    check(tick_delta(9007199254740993LL,9007199254740992LL)==1, "adjacent ticks above 2^53");
    check(format_units(9007199254740993LL,"0.000001")=="9007199254.740993", "exact decimal label");
    check(format_units(-3,"0.25")=="-0.75", "signed quarter label");
    check(ms_to_ns(18446744073709ULL)==18446744073709000000ULL && !ms_to_ns(18446744073710ULL), "timestamp overflow");
    check(split_ns(1700000000000123456ULL)==std::pair<uint64_t,uint64_t>{1700000000000ULL,123456}, "ns remainder retained");
    Scene s{2,"csv:TEST:spot",std::string(64,'a'),"0.25","1",1,60000000000ULL,120000000000ULL,{{0,400,480,360,440,0},{60000000000ULL,440,520,400,480,3},{120000000000ULL,480,560,440,520,4}}};
    s.workspace_id="test"; s.chart_id="primary-chart"; s.source_hash=std::string(64,'b'); s.availability="verified imported history"; s.dataset_revision=1;
    check(tick_levels(100,120)==std::vector<double>{100,105,110,115,120}, "independent axis steps");
    check(tick_levels(-1,1)==std::vector<double>{-1,0,1}, "equal-price padded axis has no duplicate labels");
    check(valid_scene(s,1), "zero volume valid rich scene");
    check(!valid_scene(s,2), "stale revision rejected");
    auto bad=s; bad.bars[0].high=399; check(!valid_scene(bad,1), "malformed OHLC");
    bad=s; bad.bars[1].time_ns=0; check(!valid_scene(bad,1), "duplicate timestamp");
    bad=s; bad.bars[0].volume=-1; check(!valid_scene(bad,1), "negative volume");
    bad=s; bad.version=3; check(!valid_scene(bad,1), "unknown version");
    bad=s; bad.source_hash=std::string(64,'z'); check(!valid_scene(bad,1), "malformed source identity");
    bad=s; bad.price_step="NaN"; check(!valid_scene(bad,1), "nonfinite unit metadata");
    auto before=available_bars(s); s.bars[2]={120000000000ULL,1,INT64_MAX,INT64_MIN,1,INT64_MAX};
    check(available_bars(s)==before && before.size()==2, "completion cutoff excludes extreme future bar");
    std::cout << "failures=" << failures << '\n'; return failures ? 1 : 0;
}
