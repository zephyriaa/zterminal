//
// Windows-only local-first ZTerminal native host.
// This vertical slice defaults to a withheld local chart state and renders only
// an explicitly requested bounded local scene. Deterministic fixture candles
// remain a labelled diagnostic path. It does not fetch, proxy, or manufacture
// market data; verified provider bars must enter through the Rust protocol and
// local SegmentStore before any local scene can be rendered.
//

#include "local_monte_carlo_bridge.h"
#include "local_scene_bridge.h"
#include "local_segment_catalog_bridge.h"
#include "native_chart_host.h"

#include <windows.h>
#include <windowsx.h>
#include <d3d11.h>
#include <d3dcompiler.h>
#include <d2d1.h>
#include <dwrite_3.h>
#include <dxgi.h>
#include <dxgi1_2.h>
#include <dxgi1_3.h>
#include <psapi.h>
#include <wrl/client.h>

#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstring>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <limits>
#include <memory>
#include <optional>
#include <sstream>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;

namespace {

constexpr wchar_t kWindowClass[] = L"ZTerminalPhase0NativeHost";
constexpr wchar_t kWindowTitle[] = L"ZTerminal";
constexpr std::size_t kMaximumVisibleCandles = 2'000;
constexpr std::size_t kVerticesPerCandle = 32;
constexpr std::size_t kMaximumVertices = (kMaximumVisibleCandles * kVerticesPerCandle) + 1024;

using Clock = std::chrono::steady_clock;

struct FrameSummary {
    std::size_t count{};
    double average_ms{};
    double p95_ms{};
    double maximum_ms{};
};

class FrameStats final {
public:
    void add(double elapsed_ms) {
        if (samples_.size() == kMaximumSamples) {
            samples_.erase(samples_.begin());
        }
        samples_.push_back(elapsed_ms);
    }

    [[nodiscard]] FrameSummary summarize() const {
        if (samples_.empty()) {
            return {};
        }
        std::vector<double> ordered = samples_;
        std::sort(ordered.begin(), ordered.end());
        double total{};
        for (double sample : ordered) {
            total += sample;
        }
        const auto p95_index = static_cast<std::size_t>(0.95 * static_cast<double>(ordered.size() - 1));
        return {
            .count = ordered.size(),
            .average_ms = total / static_cast<double>(ordered.size()),
            .p95_ms = ordered[p95_index],
            .maximum_ms = ordered.back(),
        };
    }

private:
    static constexpr std::size_t kMaximumSamples = 32'768;
    std::vector<double> samples_;
};

struct ChartCandle {
    double open{};
    double high{};
    double low{};
    double close{};
    uint64_t time_ns{};
    int64_t volume{},open_ticks{},high_ticks{},low_ticks{},close_ticks{};
};

struct ChartView {
    std::size_t first{};
    std::size_t visible{600};
    POINT cursor{};
    bool has_cursor{};
    bool dragging{};
    int drag_start_x{};
    std::size_t drag_start_first{};
    double logical_first{-1}, logical_count{}, drag_logical_first{};
};

zterminal::chart::Scene verified_scene;
int64_t price_origin{};
zterminal::native_chart::Appearance chart_appearance;
double chart_scale{1};
zterminal::chart::View effective_view(const ChartView& v) { return {v.logical_first<0 ? double(v.first):v.logical_first,v.logical_count<=0 ? double(v.visible):v.logical_count}; }

struct Vertex {
    float position[2];
    float color[4];
};

[[nodiscard]] const char* feature_level_name(D3D_FEATURE_LEVEL level) {
    switch (level) {
    case D3D_FEATURE_LEVEL_11_1:
        return "11_1";
    case D3D_FEATURE_LEVEL_11_0:
        return "11_0";
    case D3D_FEATURE_LEVEL_10_1:
        return "10_1";
    default:
        return "unknown";
    }
}

[[nodiscard]] std::vector<ChartCandle> fixture_candles(std::size_t count) {
    std::vector<ChartCandle> candles;
    candles.reserve(count);
    double prior_close = 100'000.0;
    for (std::size_t index = 0; index < count; ++index) {
        const double phase = static_cast<double>(index);
        const double trend = phase * 0.012;
        const double wave = std::sin(phase * 0.071) * 310.0 + std::cos(phase * 0.017) * 180.0;
        const double open = prior_close;
        const double close = 100'000.0 + trend + wave;
        const double spread = 55.0 + std::abs(std::sin(phase * 0.31)) * 240.0;
        candles.push_back({
            .open = open,
            .high = std::max(open, close) + spread,
            .low = std::min(open, close) - spread,
            .close = close,
            .time_ns = (index+1)*60'000'000'000ULL,
            .volume = static_cast<int64_t>(index%1000),
        });
        prior_close = close;
    }
    return candles;
}

[[nodiscard]] std::string utf8_from_wide(const std::wstring& input) {
    if (input.empty()) {
        return {};
    }
    const int required = WideCharToMultiByte(CP_UTF8, 0, input.data(), static_cast<int>(input.size()), nullptr, 0, nullptr, nullptr);
    if (required <= 0) {
        return "unavailable";
    }
    std::string output(static_cast<std::size_t>(required), '\0');
    (void)WideCharToMultiByte(CP_UTF8, 0, input.data(), static_cast<int>(input.size()), output.data(), required, nullptr, nullptr);
    return output;
}

[[nodiscard]] std::string json_escape(const std::string& input) {
    std::ostringstream output;
    for (const unsigned char character : input) {
        switch (character) {
        case '\\': output << "\\\\"; break;
        case '"': output << "\\\""; break;
        case '\n': output << "\\n"; break;
        case '\r': output << "\\r"; break;
        case '\t': output << "\\t"; break;
        default:
            if (character < 0x20U) {
                output << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<unsigned int>(character) << std::dec;
            } else {
                output << static_cast<char>(character);
            }
            break;
        }
    }
    return output.str();
}

[[nodiscard]] ComPtr<IDXGIAdapter> desktop_output_adapter() {
    ComPtr<IDXGIFactory1> factory;
    if (FAILED(CreateDXGIFactory1(IID_PPV_ARGS(factory.GetAddressOf())))) {
        return {};
    }
    for (UINT adapter_index = 0; ; ++adapter_index) {
        ComPtr<IDXGIAdapter> adapter;
        if (factory->EnumAdapters(adapter_index, adapter.GetAddressOf()) == DXGI_ERROR_NOT_FOUND) {
            break;
        }
        for (UINT output_index = 0; ; ++output_index) {
            ComPtr<IDXGIOutput> output;
            if (adapter->EnumOutputs(output_index, output.GetAddressOf()) == DXGI_ERROR_NOT_FOUND) {
                break;
            }
            DXGI_OUTPUT_DESC description{};
            if (SUCCEEDED(output->GetDesc(&description)) && description.AttachedToDesktop) {
                return adapter;
            }
        }
    }
    return {};
}

void append_rectangle(
    std::vector<Vertex>& vertices,
    float left,
    float top,
    float right,
    float bottom,
    const std::array<float, 4>& color) {
    const auto vertex = [&color](float x, float y) {
        Vertex result{};
        result.position[0] = x;
        result.position[1] = y;
        std::copy(color.begin(), color.end(), result.color);
        return result;
    };
    vertices.push_back(vertex(left, top));
    vertices.push_back(vertex(right, top));
    vertices.push_back(vertex(right, bottom));
    vertices.push_back(vertex(left, top));
    vertices.push_back(vertex(right, bottom));
    vertices.push_back(vertex(left, bottom));
}

class Renderer final {
public:
    bool initialize(HWND window, zterminal::native_chart::AttachSwapChain attach = {}) {
        window_ = window;
        attach_swap_chain_ = std::move(attach);
        return recreate_device_resources();
    }

    bool recreate_device_resources() {
        text_target_.Reset(); text_brush_.Reset(); text_format_.Reset(); font_collection_.Reset(); text_factory_.Reset(); d2d_factory_.Reset();
        render_target_.Reset();
        vertex_buffer_.Reset();
        clear_retained_vertices(false);
        input_layout_.Reset();
        vertex_shader_.Reset();
        pixel_shader_.Reset();
        rasterizer_state_.Reset();
        swap_chain_.Reset();
        context_.Reset();
        device_.Reset();
        used_warp_ = false;
        selected_feature_level_ = {};
        adapter_description_.clear();

        DXGI_SWAP_CHAIN_DESC descriptor{};
        descriptor.BufferCount = 2;
        descriptor.BufferDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
        descriptor.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
        descriptor.OutputWindow = window_;
        descriptor.SampleDesc.Count = 1;
        descriptor.Windowed = TRUE;
        descriptor.SwapEffect = DXGI_SWAP_EFFECT_DISCARD;

        constexpr std::array<D3D_FEATURE_LEVEL, 3> levels{
            D3D_FEATURE_LEVEL_11_1,
            D3D_FEATURE_LEVEL_11_0,
            D3D_FEATURE_LEVEL_10_1,
        };

        ComPtr<IDXGIAdapter> output_adapter = desktop_output_adapter();
        const auto create_device = [&](IDXGIAdapter* adapter, D3D_DRIVER_TYPE driver) {
            if (attach_swap_chain_) {
                return D3D11CreateDevice(adapter, driver, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                    levels.data(), static_cast<UINT>(levels.size()), D3D11_SDK_VERSION,
                    device_.ReleaseAndGetAddressOf(), &selected_feature_level_, context_.ReleaseAndGetAddressOf());
            }
            return D3D11CreateDeviceAndSwapChain(adapter, driver, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                levels.data(), static_cast<UINT>(levels.size()), D3D11_SDK_VERSION, &descriptor,
                swap_chain_.ReleaseAndGetAddressOf(), device_.ReleaseAndGetAddressOf(),
                &selected_feature_level_, context_.ReleaseAndGetAddressOf());
        };
        HRESULT result = create_device(output_adapter.Get(),
            output_adapter ? D3D_DRIVER_TYPE_UNKNOWN : D3D_DRIVER_TYPE_HARDWARE);
        if (FAILED(result) && output_adapter) {
            // A display adapter can reject a requested feature level. Retain the
            // legacy hardware fallback before considering software rendering.
            output_adapter.Reset();
            result = create_device(nullptr, D3D_DRIVER_TYPE_HARDWARE);
        }
        if (FAILED(result) && !recovering_device_) {
            used_warp_ = true;
            result = create_device(nullptr, D3D_DRIVER_TYPE_WARP);
        }
        if (FAILED(result)) {
            last_renderer_error_ = result;
            return false;
        }
        if (attach_swap_chain_) {
            ComPtr<IDXGIDevice> dxgi_device;
            ComPtr<IDXGIAdapter> adapter;
            ComPtr<IDXGIFactory2> factory;
            ComPtr<IDXGISwapChain1> composition_chain;
            DXGI_SWAP_CHAIN_DESC1 composition{};
            composition.Width = std::max<UINT>(1, width_);
            composition.Height = std::max<UINT>(1, height_);
            composition.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
            composition.SampleDesc.Count = 1;
            composition.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
            composition.BufferCount = 2;
            composition.SwapEffect = DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL;
            composition.AlphaMode = DXGI_ALPHA_MODE_IGNORE;
            composition.Scaling = DXGI_SCALING_STRETCH;
            if (FAILED(result = device_.As(&dxgi_device))
                || FAILED(result = dxgi_device->GetAdapter(adapter.GetAddressOf()))
                || FAILED(result = adapter->GetParent(IID_PPV_ARGS(factory.GetAddressOf())))
                || FAILED(result = factory->CreateSwapChainForComposition(device_.Get(), &composition, nullptr, composition_chain.GetAddressOf()))
                || FAILED(result = composition_chain.As(&swap_chain_))
                || FAILED(result = attach_swap_chain_(swap_chain_.Get()))) {
                last_renderer_error_ = result;
                return false;
            }
            if(!apply_composition_scale())return false;
        }
        populate_adapter_diagnostics();
        if (!create_render_target() || !create_pipeline()) {
            return false;
        }
        advance_geometry_revision();
        return true;
    }

    [[nodiscard]] bool resize(UINT width, UINT height) {
        if (!swap_chain_ || !context_ || width == 0 || height == 0) {
            return false;
        }
        context_->OMSetRenderTargets(0, nullptr, nullptr);
        context_->ClearState();
        context_->Flush();
        render_target_.Reset();
        text_target_.Reset(); text_brush_.Reset();
        const HRESULT result = swap_chain_->ResizeBuffers(0, width, height, DXGI_FORMAT_UNKNOWN, 0);
        if (SUCCEEDED(result) && create_render_target()) {
            width_ = width;
            height_ = height;
            ++resize_successes_;
            advance_geometry_revision();
            return true;
        }
        last_renderer_error_ = FAILED(result) ? result : E_FAIL;
        if (is_device_loss(last_renderer_error_)) {
            return recover_device(last_renderer_error_);
        }
        ++resize_failures_;
        return false;
    }

