#pragma once

#include <JuceHeader.h>
#include <atomic>
#include <map>
#include "DSP/KickEngine.h"

class KickSynthProcessor : public juce::AudioProcessor
{
public:
    KickSynthProcessor();
    ~KickSynthProcessor() override;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 1.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return "Default"; }
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock&) override;
    void setStateInformation(const void*, int) override;

    juce::AudioProcessorValueTreeState apvts;

    static juce::AudioProcessorValueTreeState::ParameterLayout createParams();

    KickParams getCurrentParams() const;
    std::vector<float> renderPreview(int numSamples = 512) const;
    void triggerManual();
    void applyPreset(const std::map<juce::String, float>& values);

private:
    KickEngine engine;
    std::atomic<bool> manualTriggerPending { false };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(KickSynthProcessor)
};
