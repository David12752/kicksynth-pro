#include <JuceHeader.h>
#include "DSP/SubOscillator.h"

class KickSynthAudioProcessor : public juce::AudioProcessor {
public:
    KickSynthAudioProcessor() : subOsc() {}
    
    void prepareToPlay (double sampleRate, int samplesPerBlock) override {
        // Initialize DSP
    }

    void processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages) override {
        subOsc.processBlock(buffer, buffer.getNumSamples());
    }

    juce::AudioProcessorEditor* createEditor() override {
        return nullptr; // UI is handled by Electron
    }

    const juce::String getName() const override { return "KickSynth Pro"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int index) override {}
    const juce::String getProgramName (int index) override { return {}; }
    void changeProgramName (int index, const juce::String& newName) override {}
    void getStateInformation (juce::MemoryBlock& destData) override {}
    void setStateInformation (const void* data, int sizeInBytes) override {}

private:
    SubOscillator subOsc;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (KickSynthAudioProcessor)
};

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
    return new KickSynthAudioProcessor();
}
