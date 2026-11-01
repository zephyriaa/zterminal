#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include <optional>
#include <utility>
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>
namespace zterminal::chart {
struct LinearPrice { double low,high,top,bottom; double y(double p) const { return bottom-(p-low)/(high-low)*(bottom-top); } double price(double y) const { return low+(bottom-y)/(bottom-top)*(high-low); } };
enum class ScaleMode { Normal, Logarithmic, Percentage };
// Values remain relative integer-tick deltas. No absolute i64 price is rounded
// through double before subtraction. Non-positive log/zero percent bases fail.
struct PriceProjection {
    LinearPrice axis;
    ScaleMode mode{ScaleMode::Normal};
    bool inverted{};
    double anchor{},base{};
    double forward(double relative) const {
        if(mode==ScaleMode::Logarithmic)return std::log1p((relative-anchor)/base);
        if(mode==ScaleMode::Percentage)return (relative-anchor)*100/std::abs(base);
        return relative;
    }
    double inverse(double value) const {
        if(mode==ScaleMode::Logarithmic)return anchor+std::expm1(value)*base;
        if(mode==ScaleMode::Percentage)return anchor+value*std::abs(base)/100;
        return value;
    }
    double y_axis(double value) const {auto y=axis.y(value);return inverted?axis.top+axis.bottom-y:y;}
    double y(double relative) const {return y_axis(forward(relative));}
    double price(double y) const {return inverse(axis.price(inverted?axis.top+axis.bottom-y:y));}
    static std::optional<PriceProjection> make(ScaleMode mode,bool inverted,int64_t origin,double anchor,double low,double high,double top,double bottom,double margin_top,double margin_bottom) {
        if(!std::isfinite(low)||!std::isfinite(high)||!std::isfinite(anchor)||high<low||bottom<=top||margin_top<0||margin_bottom<0||margin_top+margin_bottom>=.9)return {};
        PriceProjection p{{0,1,top,bottom},mode,inverted,anchor,double(origin)+anchor};
        if((mode==ScaleMode::Logarithmic&&(p.base<=0||low<=-double(origin)))||(mode==ScaleMode::Percentage&&p.base==0))return {};
        auto a=p.forward(low),b=p.forward(high);
        if(!std::isfinite(a)||!std::isfinite(b))return {};
        if(a==b){auto tick=mode==ScaleMode::Normal?1.0:mode==ScaleMode::Percentage?100/std::abs(p.base):std::log1p(1/p.base);a-=tick;b+=tick;}
        auto span=(b-a)/(1-margin_top-margin_bottom);
        p.axis.low=a-span*(inverted?margin_top:margin_bottom);p.axis.high=b+span*(inverted?margin_bottom:margin_top);
        if(!std::isfinite(p.axis.low)||!std::isfinite(p.axis.high)||p.axis.high<=p.axis.low)return {};
        return p;
    }
};
struct Rect { double left,top,right,bottom; bool operator==(const Rect&) const = default; };
struct Point {double x,y; bool operator==(const Point&) const = default;};
inline double distance_to_segment(Point p,Point a,Point b) {
    double dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
    double t=len2>0?std::clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/len2,0.0,1.0):0.0;
    return std::hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}
