#include "SampleLayer.h"

void SampleLayer::loadFile(const juce::String& path)
{
    formatManager.registerBasicFormats();

    std::unique_ptr<juce::AudioFormatReader> reader(formatManager.createReaderFor(juce::File(path)));
    if (reader == nullptr)
    {
        buffer.setSize(0, 0);
        filename.clear();
        readPos = -1.0;
        return;
    }

    buffer.setSize(static_cast<int>(reader->numChannels), static_cast<int>(reader->lengthInSamples));
    reader->read(&buffer, 0, static_cast<int>(reader->lengthInSamples), 0, true, true);
    filename = juce::File(path).getFileName();
    readPos = -1.0;
}

void SampleLayer::prepare(double newSampleRate)
{
    sampleRate = juce::jmax(1.0, newSampleRate);
    lowCutFilter.reset();
    highCutFilter.reset();
    updateFilters();
}

void SampleLayer::trigger(const SampleLayerParams& p, float velocity)
{
    currentParams = p;
    currentParams.volume = juce::jlimit(0.0f, 1.5f, currentParams.volume);
    currentParams.pitchSemitones = juce::jlimit(-24.0f, 24.0f, currentParams.pitchSemitones);
    currentParams.startOffset = juce::jlimit(0.0f, 1.0f, currentParams.startOffset);
    currentParams.lowCut = juce::jlimit(20.0f, 20000.0f, currentParams.lowCut);
    currentParams.highCut = juce::jlimit(currentParams.lowCut, 20000.0f, currentParams.highCut);
    triggerVelocity = juce::jlimit(0.0f, 1.0f, velocity);

    if (! isLoaded() || ! currentParams.enabled)
    {
        readPos = -1.0;
        return;
    }

    const auto totalSamples = juce::jmax(1, buffer.getNumSamples() - 1);
    const auto offset = currentParams.startOffset * static_cast<float>(totalSamples);
    readPos = currentParams.reverse ? static_cast<double>(totalSamples) - offset : offset;
    playbackRate = std::pow(2.0, static_cast<double>(currentParams.pitchSemitones) / 12.0);

    lowCutFilter.reset();
    highCutFilter.reset();
    updateFilters();
}

float SampleLayer::readSampleAt(double position) const
{
    if (! isLoaded())
        return 0.0f;

    const auto maxIndex = juce::jmax(0, buffer.getNumSamples() - 1);
    const auto clamped = juce::jlimit(0.0, static_cast<double>(maxIndex), position);
    const auto indexA = static_cast<int>(clamped);
    const auto indexB = juce::jmin(maxIndex, indexA + 1);
    const auto frac = static_cast<float>(clamped - static_cast<double>(indexA));

    auto sampleA = 0.0f;
    auto sampleB = 0.0f;

    for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
    {
        const auto* channelData = buffer.getReadPointer(channel);
        sampleA += channelData[indexA];
        sampleB += channelData[indexB];
    }

    const auto invChannels = 1.0f / static_cast<float>(juce::jmax(1, buffer.getNumChannels()));
    sampleA *= invChannels;
    sampleB *= invChannels;

    return juce::jmap(frac, sampleA, sampleB);
}

void SampleLayer::processBlock(juce::AudioBuffer<float>& buf, int numSamples)
{
    if (! isActive() || ! currentParams.enabled || ! isLoaded())
        return;

    const auto maxIndex = juce::jmax(0, buffer.getNumSamples() - 1);

    for (int sampleIndex = 0; sampleIndex < numSamples; ++sampleIndex)
    {
        if (readPos < 0.0 || readPos > static_cast<double>(maxIndex))
        {
            readPos = -1.0;
            break;
        }

        auto sample = readSampleAt(readPos) * currentParams.volume * triggerVelocity;
        sample = lowCutFilter.processSample(sample);
        sample = highCutFilter.processSample(sample);

        for (int channel = 0; channel < buf.getNumChannels(); ++channel)
            buf.addSample(channel, sampleIndex, sample);

        readPos += currentParams.reverse ? -playbackRate : playbackRate;
    }
}

void SampleLayer::updateFilters()
{
    lowCutFilter.coefficients = juce::dsp::IIR::Coefficients<float>::makeHighPass(sampleRate, juce::jmax(20.0f, currentParams.lowCut));
    highCutFilter.coefficients = juce::dsp::IIR::Coefficients<float>::makeLowPass(sampleRate, juce::jlimit(currentParams.lowCut, 20000.0f, currentParams.highCut));
}
