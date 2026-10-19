cmake_minimum_required(VERSION 3.22)
project(KickSynthPro VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(JUCE_DIR "C:/MathChordGen_build/build/_deps/juce-src")
add_subdirectory(${JUCE_DIR} ${CMAKE_BINARY_DIR}/juce EXCLUDE_FROM_ALL)

set(KICKSYNTH_DSP_SOURCES
    Source/DSP/KickEngine.cpp
    Source/DSP/KickEngine.h
    Source/DSP/SampleLayer.cpp
    Source/DSP/SampleLayer.h
    Source/DSP/SubOscillator.cpp
    Source/DSP/SubOscillator.h
    Source/DSP/PitchEnvelope.cpp
    Source/DSP/PitchEnvelope.h
    Source/DSP/AmpEnvelope.cpp
    Source/DSP/AmpEnvelope.h
    Source/DSP/Distortion.cpp
    Source/DSP/Distortion.h
)

juce_add_plugin(KickSynthPro
    PLUGIN_NAME "KickSynth Pro"
    PLUGIN_MANUFACTURER_CODE KSPV
    PLUGIN_CODE KSP1
    FORMATS VST3 Standalone
    PRODUCT_NAME "KickSynthPro"
    COMPANY_NAME "KickSynth"
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE
    VST3_CATEGORIES Instrument Synth
)

juce_generate_juce_header(KickSynthPro)

target_sources(KickSynthPro PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginProcessor.h
    Source/PluginEditor.cpp
    Source/PluginEditor.h
    ${KICKSYNTH_DSP_SOURCES}
)

target_include_directories(KickSynthPro PRIVATE Source)

target_compile_definitions(KickSynthPro PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(KickSynthPro PRIVATE
    juce::juce_audio_utils
    juce::juce_dsp
    juce::juce_gui_basics
    juce::juce_graphics
    juce::juce_audio_processors
    juce::juce_audio_formats
    PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)

add_executable(KickSynthCLI
    Source/CLI/main.cpp
    ${KICKSYNTH_DSP_SOURCES}
)

target_include_directories(KickSynthCLI PRIVATE Source)

target_compile_definitions(KickSynthCLI PRIVATE
    JUCE_STANDALONE_APPLICATION=1
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
)

target_link_libraries(KickSynthCLI PRIVATE
    juce::juce_audio_basics
    juce::juce_audio_formats
    juce::juce_dsp
    juce::juce_core
)

set_target_properties(KickSynthCLI PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/KickSynthPro_artefacts/Release/CLI"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/KickSynthPro_artefacts/Debug/CLI"
    RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${CMAKE_BINARY_DIR}/KickSynthPro_artefacts/RelWithDebInfo/CLI"
    RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${CMAKE_BINARY_DIR}/KickSynthPro_artefacts/MinSizeRel/CLI"
)

add_executable(KickSynthServer
    Source/Server/main.cpp
    Source/Server/KickServer.cpp
    Source/Server/KickServer.h
    ${KICKSYNTH_DSP_SOURCES}
)

target_include_directories(KickSynthServer PRIVATE Source)

target_compile_definitions(KickSynthServer PRIVATE
    JUCE_STANDALONE_APPLICATION=1
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
)

target_link_libraries(KickSynthServer PRIVATE
    juce::juce_audio_basics
    juce::juce_audio_devices
    juce::juce_audio_formats
    juce::juce_core
    juce::juce_cryptography
    juce::juce_dsp
    juce::juce_events
    juce::juce_gui_basics
    Advapi32
)

set_target_properties(KickSynthServer PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/KickSynthPro_artefacts/Release/Server"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/KickSynthPro_artefacts/Debug/Server"
    RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${CMAKE_BINARY_DIR}/KickSynthPro_artefacts/RelWithDebInfo/Server"
    RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${CMAKE_BINARY_DIR}/KickSynthPro_artefacts/MinSizeRel/Server"
)
