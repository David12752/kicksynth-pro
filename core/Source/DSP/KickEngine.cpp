#include "KickEngine.h"

namespace
{
constexpr auto twoPi = juce::MathConstants<double>::twoPi;

int toMidiNote(int note, int octave)
{
    return juce::jlimit(0, 127, note + (octave + 1) * 12);
}
}

KickEngine::KickEngine() = default;

void KickEngine::prepare(double sr, int)
{
    sampleRate = juce::jmax(1.0, sr);
    phase = 0.0;
    subOscPhase = 0.0;
    envPos = 0.0;
    lfoPhase = 0.0;
    driftLfoPhase = 0.0;
    synthPlaying = false;

    outputLowCut.reset();
    outputHighCut.reset();
    eqLowShelf.reset();
    eqLowMid.reset();
    eqHighMid.reset();
    eqHighShelf.reset();

    for (auto& layer : sampleLayers)
        layer.prepare(sampleRate);

    updateFilters();
}

void KickEngine::setParams(const KickParams& p)
{
    params = p;
    params.startPitch = juce::jlimit(20.0f, 1000.0f, params.startPitch);
    params.endPitch = juce::jlimit(20.0f, 500.0f, params.endPitch);
    params.pitchDecay = juce::jlimit(0.001f, 2.0f, params.pitchDecay);
    params.pitchCurve = juce::jlimit(0.1f, 10.0f, params.pitchCurve);
    params.phase = juce::jlimit(0.0f, 360.0f, params.phase);
    params.waveform = juce::jlimit(0, 3, params.waveform);

    params.attack = juce::jlimit(0.0005f, 2.0f, params.attack);
    params.decay = juce::jlimit(0.001f, 4.0f, params.decay);
    params.sustain = juce::jlimit(0.0f, 1.0f, params.sustain);
    params.release = juce::jlimit(0.001f, 4.0f, params.release);
    params.punch = juce::jlimit(0.0f, 1.0f, params.punch);

    params.clickLevel = juce::jlimit(0.0f, 1.0f, params.clickLevel);
    params.clickDecay = juce::jlimit(0.001f, 0.2f, params.clickDecay);

    params.drive = juce::jlimit(0.0f, 1.0f, params.drive);
    params.satType = juce::jlimit(0, 3, params.satType);
    params.noise = juce::jlimit(0.0f, 1.0f, params.noise);
    params.subLevel = juce::jlimit(0.0f, 1.2f, params.subLevel);
    params.subHarmonic = juce::jlimit(0.0f, 1.0f, params.subHarmonic);

    params.driftAmount = juce::jlimit(0.0f, 1.0f, params.driftAmount);
    params.driftRate = juce::jlimit(0.0f, 1.0f, params.driftRate);

    params.gain = juce::jlimit(0.0f, 1.2f, params.gain);
    params.lowCutHz = juce::jlimit(20.0f, 200.0f, params.lowCutHz);
    params.highCutHz = juce::jlimit(1000.0f, 20000.0f, params.highCutHz);

    params.eqLowShelfHz = juce::jlimit(20.0f, 400.0f, params.eqLowShelfHz);
    params.eqLowShelfDb = juce::jlimit(-12.0f, 12.0f, params.eqLowShelfDb);
    params.eqLowMidHz = juce::jlimit(40.0f, 1200.0f, params.eqLowMidHz);
    params.eqLowMidDb = juce::jlimit(-12.0f, 12.0f, params.eqLowMidDb);
    params.eqLowMidQ = juce::jlimit(0.1f, 10.0f, params.eqLowMidQ);
    params.eqHighMidHz = juce::jlimit(400.0f, 12000.0f, params.eqHighMidHz);
    params.eqHighMidDb = juce::jlimit(-12.0f, 12.0f, params.eqHighMidDb);
    params.eqHighMidQ = juce::jlimit(0.1f, 10.0f, params.eqHighMidQ);
    params.eqHighShelfHz = juce::jlimit(1000.0f, 20000.0f, params.eqHighShelfHz);
    params.eqHighShelfDb = juce::jlimit(-12.0f, 12.0f, params.eqHighShelfDb);

    params.snapNote = juce::jlimit(0, 11, params.snapNote);
    params.snapOctave = juce::jlimit(0, 3, params.snapOctave);

    params.velocity = juce::jlimit(0.0f, 1.0f, params.velocity);
    params.velocityToGain = juce::jlimit(0.0f, 1.0f, params.velocityToGain);
    params.velocityToDrive = juce::jlimit(0.0f, 1.0f, params.velocityToDrive);

    params.lfoRate = juce::jlimit(0.01f, 20.0f, params.lfoRate);
    params.lfoDepth = juce::jlimit(0.0f, 1.0f, params.lfoDepth);
    params.lfoTarget = juce::jlimit(0, 3, params.lfoTarget);

    updateFilters();
}

