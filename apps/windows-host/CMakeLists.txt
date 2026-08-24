cmake_minimum_required(VERSION 3.24)
project(ZTerminalWindowsHost VERSION 0.1.0 LANGUAGES CXX)

# Phase 0 intentionally uses a minimal Win32/D3D11 host to benchmark native
# window, input, and swap-chain overhead before wiring WinUI 3 controls. The
# production host will layer Windows App SDK / WinUI 3 around this surface.
if(NOT WIN32)
  message(FATAL_ERROR "ZTerminalWindowsHost is a Windows-only native spike.")
endif()

add_executable(ZTerminalWindowsHost WIN32 src/main.cpp)
target_compile_features(ZTerminalWindowsHost PRIVATE cxx_std_20)
target_compile_definitions(ZTerminalWindowsHost PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX)
target_link_libraries(ZTerminalWindowsHost PRIVATE d3d11 d3dcompiler dxgi d2d1 dwrite)

if(MSVC)
  target_compile_options(ZTerminalWindowsHost PRIVATE /W4 /permissive- /EHsc)
endif()