    void render(
        const std::vector<ChartCandle>& candles,
        const ChartView& view,
        std::uint64_t scene_revision,
        std::uint64_t view_revision,
        bool force_rebuild,
        bool unsynchronised_present,
        bool verify_pixels = false,
        std::optional<zterminal::native_chart::RasterSnapshot>* raster = nullptr
    ) {
        if (!context_ || !render_target_ || !swap_chain_ || !vertex_buffer_) {
            return;
        }
        const auto frame_started = Clock::now();
        const auto& background=chart_appearance.background;
        ID3D11RenderTargetView* const targets[] = {render_target_.Get()};
        context_->OMSetRenderTargets(1, targets, nullptr);
        // ClearState during resize discards the viewport too. Bind the complete
        // 2D rasterization state on every draw, including the first frame.
        const D3D11_VIEWPORT viewport{0.0F, 0.0F, static_cast<float>(width_), static_cast<float>(height_), 0.0F, 1.0F};
        context_->RSSetViewports(1, &viewport);
        context_->RSSetState(rasterizer_state_.Get());
        context_->ClearRenderTargetView(render_target_.Get(), background.data());

        bool can_draw = false;
        if (candles.empty()) {
            clear_retained_vertices(true);
        } else {
            const RenderInputRevision input_revision{
                .scene = scene_revision,
                .view = view_revision,
                .geometry = geometry_revision_,
            };
            if (force_rebuild || !retained_input_revision_.has_value() || *retained_input_revision_ != input_revision) {
                rebuild_retained_vertices(candles, view, input_revision);
            }
            if (retained_upload_required_ && retained_vertex_count_ > 0) {
                D3D11_MAPPED_SUBRESOURCE mapped{};
                if (SUCCEEDED(context_->Map(vertex_buffer_.Get(), 0, D3D11_MAP_WRITE_DISCARD, 0, &mapped))) {
                    std::memcpy(mapped.pData, retained_vertices_.data(), retained_vertices_.size() * sizeof(Vertex));
                    context_->Unmap(vertex_buffer_.Get(), 0);
                    retained_upload_required_ = false;
                    ++vertex_buffer_uploads_;
                }
            } else if (retained_vertex_count_ > 0) {
                ++retained_draw_reuses_;
            }
            can_draw = retained_vertex_count_ > 0 && !retained_upload_required_;
        }
        if (can_draw) {
            const UINT stride = sizeof(Vertex);
            const UINT offset = 0;
            context_->IASetInputLayout(input_layout_.Get());
            context_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
            ID3D11Buffer* const buffers[] = {vertex_buffer_.Get()};
            context_->IASetVertexBuffers(0, 1, buffers, &stride, &offset);
            context_->VSSetShader(vertex_shader_.Get(), nullptr, 0);
            context_->PSSetShader(pixel_shader_.Get(), nullptr, 0);
            context_->Draw(retained_vertex_count_, 0);
        }

        draw_labels(candles, view);
        // Flip Present rotates the buffers. Diagnostic readback must observe
        // this completed frame before Present, never a previous back buffer.
        if (raster) *raster = capture_raster();
        if (verify_pixels && !verified_chart_pixels_.has_value()) {
            verified_chart_pixels_ = verify_rendered_pixels();
        }
        const HRESULT present_result = swap_chain_->Present(unsynchronised_present ? 0U : 1U, 0);
        if (SUCCEEDED(present_result)) {
            frame_stats_.add(std::chrono::duration<double, std::milli>(Clock::now() - frame_started).count());
        } else {
            last_renderer_error_ = present_result;
            if (is_device_loss(present_result)) {
                (void)recover_device(present_result);
            } else {
                ++present_failures_;
            }
        }
    }

    [[nodiscard]] bool used_warp() const { return used_warp_; }
    [[nodiscard]] D3D_FEATURE_LEVEL feature_level() const { return selected_feature_level_; }
    [[nodiscard]] const std::wstring& adapter_description() const { return adapter_description_; }
    [[nodiscard]] FrameSummary frame_summary() const { return frame_stats_.summarize(); }
    [[nodiscard]] FrameSummary geometry_summary() const { return geometry_stats_.summarize(); }
    [[nodiscard]] UINT pixel_width() const { return width_; }
    [[nodiscard]] UINT pixel_height() const { return height_; }
    [[nodiscard]] std::uint64_t resize_successes() const { return resize_successes_; }
    [[nodiscard]] std::uint64_t resize_failures() const { return resize_failures_; }
    [[nodiscard]] std::uint64_t device_recoveries() const { return device_recoveries_; }
    [[nodiscard]] std::uint64_t unrecoverable_device_failures() const { return unrecoverable_device_failures_; }
    [[nodiscard]] std::uint64_t present_failures() const { return present_failures_; }
    [[nodiscard]] HRESULT last_renderer_error() const { return last_renderer_error_; }
    [[nodiscard]] std::uint64_t vertex_buffer_uploads() const { return vertex_buffer_uploads_; }
    [[nodiscard]] std::uint64_t retained_draw_reuses() const { return retained_draw_reuses_; }
    [[nodiscard]] std::uint64_t retained_vertex_clears() const { return retained_vertex_clears_; }
    [[nodiscard]] std::uint64_t retained_vertex_rebuilds() const { return retained_vertex_rebuilds_; }
    std::pair<double,double> interaction_bounds(const std::vector<ChartCandle>& candles,const ChartView& view) const { auto p=plot(candles,view); return {p.left,p.left+(p.right-p.left)*p.count/p.slots}; }
    void set_scale(double scale) {
        auto next=std::clamp(scale,.5,4.0); if(next==chart_scale)return; chart_scale=next;
        (void)apply_composition_scale();
        if(text_factory_) (void)text_factory_->CreateTextFormat(L"Geist Mono",font_collection_.Get(),DWRITE_FONT_WEIGHT_NORMAL,DWRITE_FONT_STYLE_NORMAL,DWRITE_FONT_STRETCH_NORMAL,float(12*chart_scale),L"en-US",text_format_.ReleaseAndGetAddressOf());
        advance_geometry_revision();
    }

private:
    bool apply_composition_scale() {
        if(!attach_swap_chain_)return true;
        ComPtr<IDXGISwapChain2> chain;
        if(FAILED(swap_chain_.As(&chain)))return false;
        const DXGI_MATRIX_3X2_F inverse{float(1/chart_scale),0,0,float(1/chart_scale),0,0};
        auto result=chain->SetMatrixTransform(&inverse); if(FAILED(result))last_renderer_error_=result; return SUCCEEDED(result);
    }
    [[nodiscard]] static bool is_device_loss(HRESULT result) {
        return result == DXGI_ERROR_DEVICE_REMOVED
            || result == DXGI_ERROR_DEVICE_RESET
            || result == DXGI_ERROR_DEVICE_HUNG;
    }

    bool recover_device(HRESULT result) {
        last_renderer_error_ = result;
        recovering_device_ = true;
        const bool recovered = recreate_device_resources();
        recovering_device_ = false;
        if (recovered) {
            ++device_recoveries_;
            return true;
        }
        ++unrecoverable_device_failures_;
        return false;
    }

    bool create_render_target() {
        ComPtr<ID3D11Texture2D> back_buffer;
        if (FAILED(swap_chain_->GetBuffer(0, IID_PPV_ARGS(back_buffer.GetAddressOf())))) {
            return false;
        }
        D3D11_TEXTURE2D_DESC description{};
        back_buffer->GetDesc(&description);
        width_ = description.Width;
        height_ = description.Height;
        if(FAILED(device_->CreateRenderTargetView(back_buffer.Get(), nullptr, render_target_.GetAddressOf()))) return false;
        if(!d2d_factory_ && FAILED(D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED,d2d_factory_.GetAddressOf()))) return false;
        if(!text_factory_ && FAILED(DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED,__uuidof(IDWriteFactory),reinterpret_cast<IUnknown**>(text_factory_.GetAddressOf())))) return false;
        if(!font_collection_) {
            ComPtr<IDWriteFactory5> factory; ComPtr<IDWriteFontSetBuilder1> builder; ComPtr<IDWriteFontSet> fonts;
            if(FAILED(text_factory_.As(&factory)) || FAILED(factory->CreateFontSetBuilder(builder.GetAddressOf())))return false;
            wchar_t exe[32768]{}; GetModuleFileNameW(nullptr,exe,32768); auto assets=std::filesystem::path(exe).parent_path()/L"Assets";
            for(auto name:{L"Geist-Regular.ttf",L"GeistMono.ttf"}) {
                ComPtr<IDWriteFontFile> file; if(FAILED(factory->CreateFontFileReference((assets/name).c_str(),nullptr,file.GetAddressOf())) || FAILED(builder->AddFontFile(file.Get())))return false;
            }
            if(FAILED(builder->CreateFontSet(fonts.GetAddressOf())) || FAILED(factory->CreateFontCollectionFromFontSet(fonts.Get(),font_collection_.GetAddressOf())))return false;
        }
        ComPtr<IDXGISurface> surface; if(FAILED(back_buffer.As(&surface))) return false;
        auto props=D2D1::RenderTargetProperties(D2D1_RENDER_TARGET_TYPE_DEFAULT,D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM,D2D1_ALPHA_MODE_IGNORE),96,96);
        if(FAILED(d2d_factory_->CreateDxgiSurfaceRenderTarget(surface.Get(),props,text_target_.ReleaseAndGetAddressOf()))) return false;
        if(FAILED(text_target_->CreateSolidColorBrush(D2D1::ColorF(.65f,.64f,.72f),text_brush_.ReleaseAndGetAddressOf()))) return false;
        return SUCCEEDED(text_factory_->CreateTextFormat(L"Geist Mono",font_collection_.Get(),DWRITE_FONT_WEIGHT_NORMAL,DWRITE_FONT_STYLE_NORMAL,DWRITE_FONT_STRETCH_NORMAL,float(12*chart_scale),L"en-US",text_format_.ReleaseAndGetAddressOf()));
    }

public:
    [[nodiscard]] std::optional<std::uint64_t> verified_chart_pixels() const { return verified_chart_pixels_; }
    // Explicit diagnostic only. Reading pixels catches a successful Draw/Present
    // that produced no chart, which aggregate HRESULT counters cannot detect.
    [[nodiscard]] std::optional<zterminal::native_chart::RasterSnapshot> capture_raster() {
        ComPtr<ID3D11Texture2D> back_buffer;
        if (FAILED(swap_chain_->GetBuffer(0, IID_PPV_ARGS(back_buffer.GetAddressOf())))) return std::nullopt;
        D3D11_TEXTURE2D_DESC description{};
        back_buffer->GetDesc(&description);
        description.Usage = D3D11_USAGE_STAGING;
        description.BindFlags = 0;
        description.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
        description.MiscFlags = 0;
        ComPtr<ID3D11Texture2D> staging;
        if (FAILED(device_->CreateTexture2D(&description, nullptr, staging.GetAddressOf()))) return std::nullopt;
        context_->CopyResource(staging.Get(), back_buffer.Get());
        D3D11_MAPPED_SUBRESOURCE mapped{};
        if (FAILED(context_->Map(staging.Get(), 0, D3D11_MAP_READ, 0, &mapped))) return std::nullopt;
        zterminal::native_chart::RasterSnapshot result{description.Width,description.Height,{}};
        result.bgra.resize(size_t(description.Width)*description.Height*4);
        for (UINT row = 0; row < description.Height; ++row) {
            const auto* pixels = static_cast<const unsigned char*>(mapped.pData) + row * mapped.RowPitch;
            std::memcpy(result.bgra.data()+size_t(row)*description.Width*4,pixels,size_t(description.Width)*4);
        }
        context_->Unmap(staging.Get(), 0);
        return result;
    }
    [[nodiscard]] std::optional<std::uint64_t> verify_rendered_pixels() {
        auto image=capture_raster(); if(!image)return std::nullopt;
        std::uint64_t count=0;
        for(size_t i=0;i<image->bgra.size();i+=4)if(image->bgra[i]>40||image->bgra[i+1]>40||image->bgra[i+2]>40)++count;
        return count;
    }