void KickEngine::trigger(float velocity)
{
    activeParams = params;
    activeParams.velocity = static_cast<float>(triggerVelocityValue(velocity));

    if (activeParams.snapToKey)
    {
        const auto midiNote = toMidiNote(activeParams.snapNote, activeParams.snapOctave);
        activeParams.endPitch = 440.0f * std::pow(2.0f, static_cast<float>(midiNote - 69) / 12.0f);
    }

    const auto velGain = 1.0f - (1.0f - activeParams.velocity) * activeParams.velocityToGain;
    const auto velDrive = juce::jlimit(0.0f, 1.0f, activeParams.drive + activeParams.velocity * activeParams.velocityToDrive);

    activeParams.gain *= velGain;
    activeParams.drive = velDrive;

    driftHz = (randomFloat() * 2.0f - 1.0f) * activeParams.driftAmount * 10.0f;
    driftPhase = (randomFloat() * 2.0f - 1.0f) * activeParams.driftAmount * 0.1f;

    const auto phaseStart = activeParams.phase * juce::MathConstants<double>::pi / 180.0 + driftPhase;
    phase = phaseStart;
    subOscPhase = phaseStart * 0.5;
    envPos = 0.0;
    lfoPhase = 0.0;
    driftLfoPhase = 0.0;
    synthPlaying = true;

    for (int slot = 0; slot < numSampleLayers; ++slot)
    {
        if (sampleLayers[slot].isLoaded() && sampleLayerParams[slot].enabled)
            sampleLayers[slot].trigger(sampleLayerParams[slot], activeParams.velocity);
    }
}

bool KickEngine::loadSample(int slot, const juce::String& path)
{
    if (! juce::isPositiveAndBelow(slot, numSampleLayers))
        return false;

    sampleLayers[slot].loadFile(path);
    sampleLayers[slot].prepare(sampleRate);
    samplePaths[slot] = path;
    return sampleLayers[slot].isLoaded();
}

void KickEngine::setSampleLayerParams(int slot, const SampleLayerParams& p)
{
    if (! juce::isPositiveAndBelow(slot, numSampleLayers))
        return;

    sampleLayerParams[slot] = p;
}

SampleLayerParams KickEngine::getSampleLayerParams(int slot) const
{
    if (! juce::isPositiveAndBelow(slot, numSampleLayers))
        return {};

    return sampleLayerParams[slot];
}

void KickEngine::triggerSample(int slot, const SampleLayerParams& p, float velocity)
{
    if (! juce::isPositiveAndBelow(slot, numSampleLayers))
        return;

    sampleLayerParams[slot] = p;
    sampleLayers[slot].trigger(sampleLayerParams[slot], velocity);
}

juce::String KickEngine::getSampleFilename(int slot) const
{
    if (! juce::isPositiveAndBelow(slot, numSampleLayers))
        return {};

    return sampleLayers[slot].filename;
}

float KickEngine::currentPitch() const
{
    const auto t = static_cast<float>(envPos);
    const auto progress = juce::jlimit(0.0f, 1.0f, t / activeParams.pitchDecay);
    const auto curve = std::pow(progress, activeParams.pitchCurve);
    return juce::jmap(curve, activeParams.startPitch + static_cast<float>(driftHz), activeParams.endPitch);
}

float KickEngine::currentAmp() const
{
    const auto t = static_cast<float>(envPos);
    const auto attack = juce::jmax(0.0005f, activeParams.attack);
    const auto decay = juce::jmax(0.0005f, activeParams.decay);
    const auto release = juce::jmax(0.0005f, activeParams.release);

    float amp = 0.0f;

    if (t < attack)
    {
        amp = t / attack;
    }
    else if (t < attack + decay)
    {
        const auto decayProgress = (t - attack) / decay;
        amp = juce::jmap(decayProgress, 1.0f, activeParams.sustain);
    }
    else
    {
        const auto releaseProgress = (t - attack - decay) / release;
        amp = activeParams.sustain * juce::jmax(0.0f, 1.0f - releaseProgress);
    }

    const auto transient = activeParams.punch * std::exp(-60.0f * t);
    return juce::jlimit(0.0f, 1.8f, amp + transient);
}

float KickEngine::currentClick() const
{
    if (envPos > static_cast<double>(activeParams.clickDecay) * 7.0)
        return 0.0f;

    const auto t = static_cast<float>(envPos / static_cast<double>(activeParams.clickDecay));
    return activeParams.clickLevel * std::exp(-6.0f * t);
}

