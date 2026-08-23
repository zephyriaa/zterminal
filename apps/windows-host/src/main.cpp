// ZTerminal Phase 0 native host spike.
//
// This Windows-only executable establishes an actual Win32 window and Direct3D
// swap chain. It deliberately does not embed the existing web application and
// does not fetch, simulate, or render market data. The production host will
// layer Windows App SDK / WinUI 3 workspace controls around this native surface.

#include <windows.h>
#include <d3d11.h>
#include <dxgi.h>
#include <wrl/client.h>

#include <array>

using Microsoft::WRL::ComPtr;

namespace {

constexpr wchar_t kWindowClass[] = L"ZTerminalPhase0NativeHost";
constexpr wchar_t kWindowTitle[] = L"ZTerminal Native Phase 0";

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
        D3D_FEATURE_LEVEL selected_level{};
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
            &selected_level,
            context_.GetAddressOf());

        if (FAILED(result)) {
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
                &selected_level,
                context_.GetAddressOf());
        }
        if (FAILED(result)) {
            return false;
        }
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

    void render() const {
        if (!context_ || !render_target_ || !swap_chain_) {
            return;
        }
        constexpr float background[] = { 0.027F, 0.047F, 0.075F, 1.0F };
        ID3D11RenderTargetView* const targets[] = { render_target_.Get() };
        context_->OMSetRenderTargets(1, targets, nullptr);
        context_->ClearRenderTargetView(render_target_.Get(), background);
        (void)swap_chain_->Present(1, 0);
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

} // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int show_command) {
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

    MSG message{};
    while (message.message != WM_QUIT) {
        if (PeekMessage(&message, nullptr, 0, 0, PM_REMOVE) != FALSE) {
            TranslateMessage(&message);
            DispatchMessage(&message);
        } else {
            native_renderer.render();
        }
    }

    renderer = nullptr;
    return static_cast<int>(message.wParam);
}
