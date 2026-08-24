//
// Windows-only Phase 0 host for the local-first ZTerminal desktop client.
// It deliberately does not embed the web app, fetch remote data, or fabricate
// market state. It establishes the native Direct3D measurement boundary before
// the Rust scene contract and chart primitives are introduced.
//

#include <windows.h>
#include <d3d11.h>
#include <dxgi.h>
#include <psapi.h>
#include <wrl/client.h>

#include <algorithm>
#include <array>
#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;

namespace {

constexpr wchar_t kWindowClass[] = L"ZTerminalPhase0NativeHost";
constexpr wchar_t kWindowTitle[] = L"ZTerminal Native Phase 0";

using Clock = std::chrono::steady_clock;

struct FrameSummary {
    std::size_t count{};
    double average_ms{};
    double p95_ms{};
    double maximum_ms{};
};

class FrameStats final {
public:
    void add(const double elapsed_ms) {
        // Retain a bounded sample so prolonged benchmark sessions cannot grow
        // memory without limit. The current Phase 0 renderer presents at v-sync.
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
        for (const double sample : ordered) {
            total += sample;
        }

        const auto p95_index = static_cast<std::size_t>(
            0.95 * static_cast<double>(ordered.size() - 1));
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

[[nodiscard]] const char* feature_level_name(const D3D_FEATURE_LEVEL level) {
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

[[nodiscard]] std::string utf8_from_wide(const std::wstring& input) {
    if (input.empty()) {
        return {};
    }

    const int required = WideCharToMultiByte(
        CP_UTF8,
        0,
        input.data(),
        static_cast<int>(input.size()),
        nullptr,
        0,
        nullptr,
        nullptr);
    if (required <= 0) {
        return "unavailable";
    }

    std::string output(static_cast<std::size_t>(required), '\0');
    (void)WideCharToMultiByte(
        CP_UTF8,
        0,
        input.data(),
        static_cast<int>(input.size()),
        output.data(),
        required,
        nullptr,
        nullptr);
    return output;
}

[[nodiscard]] std::string json_escape(const std::string& input) {
    std::ostringstream output;
    for (const unsigned char character : input) {
        switch (character) {
        case '\\':
            output << "\\\\";
            break;
        case '"':
            output << "\\\"";
            break;
        case '\n':
            output << "\\n";
            break;
        case '\r':
            output << "\\r";
            break;
        case '\t':
            output << "\\t";
            break;
        default:
            if (character < 0x20U) {
                output << "\\u" << std::hex << std::setw(4) << std::setfill('0')
                       << static_cast<unsigned int>(character) << std::dec;
            } else {
                output << static_cast<char>(character);
            }
            break;
        }
    }
    return output.str();
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

        HRESULT result = D3D11CreateDeviceAndSwapChain(
            nullptr,
            D3D_DRIVER_TYPE_HARDWARE,
            nullptr,
            D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            levels.data(),
            static_cast<UINT>(levels.size()),
            D3D11_SDK_VERSION,
            &descriptor,
            swap_chain_.GetAddressOf(),
            device_.GetAddressOf(),
            &selected_feature_level_,
            context_.GetAddressOf());

        if (FAILED(result)) {
            used_warp_ = true;
            result = D3D11CreateDeviceAndSwapChain(
                nullptr,
                D3D_DRIVER_TYPE_WARP,
                nullptr,
                D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                levels.data(),
                static_cast<UINT>(levels.size()),
                D3D11_SDK_VERSION,
                &descriptor,
                swap_chain_.GetAddressOf(),
                device_.GetAddressOf(),
                &selected_feature_level_,
                context_.GetAddressOf());
        }
        if (FAILED(result)) {
            return false;
        }

        populate_adapter_diagnostics();
        return create_render_target();
    }

    void resize(UINT width, UINT height) {
        if (!swap_chain_ || width == 0 || height == 0) {
            return;
        }
        render_target_.Reset();
        const HRESULT result = swap_chain_->ResizeBuffers(0, width, height, DXGI_FORMAT_UNKNOWN, 0);
        if (SUCCEEDED(result)) {
            (void)create_render_target();
        }
    }

    void render() {
        if (!context_ || !render_target_ || !swap_chain_) {
            return;
        }

        const auto frame_started = Clock::now();
        constexpr float background[] = { 0.027F, 0.047F, 0.075F, 1.0F };
        ID3D11RenderTargetView* const targets[] = { render_target_.Get() };
        context_->OMSetRenderTargets(1, targets, nullptr);
        context_->ClearRenderTargetView(render_target_.Get(), background);
        const HRESULT present_result = swap_chain_->Present(1, 0);
        if (SUCCEEDED(present_result)) {
            const auto elapsed = Clock::now() - frame_started;
            frame_stats_.add(std::chrono::duration<double, std::milli>(elapsed).count());
        }
    }

    [[nodiscard]] bool used_warp() const {
        return used_warp_;
    }

    [[nodiscard]] D3D_FEATURE_LEVEL feature_level() const {
        return selected_feature_level_;
    }

    [[nodiscard]] const std::wstring& adapter_description() const {
        return adapter_description_;
    }

    [[nodiscard]] FrameSummary frame_summary() const {
        return frame_stats_.summarize();
    }

private:
    bool create_render_target() {
        ComPtr<ID3D11Texture2D> back_buffer;
        const HRESULT result = swap_chain_->GetBuffer(0, IID_PPV_ARGS(back_buffer.GetAddressOf()));
        if (FAILED(result)) {
            return false;
        }
        return SUCCEEDED(device_->CreateRenderTargetView(back_buffer.Get(), nullptr, render_target_.GetAddressOf()));
    }

    void populate_adapter_diagnostics() {
        ComPtr<IDXGIDevice> dxgi_device;
        if (FAILED(device_.As(&dxgi_device))) {
            adapter_description_ = L"unavailable";
            return;
        }

        ComPtr<IDXGIAdapter> adapter;
        if (FAILED(dxgi_device->GetAdapter(adapter.GetAddressOf()))) {
            adapter_description_ = L"unavailable";
            return;
        }

        DXGI_ADAPTER_DESC description{};
        if (FAILED(adapter->GetDesc(&description))) {
            adapter_description_ = L"unavailable";
            return;
        }
        adapter_description_ = description.Description;
    }

    bool used_warp_{};
    D3D_FEATURE_LEVEL selected_feature_level_{};
    std::wstring adapter_description_;
    FrameStats frame_stats_;
    ComPtr<ID3D11Device> device_;
    ComPtr<ID3D11DeviceContext> context_;
    ComPtr<IDXGISwapChain> swap_chain_;
    ComPtr<ID3D11RenderTargetView> render_target_;
};

Renderer* renderer = nullptr;

LRESULT CALLBACK window_procedure(HWND window, UINT message, WPARAM w_param, LPARAM l_param) {
    switch (message) {
    case WM_SIZE:
        if (renderer != nullptr && w_param != SIZE_MINIMIZED) {
            renderer->resize(LOWORD(l_param), HIWORD(l_param));
        }
        return 0;
    case WM_PAINT:
        if (renderer != nullptr) {
            renderer->render();
        }
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
    if (end == value + (std::size(option) - 1) || seconds > 3'600) {
        return 0;
    }
    return seconds;
}

void write_diagnostics(const Renderer& native_renderer, const double launch_ms) {
    wchar_t app_data[MAX_PATH]{};
    const DWORD app_data_length = GetEnvironmentVariableW(L"LOCALAPPDATA", app_data, MAX_PATH);
    const std::filesystem::path root =
        app_data_length > 0 && app_data_length < MAX_PATH
            ? std::filesystem::path(app_data) / L"ZTerminal" / L"logs"
            : std::filesystem::temp_directory_path() / L"ZTerminal" / L"logs";

    std::error_code error;
    std::filesystem::create_directories(root, error);
    if (error) {
        return;
    }

    PROCESS_MEMORY_COUNTERS_EX memory{};
    memory.cb = sizeof(memory);
    const bool has_memory = GetProcessMemoryInfo(
        GetCurrentProcess(),
        reinterpret_cast<PROCESS_MEMORY_COUNTERS*>(&memory),
        sizeof(memory)) != FALSE;
    const FrameSummary frames = native_renderer.frame_summary();

    std::ofstream output(root / "phase0-host-last.json", std::ios::trunc);
    if (!output) {
        return;
    }

    output << std::fixed << std::setprecision(3);
    output << "{\n";
    output << "  \"schema_version\": 1,\n";
    output << "  \"product\": \"ZTerminal Native Phase 0\",\n";
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

    WNDCLASS window_class{};
    window_class.hInstance = instance;
    window_class.lpszClassName = kWindowClass;
    window_class.lpfnWndProc = window_procedure;
    window_class.hCursor = LoadCursor(nullptr, IDC_ARROW);
    window_class.hbrBackground = static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH));

    if (RegisterClass(&window_class) == 0) {
        return 1;
    }

    HWND window = CreateWindowEx(
        0,
        kWindowClass,
        kWindowTitle,
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT,
        CW_USEDEFAULT,
        1280,
        820,
        nullptr,
        nullptr,
        instance,
        nullptr);
    if (window == nullptr) {
        return 2;
    }

    Renderer native_renderer;
    renderer = &native_renderer;
    if (!native_renderer.initialize(window)) {
        MessageBox(window, L"Direct3D 11 could not initialize.", kWindowTitle, MB_ICONERROR | MB_OK);
        DestroyWindow(window);
        return 3;
    }

    ShowWindow(window, show_command);
    UpdateWindow(window);
    const double launch_ms = std::chrono::duration<double, std::milli>(Clock::now() - process_started).count();
    const unsigned long auto_close_after_seconds = benchmark_seconds(command_line);
    const auto benchmark_deadline = Clock::now() + std::chrono::seconds(auto_close_after_seconds);

    MSG message{};
    while (message.message != WM_QUIT) {
        if (PeekMessage(&message, nullptr, 0, 0, PM_REMOVE) != FALSE) {
            TranslateMessage(&message);
            DispatchMessage(&message);
        } else {
            native_renderer.render();
            if (auto_close_after_seconds > 0 && Clock::now() >= benchmark_deadline) {
                DestroyWindow(window);
            }
        }
    }

    write_diagnostics(native_renderer, launch_ms);
    renderer = nullptr;
    return static_cast<int>(message.wParam);
}
