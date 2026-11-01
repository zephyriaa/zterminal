# Native desktop entry point

28 October 2026. The Windows product is the WinUI/Direct3D client.

`npm run desktop:dev` and `npm run desktop:native:dev` build and open it with
`apps/windows-host/scripts/build-winui.ps1 -Launch`. Their `:build` equivalents
build the same product without launching it. Default output:
`out/windows-app/Release/ZTerminal.exe`.

For isolated verification without replacing a running build:

```powershell
pwsh -File apps/windows-host/scripts/build-winui.ps1 -OutputDirectory C:\path\to\isolated-build
```

The Win32 renderer diagnostic remains available through the explicitly named
`desktop:diagnostic:dev/build` scripts and `build-native.ps1`. Its executable is
`ZTerminalWindowsHost.exe`; passing that diagnostic does not accept the product.
`desktop:hosted-preview:dev/build` and `workstation:*` are compatibility/preview
paths. They are not the native Windows product or its offline acceptance path.

First-open welcome routes to Home after explicit offline completion or verified
native account exchange. Returning launches route to Home without showing the
welcome actions. Startup reads and completion are persisted in the existing Rust
Store. Home's complete study/card/tab workflows belong to Phase 03.

Provider connections, local storage, native rendering, research and account
identity are separate boundaries. No provider starts from the welcome. Native
account exchange uses the system browser and a temporary exclusive loopback
listener; it does not embed a web UI. The account service is unavailable until
its bounded endpoints/migration are deployed and explicitly enabled.

See `native-parity/PHASE-02.md` for artifact identities, checks and remaining live
identity/device gates. An unsigned local Release build is not a published Windows
release or complete native parity.
