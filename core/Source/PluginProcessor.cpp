#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace
{
juce::NormalisableRange<float> freqRange(float min, float max)
{
    return { min, max, 0.01f, 0.35f };
}

juce::NormalisableRange<float> timeRange(float min, float max)
{
    return { min, max, 0.001f, 0.4f };
}
}

juce::AudioProcessorValueTreeState::ParameterLayout KickSynthProcessor::createParams()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;

    params.push_back(std::make_unique<juce::AudioParameterFloat>("startPitch", "Start Pitch", freqRange(20.0f, 1000.0f), 200.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("endPitch", "End Pitch", freqRange(20.0f, 500.0f), 50.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("pitchDecay", "Pitch Decay", timeRange(0.001f, 2.0f), 0.06f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("pitchCurve", "Pitch Curve", juce::NormalisableRange<float>(0.1f, 10.0f, 0.01f), 2.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("phase", "Phase", juce::NormalisableRange<float>(0.0f, 360.0f, 0.1f), 0.0f));
    params.push_back(std::make_unique<juce::AudioParameterChoice>("waveform", "Waveform", juce::StringArray { "Sine", "Triangle", "Square", "Tanh" }, 0));

    params.push_back(std::make_unique<juce::AudioParameterFloat>("attack", "Attack", timeRange(0.001f, 2.0f), 0.002f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("decay", "Decay", timeRange(0.001f, 4.0f), 0.4f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("sustain", "Sustain", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("release", "Release", timeRange(0.001f, 4.0f), 0.1f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("punch", "Punch", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.7f));

    params.push_back(std::make_unique<juce::AudioParameterFloat>("clickLevel", "Click", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.5f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("clickDecay", "Click Decay", timeRange(0.001f, 0.2f), 0.008f));

    params.push_back(std::make_unique<juce::AudioParameterFloat>("drive", "Drive", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.3f));
    params.push_back(std::make_unique<juce::AudioParameterChoice>("satType", "Saturation Type", juce::StringArray { "Soft", "Tube", "Bit", "Tape" }, 0));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("noise", "Noise", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.1f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("subLevel", "Sub Level", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 1.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("subHarmonic", "Sub Harmonic", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("driftAmount", "Drift Amount", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("driftRate", "Drift Rate", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.5f));

    params.push_back(std::make_unique<juce::AudioParameterFloat>("gain", "Gain", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.8f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("lowCutHz", "Low Cut", freqRange(20.0f, 200.0f), 20.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("highCutHz", "High Cut", freqRange(1000.0f, 20000.0f), 20000.0f));
    params.push_back(std::make_unique<juce::AudioParameterBool>("limiterEnabled", "Limiter", true));

    params.push_back(std::make_unique<juce::AudioParameterFloat>("eqLowShelfHz", "EQ Low Shelf Hz", freqRange(20.0f, 400.0f), 80.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("eqLowShelfDb", "EQ Low Shelf dB", juce::NormalisableRange<float>(-12.0f, 12.0f, 0.1f), 0.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("eqLowMidHz", "EQ Low Mid Hz", freqRange(40.0f, 1200.0f), 200.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("eqLowMidDb", "EQ Low Mid dB", juce::NormalisableRange<float>(-12.0f, 12.0f, 0.1f), 0.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("eqLowMidQ", "EQ Low Mid Q", juce::NormalisableRange<float>(0.1f, 10.0f, 0.01f), 1.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("eqHighMidHz", "EQ High Mid Hz", freqRange(400.0f, 12000.0f), 2000.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("eqHighMidDb", "EQ High Mid dB", juce::NormalisableRange<float>(-12.0f, 12.0f, 0.1f), 0.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("eqHighMidQ", "EQ High Mid Q", juce::NormalisableRange<float>(0.1f, 10.0f, 0.01f), 1.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("eqHighShelfHz", "EQ High Shelf Hz", freqRange(1000.0f, 20000.0f), 8000.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("eqHighShelfDb", "EQ High Shelf dB", juce::NormalisableRange<float>(-12.0f, 12.0f, 0.1f), 0.0f));

    params.push_back(std::make_unique<juce::AudioParameterBool>("snapToKey", "Snap To Key", false));
    params.push_back(std::make_unique<juce::AudioParameterChoice>("snapNote", "Snap Note", juce::StringArray { "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B" }, 0));
    params.push_back(std::make_unique<juce::AudioParameterChoice>("snapOctave", "Snap Octave", juce::StringArray { "0", "1", "2", "3" }, 1));

    params.push_back(std::make_unique<juce::AudioParameterFloat>("velocity", "Velocity", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 1.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("velocityToGain", "Velocity To Gain", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.5f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("velocityToDrive", "Velocity To Drive", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.0f));

    params.push_back(std::make_unique<juce::AudioParameterFloat>("lfoRate", "LFO Rate", juce::NormalisableRange<float>(0.1f, 20.0f, 0.01f), 2.0f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>("lfoDepth", "LFO Depth", juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.0f));
    params.push_back(std::make_unique<juce::AudioParameterChoice>("lfoTarget", "LFO Target", juce::StringArray { "None", "Pitch", "Amp", "Filter" }, 0));

    return { params.begin(), params.end() };
}

KickSynthProcessor::KickSynthProcessor()
    : juce::AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "params", createParams())
{
}

KickSynthProcessor::~KickSynthProcessor() = default;

void KickSynthProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    juce::ignoreUnused(samplesPerBlock);
    engine.prepare(sampleRate, samplesPerBlock);
}

void KickSynthProcessor::releaseResources() {}

bool KickSynthProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    const auto mainOut = layouts.getMainOutputChannelSet();
    return mainOut == juce::AudioChannelSet::mono() || mainOut == juce::AudioChannelSet::stereo();
}

KickParams KickSynthProcessor::getCurrentParams() const
{
    KickParams p;

    auto getFloat = [this](const char* id) { return apvts.getRawParameterValue(id)->load(); };
    auto getBool = [this](const char* id) { return apvts.getRawParameterValue(id)->load() >= 0.5f; };

    p.startPitch = getFloat("startPitch");
    p.endPitch = getFloat("endPitch");
    p.pitchDecay = getFloat("pitchDecay");
    p.pitchCurve = getFloat("pitchCurve");
    p.phase = getFloat("phase");
    p.waveform = static_cast<int>(getFloat("waveform"));
    p.attack = getFloat("attack");
    p.decay = getFloat("decay");
    p.sustain = getFloat("sustain");
    p.release = getFloat("release");
    p.punch = getFloat("punch");
    p.clickLevel = getFloat("clickLevel");
    p.clickDecay = getFloat("clickDecay");
    p.drive = getFloat("drive");
    p.satType = static_cast<int>(getFloat("satType"));
    p.noise = getFloat("noise");
    p.subLevel = getFloat("subLevel");
    p.subHarmonic = getFloat("subHarmonic");
    p.driftAmount = getFloat("driftAmount");
    p.driftRate = getFloat("driftRate");
    p.gain = getFloat("gain");
    p.lowCutHz = getFloat("lowCutHz");
    p.highCutHz = getFloat("highCutHz");
    p.limiterEnabled = getBool("limiterEnabled");
    p.eqLowShelfHz = getFloat("eqLowShelfHz");
    p.eqLowShelfDb = getFloat("eqLowShelfDb");
    p.eqLowMidHz = getFloat("eqLowMidHz");
    p.eqLowMidDb = getFloat("eqLowMidDb");
    p.eqLowMidQ = getFloat("eqLowMidQ");
    p.eqHighMidHz = getFloat("eqHighMidHz");
    p.eqHighMidDb = getFloat("eqHighMidDb");
    p.eqHighMidQ = getFloat("eqHighMidQ");
    p.eqHighShelfHz = getFloat("eqHighShelfHz");
    p.eqHighShelfDb = getFloat("eqHighShelfDb");
    p.snapToKey = getBool("snapToKey");
    p.snapNote = static_cast<int>(getFloat("snapNote"));
    p.snapOctave = static_cast<int>(getFloat("snapOctave"));
    p.velocity = getFloat("velocity");
    p.velocityToGain = getFloat("velocityToGain");
    p.velocityToDrive = getFloat("velocityToDrive");
    p.lfoRate = getFloat("lfoRate");
    p.lfoDepth = getFloat("lfoDepth");
    p.lfoTarget = static_cast<int>(getFloat("lfoTarget"));

    return p;
}

std::vector<float> KickSynthProcessor::renderPreview(int numSamples) const
{
    KickEngine previewEngine;
    previewEngine.prepare(44100.0, numSamples);
    previewEngine.setParams(getCurrentParams());
    return previewEngine.renderPreview(numSamples);
}

void KickSynthProcessor::triggerManual()
{
    manualTriggerPending.store(true);
}

void KickSynthProcessor::applyPreset(const std::map<juce::String, float>& values)
{
    for (const auto& [paramId, value] : values)
        if (auto* param = apvts.getParameter(paramId))
            param->setValueNotifyingHost(param->convertTo0to1(value));
}

void KickSynthProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;

    engine.setParams(getCurrentParams());

    if (manualTriggerPending.exchange(false))
        engine.trigger();

    for (const auto metadata : midiMessages)
    {
        const auto message = metadata.getMessage();
        if (message.isNoteOn())
        {
            engine.trigger(message.getFloatVelocity());
            break;
        }
    }

    engine.processBlock(buffer, buffer.getNumSamples());
    midiMessages.clear();
}

void KickSynthProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    if (auto state = apvts.copyState().createXml())
        copyXmlToBinary(*state, destData);
}

void KickSynthProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary(data, sizeInBytes))
        if (xml->hasTagName(apvts.state.getType()))
            apvts.replaceState(juce::ValueTree::fromXml(*xml));
}

juce::AudioProcessorEditor* KickSynthProcessor::createEditor()
{
    return new KickSynthEditor(*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new KickSynthProcessor();
}
