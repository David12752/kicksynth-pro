#pragma once

#include <array>
#include <atomic>
#include <memory>
#include <vector>

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>

#include "../DSP/KickEngine.h"

class KickAudioServer : public juce::Thread,
                        public juce::AudioIODeviceCallback
{
public:
    KickAudioServer();
    ~KickAudioServer() override;

    bool start(int port = 9877);
    void stop();

    void audioDeviceAboutToStart(juce::AudioIODevice* device) override;
    void audioDeviceStopped() override;
    void audioDeviceIOCallbackWithContext(const float* const*, int,
                                          float* const*, int, int,
                                          const juce::AudioIODeviceCallbackContext&) override;

    void run() override;

private:
    static constexpr int serverSampleLayers = 3;

    struct PendingSampleTrigger
    {
        bool pending = false;
        float velocity = 1.0f;
        SampleLayerParams params;
    };

    KickEngine engine;
    KickParams currentParams;
    std::array<SampleLayerParams, serverSampleLayers> currentSampleParams {};
    std::array<juce::String, serverSampleLayers> currentSamplePaths {};

    juce::AudioDeviceManager deviceManager;
    std::unique_ptr<juce::StreamingSocket> serverSocket;
    std::vector<std::unique_ptr<juce::StreamingSocket>> clients;

    juce::CriticalSection engineLock;
    std::atomic<bool> triggerRequested { false };
    std::atomic<float> triggerVelocity { 1.0f };
    std::array<PendingSampleTrigger, serverSampleLayers> pendingSampleTriggers {};

    void handleClient(juce::StreamingSocket* client);
    void processMessage(const juce::String& msg, juce::StreamingSocket* client);
    void sendToClient(juce::StreamingSocket* client, const juce::String& json);

    bool doWebSocketHandshake(juce::StreamingSocket* client);
    juce::String receiveWebSocketFrame(juce::StreamingSocket* client);
    void sendWebSocketFrame(juce::StreamingSocket* client, const juce::String& text);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(KickAudioServer)
};