float KickEngine::waveformAt(double ph, int type) const
{
    const auto wrapped = std::fmod(ph, twoPi);
    const auto sine = static_cast<float>(std::sin(wrapped));

    switch (type)
    {
        case 1:
        {
            const auto t = wrapped / twoPi;
            return static_cast<float>(t < 0.5 ? (4.0 * t - 1.0) : (3.0 - 4.0 * t));
        }
        case 2:
            return sine >= 0.0f ? 1.0f : -1.0f;
        case 3:
            return static_cast<float>(std::tanh(2.25 * sine));
        default:
            return sine;
    }
}

float KickEngine::applySaturation(float x, float drive, int satType) const
{
    if (drive <= 0.0001f)
        return x;

    const auto g = 1.0f + drive * 12.0f;

    switch (satType)
    {
        case 1:
        {
            const auto sign = x >= 0.0f ? 1.0f : -1.0f;
            const auto tube = (1.0f - std::exp(-std::abs(x) * g)) * sign;
            return juce::jlimit(-1.2f, 1.2f, tube + 0.08f * std::sin(2.0f * x * g));
        }
        case 2:
        {
            const auto steps = 1.0f + (1.0f - drive) * 127.0f;
            return std::round(x * steps) / steps;
        }
        case 3:
            return static_cast<float>(std::tanh(x * g) + 0.1 * std::sin(3.0 * x * g));
        default:
            return x / (1.0f + std::abs(x));
    }
}

float KickEngine::makeNoiseSample()
{
    return randomFloat() * 2.0f - 1.0f;
}

float KickEngine::randomFloat()
{
    return random.nextFloat();
}

bool KickEngine::anySampleActive() const
{
    for (const auto& layer : sampleLayers)
        if (layer.isActive())
            return true;

    return false;
}

double KickEngine::triggerVelocityValue(float velocityOverride) const
{
    if (velocityOverride >= 0.0f)
        return static_cast<double>(juce::jlimit(0.0f, 1.0f, velocityOverride));

    return static_cast<double>(juce::jlimit(0.0f, 1.0f, params.velocity));
}

void KickEngine::generateSynthBlock(juce::AudioBuffer<float>& buffer, int numSamples, std::vector<float>* subPreview)
{
    if (! synthPlaying)
        return;

    auto* main = buffer.getWritePointer(0);
    const auto dt = 1.0 / sampleRate;

    if (subPreview != nullptr)
        subPreview->assign(static_cast<size_t>(numSamples), 0.0f);

    for (int i = 0; i < numSamples; ++i)
    {
        const auto lfo = std::sin(lfoPhase);
        lfoPhase += twoPi * activeParams.lfoRate / sampleRate;
        driftLfoPhase += twoPi * (0.05 + activeParams.driftRate * 1.95) / sampleRate;

        auto pitch = currentPitch();
        auto amp = currentAmp();
        const auto click = currentClick();

        if (activeParams.lfoTarget == 1)
            pitch *= 1.0f + lfo * activeParams.lfoDepth * 0.25f;
        else if (activeParams.lfoTarget == 2)
            amp *= 1.0f + lfo * activeParams.lfoDepth * 0.5f;

        const auto slowDrift = std::sin(driftLfoPhase) * activeParams.driftAmount * (0.3 + activeParams.driftRate);
        pitch += static_cast<float>(driftHz + slowDrift * 4.0);
        pitch = juce::jmax(20.0f, pitch);

        const auto phaseInc = twoPi * static_cast<double>(pitch) / sampleRate;
        phase += phaseInc;
        subOscPhase += phaseInc * 0.5;

        const auto osc = waveformAt(phase, activeParams.waveform);
        const auto subHarm = static_cast<float>(std::sin(subOscPhase)) * activeParams.subHarmonic * amp * 0.5f;
        const auto sub = osc * activeParams.subLevel;
        const auto noise = makeNoiseSample() * activeParams.noise * amp * 0.2f;

        auto out = (sub + subHarm) * amp + click + noise;
        out = applySaturation(out, activeParams.drive, activeParams.satType);
        out *= activeParams.gain;

        if (activeParams.limiterEnabled)
        {
            const auto peak = std::abs(out);
            if (peak > 0.99f)
                out *= 0.99f / peak;
        }

        main[i] += out;

        if (subPreview != nullptr)
            (*subPreview)[static_cast<size_t>(i)] = (sub + subHarm) * juce::jlimit(0.0f, 1.0f, amp);

        envPos += dt;

        if (amp <= 0.00005f && click <= 0.00005f)
            synthPlaying = false;
    }
}