inline std::optional<std::pair<Point,Point>> clip_line(Rect bounds,Point a,Point b,bool extend_start=false,bool extend_end=false) {
    double dx=b.x-a.x,dy=b.y-a.y;
    if(dx==0&&dy==0){if(a.x<bounds.left||a.x>bounds.right||a.y<bounds.top||a.y>bounds.bottom)return {};return std::pair{a,b};}
    double lo=extend_start?-std::numeric_limits<double>::infinity():0,hi=extend_end?std::numeric_limits<double>::infinity():1;
    auto edge=[&](double p,double q){if(p==0)return q>=0;auto t=q/p;if(p<0)lo=std::max(lo,t);else hi=std::min(hi,t);return lo<=hi;};
    if(!edge(-dx,a.x-bounds.left)||!edge(dx,bounds.right-a.x)||!edge(-dy,a.y-bounds.top)||!edge(dy,bounds.bottom-a.y))return {};
    return std::pair{Point{a.x+lo*dx,a.y+lo*dy},Point{a.x+hi*dx,a.y+hi*dy}};
}
inline std::vector<std::optional<double>> evaluate_sma(const std::vector<double>& closes,size_t period) {
    std::vector<std::optional<double>> out(closes.size());
    if(closes.empty()||period<2)return out;
    double sum=0;
    for(size_t i=0;i<closes.size();++i){sum+=closes[i];if(i>=period)sum-=closes[i-period];if(i+1>=period)out[i]=sum/double(period);}
    return out;
}
inline std::vector<std::optional<double>> evaluate_ema(const std::vector<double>& closes,size_t period) {
    std::vector<std::optional<double>> out(closes.size());
    if(closes.empty()||period<2)return out;
    double k=2.0/(double(period)+1.0),prev=closes[0];out[0]=prev;
    for(size_t i=1;i<closes.size();++i){prev=closes[i]*k+prev*(1.0-k);out[i]=prev;}
    return out;
}
inline std::optional<Rect> clipped(Rect r,Rect pane) {
    r={std::max(r.left,pane.left),std::max(r.top,pane.top),std::min(r.right,pane.right),std::min(r.bottom,pane.bottom)};
    if(r.left>=r.right||r.top>=r.bottom)return {}; return r;
}
struct CandleGeometry { Rect wick,body,volume; };
template<class Price> inline CandleGeometry project_candle(double open,double high,double low,double close,int64_t volume,double x,double slot,Price price,double volume_top,double volume_bottom,double maximum_volume,double pixel=1) {
    auto wick=std::min(slot*.1,std::max(pixel*.5,slot*.05)); auto body=std::min(slot*.4,std::max(pixel*.5,slot*.28));
    auto top=std::min(price.y(open),price.y(close));
    auto wick_top=std::min(price.y(high),price.y(low));
    return {{x-wick,wick_top,x+wick,std::max(std::max(price.y(low),price.y(high)),wick_top+pixel)},
        {x-body,top,x+body,std::max(top+pixel,std::max(price.y(open),price.y(close)))},
        {x-body,volume_bottom-double(volume)/std::max(1.0,maximum_volume)*(volume_bottom-volume_top),x+body,volume_bottom}};
}
struct View { double first,count; };
inline std::vector<double> tick_levels(double low,double high,unsigned desired=6,double minimum_step=1) {
    std::vector<double> levels; if(!std::isfinite(low)||!std::isfinite(high)||high<=low||desired<2)return levels;
    auto raw=std::max(minimum_step,(high-low)/(desired-1)); auto power=std::pow(10.0,std::floor(std::log10(raw))); auto ratio=raw/power;
    auto step=(ratio<=1?1:ratio<=2?2:ratio<=5?5:10)*power;
    auto start=std::ceil(low/step)*step;
    for(unsigned i=0;i<desired+2;++i) { auto v=start+i*step; if(v>high)break; levels.push_back(v); } return levels;
}
inline View zoom_at(View v,double fraction,double count,double total) {
    fraction=std::clamp(fraction,0.0,1.0); count=std::clamp(count,1.0,std::max(1.0,total));
    return {std::clamp(v.first+fraction*(v.count-count),0.0,std::max(0.0,total-count)),count};
}
// Subtract integers before projection. Unsigned subtraction avoids signed overflow.
inline double tick_delta(int64_t a,int64_t b) {
    return a>=b ? double(uint64_t(a)-uint64_t(b)) : -double(uint64_t(b)-uint64_t(a));
}
inline bool valid_step(const std::string& s) {
    if(s.empty() || s.size()>20) return false;
    unsigned dots=0,digits=0; bool positive=false;
    for(char c:s) { if(c=='.') { if(++dots>1 || !digits) return false; } else if(c>='0'&&c<='9') { ++digits; positive |= c!='0'; } else return false; }
    return digits && positive && s.back()!='.';
}
inline std::string format_units(int64_t ticks,const std::string& step) {
    if(!valid_step(step)) throw std::invalid_argument("Invalid exact decimal increment");
    auto dot=step.find('.'); auto decimals=dot==std::string::npos ? 0 : step.size()-dot-1;
    std::string b=step; if(dot!=std::string::npos) b.erase(dot,1);
    auto magnitude=ticks<0 ? uint64_t(0)-uint64_t(ticks) : uint64_t(ticks);
    auto a=std::to_string(magnitude); std::vector<int> product(a.size()+b.size(),0);
    for(size_t i=a.size();i-->0;) for(size_t j=b.size();j-->0;) product[i+j+1]+=(a[i]-'0')*(b[j]-'0');
    for(size_t i=product.size()-1;i>0;--i) { product[i-1]+=product[i]/10; product[i]%=10; }
    std::string result; for(auto n:product) result+=char('0'+n);
    auto nonzero=result.find_first_not_of('0'); result=nonzero==std::string::npos ? "0" : result.substr(nonzero);
    if(decimals) { if(result.size()<=decimals) result.insert(0,decimals+1-result.size(),'0'); result.insert(result.size()-decimals,1,'.'); }
    if(ticks<0) result.insert(0,1,'-'); return result;
}
inline std::optional<uint64_t> ms_to_ns(uint64_t ms) {
    if(ms>std::numeric_limits<uint64_t>::max()/1000000) return {}; return ms*1000000;
}
inline std::pair<uint64_t,uint64_t> split_ns(uint64_t ns) { return {ns/1000000,ns%1000000}; }
struct Bar { uint64_t time_ns; int64_t open,high,low,close,volume; bool operator==(const Bar&) const = default; };
struct Scene { unsigned version; std::string instrument,hash,price_step,quantity_step; uint64_t revision,interval_ns,available_through_ns; std::vector<Bar> bars; std::string workspace_id,chart_id,source_hash,availability; uint64_t dataset_revision{}; };
inline bool valid_scene(const Scene& s,uint64_t expected) {
    if(s.version!=2 || s.revision!=expected || !s.revision || s.instrument.empty() || s.hash.size()!=64 || !valid_step(s.price_step) || !valid_step(s.quantity_step) || !s.interval_ns || s.bars.size()>100000 || s.workspace_id.empty() || s.chart_id.empty() || s.source_hash.size()!=64 || !s.dataset_revision || s.availability!="verified imported history") return false;
    if(!std::all_of(s.hash.begin(),s.hash.end(),[](char c){return (c>='0'&&c<='9')||(c>='a'&&c<='f');})) return false;
    if(!std::all_of(s.source_hash.begin(),s.source_hash.end(),[](char c){return (c>='0'&&c<='9')||(c>='a'&&c<='f');})) return false;
    for(size_t i=0;i<s.bars.size();++i) { auto& b=s.bars[i];
        if(b.volume<0 || b.low>b.high || b.low>std::min(b.open,b.close) || b.high<std::max(b.open,b.close) || b.time_ns>UINT64_MAX-s.interval_ns || (i && b.time_ns<=s.bars[i-1].time_ns)) return false;
    } return true;
}
inline std::vector<Bar> available_bars(const Scene& s) {
    std::vector<Bar> out; for(auto b:s.bars) if(b.time_ns<=UINT64_MAX-s.interval_ns && b.time_ns+s.interval_ns<=s.available_through_ns) out.push_back(b); return out;
}
}