private:

    bool create_pipeline() {
        constexpr char shader_source[] = R"(
            struct VertexInput { float2 position : POSITION; float4 color : COLOR; };
            struct PixelInput { float4 position : SV_POSITION; float4 color : COLOR; };
            PixelInput VSMain(VertexInput input) { PixelInput output; output.position = float4(input.position, 0.0, 1.0); output.color = input.color; return output; }
            float4 PSMain(PixelInput input) : SV_TARGET { return input.color; }
        )";
        ComPtr<ID3DBlob> vertex_code;
        ComPtr<ID3DBlob> pixel_code;
        if (FAILED(D3DCompile(shader_source, sizeof(shader_source) - 1, nullptr, nullptr, nullptr, "VSMain", "vs_4_0", 0, 0, vertex_code.GetAddressOf(), nullptr))
            || FAILED(D3DCompile(shader_source, sizeof(shader_source) - 1, nullptr, nullptr, nullptr, "PSMain", "ps_4_0", 0, 0, pixel_code.GetAddressOf(), nullptr))) {
            return false;
        }
        if (FAILED(device_->CreateVertexShader(vertex_code->GetBufferPointer(), vertex_code->GetBufferSize(), nullptr, vertex_shader_.GetAddressOf()))
            || FAILED(device_->CreatePixelShader(pixel_code->GetBufferPointer(), pixel_code->GetBufferSize(), nullptr, pixel_shader_.GetAddressOf()))) {
            return false;
        }
        constexpr std::array<D3D11_INPUT_ELEMENT_DESC, 2> layout{{
            {"POSITION", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 0, D3D11_INPUT_PER_VERTEX_DATA, 0},
            {"COLOR", 0, DXGI_FORMAT_R32G32B32A32_FLOAT, 0, 8, D3D11_INPUT_PER_VERTEX_DATA, 0},
        }};
        if (FAILED(device_->CreateInputLayout(layout.data(), static_cast<UINT>(layout.size()), vertex_code->GetBufferPointer(), vertex_code->GetBufferSize(), input_layout_.GetAddressOf()))) {
            return false;
        }
        D3D11_BUFFER_DESC buffer{};
        buffer.ByteWidth = static_cast<UINT>(kMaximumVertices * sizeof(Vertex));
        buffer.Usage = D3D11_USAGE_DYNAMIC;
        buffer.BindFlags = D3D11_BIND_VERTEX_BUFFER;
        buffer.CPUAccessFlags = D3D11_CPU_ACCESS_WRITE;
        D3D11_RASTERIZER_DESC rasterizer{};
        rasterizer.FillMode = D3D11_FILL_SOLID;
        rasterizer.CullMode = D3D11_CULL_NONE;
        rasterizer.DepthClipEnable = TRUE;
        if (FAILED(device_->CreateRasterizerState(&rasterizer, rasterizer_state_.GetAddressOf()))) return false;
        return SUCCEEDED(device_->CreateBuffer(&buffer, nullptr, vertex_buffer_.GetAddressOf()));
    }

    struct RenderInputRevision {
        std::uint64_t scene{};
        std::uint64_t view{};
        std::uint64_t geometry{};

        [[nodiscard]] bool operator==(const RenderInputRevision&) const = default;
    };

    void advance_geometry_revision() {
        if (geometry_revision_ < std::numeric_limits<std::uint64_t>::max()) {
            ++geometry_revision_;
        }
    }

    void clear_retained_vertices(bool record_clear) {
        if (retained_vertex_count_ > 0 && record_clear) {
            ++retained_vertex_clears_;
        }
        retained_vertices_.clear();
        retained_vertex_count_ = 0;
        retained_input_revision_.reset();
        retained_upload_required_ = false;
    }

    void rebuild_retained_vertices(
        const std::vector<ChartCandle>& candles,
        const ChartView& view,
        RenderInputRevision input_revision
    ) {
        const auto started=Clock::now();
        retained_vertices_.clear();
        if (retained_vertices_.capacity() < kMaximumVertices) {
            retained_vertices_.reserve(kMaximumVertices);
        }
        chart_vertices(candles, view, retained_vertices_);
        if (retained_vertices_.size() > kMaximumVertices) {
            clear_retained_vertices(true);
            return;
        }
        retained_vertex_count_ = static_cast<UINT>(retained_vertices_.size());
        retained_input_revision_ = input_revision;
        retained_upload_required_ = retained_vertex_count_ > 0;
        ++retained_vertex_rebuilds_;
        geometry_stats_.add(std::chrono::duration<double,std::milli>(Clock::now()-started).count());
    }

    struct Plot {
        double left, right, top, bottom, volume_top, volume_bottom;
        double first, count, low, high, maximum_volume, slots;
        zterminal::chart::PriceProjection price;bool valid;
    };
    double measured_width(const std::wstring& text) const {
        ComPtr<IDWriteTextLayout> layout; DWRITE_TEXT_METRICS metrics{};
        if(!text_factory_ || !text_format_ || FAILED(text_factory_->CreateTextLayout(text.data(),static_cast<UINT32>(text.size()),text_format_.Get(),10000,1000,layout.GetAddressOf())) || FAILED(layout->GetMetrics(&metrics))) return 0;
        return metrics.widthIncludingTrailingWhitespace;
    }
    std::wstring price_label(double relative) const {
        if(verified_scene.version==2 && relative>=double(INT64_MIN) && relative<double(INT64_MAX)) {
            auto delta=static_cast<int64_t>(std::llround(relative));
            if((delta>0 && price_origin>INT64_MAX-delta)||(delta<0 && price_origin<INT64_MIN-delta)) return L"Out of range";
            auto label=zterminal::chart::format_units(price_origin+delta,verified_scene.price_step);
            return std::wstring(label.begin(),label.end());
        }
        std::wostringstream s; s<<std::fixed<<std::setprecision(2)<<relative; return s.str();
    }
    Plot plot(const std::vector<ChartCandle>& candles,const ChartView& view) const {
        auto v=effective_view(view); v.count=std::clamp(v.count,1.0,double(std::min(kMaximumVisibleCandles,candles.size())));
        v.first=std::clamp(v.first,0.0,std::max(0.0,double(candles.size())-v.count));
        double low=std::numeric_limits<double>::max(),high=std::numeric_limits<double>::lowest(),volume=0;
        auto end=std::min(candles.size(),size_t(std::ceil(v.first+v.count)));
        for(size_t i=size_t(v.first);i<end;++i) { low=std::min(low,candles[i].low); high=std::max(high,candles[i].high); volume=std::max(volume,double(candles[i].volume)); }
        auto& a=chart_appearance;
        double price_bottom=std::max(33*chart_scale,double(height_)*(a.volume?1-a.volume_ratio-.02:1)-28*chart_scale);
        double volume_top=a.volume?price_bottom+20*chart_scale:price_bottom,volume_bottom=a.volume?std::max(volume_top+1,double(height_)-28*chart_scale):price_bottom;
        auto projection=zterminal::chart::PriceProjection::make(a.scale,a.inverted,price_origin,candles[size_t(v.first)].close,low,high,32*chart_scale,price_bottom,a.margin_top,a.margin_bottom);
        auto transformed_low=projection?projection->axis.low:low,transformed_high=projection?projection->axis.high:high;
        auto label=[&](double q){if(projection&&a.scale==zterminal::chart::ScaleMode::Percentage){std::wostringstream t;t<<std::fixed<<std::setprecision(2)<<q<<L'%';return t.str();}return price_label(projection?projection->inverse(q):q);};
        double axis=std::max(90*chart_scale,std::max(measured_width(label(transformed_low)),measured_width(label(transformed_high)))+18*chart_scale);
        double slots=v.count+(v.first+v.count>=double(candles.size())-.00001?a.future_bars:0);
        return {12*chart_scale,std::max(13*chart_scale,double(width_)-axis),32*chart_scale,price_bottom,volume_top,volume_bottom,v.first,v.count,transformed_low,transformed_high,std::max(1.0,volume),slots,projection.value_or(zterminal::chart::PriceProjection{}),bool(projection)};
    }
    std::wstring axis_label(double relative,const Plot& p) const {
        if(chart_appearance.scale!=zterminal::chart::ScaleMode::Percentage)return price_label(relative);
        std::wostringstream text;text<<std::fixed<<std::setprecision(std::clamp(int(std::ceil(-std::log10(100/std::abs(p.price.base))))+1,2,18))<<p.price.forward(relative)<<L'%';return text.str();
    }

    std::vector<double> axis_ticks(const Plot& p) const {
        std::vector<double> result;
        auto levels=zterminal::chart::tick_levels(p.low,p.high,unsigned(std::clamp((p.bottom-p.top)/(30*chart_scale),2.0,6.0)),chart_appearance.scale==zterminal::chart::ScaleMode::Normal?1.0:0.0);
        for(auto level:levels){auto relative=std::round(p.price.inverse(level));if(chart_appearance.scale==zterminal::chart::ScaleMode::Logarithmic)relative=std::max(relative,1-double(price_origin));if(result.empty()||relative!=result.back())result.push_back(relative);}
        return result;
    }
    static std::wstring utc_label(uint64_t ns) {
        // Windows FILETIME uses 100 ns units since 1601. Preserve originals.
        auto ticks=ns/100+116444736000000000ULL; FILETIME ft{DWORD(ticks),DWORD(ticks>>32)}; SYSTEMTIME st{};
        if(!FileTimeToSystemTime(&ft,&st)) return L"UTC out of range";
        std::wostringstream s; s<<std::setfill(L'0')<<std::setw(4)<<st.wYear<<L'-'<<std::setw(2)<<st.wMonth<<L'-'<<std::setw(2)<<st.wDay<<L' '<<std::setw(2)<<st.wHour<<L':'<<std::setw(2)<<st.wMinute<<L':'<<std::setw(2)<<st.wSecond<<L" UTC"; return s.str();
    }
public:
    bool valid_projection(const std::vector<ChartCandle>& candles,const ChartView& view) const {return candles.empty()||plot(candles,view).valid;}
    bool contains_data_point(const std::vector<ChartCandle>& candles,const ChartView& view,int x,int y) const {
        if(candles.empty())return false;
        auto p=plot(candles,view);
        return p.valid&&p.right-p.left>=2&&p.bottom-p.top>=2&&x>=p.left&&x<p.right&&y>=p.top&&y<(chart_appearance.volume?p.volume_bottom:p.bottom);
    }
    std::wstring last_visible_price(const std::vector<ChartCandle>& candles,const ChartView& view) const {
        if(candles.empty())return {};
        auto p=plot(candles,view);
        auto last=std::min(candles.size(),size_t(std::ceil(p.first+p.count)))-1;
        return price_label(candles[last].close);
    }
    std::wstring pointer_readout(const std::vector<ChartCandle>& candles,const ChartView& view) const {
        if(!view.has_cursor||!contains_data_point(candles,view,view.cursor.x,view.cursor.y))return {};
        auto p=plot(candles,view);
        if(view.cursor.x<p.left||view.cursor.x>=p.right||view.cursor.y<p.top||view.cursor.y>=p.volume_bottom)return {};
        auto index=size_t(p.first+(view.cursor.x-p.left)/(p.right-p.left)*p.slots);
        if(index>=candles.size())return L"Future time · no observation";
        const auto& b=candles[index];
        auto label=utc_label(b.time_ns)+L"  O "+price_label(b.open)+L" H "+price_label(b.high)+L" L "+price_label(b.low)+L" C "+price_label(b.close);
        if(verified_scene.version==2) {
            auto quantity=zterminal::chart::format_units(b.volume,verified_scene.quantity_step);
            label+=L" V "+std::wstring(quantity.begin(),quantity.end());
        }
        return label;
    }