void KickEngine::applyOutputProcessing(juce::AudioBuffer<float>& buffer, int numSamples)
{
    if (numSamples <= 0 || buffer.getNumChannels() <= 0)
        return;

    auto* channel0 = buffer.getWritePointer(0);

    for (int i = 0; i < numSamples; ++i)
    {
        auto out = channel0[i];
        out = outputLowCut.processSample(out);

        if (params.lfoTarget == 3 && params.lfoDepth > 0.0f)
        {
            const auto filterLfo = 1.0f + static_cast<float>(std::sin(lfoPhase)) * params.lfoDepth * 0.35f;
            outputHighCut.coefficients = juce::dsp::IIR::Coefficients<float>::makeLowPass(sampleRate, juce::jlimit(1000.0f, 20000.0f, params.highCutHz * filterLfo));
        }

        out = outputHighCut.processSample(out);
        out = eqLowShelf.processSample(out);
        out = eqLowMid.processSample(out);
        out = eqHighMid.processSample(out);
        out = eqHighShelf.processSample(out);

        if (params.limiterEnabled)
        {
            const auto peak = std::abs(out);
            if (peak > 0.99f)
                out *= 0.99f / peak;
        }

        channel0[i] = out;
    }

    for (int channel = 1; channel < buffer.getNumChannels(); ++channel)
        buffer.copyFrom(channel, 0, buffer, 0, 0, numSamples);
}

void KickEngine::processBlock(juce::AudioBuffer<float>& buffer, int numSamples)
{
    buffer.clear();

    if (! synthPlaying && ! anySampleActive())
        return;

    generateSynthBlock(buffer, numSamples);

    for (auto& layer : sampleLayers)
        layer.processBlock(buffer, numSamples);

    applyOutputProcessing(buffer, numSamples);
}

void KickEngine::updateFilters()
{
    outputLowCut.coefficients = juce::dsp::IIR::Coefficients<float>::makeHighPass(sampleRate, params.lowCutHz);
    outputHighCut.coefficients = juce::dsp::IIR::Coefficients<float>::makeLowPass(sampleRate, params.highCutHz);
    eqLowShelf.coefficients = juce::dsp::IIR::Coefficients<float>::makeLowShelf(sampleRate, params.eqLowShelfHz, 0.707f, juce::Decibels::decibelsToGain(params.eqLowShelfDb));
    eqLowMid.coefficients = juce::dsp::IIR::Coefficients<float>::makePeakFilter(sampleRate, params.eqLowMidHz, params.eqLowMidQ, juce::Decibels::decibelsToGain(params.eqLowMidDb));
    eqHighMid.coefficients = juce::dsp::IIR::Coefficients<float>::makePeakFilter(sampleRate, params.eqHighMidHz, params.eqHighMidQ, juce::Decibels::decibelsToGain(params.eqHighMidDb));
    eqHighShelf.coefficients = juce::dsp::IIR::Coefficients<float>::makeHighShelf(sampleRate, params.eqHighShelfHz, 0.707f, juce::Decibels::decibelsToGain(params.eqHighShelfDb));
}

KickPreviewData KickEngine::renderDetailedPreview(int numSamples) const
{
    numSamples = juce::jmax(64, numSamples);

    KickEngine temp;
    temp.prepare(44100.0, numSamples);
    temp.setParams(params);

    for (int slot = 0; slot < numSampleLayers; ++slot)
    {
        temp.setSampleLayerParams(slot, sampleLayerParams[slot]);
        if (samplePaths[slot].isNotEmpty())
            temp.loadSample(slot, samplePaths[slot]);
    }

    temp.trigger(params.velocity);

    KickPreviewData preview;
    preview.waveform.assign(static_cast<size_t>(numSamples), 0.0f);
    preview.subWaveform.assign(static_cast<size_t>(numSamples), 0.0f);

    juce::AudioBuffer<float> mixBuffer(1, numSamples);
    mixBuffer.clear();
    temp.generateSynthBlock(mixBuffer, numSamples, &preview.subWaveform);

    for (int slot = 0; slot < numSampleLayers; ++slot)
    {
        juce::AudioBuffer<float> sampleBuffer(1, numSamples);
        sampleBuffer.clear();
        temp.sampleLayers[slot].processBlock(sampleBuffer, numSamples);

        const auto* sampleData = sampleBuffer.getReadPointer(0);
        preview.sampleWaveforms[static_cast<size_t>(slot)].assign(static_cast<size_t>(numSamples), 0.0f);

        for (int i = 0; i < numSamples; ++i)
        {
            preview.sampleWaveforms[static_cast<size_t>(slot)][static_cast<size_t>(i)] = sampleData[i];
            mixBuffer.addSample(0, i, sampleData[i]);
        }
    }

    temp.applyOutputProcessing(mixBuffer, numSamples);

    const auto* mix = mixBuffer.getReadPointer(0);
    for (int i = 0; i < numSamples; ++i)
    {
        preview.waveform[static_cast<size_t>(i)] = mix[i];
        preview.peak = juce::jmax(preview.peak, std::abs(mix[i]));
    }

    return preview;
}

std::vector<float> KickEngine::renderPreview(int numSamples) const
{
    return renderDetailedPreview(numSamples).waveform;
}
