#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_core/juce_core.h>
#include <juce_dsp/juce_dsp.h>

struct SampleLayerParams {
    float volume = 1.0f;
    float pitchSemitones = 0.0f;    // -24 to +24
    float startOffset = 0.0f;       // 0-1
    float lowCut = 20.0f;           // Hz
    float highCut = 20000.0f;       // Hz
    bool enabled = true;
    bool reverse = false;
};

class SampleLayer {
public:
    void loadFile(const juce::String& path);
    void prepare(double sampleRate);
    void trigger(const SampleLayerParams& p, float velocity = 1.0f);
    void processBlock(juce::AudioBuffer<float>& buf, int numSamples);

    juce::String filename;
    bool isLoaded() const { return buffer.getNumSamples() > 0; }
    bool isActive() const { return readPos >= 0.0; }

private:
    float readSampleAt(double position) const;
    void updateFilters();

    juce::AudioBuffer<float> buffer;
    juce::AudioFormatManager formatManager;
    double sampleRate = 44100.0;
    double readPos = -1.0;
    double playbackRate = 1.0;
    float triggerVelocity = 1.0f;
    SampleLayerParams currentParams;

    juce::dsp::IIR::Filter<float> lowCutFilter, highCutFilter;
};
