# ZTerminal Windows Native Host — Phase 0 Spike

This is a **Windows-only native host spike**. It creates a Win32 desktop window and a Direct3D 11.1-compatible swap chain. It does not contain a WebView, does not open the deployed ZTerminal site, does not contain a market-data client, and does not place or simulate orders.

The purpose is to measure native windowing, input dispatch, swap-chain creation, resize behavior, clear/present frame time, memory, and installer overhead before integrating the full Windows App SDK / WinUI 3 host and Rust engine. The Direct3D 11 surface is deliberately isolated so Direct3D 12 can be benchmarked behind the same renderer contract later.

## Build prerequisites

Build this spike on a Windows 10 version 1809+ or Windows 11 x64 development machine with Visual Studio 2022 Build Tools, the Windows 10/11 SDK, CMake 3.24+, and the Desktop C++ workload. The current Linux CI environment intentionally cannot compile or run Direct3D/WinUI code; it validates only the portable Rust protocol, engine, cache, and benchmark components.

```powershell
cmake -S apps/windows-host -B out/windows-host -G "Visual Studio 17 2022" -A x64
cmake --build out/windows-host --config Release
.\out\windows-host\Release\ZTerminalWindowsHost.exe
```

## Required Phase 0 measurements

Record cold and warm startup, process private bytes/working set, GPU time, frame time at idle and resize, input-to-frame latency, executable size, and failure behavior with no hardware Direct3D device. The spike may use WARP only as a functional fallback; a WARP result does not qualify as a GPU-performance benchmark.

The next host iteration replaces the temporary Win32 chrome with a Windows App SDK / WinUI 3 shell while retaining this custom native GPU surface. No production installer, auto-update, account authorization, cloud synchronization, or entitlement claim is enabled by this spike.
