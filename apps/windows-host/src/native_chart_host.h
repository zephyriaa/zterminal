#pragma once

#include "local_scene_bridge.h"
#include "chart_math.h"
#include <windows.h>
#include <dxgi.h>
#include <functional>
#include <string>
#include <array>

// Presentation adapter for the existing local scene and retained renderer.
// Ownership remains on the host UI thread. This is not a new domain model.
namespace zterminal::native_chart {
using AttachSwapChain = std::function<HRESULT(IDXGISwapChain*)>;
enum class ChartType { Candles, Bars, Line, Area };
struct Appearance {
    ChartType type{ChartType::Candles};chart::ScaleMode scale{chart::ScaleMode::Normal};
    std::array<float,4> up{.204f,.827f,.6f,1},down{.937f,.267f,.267f,1},border_up{.204f,.827f,.6f,1},border_down{.937f,.267f,.267f,1},wick_up{.204f,.827f,.6f,1},wick_down{.937f,.267f,.267f,1},background{.039f,.051f,.071f,1};
    double grid_opacity{.075},margin_top{.08},margin_bottom{.18},volume_ratio{.22};unsigned future_bars{24};
    bool grid{true},price_line{true},crosshair{true},borders{},wicks{true},inverted{},volume{true};
};
void configure(const Appearance& appearance);

bool initialize(HWND owner, AttachSwapChain attach, const wchar_t* arguments);
void shutdown();
bool resize(unsigned width, unsigned height);
void render(bool verify_pixels = false);
bool available();
std::wstring availability_text();
std::wstring diagnostic();
void pointer_move(int x, int y);
void pointer_leave();
bool begin_drag(int x);
void end_drag();
void cancel_drag();
void set_scale(double scale);
bool needs_render();
struct RasterSnapshot { unsigned width{},height{}; std::vector<uint8_t> bgra; };
std::optional<RasterSnapshot> capture_raster();
void fit();
bool select_verified_scene(const chart::Scene& scene, uint64_t expected_revision, const std::string& expected_instrument, const std::string& expected_hash, uint64_t expected_dataset_revision);
std::pair<int64_t,int64_t> semantic_viewport();
bool restore_viewport(int64_t from_ms, int64_t to_ms);
std::wstring readout();
void zoom(int wheel_delta);
void navigate(unsigned key);
bool select_scene(const local_scene::Request& request, const local_scene::Result& result);
}
