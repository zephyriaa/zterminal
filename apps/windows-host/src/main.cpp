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

#include <windows.h>
#include <windowsx.h>
#include <d3d11.h>
#include <d3dcompiler.h>
#include <dxgi.h>
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
#include <optional>
#include <sstream>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;

namespace {

constexpr wchar_t kWindowClass[] = L"ZTerminalPhase0NativeHost";
constexpr wchar_t kWindowTitle[] = L"ZTerminal Native Local-First Host";
constexpr std::size_t kMaximumVisibleCandles = 2'000;
constexpr std::size_t kVerticesPerCandle = 12;
constexpr std::size_t kMaximumVertices = (kMaximumVisibleCandles * kVerticesPerCandle) + 24;

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
};

struct ChartView {
    std::size_t first{};
    std::size_t visible{600};
    POINT cursor{};
    bool has_cursor{};
    bool dragging{};
    int drag_start_x{};
    std::size_t drag_start_first{};
};

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
    bool initialize(HWND window) {
        window_ = window;
        return recreate_device_resources();
    }

    bool recreate_device_resources() {
        render_target_.Reset();
        vertex_buffer_.Reset();
        input_layout_.Reset();
        vertex_shader_.Reset();
        pixel_shader_.Reset();
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
        HRESULT result = D3D11CreateDeviceAndSwapChain(
            output_adapter.Get(),
            output_adapter ? D3D_DRIVER_TYPE_UNKNOWN : D3D_DRIVER_TYPE_HARDWARE,
            nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            levels.data(), static_cast<UINT>(levels.size()), D3D11_SDK_VERSION, &descriptor,
            swap_chain_.GetAddressOf(), device_.GetAddressOf(), &selected_feature_level_, context_.GetAddressOf());
        if (FAILED(result) && output_adapter) {
            // A display adapter can reject a requested feature level. Retain the
            // legacy hardware fallback before considering software rendering.
            output_adapter.Reset();
            result = D3D11CreateDeviceAndSwapChain(
                nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                levels.data(), static_cast<UINT>(levels.size()), D3D11_SDK_VERSION, &descriptor,
                swap_chain_.GetAddressOf(), device_.GetAddressOf(), &selected_feature_level_, context_.GetAddressOf());
        }
        if (FAILED(result) && !recovering_device_) {
            used_warp_ = true;
            result = D3D11CreateDeviceAndSwapChain(
                nullptr, D3D_DRIVER_TYPE_WARP, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                levels.data(), static_cast<UINT>(levels.size()), D3D11_SDK_VERSION, &descriptor,
                swap_chain_.GetAddressOf(), device_.GetAddressOf(), &selected_feature_level_, context_.GetAddressOf());
        }
        if (FAILED(result)) {
            return false;
        }
        populate_adapter_diagnostics();
        return create_render_target() && create_pipeline();
    }

    void resize(UINT width, UINT height) {
        if (!swap_chain_ || !context_ || width == 0 || height == 0) {
            return;
        }
        context_->OMSetRenderTargets(0, nullptr, nullptr);
        context_->ClearState();
        context_->Flush();
        render_target_.Reset();
        const HRESULT result = swap_chain_->ResizeBuffers(0, width, height, DXGI_FORMAT_UNKNOWN, 0);
        if (SUCCEEDED(result) && create_render_target()) {
            width_ = width;
            height_ = height;
            ++resize_successes_;
            return;
        }
        last_renderer_error_ = FAILED(result) ? result : E_FAIL;
        if (is_device_loss(last_renderer_error_)) {
            (void)recover_device(last_renderer_error_);
        } else {
            ++resize_failures_;
        }
    }

    void render(const std::vector<ChartCandle>& candles, const ChartView& view, bool unsynchronised_present) {
        if (!context_ || !render_target_ || !swap_chain_ || !vertex_buffer_) {
            return;
        }
        const auto frame_started = Clock::now();
        constexpr float background[] = {0.027F, 0.047F, 0.075F, 1.0F};
        ID3D11RenderTargetView* const targets[] = {render_target_.Get()};
        context_->OMSetRenderTargets(1, targets, nullptr);
        context_->ClearRenderTargetView(render_target_.Get(), background);

        if (!candles.empty()) {
            const std::vector<Vertex> vertices = chart_vertices(candles, view);
            if (!vertices.empty()) {
                D3D11_MAPPED_SUBRESOURCE mapped{};
                if (SUCCEEDED(context_->Map(vertex_buffer_.Get(), 0, D3D11_MAP_WRITE_DISCARD, 0, &mapped))) {
                    std::memcpy(mapped.pData, vertices.data(), vertices.size() * sizeof(Vertex));
                    context_->Unmap(vertex_buffer_.Get(), 0);
                    const UINT stride = sizeof(Vertex);
                    const UINT offset = 0;
                    context_->IASetInputLayout(input_layout_.Get());
                    context_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
                    ID3D11Buffer* const buffers[] = {vertex_buffer_.Get()};
                    context_->IASetVertexBuffers(0, 1, buffers, &stride, &offset);
                    context_->VSSetShader(vertex_shader_.Get(), nullptr, 0);
                    context_->PSSetShader(pixel_shader_.Get(), nullptr, 0);
                    context_->Draw(static_cast<UINT>(vertices.size()), 0);
                }
            }
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
    [[nodiscard]] std::uint64_t resize_successes() const { return resize_successes_; }
    [[nodiscard]] std::uint64_t resize_failures() const { return resize_failures_; }
    [[nodiscard]] std::uint64_t device_recoveries() const { return device_recoveries_; }
    [[nodiscard]] std::uint64_t unrecoverable_device_failures() const { return unrecoverable_device_failures_; }
    [[nodiscard]] std::uint64_t present_failures() const { return present_failures_; }
    [[nodiscard]] HRESULT last_renderer_error() const { return last_renderer_error_; }

private:
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
        return SUCCEEDED(device_->CreateRenderTargetView(back_buffer.Get(), nullptr, render_target_.GetAddressOf()));
    }

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
        return SUCCEEDED(device_->CreateBuffer(&buffer, nullptr, vertex_buffer_.GetAddressOf()));
    }

    [[nodiscard]] std::vector<Vertex> chart_vertices(const std::vector<ChartCandle>& candles, const ChartView& view) const {
        const std::size_t visible = std::min({view.visible, kMaximumVisibleCandles, candles.size()});
        const std::size_t first = std::min(view.first, candles.size() - visible);
        const std::size_t last = first + visible;
        double low = std::numeric_limits<double>::max();
        double high = std::numeric_limits<double>::lowest();
        for (std::size_t index = first; index < last; ++index) {
            low = std::min(low, candles[index].low);
            high = std::max(high, candles[index].high);
        }
        const double padding = std::max((high - low) * 0.08, 1.0);
        low -= padding;
        high += padding;
        const double range = std::max(high - low, 1.0);
        const float slot = 2.0F / static_cast<float>(visible);
        const float body_half_width = std::max(slot * 0.28F, 0.0004F);
        const float wick_half_width = std::max(slot * 0.05F, 0.0002F);
        const auto y = [low, range](double price) { return static_cast<float>(1.0 - ((price - low) / range) * 2.0); };

        std::vector<Vertex> vertices;
        vertices.reserve((visible * kVerticesPerCandle) + 12);
        for (std::size_t local_index = 0; local_index < visible; ++local_index) {
            const ChartCandle& candle = candles[first + local_index];
            const float x = -1.0F + (static_cast<float>(local_index) + 0.5F) * slot;
            const bool rising = candle.close >= candle.open;
            const std::array<float, 4> color = rising
                ? std::array<float, 4>{0.106F, 0.725F, 0.565F, 1.0F}
                : std::array<float, 4>{0.875F, 0.306F, 0.353F, 1.0F};
            append_rectangle(vertices, x - wick_half_width, y(candle.high), x + wick_half_width, y(candle.low), color);
            const float top = y(std::max(candle.open, candle.close));
            const float bottom = y(std::min(candle.open, candle.close));
            append_rectangle(vertices, x - body_half_width, top, x + body_half_width, std::max(bottom, top + 0.002F), color);
        }
        if (view.has_cursor && width_ > 0 && height_ > 0) {
            const float x = (static_cast<float>(view.cursor.x) / static_cast<float>(width_)) * 2.0F - 1.0F;
            const float y_cursor = 1.0F - (static_cast<float>(view.cursor.y) / static_cast<float>(height_)) * 2.0F;
            constexpr std::array<float, 4> crosshair{0.58F, 0.68F, 0.79F, 0.55F};
            append_rectangle(vertices, x - 0.001F, -1.0F, x + 0.001F, 1.0F, crosshair);
            append_rectangle(vertices, -1.0F, y_cursor - 0.001F, 1.0F, y_cursor + 0.001F, crosshair);
        }
        return vertices;
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
    bool used_warp_{};
    bool recovering_device_{};
    D3D_FEATURE_LEVEL selected_feature_level_{};
    UINT width_{1280};
    UINT height_{820};
    std::wstring adapter_description_;
    FrameStats frame_stats_;
    std::uint64_t resize_successes_{};
    std::uint64_t resize_failures_{};
    std::uint64_t device_recoveries_{};
    std::uint64_t unrecoverable_device_failures_{};
    std::uint64_t present_failures_{};
    HRESULT last_renderer_error_{S_OK};
    ComPtr<ID3D11Device> device_;
    ComPtr<ID3D11DeviceContext> context_;
    ComPtr<IDXGISwapChain> swap_chain_;
    ComPtr<ID3D11RenderTargetView> render_target_;
    ComPtr<ID3D11VertexShader> vertex_shader_;
    ComPtr<ID3D11PixelShader> pixel_shader_;
    ComPtr<ID3D11InputLayout> input_layout_;
    ComPtr<ID3D11Buffer> vertex_buffer_;
};

