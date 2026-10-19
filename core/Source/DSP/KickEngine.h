#pragma once

#include <array>
#include <vector>

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_core/juce_core.h>
#include <juce_dsp/juce_dsp.h>

#include "SampleLayer.h"

struct KickParams
{
    // === OSCILLATOR ===
    float startPitch = 200.0f;      // Hz (20-1000)
    float endPitch = 50.0f;         // Hz (20-500)
    float pitchDecay = 0.06f;       // seconds (0.001-2.0)
    float pitchCurve = 2.0f;        // 0.1=linear, 10=exponential
    float phase = 0.0f;             // degrees (0-360) initial phase
    int waveform = 0;               // 0=sine, 1=triangle, 2=square, 3=tanh

    // === AMP ENVELOPE ===
    float attack = 0.002f;          // seconds
    float decay = 0.4f;             // seconds
    float sustain = 0.0f;           // 0-1
    float release = 0.1f;           // seconds
    float punch = 0.7f;             // 0-1 transient boost

    // === CLICK TRANSIENT ===
    float clickLevel = 0.5f;        // 0-1
    float clickDecay = 0.008f;      // seconds

    // === CHARACTER ===
    float drive = 0.3f;             // 0-1
    int satType = 0;                // 0=soft, 1=tube, 2=bitcrush, 3=tape
    float tone = 0.5f;              // compatibility control for preview/server clients
    float noise = 0.1f;             // 0-1
    float subLevel = 1.0f;          // 0-1
    float subHarmonic = 0.0f;       // 0-1 (octave below enhancer)

    // === ANALOG DRIFT ===
    float driftAmount = 0.0f;       // 0-1
    float driftRate = 0.5f;         // 0-1 (slow to fast)

    // === OUTPUT ===
    float gain = 0.8f;              // 0-1
    float bpm = 120.0f;             // compatibility field for transport clients
    float lowCutHz = 20.0f;         // Hz (20-200)
    float highCutHz = 20000.0f;     // Hz (1000-20000)
    bool limiterEnabled = true;

    // === EQ (4-band) ===
    float eqLowShelfHz = 80.0f;     float eqLowShelfDb = 0.0f;
    float eqLowMidHz = 200.0f;      float eqLowMidDb = 0.0f;   float eqLowMidQ = 1.0f;
    float eqHighMidHz = 2000.0f;    float eqHighMidDb = 0.0f;  float eqHighMidQ = 1.0f;
    float eqHighShelfHz = 8000.0f;  float eqHighShelfDb = 0.0f;

    // === SNAP TO KEY ===
    bool snapToKey = false;
    int snapNote = 0;               // 0=C, 1=C#... 11=B
    int snapOctave = 1;             // 0-3

    // === VELOCITY ===
    float velocity = 1.0f;          // 0-1 (from MIDI)
    float velocityToGain = 0.5f;    // 0-1
    float velocityToDrive = 0.0f;   // 0-1

    // === LFO ===
    float lfoRate = 2.0f;           // Hz
    float lfoDepth = 0.0f;          // 0-1
    int lfoTarget = 0;              // 0=none, 1=pitch, 2=amp, 3=filter
};

struct KickPreviewData
{
    std::vector<float> waveform;
    std::vector<float> subWaveform;
    std::array<std::vector<float>, 3> sampleWaveforms;
    float peak = 0.0f;
};

class KickEngine
{
public:
    KickEngine();

    void prepare(double sampleRate, int blockSize);
    void trigger(float velocity = -1.0f);
    void processBlock(juce::AudioBuffer<float>& buffer, int numSamples);
    void setParams(const KickParams& p);
    const KickParams& getParams() const { return params; }

    bool loadSample(int slot, const juce::String& path);
    void setSampleLayerParams(int slot, const SampleLayerParams& p);
    SampleLayerParams getSampleLayerParams(int slot) const;
    void triggerSample(int slot, const SampleLayerParams& p, float velocity = 1.0f);
    juce::String getSampleFilename(int slot) const;

    std::vector<float> renderPreview(int numSamples = 512) const;
    KickPreviewData renderDetailedPreview(int numSamples = 512) const;

private:
    static constexpr int numSampleLayers = 3;

    void updateFilters();
    void generateSynthBlock(juce::AudioBuffer<float>& buffer, int numSamples, std::vector<float>* subPreview = nullptr);
    void applyOutputProcessing(juce::AudioBuffer<float>& buffer, int numSamples);

    float currentPitch() const;
    float currentAmp() const;
    float currentClick() const;
    float waveformAt(double ph, int type) const;
    float applySaturation(float x, float drive, int satType) const;
    float makeNoiseSample();
    float randomFloat();
    bool anySampleActive() const;
    double triggerVelocityValue(float velocityOverride) const;

    KickParams params;
    KickParams activeParams;

    double sampleRate = 44100.0;
    double phase = 0.0;
    double subOscPhase = 0.0;
    double envPos = 0.0;
    double lfoPhase = 0.0;
    double driftLfoPhase = 0.0;
    double driftHz = 0.0;
    double driftPhase = 0.0;
    bool synthPlaying = false;

    std::array<SampleLayer, numSampleLayers> sampleLayers;
    std::array<SampleLayerParams, numSampleLayers> sampleLayerParams;
    std::array<juce::String, numSampleLayers> samplePaths;

    juce::dsp::IIR::Filter<float> outputLowCut, outputHighCut;
    juce::dsp::IIR::Filter<float> eqLowShelf, eqLowMid, eqHighMid, eqHighShelf;

    juce::Random random { 0x5EED1234 };
};
