cmake_minimum_required(VERSION 3.21)
project(ZTerminalWindowsHost VERSION 0.1.0 LANGUAGES CXX)

# Phase 0 intentionally uses a minimal Win32/D3D11 host to benchmark native
# window, input, and swap-chain overhead before wiring WinUI 3 controls. The
# production host will layer Windows App SDK / WinUI 3 around this surface.
if(NOT WIN32)
  message(FATAL_ERROR "ZTerminalWindowsHost is a Windows-only native spike.")
endif()

find_program(CARGO_EXECUTABLE cargo REQUIRED)
set(ZT_REPOSITORY_ROOT "${CMAKE_CURRENT_LIST_DIR}/../..")
set(ZT_LOCAL_SCENE_BRIDGE_MANIFEST "${ZT_REPOSITORY_ROOT}/apps/zt-local-scene-bridge/Cargo.toml")
set(ZT_LOCAL_SCENE_BRIDGE_TARGET_DIR "${CMAKE_CURRENT_BINARY_DIR}/cargo")
set(ZT_LOCAL_SCENE_BRIDGE_EXE "${ZT_LOCAL_SCENE_BRIDGE_TARGET_DIR}/release/zt-local-scene-bridge.exe")

add_custom_command(
  OUTPUT "${ZT_LOCAL_SCENE_BRIDGE_EXE}"
  COMMAND "${CARGO_EXECUTABLE}" build --manifest-path "${ZT_LOCAL_SCENE_BRIDGE_MANIFEST}" --release --target-dir "${ZT_LOCAL_SCENE_BRIDGE_TARGET_DIR}"
  WORKING_DIRECTORY "${ZT_REPOSITORY_ROOT}"
  DEPENDS
    "${ZT_LOCAL_SCENE_BRIDGE_MANIFEST}"
    "${ZT_REPOSITORY_ROOT}/crates/zt-core/src/lib.rs"
    "${ZT_REPOSITORY_ROOT}/crates/zt-core/Cargo.toml"
    "${ZT_REPOSITORY_ROOT}/crates/zt-storage/src/lib.rs"
    "${ZT_REPOSITORY_ROOT}/crates/zt-storage/Cargo.toml"
    "${ZT_REPOSITORY_ROOT}/crates/zt-protocol/src/lib.rs"
    "${ZT_REPOSITORY_ROOT}/Cargo.lock"
    "${ZT_REPOSITORY_ROOT}/Cargo.toml"
  COMMENT "Building local-only Rust scene bridge"
  VERBATIM
)
add_custom_target(ZTerminalLocalSceneBridge DEPENDS "${ZT_LOCAL_SCENE_BRIDGE_EXE}")

add_executable(ZTerminalWindowsHost WIN32 src/main.cpp src/local_scene_bridge.cpp)
add_dependencies(ZTerminalWindowsHost ZTerminalLocalSceneBridge)
target_compile_features(ZTerminalWindowsHost PRIVATE cxx_std_20)
target_compile_definitions(ZTerminalWindowsHost PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX)
target_link_libraries(ZTerminalWindowsHost PRIVATE d3d11 d3dcompiler dxgi d2d1 dwrite)

add_custom_command(
  TARGET ZTerminalWindowsHost POST_BUILD
  COMMAND "${CMAKE_COMMAND}" -E copy_if_different "${ZT_LOCAL_SCENE_BRIDGE_EXE}" "$<TARGET_FILE_DIR:ZTerminalWindowsHost>/zt-local-scene-bridge.exe"
  COMMENT "Copying local-only Rust scene bridge beside native host"
)

if(MSVC)
  target_compile_options(ZTerminalWindowsHost PRIVATE /W4 /permissive- /EHsc)
endif()