enum class ChartSource {
    Unavailable,
    FixtureDiagnostic,
    LocalScene,
};

Renderer* renderer = nullptr;
ChartView chart_view;
std::vector<ChartCandle> chart_candles;
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

void request_frame(HWND window) {
    render_requested = true;
    InvalidateRect(window, nullptr, FALSE);
}

void update_title(HWND window) {
    std::wstringstream title;
    title << kWindowTitle << L" | ";
    if (chart_source == ChartSource::FixtureDiagnostic) {
        title << L"FIXTURE ONLY | " << chart_candles.size() << L" diagnostic candles";
    } else if (chart_source == ChartSource::LocalScene) {
        title << zterminal::local_scene::availability_label(local_availability)
              << L" | " << chart_candles.size() << L" of " << local_total_bars
              << L" verified local candles | source offset " << local_first_bar;
        if (active_local_scene_request.has_value()) {
            title << L" | segment " << active_local_scene_request->start_ns;
        }
        if (local_availability == zterminal::local_scene::Availability::Cached) {
            title << L" | age " << local_age_ns << L" ns";
        }
    } else {
        title << zterminal::local_scene::availability_label(local_availability)
              << L" | no candles rendered";
        if (!local_diagnostic.empty()) {
            title << L" | " << local_diagnostic;
        }
    }
    if (!local_history_diagnostic.empty()) {
        title << L" | " << local_history_diagnostic;
    }
    if (local_monte_carlo_result.kind == zterminal::local_monte_carlo::Kind::Complete) {
        title << L" | " << zterminal::local_monte_carlo::kind_label(local_monte_carlo_result.kind)
              << L" | median " << local_monte_carlo_result.median_return_bps
              << L" bps | p05 " << local_monte_carlo_result.p05_return_bps
              << L" | p95 " << local_monte_carlo_result.p95_return_bps;
    } else if (local_monte_carlo_result.kind != zterminal::local_monte_carlo::Kind::NotRequested) {
        title << L" | " << zterminal::local_monte_carlo::kind_label(local_monte_carlo_result.kind);
    }
    title << L" | wheel zoom, drag pan, PgUp/PgDn page, Home/End bounds, Esc close";
    SetWindowText(window, title.str().c_str());
}

