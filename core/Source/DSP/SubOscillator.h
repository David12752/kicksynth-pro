#pragma once

#include <cmath>

#include <juce_core/juce_core.h>

class SubOscillator
{
public:
    void setFrequency(float newFrequency) { frequency = newFrequency; }
    void prepare(double newSampleRate) { sampleRate = juce::jmax(1.0, newSampleRate); }

    float getNextSample()
    {
        phase += juce::MathConstants<float>::twoPi * frequency / static_cast<float>(sampleRate);
        if (phase >= juce::MathConstants<float>::twoPi)
            phase -= juce::MathConstants<float>::twoPi;
        return std::sin(phase);
    }

private:
    float frequency = 50.0f;
    double sampleRate = 44100.0;
    float phase = 0.0f;
};
