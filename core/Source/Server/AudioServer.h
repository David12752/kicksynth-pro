#pragma once

#include <atomic>
#include <memory>
#include <vector>

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>

#include "../DSP/KickEngine.h"

class AudioServer final : private juce::Thread
{
public:
    AudioServer();
    ~AudioServer() override;

    bool startServer(int port = 9877);
    void stopServer();

private:
    class PlaybackSource : public juce::AudioSource
    {
    public:
        void prepareToPlay(int samplesPerBlockExpected, double sampleRate) override;
        void releaseResources() override;
        void getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) override;

        void setBuffer(juce::AudioBuffer<float>&& newBuffer);

    private:
        juce::CriticalSection lock;
        juce::AudioBuffer<float> buffer;
        int position = 0;
        double currentSampleRate = 44100.0;
    };

    void run() override;

    juce::String handleMessage(const juce::String& message);
    KickParams parseParams(const juce::var& paramsVar, bool useStoredDefaults) const;
    void applyParamMutation(KickParams& params, const juce::String& name, double value) const;

    void trigger(const KickParams& params);
    std::vector<float> preview(const KickParams& params, int numSamples) const;
    bool exportToFile(const KickParams& params, const juce::File& file, juce::String& errorMessage) const;

    bool performHandshake(juce::StreamingSocket& socket, juce::MemoryBlock& pendingData);
    bool readFrame(juce::StreamingSocket& socket, juce::MemoryBlock& pendingData, juce::String& message);
    bool sendText(juce::StreamingSocket& socket, const juce::String& message);

    bool appendUntil(juce::StreamingSocket& socket, juce::MemoryBlock& pendingData, size_t minBytes, int timeoutMs) const;
    static juce::String createWebSocketAccept(const juce::String& clientKey);
    static juce::AudioBuffer<float> renderKickBuffer(const KickParams& params, double sampleRate, double durationSeconds);

    mutable juce::CriticalSection stateLock;
    KickParams currentParams;

    PlaybackSource playbackSource;
    juce::AudioSourcePlayer sourcePlayer;
    juce::AudioDeviceManager deviceManager;

    std::unique_ptr<juce::StreamingSocket> listener;
    int portNumber = 9877;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AudioServer)
};