bool apply_local_scene_result(
    const zterminal::local_scene::Request& request,
    const zterminal::local_scene::Result& result
) {
    local_availability = result.availability;
    local_diagnostic = result.diagnostic;
    local_total_bars = result.total_bars == 0 ? result.retained_bars : result.total_bars;
    local_first_bar = result.first_bar;
    local_age_ns = result.age_ns;
    chart_candles.clear();
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
    for (const zterminal::local_scene::Candle& candle : result.candles) {
        chart_candles.push_back({
            .open = static_cast<double>(candle.open_ticks),
            .high = static_cast<double>(candle.high_ticks),
            .low = static_cast<double>(candle.low_ticks),
            .close = static_cast<double>(candle.close_ticks),
        });
    }
    chart_view.visible = std::min(chart_view.visible, chart_candles.size());
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
    chart_view.first = static_cast<std::size_t>(std::clamp(static_cast<long long>(chart_view.drag_start_first) + delta, 0LL, maximum_first));
    update_title(window);
}

LRESULT CALLBACK window_procedure(HWND window, UINT message, WPARAM w_param, LPARAM l_param) {
    switch (message) {
    case WM_SIZE:
        if (renderer != nullptr && w_param != SIZE_MINIMIZED) {
            renderer->resize(LOWORD(l_param), HIWORD(l_param));
            request_frame(window);
        }
        return 0;
    case WM_MOUSEMOVE:
        chart_view.cursor = {GET_X_LPARAM(l_param), GET_Y_LPARAM(l_param)};
        chart_view.has_cursor = true;
        pan_from_drag(window, chart_view.cursor.x);
        request_frame(window);
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
    case WM_PAINT:
        ValidateRect(window, nullptr);
        return 0;
    case WM_KEYDOWN:
        if (w_param == VK_ESCAPE) {
            DestroyWindow(window);
        } else if (w_param == VK_PRIOR || w_param == VK_NEXT || w_param == VK_HOME || w_param == VK_END) {
            navigate_local_scene(window, w_param);
        }
        return 0;
    case WM_DESTROY:
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
        || has_option(command_line, L"--local-monte-carlo-seed=");
}

[[nodiscard]] std::optional<zterminal::local_monte_carlo::Request> requested_local_monte_carlo(
    PWSTR command_line,
    const zterminal::local_scene::Request& local_scene_request
) {
    constexpr wchar_t simulations_option[] = L"--local-monte-carlo-simulations=";
    constexpr wchar_t horizon_option[] = L"--local-monte-carlo-horizon-bars=";
    constexpr wchar_t seed_option[] = L"--local-monte-carlo-seed=";
    const std::optional<std::uint64_t> simulations = unsigned_option_value(command_line, simulations_option);
    const std::optional<std::uint64_t> horizon_bars = unsigned_option_value(command_line, horizon_option);
    const std::optional<std::uint64_t> seed = unsigned_option_value(command_line, seed_option);
    if (!simulations.has_value() || !horizon_bars.has_value() || !seed.has_value()
        || *simulations == 0 || *horizon_bars == 0 || *seed == 0
        || *simulations > 10'000 || *horizon_bars > 1'000
        || *simulations > std::numeric_limits<std::size_t>::max()
        || *horizon_bars > std::numeric_limits<std::size_t>::max()) {
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

void write_diagnostics(const Renderer& native_renderer, double launch_ms) {
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
    PROCESS_MEMORY_COUNTERS_EX memory{};
    memory.cb = sizeof(memory);
    const bool has_memory = GetProcessMemoryInfo(GetCurrentProcess(), reinterpret_cast<PROCESS_MEMORY_COUNTERS*>(&memory), sizeof(memory)) != FALSE;
    const FrameSummary frames = native_renderer.frame_summary();
    std::ofstream output(root / "phase0-host-last.json", std::ios::trunc);
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
    output << "  \"local_monte_carlo_source_bars\": " << local_monte_carlo_result.source_bars << ",\n";
    output << "  \"local_monte_carlo_simulations\": " << local_monte_carlo_result.simulations << ",\n";
    output << "  \"local_monte_carlo_horizon_bars\": " << local_monte_carlo_result.horizon_bars << ",\n";
    output << "  \"local_monte_carlo_median_return_bps\": " << local_monte_carlo_result.median_return_bps << ",\n";
    output << "  \"fixture_candles\": " << chart_candles.size() << ",\n";
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
    output << "  \"renderer_last_error_hr\": " << static_cast<long>(native_renderer.last_renderer_error()) << ",\n";
    output << "  \"working_set_bytes\": " << (has_memory ? memory.WorkingSetSize : 0) << ",\n";
    output << "  \"private_usage_bytes\": " << (has_memory ? memory.PrivateUsage : 0) << "\n";
    output << "}\n";
}

} // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR command_line, int show_command) {
    const auto process_started = Clock::now();
    select_chart_source(command_line);
    chart_view.visible = std::min<std::size_t>(600, chart_candles.size());
    chart_view.first = chart_candles.empty() ? 0 : chart_candles.size() - chart_view.visible;

    WNDCLASS window_class{};
    window_class.hInstance = instance;
    window_class.lpszClassName = kWindowClass;
    window_class.lpfnWndProc = window_procedure;
    window_class.hCursor = LoadCursor(nullptr, IDC_ARROW);
    window_class.hbrBackground = static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH));
    if (RegisterClass(&window_class) == 0) {
        return 1;
    }
    HWND window = CreateWindowEx(0, kWindowClass, kWindowTitle, WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT, 1280, 820, nullptr, nullptr, instance, nullptr);
    if (window == nullptr) {
        return 2;
    }
    Renderer native_renderer;
    renderer = &native_renderer;
    if (!native_renderer.initialize(window)) {
        MessageBox(window, L"Direct3D 11 candle surface could not initialize.", kWindowTitle, MB_ICONERROR | MB_OK);
        DestroyWindow(window);
        return 3;
    }
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
            native_renderer.render(chart_candles, chart_view, unsynchronised_benchmark_present);
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