private:
    void draw_labels(const std::vector<ChartCandle>& candles,const ChartView& view) {
        if(candles.empty() || !text_target_) return;
        auto p=plot(candles,view); if(!p.valid || p.right-p.left<2 || p.bottom-p.top<2) return;
        text_target_->BeginDraw();
        auto text=[&](std::wstring label,double x,double y,double width) { text_target_->DrawText(label.data(),UINT32(label.size()),text_format_.Get(),D2D1::RectF(float(x),float(y),float(x+width),float(y+20*chart_scale)),text_brush_.Get(),D2D1_DRAW_TEXT_OPTIONS_CLIP); };
        auto transform=p.price;
        auto last=std::min(candles.size(),size_t(std::ceil(p.first+p.count)))-1;
        auto last_y=transform.y(candles[last].close);
        for(auto level:axis_ticks(p)) {
            if(!chart_appearance.price_line||std::abs(transform.y(level)-last_y)>=20*chart_scale)text(axis_label(level,p),p.right+8*chart_scale,transform.y(level)-8*chart_scale,width_-p.right-8*chart_scale);
        }
        if(chart_appearance.price_line&&(!chart_appearance.crosshair||!view.has_cursor||view.cursor.y>=p.bottom||std::abs(view.cursor.y-last_y)>=20*chart_scale)) {
            auto original=text_brush_->GetColor();
            const auto& ink=candles[last].close>=candles[last].open?chart_appearance.up:chart_appearance.down;
            text_brush_->SetColor(D2D1::ColorF(ink[0],ink[1],ink[2]));
            text_target_->FillRectangle(D2D1::RectF(float(p.right+4*chart_scale),float(last_y-10*chart_scale),float(width_),float(last_y+10*chart_scale)),text_brush_.Get());
            text_brush_->SetColor(ink[0]*.2126+ink[1]*.7152+ink[2]*.0722>.45?D2D1::ColorF(.04f,.04f,.06f):D2D1::ColorF(.94f,.94f,.97f));
            text(axis_label(candles[last].close,p),p.right+8*chart_scale,last_y-9*chart_scale,width_-p.right-8*chart_scale);
            text_brush_->SetColor(original);
        }
        double prior_end=-1;
        size_t prior_index=SIZE_MAX;
        for(int i=0;i<=4;++i) {
            auto index=std::min(candles.size()-1,size_t(p.first+(p.count-1)*i/4));
            if(index==prior_index) continue;
            prior_index=index;
            auto label=utc_label(candles[index].time_ns);
            double w=measured_width(label),center=p.left+(double(index)-p.first+.5)*(p.right-p.left)/p.slots;
            double x=std::clamp(center-w/2,0.0,std::max(0.0,double(width_)-w));
            if(x>prior_end+8*chart_scale) { text(label,x,height_-24*chart_scale,w+2); prior_end=x+w; }
        }
        if(chart_appearance.volume)text(L"Volume",p.left,p.volume_top-16*chart_scale,80*chart_scale);
        if(chart_appearance.crosshair && view.has_cursor && view.cursor.x>=p.left && view.cursor.x<p.right && view.cursor.y>=p.top && view.cursor.y<p.volume_bottom) {
            text(pointer_readout(candles,view),p.left,6*chart_scale,p.right-p.left);
            if(view.cursor.y<p.bottom)text(axis_label(transform.price(view.cursor.y),p),p.right+8*chart_scale,view.cursor.y-8*chart_scale,width_-p.right-8*chart_scale);
        }
        auto result=text_target_->EndDraw(); if(FAILED(result)) { last_renderer_error_=result; if(result==D2DERR_RECREATE_TARGET) { text_target_.Reset(); (void)recover_device(result); } }
    }
    void chart_vertices(
        const std::vector<ChartCandle>& candles,
        const ChartView& view,
        std::vector<Vertex>& vertices
    ) const {
        auto p=plot(candles,view); if(!p.valid || p.right-p.left<2 || p.bottom-p.top<2) return;
        auto transform=p.price;
        auto rectangle=[&](double l,double t,double r,double b,const std::array<float,4>& color,double clip_top,double clip_bottom) {
            auto clip=zterminal::chart::clipped({l,t,r,b},{p.left,clip_top,p.right,clip_bottom}); if(!clip)return;
            l=clip->left; r=clip->right; t=clip->top; b=clip->bottom;
            append_rectangle(vertices,float(l/width_*2-1),float(1-t/height_*2),float(r/width_*2-1),float(1-b/height_*2),color);
        };
        const double slot=(p.right-p.left)/p.slots;
        auto mixed=[](std::array<float,4> color,double opacity){for(int i=0;i<3;++i)color[i]=float(color[i]*opacity+chart_appearance.background[i]*(1-opacity));color[3]=1;return color;};
        const auto grid=mixed({1,1,1,1},chart_appearance.grid_opacity);
        if(chart_appearance.grid)for(auto level:axis_ticks(p)) { auto y=transform.y(level); rectangle(p.left,y,p.right,y+chart_scale,grid,p.top,p.bottom); }
        if(chart_appearance.grid)for(int i=0;i<=4;++i) { auto x=p.left+(p.right-p.left)*i/4; rectangle(x,p.top,x+chart_scale,p.volume_bottom,grid,p.top,p.volume_bottom); }
        const auto last=std::min(candles.size(),size_t(std::ceil(p.first+p.count)));
        if(chart_appearance.price_line&&last){const auto& ink=candles[last-1].close>=candles[last-1].open?chart_appearance.up:chart_appearance.down;auto y=transform.y(candles[last-1].close);rectangle(p.left,y,p.right,y+chart_scale,mixed(ink,.4),p.top,p.bottom);}
        for (size_t index=size_t(p.first);index<last;++index) {
            const ChartCandle& candle = candles[index];
            const double x=p.left+(double(index)-p.first+.5)*slot;
            const bool rising = candle.close >= candle.open;
            const auto& a=chart_appearance;const auto& color=rising?a.up:a.down;
            auto g=zterminal::chart::project_candle(candle.open,candle.high,candle.low,candle.close,candle.volume,x,slot,transform,p.volume_top,p.volume_bottom,p.maximum_volume,chart_scale);
            if(a.type==zterminal::native_chart::ChartType::Candles) {
                if(a.wicks)rectangle(g.wick.left,g.wick.top,g.wick.right,g.wick.bottom,rising?a.wick_up:a.wick_down,p.top,p.bottom);
                rectangle(g.body.left,g.body.top,g.body.right,g.body.bottom,a.borders?(rising?a.border_up:a.border_down):color,p.top,p.bottom);
                if(a.borders)rectangle(g.body.left+chart_scale,g.body.top+chart_scale,g.body.right-chart_scale,g.body.bottom-chart_scale,color,p.top,p.bottom);
            } else if(a.type==zterminal::native_chart::ChartType::Bars) {
                rectangle(x-chart_scale*.5,g.wick.top,x+chart_scale*.5,g.wick.bottom,color,p.top,p.bottom);
                auto o=transform.y(candle.open),c=transform.y(candle.close);
                rectangle(x-slot*.35,o,x,o+chart_scale,color,p.top,p.bottom);rectangle(x,c,x+slot*.35,c+chart_scale,color,p.top,p.bottom);
            } else if(index>0) {
                auto x0=x-slot,y0=transform.y(candles[index-1].close),y1=transform.y(candle.close);
                // Clip each segment to the semantic price pane before thickening.
                auto segment=zterminal::chart::clip_line({p.left,p.top,p.right,p.bottom},{x0,y0},{x,y1});
                if(segment){auto [u,v]=*segment;
                    auto vertex=[&](double px,double py,const std::array<float,4>& ink){return Vertex{{float(px/width_*2-1),float(1-py/height_*2)}, {ink[0],ink[1],ink[2],1}};};
                    if(a.type==zterminal::native_chart::ChartType::Area){auto fill=mixed(a.up,.18);auto left=vertex(u.x,u.y,fill),right=vertex(v.x,v.y,fill),bottom_left=vertex(u.x,p.bottom,fill),bottom_right=vertex(v.x,p.bottom,fill);vertices.insert(vertices.end(),{left,right,bottom_right,left,bottom_right,bottom_left});}
                    auto dx=v.x-u.x,dy=v.y-u.y,length=std::max(.0001,std::hypot(dx,dy));auto ox=-dy/length*chart_scale*.75,oy=dx/length*chart_scale*.75;
                    auto a0=vertex(u.x+ox,u.y+oy,a.up),a1=vertex(v.x+ox,v.y+oy,a.up),a2=vertex(v.x-ox,v.y-oy,a.up),a3=vertex(u.x-ox,u.y-oy,a.up);vertices.insert(vertices.end(),{a0,a1,a2,a0,a2,a3});
                }
            }
            if(a.volume)rectangle(g.volume.left,g.volume.top,g.volume.right,g.volume.bottom,color,p.volume_top,p.volume_bottom);
        }
        if (chart_appearance.crosshair && view.has_cursor && width_ > 0 && height_ > 0) {
            constexpr std::array<float, 4> crosshair{0.58F, 0.68F, 0.79F, 0.55F};
            if(view.cursor.x>=p.left && view.cursor.x<p.right && view.cursor.y>=p.top && view.cursor.y<p.volume_bottom) {
                rectangle(view.cursor.x,p.top,view.cursor.x+chart_scale,p.volume_bottom,crosshair,p.top,p.volume_bottom);
                if(view.cursor.y<p.bottom) rectangle(p.left,view.cursor.y,p.right,view.cursor.y+chart_scale,crosshair,p.top,p.bottom);
            }
        }
    }

    void populate_adapter_diagnostics() {
        ComPtr<IDXGIDevice> dxgi_device;
        ComPtr<IDXGIAdapter> adapter;
        DXGI_ADAPTER_DESC description{};
        if (SUCCEEDED(device_.As(&dxgi_device))
            && SUCCEEDED(dxgi_device->GetAdapter(adapter.GetAddressOf()))
            && SUCCEEDED(adapter->GetDesc(&description))) {
            adapter_description_ = description.Description;
        } else {
            adapter_description_ = L"unavailable";
        }
    }

    HWND window_{};
    zterminal::native_chart::AttachSwapChain attach_swap_chain_;
    bool used_warp_{};
    bool recovering_device_{};
    D3D_FEATURE_LEVEL selected_feature_level_{};
    UINT width_{1280};
    UINT height_{820};
    std::wstring adapter_description_;
    FrameStats frame_stats_;
    FrameStats geometry_stats_;
    std::uint64_t resize_successes_{};
    std::uint64_t resize_failures_{};
    std::uint64_t device_recoveries_{};
    std::uint64_t unrecoverable_device_failures_{};
    std::uint64_t present_failures_{};
    HRESULT last_renderer_error_{S_OK};
    std::vector<Vertex> retained_vertices_;
    std::optional<RenderInputRevision> retained_input_revision_;
    UINT retained_vertex_count_{};
    bool retained_upload_required_{};
    std::uint64_t vertex_buffer_uploads_{};
    std::uint64_t retained_draw_reuses_{};
    std::uint64_t retained_vertex_clears_{};
    std::uint64_t retained_vertex_rebuilds_{};
    std::uint64_t geometry_revision_{};
    ComPtr<ID3D11Device> device_;
    ComPtr<ID3D11DeviceContext> context_;
    ComPtr<IDXGISwapChain> swap_chain_;
    ComPtr<ID3D11RenderTargetView> render_target_;
    ComPtr<ID3D11VertexShader> vertex_shader_;
    ComPtr<ID3D11PixelShader> pixel_shader_;
    ComPtr<ID3D11InputLayout> input_layout_;
    ComPtr<ID3D11Buffer> vertex_buffer_;
    ComPtr<ID3D11RasterizerState> rasterizer_state_;
    ComPtr<ID2D1Factory> d2d_factory_;
    ComPtr<ID2D1RenderTarget> text_target_;
    ComPtr<ID2D1SolidColorBrush> text_brush_;
    ComPtr<IDWriteFactory> text_factory_;
    ComPtr<IDWriteTextFormat> text_format_;
    ComPtr<IDWriteFontCollection1> font_collection_;
    std::optional<std::uint64_t> verified_chart_pixels_;
};

enum class ChartSource {
    Unavailable,
    FixtureDiagnostic,
    LocalScene,
};

Renderer* renderer = nullptr;
ChartView chart_view;
std::vector<ChartCandle> chart_candles;
std::uint64_t chart_scene_revision{};
std::uint64_t chart_view_revision{};
bool force_chart_vertex_rebuild = false;
ChartSource chart_source = ChartSource::Unavailable;
zterminal::local_scene::Availability local_availability = zterminal::local_scene::Availability::Unavailable;
std::wstring local_diagnostic;
std::size_t local_total_bars{};
std::size_t local_first_bar{};
std::uint64_t local_age_ns{};
std::uint64_t local_navigation_reloads{};
std::uint64_t local_segment_switches{};
std::wstring local_history_diagnostic;
std::optional<zterminal::local_scene::Request> active_local_scene_request;
zterminal::local_monte_carlo::Result local_monte_carlo_result;
bool render_requested = true;
bool continuous_benchmark_rendering = false;
bool unsynchronised_benchmark_present = false;
bool benchmark_resize_once = false;

HWND workspace_brand{};
HWND workspace_state{};
HWND workspace_detail{};
HWND workspace_help{};
HFONT workspace_brand_font{};
HFONT workspace_state_font{};
HFONT workspace_body_font{};

void layout_workspace_overlay(HWND window) {
    if (workspace_brand == nullptr) {
        return;
    }
    RECT client{};
    GetClientRect(window, &client);
    const int width = std::max<LONG>(1, client.right - client.left);
    const int height = std::max<LONG>(1, client.bottom - client.top);
    const int left = std::max(32, (width - 640) / 2);
    const int top = std::max(68, (height - 220) / 2);
    SetWindowPos(workspace_brand, HWND_TOP, 30, 24, width - 60, 28, SWP_NOACTIVATE);
    SetWindowPos(workspace_state, HWND_TOP, left, top, 640, 42, SWP_NOACTIVATE);
    SetWindowPos(workspace_detail, HWND_TOP, left, top + 58, 640, 28, SWP_NOACTIVATE);
    SetWindowPos(workspace_help, HWND_TOP, left, top + 96, 640, 54, SWP_NOACTIVATE);
}

