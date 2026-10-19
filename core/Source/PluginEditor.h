#pragma once

#include <JuceHeader.h>
#include <map>
#include "PluginProcessor.h"

class WaveformDisplay : public juce::Component,
                        private juce::Timer
{
public:
    explicit WaveformDisplay(KickSynthProcessor& processor);
    void paint(juce::Graphics& g) override;

private:
    void timerCallback() override;

    KickSynthProcessor& proc;
    std::vector<float> preview;
};

class SynthLookAndFeel : public juce::LookAndFeel_V4
{
public:
    SynthLookAndFeel();

    void drawRotarySlider(juce::Graphics&, int x, int y, int width, int height,
                          float sliderPosProportional, float rotaryStartAngle,
                          float rotaryEndAngle, juce::Slider&) override;
    void drawButtonBackground(juce::Graphics&, juce::Button&, const juce::Colour&,
                              bool shouldDrawButtonAsHighlighted, bool shouldDrawButtonAsDown) override;
    void drawComboBox(juce::Graphics&, int width, int height, bool isButtonDown,
                      int buttonX, int buttonY, int buttonW, int buttonH, juce::ComboBox&) override;
    juce::Font getComboBoxFont(juce::ComboBox&) override;
};

class KnobWithLabel : public juce::Component
{
public:
    KnobWithLabel(const juce::String& name,
                  juce::AudioProcessorValueTreeState& apvts,
                  const juce::String& paramId,
                  SynthLookAndFeel& lookAndFeel);

    void resized() override;

    juce::Slider knob;

private:
    juce::Label label;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> attachment;
};

class KickSynthEditor : public juce::AudioProcessorEditor
{
public:
    explicit KickSynthEditor(KickSynthProcessor&);
    ~KickSynthEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    struct Preset
    {
        juce::String name;
        std::map<juce::String, float> values;
    };

    void setupPresets();
    void loadPreset(int idx);
    void saveCurrentPreset();
    void paintSection(juce::Graphics& g, juce::Rectangle<int> area, const juce::String& title) const;

    KickSynthProcessor& proc;
    SynthLookAndFeel lookAndFeel;
    WaveformDisplay waveform;

    juce::Label titleLabel;
    juce::ComboBox presetBox;
    juce::TextButton savePreset { "SAVE" };
    juce::TextButton triggerBtn { juce::String::fromUTF8("\xE2\x96\xB6 TRIGGER") };
    juce::ComboBox waveformBox;

    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> waveformAttachment;

    KnobWithLabel startPitch;
    KnobWithLabel endPitch;
    KnobWithLabel pitchDecay;
    KnobWithLabel pitchCurve;
    KnobWithLabel attack;
    KnobWithLabel decay;
    KnobWithLabel punch;
    KnobWithLabel drive;
    KnobWithLabel noise;
    KnobWithLabel clickLevel;
    KnobWithLabel subLevel;
    KnobWithLabel gain;

    std::vector<Preset> presets;
    int userPresetCounter = 1;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(KickSynthEditor)
};
