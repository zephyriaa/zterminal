//
// Windows-only local-first ZTerminal native host.
// This vertical slice renders only explicitly labelled deterministic fixture
// candles. It does not fetch, proxy, or manufacture market data. Real provider
// data must enter later through the Rust protocol and local SegmentStore.
//

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
#include <sstream>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;

namespace {

constexpr wchar_t kWindowClass[] = L"ZTerminalPhase0NativeHost";
constexpr wchar_t kWindowTitle[] = L"ZTerminal Native — Fixture Candle Slice";
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

struct FixtureCandle {
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

[[nodiscard]] std::vector<FixtureCandle> fixture_candles(std::size_t count) {
    std::vector<FixtureCandle> candles;
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
        DXGI_SWAP_CHAIN_DESC descriptor{};
        descriptor.BufferCount = 2;
        descriptor.BufferDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
        descriptor.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
        descriptor.OutputWindow = window;
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
        if (FAILED(result)) {
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
        if (!swap_chain_ || width == 0 || height == 0) {
            return;
        }
        render_target_.Reset();
        if (SUCCEEDED(swap_chain_->ResizeBuffers(0, width, height, DXGI_FORMAT_UNKNOWN, 0))) {
            width_ = width;
            height_ = height;
            (void)create_render_target();
        }
    }

    void render(const std::vector<FixtureCandle>& candles, const ChartView& view) {
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

        if (SUCCEEDED(swap_chain_->Present(1, 0))) {
            frame_stats_.add(std::chrono::duration<double, std::milli>(Clock::now() - frame_started).count());
        }
    }

    [[nodiscard]] bool used_warp() const { return used_warp_; }
    [[nodiscard]] D3D_FEATURE_LEVEL feature_level() const { return selected_feature_level_; }
    [[nodiscard]] const std::wstring& adapter_description() const { return adapter_description_; }
    [[nodiscard]] FrameSummary frame_summary() const { return frame_stats_.summarize(); }

private:
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

    [[nodiscard]] std::vector<Vertex> chart_vertices(const std::vector<FixtureCandle>& candles, const ChartView& view) const {
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
            const FixtureCandle& candle = candles[first + local_index];
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

    bool used_warp_{};
    D3D_FEATURE_LEVEL selected_feature_level_{};
    UINT width_{1280};
    UINT height_{820};
    std::wstring adapter_description_;
    FrameStats frame_stats_;
    ComPtr<ID3D11Device> device_;
    ComPtr<ID3D11DeviceContext> context_;
    ComPtr<IDXGISwapChain> swap_chain_;
    ComPtr<ID3D11RenderTargetView> render_target_;
    ComPtr<ID3D11VertexShader> vertex_shader_;
    ComPtr<ID3D11PixelShader> pixel_shader_;
    ComPtr<ID3D11InputLayout> input_layout_;
    ComPtr<ID3D11Buffer> vertex_buffer_;
};

Renderer* renderer = nullptr;
ChartView chart_view;
std::vector<FixtureCandle> chart_candles;
bool render_requested = true;
bool continuous_benchmark_rendering = false;

void request_frame(HWND window) {
    render_requested = true;
    InvalidateRect(window, nullptr, FALSE);
}

void update_title(HWND window) {
    std::wstringstream title;
    title << kWindowTitle << L" | FIXTURE ONLY | " << chart_candles.size()
          << L" candles | visible " << chart_view.visible
          << L" | wheel zoom, drag pan, Esc close";
    SetWindowText(window, title.str().c_str());
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
        }
        return 0;
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    default:
        return DefWindowProc(window, message, w_param, l_param);
    }
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

[[nodiscard]] std::size_t requested_fixture_candle_count(PWSTR command_line) {
    constexpr wchar_t option[] = L"--fixture-candles=";
    const wchar_t* const value = wcsstr(command_line, option);
    if (value == nullptr) {
        return 10'000;
    }
    wchar_t* end{};
    const unsigned long count = wcstoul(value + (std::size(option) - 1), &end, 10);
    if (end == value + (std::size(option) - 1) || count < 10'000 || count > 100'000) {
        return 10'000;
    }
    return static_cast<std::size_t>(count);
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
    output << "  \"product\": \"ZTerminal Native Fixture Candle Slice\",\n";
    output << "  \"fixture_only\": true,\n";
    output << "  \"fixture_candles\": " << chart_candles.size() << ",\n";
    output << "  \"driver\": \"" << (native_renderer.used_warp() ? "warp" : "hardware") << "\",\n";
    output << "  \"adapter\": \"" << json_escape(utf8_from_wide(native_renderer.adapter_description())) << "\",\n";
    output << "  \"feature_level\": \"" << feature_level_name(native_renderer.feature_level()) << "\",\n";
    output << "  \"launch_to_visible_ms\": " << launch_ms << ",\n";
    output << "  \"frame_samples\": " << frames.count << ",\n";
    output << "  \"frame_average_ms\": " << frames.average_ms << ",\n";
    output << "  \"frame_p95_ms\": " << frames.p95_ms << ",\n";
    output << "  \"frame_maximum_ms\": " << frames.maximum_ms << ",\n";
    output << "  \"working_set_bytes\": " << (has_memory ? memory.WorkingSetSize : 0) << ",\n";
    output << "  \"private_usage_bytes\": " << (has_memory ? memory.PrivateUsage : 0) << "\n";
    output << "}\n";
}

} // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR command_line, int show_command) {
    const auto process_started = Clock::now();
    chart_candles = fixture_candles(requested_fixture_candle_count(command_line));
    chart_view.visible = std::min<std::size_t>(600, chart_candles.size());
    chart_view.first = chart_candles.size() - chart_view.visible;

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
    const auto benchmark_deadline = Clock::now() + std::chrono::seconds(auto_close_after_seconds);

    MSG message{};
    while (message.message != WM_QUIT) {
        if (PeekMessage(&message, nullptr, 0, 0, PM_REMOVE) != FALSE) {
            TranslateMessage(&message);
            DispatchMessage(&message);
        } else if (render_requested || continuous_benchmark_rendering) {
            native_renderer.render(chart_candles, chart_view);
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