void create_workspace_overlay(HWND window) {
    if (workspace_brand != nullptr) {
        return;
    }
    constexpr DWORD style = WS_CHILD | SS_LEFT | SS_NOPREFIX;
    workspace_brand = CreateWindowExW(0, L"STATIC", L"ZTERMINAL  /  LOCAL WORKSPACE", style, 0, 0, 0, 0, window, nullptr, nullptr, nullptr);
    workspace_state = CreateWindowExW(0, L"STATIC", L"LOCAL DATA UNAVAILABLE", style, 0, 0, 0, 0, window, nullptr, nullptr, nullptr);
    workspace_detail = CreateWindowExW(0, L"STATIC", L"No verified local candles are available in this workspace.", style, 0, 0, 0, 0, window, nullptr, nullptr, nullptr);
    workspace_help = CreateWindowExW(0, L"STATIC", L"Import a verified local segment to begin. ZTerminal will not fetch or manufacture market data automatically.", style, 0, 0, 0, 0, window, nullptr, nullptr, nullptr);
    workspace_brand_font = CreateFontW(-16, 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Segoe UI");
    workspace_state_font = CreateFontW(-30, 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Segoe UI");
    workspace_body_font = CreateFontW(-17, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Segoe UI");
    if (workspace_brand_font != nullptr) {
        SendMessageW(workspace_brand, WM_SETFONT, reinterpret_cast<WPARAM>(workspace_brand_font), TRUE);
    }
    if (workspace_state_font != nullptr) {
        SendMessageW(workspace_state, WM_SETFONT, reinterpret_cast<WPARAM>(workspace_state_font), TRUE);
    }
    if (workspace_body_font != nullptr) {
        SendMessageW(workspace_detail, WM_SETFONT, reinterpret_cast<WPARAM>(workspace_body_font), TRUE);
        SendMessageW(workspace_help, WM_SETFONT, reinterpret_cast<WPARAM>(workspace_body_font), TRUE);
    }
    layout_workspace_overlay(window);
}

void update_workspace_overlay(HWND window) {
    if (workspace_brand == nullptr) {
        return;
    }
    const bool unavailable = chart_source == ChartSource::Unavailable;
    const int visibility = unavailable ? SW_SHOWNA : SW_HIDE;
    ShowWindow(workspace_brand, visibility);
    ShowWindow(workspace_state, visibility);
    ShowWindow(workspace_detail, visibility);
    ShowWindow(workspace_help, visibility);
    if (!unavailable) {
        return;
    }
    SetWindowTextW(workspace_state, L"LOCAL DATA UNAVAILABLE");
    SetWindowTextW(workspace_detail, L"No verified local candles are available in this workspace.");
    if (local_diagnostic == L"invalid local scene request") {
        SetWindowTextW(workspace_help, L"The local scene request was invalid. Check the selected local store and segment parameters.");
    } else if (!local_diagnostic.empty() && local_diagnostic != L"explicit local scene request required") {
        SetWindowTextW(workspace_help, local_diagnostic.c_str());
    } else {
        SetWindowTextW(workspace_help, L"Import a verified local segment to begin. ZTerminal will not fetch or manufacture market data automatically.");
    }
    layout_workspace_overlay(window);
}

void destroy_workspace_overlay() {
    if (workspace_brand_font != nullptr) {
        DeleteObject(workspace_brand_font);
        workspace_brand_font = nullptr;
    }
    if (workspace_state_font != nullptr) {
        DeleteObject(workspace_state_font);
        workspace_state_font = nullptr;
    }
    if (workspace_body_font != nullptr) {
        DeleteObject(workspace_body_font);
        workspace_body_font = nullptr;
    }
    workspace_brand = nullptr;
    workspace_state = nullptr;
    workspace_detail = nullptr;
    workspace_help = nullptr;
}

void request_frame(HWND window) {
    render_requested = true;
    if (window != nullptr) InvalidateRect(window, nullptr, FALSE);
}

void advance_chart_revision(std::uint64_t& revision) {
    if (revision < std::numeric_limits<std::uint64_t>::max()) {
        ++revision;
    } else {
        force_chart_vertex_rebuild = true;
    }
}

void advance_chart_scene_revision() {
    advance_chart_revision(chart_scene_revision);
}

void advance_chart_view_revision() {
    advance_chart_revision(chart_view_revision);
}

void update_title(HWND window) {
    if (window == nullptr) return;
    SetWindowTextW(window, chart_source == ChartSource::FixtureDiagnostic
        ? L"ZTerminal - diagnostic synthetic candles" : kWindowTitle);
    update_workspace_overlay(window);
}

bool apply_local_scene_result(
    const zterminal::local_scene::Request& request,
    const zterminal::local_scene::Result& result
) {
    if(result.availability==zterminal::local_scene::Availability::Live || result.availability==zterminal::local_scene::Availability::Cached) {
        if(!request.interval_ns || result.first_bar!=request.first_bar || result.candles.size()!=request.visible_bars || result.first_bar>result.total_bars || result.candles.size()>result.total_bars-result.first_bar) return false;
        for(size_t i=0;i<result.candles.size();++i) {
            auto& c=result.candles[i]; auto index=result.first_bar+i;
            if(index>(UINT64_MAX-request.start_ns)/request.interval_ns || c.open_time_ns!=request.start_ns+index*request.interval_ns || c.volume<0 || c.low_ticks>std::min(c.open_ticks,c.close_ticks) || c.high_ticks<std::max(c.open_ticks,c.close_ticks) || c.low_ticks>c.high_ticks) return false;
        }
    }
    local_availability = result.availability;
    local_diagnostic = result.diagnostic;
    local_total_bars = result.total_bars == 0 ? result.retained_bars : result.total_bars;
    local_first_bar = result.first_bar;
    local_age_ns = result.age_ns;
    chart_candles.clear();
    advance_chart_scene_revision();
    chart_view.first = 0;
    chart_view.dragging = false;
    if (result.availability != zterminal::local_scene::Availability::Live
        && result.availability != zterminal::local_scene::Availability::Cached) {
        chart_source = ChartSource::Unavailable;
        active_local_scene_request.reset();
        return false;
    }
    chart_source = ChartSource::LocalScene;
    active_local_scene_request = request;
    chart_candles.reserve(result.candles.size());
    price_origin=result.candles.empty()?0:result.candles.front().low_ticks;
    verified_scene={}; chart_view.logical_first=-1; chart_view.logical_count=0;
    for (const zterminal::local_scene::Candle& candle : result.candles) {
        chart_candles.push_back({
            .open = zterminal::chart::tick_delta(candle.open_ticks,price_origin),
            .high = zterminal::chart::tick_delta(candle.high_ticks,price_origin),
            .low = zterminal::chart::tick_delta(candle.low_ticks,price_origin),
            .close = zterminal::chart::tick_delta(candle.close_ticks,price_origin),
            .time_ns=candle.open_time_ns,.volume=candle.volume,.open_ticks=candle.open_ticks,.high_ticks=candle.high_ticks,.low_ticks=candle.low_ticks,.close_ticks=candle.close_ticks,
        });
    }
    chart_view.visible = std::min(chart_view.visible, chart_candles.size());
    advance_chart_view_revision();
    return true;
}

void reload_local_scene(HWND window, std::size_t requested_first_bar) {
    if (chart_source != ChartSource::LocalScene || !active_local_scene_request.has_value()) {
        return;
    }
    zterminal::local_scene::Request request = *active_local_scene_request;
    const std::size_t maximum_first_bar = local_total_bars > request.visible_bars
        ? local_total_bars - request.visible_bars
        : 0;
    request.first_bar = std::min(requested_first_bar, maximum_first_bar);
    if (request.first_bar == active_local_scene_request->first_bar) {
        return;
    }
    const zterminal::local_scene::Result result = zterminal::local_scene::load(request);
    if (local_navigation_reloads < std::numeric_limits<std::uint64_t>::max()) {
        ++local_navigation_reloads;
    }
    (void)apply_local_scene_result(request, result);
    update_title(window);
    request_frame(window);
}

void reload_adjacent_local_segment(HWND window, bool forward) {
    if (chart_source != ChartSource::LocalScene || !active_local_scene_request.has_value()) {
        return;
    }
    const zterminal::local_scene::Request current = *active_local_scene_request;
    const zterminal::local_segment_catalog::Result catalog = zterminal::local_segment_catalog::load({
        .root = current.root,
        .symbol_id = current.symbol_id,
        .interval_ns = current.interval_ns,
        .maximum_entries = 256,
    });
    if (catalog.status != zterminal::local_segment_catalog::Status::Available) {
        local_history_diagnostic = zterminal::local_segment_catalog::status_label(catalog.status);
        update_title(window);
        request_frame(window);
        return;
    }
    if (catalog.truncated) {
        local_history_diagnostic = L"LOCAL HISTORY CATALOG TRUNCATED";
        update_title(window);
        request_frame(window);
        return;
    }
    const auto current_entry = std::find_if(
        catalog.entries.begin(),
        catalog.entries.end(),
        [&current](const zterminal::local_segment_catalog::Entry& entry) {
            return entry.start_ns == current.start_ns;
        }
    );
    if (current_entry == catalog.entries.end()) {
        local_history_diagnostic = L"CURRENT LOCAL SEGMENT NOT CATALOGED";
        update_title(window);
        request_frame(window);
        return;
    }
    std::optional<std::uint64_t> adjacent_start;
    if (forward) {
        const auto next = std::next(current_entry);
        if (next != catalog.entries.end()) {
            adjacent_start = next->start_ns;
        }
    } else if (current_entry != catalog.entries.begin()) {
        adjacent_start = std::prev(current_entry)->start_ns;
    }
    if (!adjacent_start.has_value()) {
        local_history_diagnostic = forward ? L"NO LATER LOCAL SEGMENT" : L"NO EARLIER LOCAL SEGMENT";
        update_title(window);
        request_frame(window);
        return;
    }
    zterminal::local_scene::Request request = current;
    request.start_ns = *adjacent_start;
    request.first_bar = 0;
    local_monte_carlo_result = {};
    local_history_diagnostic = L"LOCAL SEGMENT SWITCHED | CONTINUITY NOT ASSERTED";
    const zterminal::local_scene::Result result = zterminal::local_scene::load(request);
    if (local_navigation_reloads < std::numeric_limits<std::uint64_t>::max()) {
        ++local_navigation_reloads;
    }
    if (local_segment_switches < std::numeric_limits<std::uint64_t>::max()) {
        ++local_segment_switches;
    }
    (void)apply_local_scene_result(request, result);
    update_title(window);
    request_frame(window);
}

void navigate_local_scene(HWND window, WPARAM virtual_key) {
    if (chart_source != ChartSource::LocalScene || !active_local_scene_request.has_value()) {
        return;
    }
    const zterminal::local_scene::Request& request = *active_local_scene_request;
    const std::size_t page_step = std::max<std::size_t>(1, request.visible_bars / 2);
    const std::size_t maximum_first_bar = local_total_bars > request.visible_bars
        ? local_total_bars - request.visible_bars
        : 0;
    std::size_t requested_first_bar = request.first_bar;
    if (virtual_key == VK_PRIOR) {
        if (request.first_bar == 0) {
            reload_adjacent_local_segment(window, false);
            return;
        }
        requested_first_bar = request.first_bar > page_step ? request.first_bar - page_step : 0;
    } else if (virtual_key == VK_NEXT) {
        if (request.first_bar == maximum_first_bar) {
            reload_adjacent_local_segment(window, true);
            return;
        }
        const std::size_t remaining_bars = maximum_first_bar - request.first_bar;
        requested_first_bar = request.first_bar + std::min(page_step, remaining_bars);
    } else if (virtual_key == VK_HOME) {
        requested_first_bar = 0;
    } else if (virtual_key == VK_END) {
        requested_first_bar = maximum_first_bar;
    } else {
        return;
    }
    reload_local_scene(window, requested_first_bar);
}

void pan_from_drag(HWND window, int cursor_x) {
    if (!chart_view.dragging || chart_candles.empty()) {
        return;
    }
    RECT rectangle{};
    GetClientRect(window, &rectangle);
    const int width = static_cast<int>(std::max<LONG>(1, rectangle.right - rectangle.left));
    const double candles_per_pixel = static_cast<double>(chart_view.visible) / static_cast<double>(width);
    const long long delta = static_cast<long long>(std::llround((chart_view.drag_start_x - cursor_x) * candles_per_pixel));
    const long long maximum_first = static_cast<long long>(chart_candles.size() - std::min(chart_view.visible, chart_candles.size()));
    const std::size_t next_first = static_cast<std::size_t>(std::clamp(static_cast<long long>(chart_view.drag_start_first) + delta, 0LL, maximum_first));
    if (next_first != chart_view.first) {
        chart_view.first = next_first;
        advance_chart_view_revision();
        update_title(window);
    }
}

LRESULT CALLBACK window_procedure(HWND window, UINT message, WPARAM w_param, LPARAM l_param) {
    switch (message) {
    case WM_SIZE:
        if (renderer != nullptr && w_param != SIZE_MINIMIZED) {
            if (renderer->resize(LOWORD(l_param), HIWORD(l_param))) {
                advance_chart_view_revision();
            }
            layout_workspace_overlay(window);
            request_frame(window);
        }
        return 0;
    case WM_CTLCOLORSTATIC: {
        HDC device_context = reinterpret_cast<HDC>(w_param);
        const HWND control = reinterpret_cast<HWND>(l_param);
        SetBkMode(device_context, OPAQUE);
        SetBkColor(device_context, RGB(7, 12, 19));
        SetDCBrushColor(device_context, RGB(7, 12, 19));
        if (control == workspace_state) {
            SetTextColor(device_context, RGB(243, 176, 75));
        } else if (control == workspace_brand) {
            SetTextColor(device_context, RGB(147, 181, 209));
        } else if (control == workspace_help) {
            SetTextColor(device_context, RGB(139, 160, 179));
        } else {
            SetTextColor(device_context, RGB(223, 234, 244));
        }
        return reinterpret_cast<LRESULT>(GetStockObject(DC_BRUSH));
    }
    case WM_MOUSEMOVE: {
        TRACKMOUSEEVENT tracking{sizeof(TRACKMOUSEEVENT), TME_LEAVE, window, 0};
        (void)TrackMouseEvent(&tracking);
        const POINT next_cursor{GET_X_LPARAM(l_param), GET_Y_LPARAM(l_param)};
        if (!chart_view.has_cursor || next_cursor.x != chart_view.cursor.x || next_cursor.y != chart_view.cursor.y) {
            chart_view.cursor = next_cursor;
            chart_view.has_cursor = true;
            advance_chart_view_revision();
        }
        pan_from_drag(window, chart_view.cursor.x);
        request_frame(window);
        return 0;
    }
    case WM_MOUSELEAVE:
        if (chart_view.has_cursor) {
            chart_view.has_cursor = false;
            advance_chart_view_revision();
            request_frame(window);
        }
        return 0;
    case WM_MOUSEWHEEL: {
        const int delta = GET_WHEEL_DELTA_WPARAM(w_param);
        const std::size_t prior = chart_view.visible;
        chart_view.visible = delta > 0
            ? std::max<std::size_t>(20, (chart_view.visible * 4) / 5)
            : std::min<std::size_t>(kMaximumVisibleCandles, (chart_view.visible * 5) / 4);
        chart_view.visible = std::min(chart_view.visible, chart_candles.size());
        if (chart_view.visible != prior) {
            chart_view.first = std::min(chart_view.first, chart_candles.size() - chart_view.visible);
            advance_chart_view_revision();
            update_title(window);
            request_frame(window);
        }
        return 0;
    }
    case WM_LBUTTONDOWN:
        chart_view.dragging = true;
        chart_view.drag_start_x = GET_X_LPARAM(l_param);
        chart_view.drag_start_first = chart_view.first;
        SetCapture(window);
        request_frame(window);
        return 0;
    case WM_LBUTTONUP:
        chart_view.dragging = false;
        ReleaseCapture();
        request_frame(window);
        return 0;
    case WM_PAINT: {
        PAINTSTRUCT paint{};
        HDC context = BeginPaint(window, &paint);
        if (chart_source == ChartSource::Unavailable) {
            SetDCBrushColor(context, RGB(7, 12, 19));
            FillRect(context, &paint.rcPaint, static_cast<HBRUSH>(GetStockObject(DC_BRUSH)));
        }
        EndPaint(window, &paint);
        // Repainting a chart must request a fresh GPU frame after exposure.
        render_requested = true;
        return 0;
    }
    case WM_KEYDOWN:
        if (w_param == VK_ESCAPE) {
            DestroyWindow(window);
        } else if (w_param == VK_PRIOR || w_param == VK_NEXT || w_param == VK_HOME || w_param == VK_END) {
            navigate_local_scene(window, w_param);
        }
        return 0;
    case WM_DESTROY:
        destroy_workspace_overlay();
        PostQuitMessage(0);
        return 0;
    default:
        return DefWindowProc(window, message, w_param, l_param);
    }
}

[[nodiscard]] bool has_option(PWSTR command_line, const wchar_t* option) {
    return wcsstr(command_line, option) != nullptr;
}

[[nodiscard]] unsigned long benchmark_seconds(PWSTR command_line) {
    constexpr wchar_t option[] = L"--benchmark-seconds=";
    const wchar_t* const value = wcsstr(command_line, option);
    if (value == nullptr) {
        return 0;
    }
    wchar_t* end{};
    const unsigned long seconds = wcstoul(value + (std::size(option) - 1), &end, 10);
    return end == value + (std::size(option) - 1) || seconds > 3'600 ? 0 : seconds;
}

[[nodiscard]] std::optional<std::wstring> option_value(PWSTR command_line, const wchar_t* option) {
    const wchar_t* const value = wcsstr(command_line, option);
    if (value == nullptr) {
        return std::nullopt;
    }
    const wchar_t* first = value + wcslen(option);
    if (*first == L'\"') {
        ++first;
        const wchar_t* const last = wcschr(first, L'\"');
        if (last == nullptr || last == first) {
            return std::nullopt;
        }
        return std::wstring(first, last);
    }
    const wchar_t* last = first;
    while (*last != L'\0' && *last != L' ') {
        ++last;
    }
    if (last == first) {
        return std::nullopt;
    }
    return std::wstring(first, last);
}

[[nodiscard]] std::optional<std::uint64_t> unsigned_option_value(PWSTR command_line, const wchar_t* option) {
    const std::optional<std::wstring> text = option_value(command_line, option);
    if (!text.has_value()) {
        return std::nullopt;
    }
    wchar_t* end{};
    const unsigned long long value = wcstoull(text->c_str(), &end, 10);
    if (end == text->c_str() || *end != L'\0') {
        return std::nullopt;
    }
    return static_cast<std::uint64_t>(value);
}

[[nodiscard]] bool diagnostic_next_local_segment(PWSTR command_line) {
    constexpr wchar_t option[] = L"--diagnostic-local-navigation=";
    return option_value(command_line, option) == std::optional<std::wstring>(L"next-segment");
}

[[nodiscard]] std::optional<WPARAM> diagnostic_local_navigation_key(PWSTR command_line) {
    constexpr wchar_t option[] = L"--diagnostic-local-navigation=";
    const std::optional<std::wstring> value = option_value(command_line, option);
    if (!value.has_value()) {
        return std::nullopt;
    }
    if (*value == L"page-up") {
        return VK_PRIOR;
    }
    if (*value == L"page-down") {
        return VK_NEXT;
    }
    if (*value == L"home") {
        return VK_HOME;
    }
    if (*value == L"end") {
        return VK_END;
    }
    return std::nullopt;
}

[[nodiscard]] bool has_local_monte_carlo_option(PWSTR command_line) {
    return has_option(command_line, L"--local-monte-carlo-simulations=")
        || has_option(command_line, L"--local-monte-carlo-horizon-bars=")
        || has_option(command_line, L"--local-monte-carlo-seed=")
        || has_option(command_line, L"--local-monte-carlo-history-segments=");
}

[[nodiscard]] std::optional<zterminal::local_monte_carlo::Request> requested_local_monte_carlo(
    PWSTR command_line,
    const zterminal::local_scene::Request& local_scene_request
) {
    constexpr wchar_t simulations_option[] = L"--local-monte-carlo-simulations=";
    constexpr wchar_t horizon_option[] = L"--local-monte-carlo-horizon-bars=";
    constexpr wchar_t seed_option[] = L"--local-monte-carlo-seed=";
    constexpr wchar_t history_segments_option[] = L"--local-monte-carlo-history-segments=";
    const std::optional<std::uint64_t> simulations = unsigned_option_value(command_line, simulations_option);
    const std::optional<std::uint64_t> horizon_bars = unsigned_option_value(command_line, horizon_option);
    const std::optional<std::uint64_t> seed = unsigned_option_value(command_line, seed_option);
    const std::optional<std::uint64_t> history_segments = unsigned_option_value(command_line, history_segments_option);
    const std::uint64_t effective_history_segments = history_segments.value_or(1);
    if (!simulations.has_value() || !horizon_bars.has_value() || !seed.has_value()
        || *simulations == 0 || *horizon_bars == 0 || *seed == 0
        || *simulations > 10'000 || *horizon_bars > 1'000
        || effective_history_segments == 0 || effective_history_segments > 16
        || *simulations > std::numeric_limits<std::size_t>::max()
        || *horizon_bars > std::numeric_limits<std::size_t>::max()
        || effective_history_segments > std::numeric_limits<std::size_t>::max()) {
        return std::nullopt;
    }
    const std::size_t simulations_size = static_cast<std::size_t>(*simulations);
    const std::size_t horizon_bars_size = static_cast<std::size_t>(*horizon_bars);
    if (simulations_size > 1'000'000 / horizon_bars_size) {
        return std::nullopt;
    }
    return zterminal::local_monte_carlo::Request{
        .root = local_scene_request.root,
        .symbol_id = local_scene_request.symbol_id,
        .interval_ns = local_scene_request.interval_ns,
        .start_ns = local_scene_request.start_ns,
        .freshness_budget_ns = local_scene_request.freshness_budget_ns,
        .simulations = simulations_size,
        .horizon_bars = horizon_bars_size,
        .seed = *seed,
        .history_segments = static_cast<std::size_t>(effective_history_segments),
    };
}

[[nodiscard]] std::optional<std::size_t> requested_fixture_candle_count(PWSTR command_line) {
    constexpr wchar_t option[] = L"--fixture-candles=";
    const std::optional<std::uint64_t> count = unsigned_option_value(command_line, option);
    if (!count.has_value() || *count < 10'000 || *count > 100'000) {
        return std::nullopt;
    }
    return static_cast<std::size_t>(*count);
}

[[nodiscard]] std::optional<zterminal::local_scene::Request> requested_local_scene(PWSTR command_line) {
    constexpr wchar_t root_option[] = L"--local-root=";
    constexpr wchar_t symbol_option[] = L"--symbol-id=";
    constexpr wchar_t interval_option[] = L"--interval-ns=";
    constexpr wchar_t start_option[] = L"--start-ns=";
    constexpr wchar_t first_option[] = L"--first-bar=";
    constexpr wchar_t visible_option[] = L"--visible-bars=";
    constexpr wchar_t freshness_option[] = L"--freshness-budget-ns=";
    const std::optional<std::wstring> root = option_value(command_line, root_option);
    const std::optional<std::uint64_t> symbol_id = unsigned_option_value(command_line, symbol_option);
    const std::optional<std::uint64_t> interval_ns = unsigned_option_value(command_line, interval_option);
    const std::optional<std::uint64_t> start_ns = unsigned_option_value(command_line, start_option);
    const std::optional<std::uint64_t> first_bar = unsigned_option_value(command_line, first_option);
    const std::optional<std::uint64_t> visible_bars = unsigned_option_value(command_line, visible_option);
    const std::optional<std::uint64_t> freshness_budget_ns = unsigned_option_value(command_line, freshness_option);
    if (!root.has_value() || !symbol_id.has_value() || !interval_ns.has_value()
        || !start_ns.has_value() || !first_bar.has_value() || !visible_bars.has_value()
        || !freshness_budget_ns.has_value() || *symbol_id > std::numeric_limits<std::uint32_t>::max()
        || *first_bar > std::numeric_limits<std::size_t>::max()
        || *visible_bars > std::numeric_limits<std::size_t>::max()) {
        return std::nullopt;
    }
    return zterminal::local_scene::Request{
        .root = *root,
        .symbol_id = static_cast<std::uint32_t>(*symbol_id),
        .interval_ns = *interval_ns,
        .start_ns = *start_ns,
        .first_bar = static_cast<std::size_t>(*first_bar),
        .visible_bars = static_cast<std::size_t>(*visible_bars),
        .freshness_budget_ns = *freshness_budget_ns,
    };
}

void select_chart_source(PWSTR command_line) {
    active_local_scene_request.reset();
    local_monte_carlo_result = {};
    local_segment_switches = 0;
    local_history_diagnostic.clear();
    if (const std::optional<std::size_t> fixture_count = requested_fixture_candle_count(command_line); fixture_count.has_value()) {
        chart_source = ChartSource::FixtureDiagnostic;
        chart_candles = fixture_candles(*fixture_count);
        advance_chart_scene_revision();
        advance_chart_view_revision();
        return;
    }
    if (wcsstr(command_line, L"--local-root=") == nullptr) {
        chart_source = ChartSource::Unavailable;
        local_availability = zterminal::local_scene::Availability::Unavailable;
        local_diagnostic = L"explicit local scene request required";
        return;
    }
    const std::optional<zterminal::local_scene::Request> request = requested_local_scene(command_line);
    if (!request.has_value()) {
        chart_source = ChartSource::Unavailable;
        local_availability = zterminal::local_scene::Availability::BridgeFailure;
        local_diagnostic = L"invalid local scene request";
        return;
    }
    const zterminal::local_scene::Result result = zterminal::local_scene::load(*request);
    if (!apply_local_scene_result(*request, result)) {
        return;
    }
    if (!has_local_monte_carlo_option(command_line)) {
        return;
    }
    const std::optional<zterminal::local_monte_carlo::Request> research_request = requested_local_monte_carlo(command_line, *request);
    if (!research_request.has_value()) {
        local_monte_carlo_result.kind = zterminal::local_monte_carlo::Kind::BridgeFailure;
        local_monte_carlo_result.availability = zterminal::local_scene::Availability::BridgeFailure;
        local_monte_carlo_result.diagnostic = L"invalid explicit local Monte Carlo request";
        return;
    }
    local_monte_carlo_result = zterminal::local_monte_carlo::load(*research_request);
}

void write_startup_status(const char* stage, long result_code) {
    wchar_t app_data[MAX_PATH]{};
    const DWORD app_data_length = GetEnvironmentVariableW(L"LOCALAPPDATA", app_data, MAX_PATH);
    const std::filesystem::path root = app_data_length > 0 && app_data_length < MAX_PATH
        ? std::filesystem::path(app_data) / L"ZTerminal" / L"logs"
        : std::filesystem::temp_directory_path() / L"ZTerminal" / L"logs";
    std::error_code error;
    std::filesystem::create_directories(root, error);
    if (error) {
        return;
    }
    std::ofstream output(root / "native-startup-last.json", std::ios::trunc);
    if (!output) {
        return;
    }
    output << "{\n";
    output << "  \"schema_version\": 1,\n";
    output << "  \"product\": \"ZTerminal Native Local-First Host\",\n";
    output << "  \"startup_stage\": \"" << stage << "\",\n";
    output << "  \"result_code\": " << result_code << ",\n";
    output << "  \"network_opened\": false\n";
    output << "}\n";
}

void write_diagnostics(const Renderer& native_renderer, double launch_ms, std::optional<std::filesystem::path> destination = {}) {
    wchar_t app_data[MAX_PATH]{};
    const DWORD app_data_length = GetEnvironmentVariableW(L"LOCALAPPDATA", app_data, MAX_PATH);
    const std::filesystem::path root = destination ? destination->parent_path() : app_data_length > 0 && app_data_length < MAX_PATH
        ? std::filesystem::path(app_data) / L"ZTerminal" / L"logs"
        : std::filesystem::temp_directory_path() / L"ZTerminal" / L"logs";
    std::error_code error;
    std::filesystem::create_directories(root, error);
    if (error) {
        return;
    }
    PROCESS_MEMORY_COUNTERS_EX memory{};
    memory.cb = sizeof(memory);
    const bool has_memory = GetProcessMemoryInfo(GetCurrentProcess(), reinterpret_cast<PROCESS_MEMORY_COUNTERS*>(&memory), sizeof(memory)) != FALSE;
    const FrameSummary frames = native_renderer.frame_summary();
    std::ofstream output(destination.value_or(root / "phase0-host-last.json"), std::ios::trunc);
    if (!output) {
        return;
    }
    output << std::fixed << std::setprecision(3);
    output << "{\n";
    output << "  \"schema_version\": 1,\n";
    output << "  \"product\": \"ZTerminal Native Local-First Host\",\n";
    output << "  \"fixture_only\": " << (chart_source == ChartSource::FixtureDiagnostic ? "true" : "false") << ",\n";
    output << "  \"chart_source\": \"" << (chart_source == ChartSource::FixtureDiagnostic ? "fixture" : chart_source == ChartSource::LocalScene ? "local_scene" : "withheld") << "\",\n";
    output << "  \"local_availability\": \"" << json_escape(utf8_from_wide(zterminal::local_scene::availability_label(local_availability))) << "\",\n";
    output << "  \"local_bridge_diagnostic\": \"" << json_escape(utf8_from_wide(local_diagnostic)) << "\",\n";
    output << "  \"local_total_bars\": " << local_total_bars << ",\n";
    output << "  \"local_first_bar\": " << local_first_bar << ",\n";
    output << "  \"local_navigation_reloads\": " << local_navigation_reloads << ",\n";
    output << "  \"local_segment_switches\": " << local_segment_switches << ",\n";
    output << "  \"local_history_diagnostic\": \"" << json_escape(utf8_from_wide(local_history_diagnostic)) << "\",\n";
    output << "  \"local_monte_carlo_kind\": \"" << json_escape(utf8_from_wide(zterminal::local_monte_carlo::kind_label(local_monte_carlo_result.kind))) << "\",\n";
    output << "  \"local_monte_carlo_availability\": \"" << json_escape(utf8_from_wide(zterminal::local_scene::availability_label(local_monte_carlo_result.availability))) << "\",\n";
    output << "  \"local_monte_carlo_source_segments\": " << local_monte_carlo_result.source_segments << ",\n";
    output << "  \"local_monte_carlo_source_bars\": " << local_monte_carlo_result.source_bars << ",\n";
    output << "  \"local_monte_carlo_simulations\": " << local_monte_carlo_result.simulations << ",\n";
    output << "  \"local_monte_carlo_horizon_bars\": " << local_monte_carlo_result.horizon_bars << ",\n";
    output << "  \"local_monte_carlo_median_return_bps\": " << local_monte_carlo_result.median_return_bps << ",\n";
    output << "  \"fixture_candles\": " << chart_candles.size() << ",\n";
    output << "  \"visible_candles\": " << effective_view(chart_view).count << ",\n";
#ifdef ZT_NATIVE_CHART_LIBRARY
    auto semantic=zterminal::native_chart::semantic_viewport();
    output << "  \"semantic_from_ms\": " << semantic.first << ",\n";
    output << "  \"semantic_to_ms\": " << semantic.second << ",\n";
#endif
    output << "  \"client_physical_width\": " << native_renderer.pixel_width() << ",\n";
    output << "  \"client_physical_height\": " << native_renderer.pixel_height() << ",\n";
    output << "  \"projection_scale\": " << chart_scale << ",\n";
    output << "  \"geometry_samples\": " << native_renderer.geometry_summary().count << ",\n";
    output << "  \"geometry_p95_ms\": " << native_renderer.geometry_summary().p95_ms << ",\n";
    output << "  \"benchmark_unsynchronised_present\": " << (unsynchronised_benchmark_present ? "true" : "false") << ",\n";
    output << "  \"benchmark_resize_once\": " << (benchmark_resize_once ? "true" : "false") << ",\n";
    output << "  \"driver\": \"" << (native_renderer.used_warp() ? "warp" : "hardware") << "\",\n";
    output << "  \"adapter\": \"" << json_escape(utf8_from_wide(native_renderer.adapter_description())) << "\",\n";
    output << "  \"feature_level\": \"" << feature_level_name(native_renderer.feature_level()) << "\",\n";
    output << "  \"launch_to_visible_ms\": " << launch_ms << ",\n";
    output << "  \"frame_samples\": " << frames.count << ",\n";
    output << "  \"frame_average_ms\": " << frames.average_ms << ",\n";
    output << "  \"frame_p95_ms\": " << frames.p95_ms << ",\n";
    output << "  \"frame_maximum_ms\": " << frames.maximum_ms << ",\n";
    output << "  \"renderer_resize_successes\": " << native_renderer.resize_successes() << ",\n";
    output << "  \"renderer_resize_failures\": " << native_renderer.resize_failures() << ",\n";
    output << "  \"renderer_device_recoveries\": " << native_renderer.device_recoveries() << ",\n";
    output << "  \"renderer_unrecoverable_device_failures\": " << native_renderer.unrecoverable_device_failures() << ",\n";
    output << "  \"renderer_present_failures\": " << native_renderer.present_failures() << ",\n";
    output << "  \"renderer_vertex_buffer_uploads\": " << native_renderer.vertex_buffer_uploads() << ",\n";
    output << "  \"renderer_retained_draw_reuses\": " << native_renderer.retained_draw_reuses() << ",\n";
    output << "  \"renderer_retained_vertex_clears\": " << native_renderer.retained_vertex_clears() << ",\n";
    output << "  \"renderer_retained_vertex_rebuilds\": " << native_renderer.retained_vertex_rebuilds() << ",\n";
    output << "  \"renderer_last_error_hr\": " << static_cast<long>(native_renderer.last_renderer_error()) << ",\n";
    output << "  \"verified_chart_pixels\": ";
    if (native_renderer.verified_chart_pixels().has_value()) output << *native_renderer.verified_chart_pixels();
    else output << "null";
    output << ",\n";
    output << "  \"working_set_bytes\": " << (has_memory ? memory.WorkingSetSize : 0) << ",\n";
    output << "  \"private_usage_bytes\": " << (has_memory ? memory.PrivateUsage : 0) << "\n";
    output << "}\n";
}

} // namespace

#ifndef ZT_NATIVE_CHART_LIBRARY
int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR command_line, int show_command) {
    const auto process_started = Clock::now();
    write_startup_status("starting", 0);
    select_chart_source(command_line);
    chart_view.visible = std::min<std::size_t>(600, chart_candles.size());
    if(chart_source==ChartSource::FixtureDiagnostic) {
        auto requested=unsigned_option_value(command_line,L"--benchmark-visible=");
        if(requested && *requested>0 && *requested<=kMaximumVisibleCandles)chart_view.visible=std::min<size_t>(size_t(*requested),chart_candles.size());
    }
    chart_view.first = chart_candles.empty() ? 0 : chart_candles.size() - chart_view.visible;

    WNDCLASS window_class{};
    window_class.hInstance = instance;
    window_class.lpszClassName = kWindowClass;
    window_class.lpfnWndProc = window_procedure;
    window_class.hCursor = LoadCursor(nullptr, IDC_ARROW);
    window_class.hbrBackground = static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH));
    if (RegisterClass(&window_class) == 0) {
        write_startup_status("window_class_failed", static_cast<long>(GetLastError()));
        return 1;
    }
    HWND window = CreateWindowEx(0, kWindowClass, kWindowTitle, WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN, CW_USEDEFAULT, CW_USEDEFAULT, 1280, 820, nullptr, nullptr, instance, nullptr);
    if (window == nullptr) {
        write_startup_status("window_create_failed", static_cast<long>(GetLastError()));
        return 2;
    }
    write_startup_status("window_created", 0);
    Renderer native_renderer;
    renderer = &native_renderer;
    if (!native_renderer.initialize(window)) {
        write_startup_status("direct3d_initialize_failed", static_cast<long>(native_renderer.last_renderer_error()));
        MessageBox(window, L"ZTerminal could not initialize its local Direct3D workspace. See the local ZTerminal startup diagnostic for the error category.", kWindowTitle, MB_ICONERROR | MB_OK);
        DestroyWindow(window);
        return 3;
    }
    write_startup_status("ready", 0);
    create_workspace_overlay(window);
    update_title(window);
    ShowWindow(window, show_command);
    UpdateWindow(window);
    const double launch_ms = std::chrono::duration<double, std::milli>(Clock::now() - process_started).count();
    const unsigned long auto_close_after_seconds = benchmark_seconds(command_line);
    continuous_benchmark_rendering = auto_close_after_seconds > 0;
    unsynchronised_benchmark_present = auto_close_after_seconds > 0
        && has_option(command_line, L"--benchmark-unsynchronised-present");
    benchmark_resize_once = auto_close_after_seconds > 0
        && has_option(command_line, L"--benchmark-resize-once");
    const bool verify_pixels = auto_close_after_seconds > 0
        && has_option(command_line, L"--benchmark-verify-pixels");
    const bool diagnostic_next_segment = auto_close_after_seconds > 0
        && diagnostic_next_local_segment(command_line);
    const std::optional<WPARAM> diagnostic_navigation = auto_close_after_seconds > 0
        ? diagnostic_local_navigation_key(command_line)
        : std::nullopt;
    if (diagnostic_next_segment) {
        // Internal benchmark-only exercise of the same End then Page Down path
        // users invoke at a local immutable segment boundary.
        navigate_local_scene(window, VK_END);
        navigate_local_scene(window, VK_NEXT);
    } else if (diagnostic_navigation.has_value()) {
        // Internal benchmark-only exercise of the same keyboard navigation path.
        navigate_local_scene(window, *diagnostic_navigation);
    }
    if (benchmark_resize_once) {
        // Internal diagnostic only: drive one ordinary WM_SIZE path without a
        // cross-process window controller or any source/data change.
        (void)SetWindowPos(window, nullptr, 0, 0, 1024, 680, SWP_NOMOVE | SWP_NOZORDER);
    }
    const auto benchmark_deadline = Clock::now() + std::chrono::seconds(auto_close_after_seconds);

    MSG message{};
    while (message.message != WM_QUIT) {
        if (PeekMessage(&message, nullptr, 0, 0, PM_REMOVE) != FALSE) {
            TranslateMessage(&message);
            DispatchMessage(&message);
        } else if (render_requested || continuous_benchmark_rendering) {
            if (chart_source != ChartSource::Unavailable) {
                native_renderer.render(
                    chart_candles,
                    chart_view,
                    chart_scene_revision,
                    chart_view_revision,
                    force_chart_vertex_rebuild,
                    unsynchronised_benchmark_present,
                    verify_pixels);
            } else if (continuous_benchmark_rendering) {
                Sleep(16);
            }
            force_chart_vertex_rebuild = false;
            render_requested = false;
            if (auto_close_after_seconds > 0 && Clock::now() >= benchmark_deadline) {
                DestroyWindow(window);
            }
        } else {
            // A local static workstation should not spin a render loop while idle.
            // Input, resize, or future verified local-data arrival requests the next frame.
            WaitMessage();
        }
    }
    write_diagnostics(native_renderer, launch_ms);
    renderer = nullptr;
    return static_cast<int>(message.wParam);
}
#else
namespace zterminal::native_chart {
namespace {
std::unique_ptr<Renderer> composed_renderer;
std::optional<std::filesystem::path> evidence_destination;
unsigned viewport_width{1};
}
bool initialize(HWND owner, AttachSwapChain attach, const wchar_t* arguments) {
    if (!attach || composed_renderer) return false;
    select_chart_source(const_cast<wchar_t*>(arguments ? arguments : L""));
    auto evidence=option_value(const_cast<wchar_t*>(arguments ? arguments : L""),L"--chart-evidence=");
    evidence_destination=evidence?std::optional<std::filesystem::path>(*evidence):std::nullopt;
    chart_view.visible = std::min<std::size_t>(600, chart_candles.size());
    chart_view.first = chart_candles.empty() ? 0 : chart_candles.size() - chart_view.visible;
    composed_renderer = std::make_unique<Renderer>();
    if (!composed_renderer->initialize(owner, std::move(attach))) {
        composed_renderer.reset();
        return false;
    }
    renderer = composed_renderer.get();
    return true;
}
void shutdown() {
    if(composed_renderer&&evidence_destination)write_diagnostics(*composed_renderer,0,evidence_destination);
    renderer = nullptr; composed_renderer.reset(); evidence_destination.reset();
}
bool resize(unsigned width, unsigned height) {
    if (!composed_renderer || width == 0 || height == 0) return false;
    viewport_width = width;
    cancel_drag();
    if (!composed_renderer->resize(width, height)) return false;
    advance_chart_view_revision();
    render_requested=true;
    return true;
}
void render(bool verify_pixels) {
    if (!composed_renderer) return;
    composed_renderer->render(chart_candles, chart_view, chart_scene_revision,
        chart_view_revision, force_chart_vertex_rebuild, false, verify_pixels);
    force_chart_vertex_rebuild = false;
    render_requested=false;
}
bool needs_render() { return render_requested; }
std::optional<RasterSnapshot> capture_raster() {
    std::optional<RasterSnapshot> raster;
    if (composed_renderer) composed_renderer->render(chart_candles, chart_view, chart_scene_revision,
        chart_view_revision, force_chart_vertex_rebuild, false, false, &raster);
    return raster;
}
void set_scale(double scale) { if(composed_renderer) composed_renderer->set_scale(scale); render_requested=true; }
void configure(const Appearance& value) {chart_appearance=value;advance_chart_view_revision();render_requested=true;}
bool scale_available(){return !composed_renderer||composed_renderer->valid_projection(chart_candles,chart_view);}
bool available() { return chart_source != ChartSource::Unavailable && scale_available(); }
std::wstring availability_text() {
    if(!scale_available())return L"PRICE SCALE UNAVAILABLE · use normal scale for non-positive prices or a zero percentage base";
    if (chart_source == ChartSource::FixtureDiagnostic) return L"DIAGNOSTIC SYNTHETIC DATA";
    return local_scene::availability_label(local_availability);
}
std::wstring diagnostic() { return local_diagnostic; }
void pointer_move(int x, int y) {
    if(chart_view.cursor.x==x && chart_view.cursor.y==y && chart_view.has_cursor && !chart_view.dragging) return;
    chart_view.cursor = {x, y};
    chart_view.has_cursor = true;
    if (chart_view.dragging && !chart_candles.empty()) {
        auto bounds=composed_renderer->interaction_bounds(chart_candles,chart_view); auto v=effective_view(chart_view);
        double shift=(chart_view.drag_start_x-x)*v.count/std::max(1.0,bounds.second-bounds.first);
        chart_view.logical_first=std::clamp(chart_view.drag_logical_first+shift,0.0,std::max(0.0,double(chart_candles.size())-v.count));
    }
    advance_chart_view_revision();
    render_requested=true;
}
void pointer_leave() { chart_view.has_cursor = false; advance_chart_view_revision(); render_requested=true; }
bool begin_drag(int x) {
    if(!composed_renderer||!chart_view.has_cursor||!composed_renderer->contains_data_point(chart_candles,chart_view,x,chart_view.cursor.y))return false;
    chart_view.dragging = true; chart_view.drag_start_x = x; chart_view.drag_start_first = chart_view.first; chart_view.drag_logical_first=effective_view(chart_view).first; return true;
}
void end_drag() { chart_view.dragging = false; }
void cancel_drag() { if(chart_view.dragging) { chart_view.logical_first=chart_view.drag_logical_first; chart_view.dragging=false; advance_chart_view_revision(); render_requested=true; } }
void zoom(int delta) {
    if(!composed_renderer || chart_candles.empty() || !delta)return;
    cancel_drag(); auto v=effective_view(chart_view); auto bounds=composed_renderer->interaction_bounds(chart_candles,chart_view);
    double fraction=chart_view.has_cursor ? (chart_view.cursor.x-bounds.first)/std::max(1.0,bounds.second-bounds.first):.5;
    auto result=chart::zoom_at(v,fraction,std::clamp(v.count*std::pow(.8,double(delta)/120),1.0,double(std::min(kMaximumVisibleCandles,chart_candles.size()))),double(chart_candles.size()));
    chart_view.logical_first=result.first; chart_view.logical_count=result.count;
    advance_chart_view_revision();
    render_requested=true;
}
void fit() { if(chart_candles.empty())return; cancel_drag(); chart_view.logical_count=double(std::min(kMaximumVisibleCandles,chart_candles.size())); chart_view.logical_first=double(chart_candles.size())-chart_view.logical_count; advance_chart_view_revision(); render_requested=true; }
void navigate(unsigned key) {
    if(verified_scene.version!=2) { if(composed_renderer)navigate_local_scene(nullptr,key); render_requested=true; return; }
    cancel_drag(); auto v=effective_view(chart_view); auto maximum=std::max(0.0,double(chart_candles.size())-v.count);
    if(key==VK_HOME)v.first=0; else if(key==VK_END)v.first=maximum;
    else if(key==VK_LEFT||key==VK_PRIOR)v.first=std::max(0.0,v.first-(key==VK_LEFT?1:v.count*.5));
    else if(key==VK_RIGHT||key==VK_NEXT)v.first=std::min(maximum,v.first+(key==VK_RIGHT?1:v.count*.5)); else return;
    chart_view.logical_first=v.first; advance_chart_view_revision(); render_requested=true;
}
bool select_verified_scene(const chart::Scene& s,uint64_t expected,const std::string& instrument,const std::string& hash,uint64_t dataset_revision) {
    if(!chart::valid_scene(s,expected)||s.instrument!=instrument||s.hash!=hash||s.dataset_revision!=dataset_revision) return false;
    if(verified_scene.version==2 && s.workspace_id==verified_scene.workspace_id && s.revision<verified_scene.revision)return false;
    auto bars=chart::available_bars(s); std::vector<ChartCandle> converted;
    auto origin=bars.empty()?0:bars.front().low;
    for(auto b:bars) {
        auto o=chart::tick_delta(b.open,origin),h=chart::tick_delta(b.high,origin),l=chart::tick_delta(b.low,origin),c=chart::tick_delta(b.close,origin);
        if(std::max({std::abs(o),std::abs(h),std::abs(l),std::abs(c)})>9007199254740991.0) return false;
        converted.push_back({o,h,l,c,b.time_ns,b.volume,b.open,b.high,b.low,b.close});
    }
    cancel_drag(); verified_scene=s; price_origin=origin; chart_candles=std::move(converted); active_local_scene_request.reset();
    chart_source=chart_candles.empty()?ChartSource::Unavailable:ChartSource::LocalScene; local_availability=chart_candles.empty()?local_scene::Availability::Unavailable:local_scene::Availability::Cached;
    // Open a readable recent range; explicit Fit history still shows the bounded full range.
    chart_view.logical_count=double(std::min<size_t>(100,chart_candles.size())); chart_view.logical_first=double(chart_candles.size())-chart_view.logical_count;
    chart_view.visible=size_t(chart_view.logical_count); chart_view.first=size_t(chart_view.logical_first); chart_view.has_cursor=false;
    advance_chart_scene_revision(); advance_chart_view_revision(); render_requested=true; return true;
}
std::pair<int64_t,int64_t> semantic_viewport() {
    if(chart_candles.empty()||!verified_scene.interval_ns)return {0,0}; auto v=effective_view(chart_view);
    auto time_at=[](double logical) {
        const auto index=std::min(size_t(logical),chart_candles.size()-1);
        const auto start=chart_candles[index].time_ns;
        const auto end=index+1<chart_candles.size()?chart_candles[index+1].time_ns:start+verified_scene.interval_ns;
        // ChartDocumentV3 stores milliseconds. Keep absolute nanoseconds in the
        // scene and interpolate real adjacent timestamps before quantization.
        return int64_t(std::llround((static_cast<long double>(start)+(logical-index)*static_cast<long double>(end-start))/1000000.0L));
    };
    return {time_at(v.first),time_at(v.first+v.count)};
}
bool restore_viewport(int64_t from,int64_t to) {
    if(chart_candles.empty()||!verified_scene.interval_ns||from<0||to<=from)return false;
    auto logical_at=[](int64_t ms) {
        auto converted=chart::ms_to_ns(uint64_t(ms)); if(!converted)return -1.0;
        auto ns=*converted;
        if(ns<chart_candles.front().time_ns||ns>chart_candles.back().time_ns+verified_scene.interval_ns)return -1.0;
        auto next=std::upper_bound(chart_candles.begin(),chart_candles.end(),ns,[](uint64_t t,const ChartCandle& b){return t<b.time_ns;});
        auto index=size_t(next-chart_candles.begin()-1); auto start=chart_candles[index].time_ns;
        auto end=next==chart_candles.end()?start+verified_scene.interval_ns:next->time_ns;
        return double(index)+double(ns-start)/double(end-start);
    };
    double first=logical_at(from),end=logical_at(to),count=end-first;
    if(first<0||count<1||count>kMaximumVisibleCandles||first+count>double(chart_candles.size())+.00001)return false;
    chart_view.logical_first=first; chart_view.logical_count=count; advance_chart_view_revision(); render_requested=true; return true;
}
std::wstring readout() {
    if(chart_candles.empty())return L"No available observations";
    auto range=semantic_viewport(); auto summary=L"Verified imported history · "+std::to_wstring(chart_candles.size())+L" bars · viewport UTC ms "+std::to_wstring(range.first)+L" to "+std::to_wstring(range.second);
    if(composed_renderer) {
        summary+=L" · Last visible close "+composed_renderer->last_visible_price(chart_candles,chart_view);
        auto pointer=composed_renderer->pointer_readout(chart_candles,chart_view); if(!pointer.empty())summary+=L" · "+pointer;
    }
    return summary;
}
bool select_scene(const local_scene::Request& request, const local_scene::Result& result) {
    if (!apply_local_scene_result(request, result)) return false;
    chart_view.visible = std::min<std::size_t>(600, chart_candles.size());
    chart_view.first = chart_candles.empty() ? 0 : chart_candles.size() - chart_view.visible;
    advance_chart_view_revision();
    return true;
}
}
#endif
