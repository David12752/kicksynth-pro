#include <cstring>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#include "../DSP/KickEngine.h"

namespace
{
void writeWav(const std::string& path, const std::vector<float>& samples, int sampleRate)
{
    std::ofstream f(path, std::ios::binary);
    if (! f)
        throw std::runtime_error("Failed to open output file");

    const int numSamples = static_cast<int>(samples.size());
    const int byteRate = sampleRate * 2 * 2;
    const int dataSize = numSamples * 2 * 2;

    f.write("RIFF", 4);
    const int chunkSize = 36 + dataSize;
    f.write(reinterpret_cast<const char*>(&chunkSize), 4);
    f.write("WAVE", 4);
    f.write("fmt ", 4);
    const int subchunk1 = 16;
    f.write(reinterpret_cast<const char*>(&subchunk1), 4);
    const short audioFormat = 1;
    f.write(reinterpret_cast<const char*>(&audioFormat), 2);
    const short numChannels = 2;
    f.write(reinterpret_cast<const char*>(&numChannels), 2);
    f.write(reinterpret_cast<const char*>(&sampleRate), 4);
    f.write(reinterpret_cast<const char*>(&byteRate), 4);
    const short blockAlign = 4;
    f.write(reinterpret_cast<const char*>(&blockAlign), 2);
    const short bitsPerSample = 16;
    f.write(reinterpret_cast<const char*>(&bitsPerSample), 2);
    f.write("data", 4);
    f.write(reinterpret_cast<const char*>(&dataSize), 4);

    for (float s : samples)
    {
        const short v = static_cast<short>(juce::jlimit(-1.0f, 1.0f, s) * 32767.0f);
        f.write(reinterpret_cast<const char*>(&v), 2);
        f.write(reinterpret_cast<const char*>(&v), 2);
    }
}

const char* getArg(int argc, char* argv[], const char* flag, const char* def)
{
    for (int i = 1; i + 1 < argc; ++i)
        if (std::strcmp(argv[i], flag) == 0)
            return argv[i + 1];

    return def;
}

bool hasFlag(int argc, char* argv[], const char* flag)
{
    for (int i = 1; i < argc; ++i)
        if (std::strcmp(argv[i], flag) == 0)
            return true;

    return false;
}
}

int main(int argc, char* argv[])
{
    try
    {
        KickParams p;
        p.startPitch = std::stof(getArg(argc, argv, "--startPitch", "200"));
        p.endPitch = std::stof(getArg(argc, argv, "--endPitch", "50"));
        p.pitchDecay = std::stof(getArg(argc, argv, "--pitchDecay", "0.06"));
        p.pitchCurve = std::stof(getArg(argc, argv, "--pitchCurve", "2.0"));
        p.phase = std::stof(getArg(argc, argv, "--phase", "0"));
        p.waveform = std::stoi(getArg(argc, argv, "--waveform", "0"));

        p.attack = std::stof(getArg(argc, argv, "--attack", "0.002"));
        p.decay = std::stof(getArg(argc, argv, "--decay", "0.4"));
        p.sustain = std::stof(getArg(argc, argv, "--sustain", "0.0"));
        p.release = std::stof(getArg(argc, argv, "--release", "0.1"));
        p.punch = std::stof(getArg(argc, argv, "--punch", "0.7"));

        p.clickLevel = std::stof(getArg(argc, argv, "--click", getArg(argc, argv, "--clickLevel", "0.5")));
        p.clickDecay = std::stof(getArg(argc, argv, "--clickDecay", "0.008"));
        p.drive = std::stof(getArg(argc, argv, "--drive", "0.3"));
        p.satType = std::stoi(getArg(argc, argv, "--satType", "0"));
        p.noise = std::stof(getArg(argc, argv, "--noise", "0.1"));
        p.subLevel = std::stof(getArg(argc, argv, "--subLevel", "1.0"));
        p.subHarmonic = std::stof(getArg(argc, argv, "--subHarmonic", "0.0"));
        p.driftAmount = std::stof(getArg(argc, argv, "--driftAmount", "0.0"));
        p.driftRate = std::stof(getArg(argc, argv, "--driftRate", "0.5"));
        p.gain = std::stof(getArg(argc, argv, "--gain", "0.8"));
        p.lowCutHz = std::stof(getArg(argc, argv, "--lowCutHz", "20"));
        p.highCutHz = std::stof(getArg(argc, argv, "--highCutHz", "20000"));
        p.limiterEnabled = ! hasFlag(argc, argv, "--noLimiter");
        p.eqLowShelfHz = std::stof(getArg(argc, argv, "--eqLowShelfHz", "80"));
        p.eqLowShelfDb = std::stof(getArg(argc, argv, "--eqLowShelfDb", "0"));
        p.eqLowMidHz = std::stof(getArg(argc, argv, "--eqLowMidHz", "200"));
        p.eqLowMidDb = std::stof(getArg(argc, argv, "--eqLowMidDb", "0"));
        p.eqLowMidQ = std::stof(getArg(argc, argv, "--eqLowMidQ", "1"));
        p.eqHighMidHz = std::stof(getArg(argc, argv, "--eqHighMidHz", "2000"));
        p.eqHighMidDb = std::stof(getArg(argc, argv, "--eqHighMidDb", "0"));
        p.eqHighMidQ = std::stof(getArg(argc, argv, "--eqHighMidQ", "1"));
        p.eqHighShelfHz = std::stof(getArg(argc, argv, "--eqHighShelfHz", "8000"));
        p.eqHighShelfDb = std::stof(getArg(argc, argv, "--eqHighShelfDb", "0"));
        p.snapToKey = hasFlag(argc, argv, "--snapToKey");
        p.snapNote = std::stoi(getArg(argc, argv, "--snapNote", "0"));
        p.snapOctave = std::stoi(getArg(argc, argv, "--snapOctave", "1"));
        p.velocity = std::stof(getArg(argc, argv, "--velocity", "1.0"));
        p.velocityToGain = std::stof(getArg(argc, argv, "--velocityToGain", "0.5"));
        p.velocityToDrive = std::stof(getArg(argc, argv, "--velocityToDrive", "0.0"));
        p.lfoRate = std::stof(getArg(argc, argv, "--lfoRate", "2.0"));
        p.lfoDepth = std::stof(getArg(argc, argv, "--lfoDepth", "0.0"));
        p.lfoTarget = std::stoi(getArg(argc, argv, "--lfoTarget", "0"));

        const int sampleRate = std::stoi(getArg(argc, argv, "--sr", "44100"));
        const float duration = std::stof(getArg(argc, argv, "--dur", "1.0"));
        const std::string output = getArg(argc, argv, "--out", "kick.wav");
        const bool jsonMode = hasFlag(argc, argv, "--json");
        const int numSamples = static_cast<int>(sampleRate * duration);

        KickEngine engine;
        engine.prepare(sampleRate, 512);
        engine.setParams(p);
        engine.trigger(p.velocity);

        juce::AudioBuffer<float> buffer(2, numSamples);
        buffer.clear();
        engine.processBlock(buffer, numSamples);

        std::vector<float> samples(static_cast<size_t>(numSamples));
        const auto* ptr = buffer.getReadPointer(0);
        for (int i = 0; i < numSamples; ++i)
            samples[static_cast<size_t>(i)] = ptr[i];

        if (jsonMode)
        {
            const auto preview = engine.renderDetailedPreview(512);
            std::cout << "{\"waveform\":[";
            for (size_t i = 0; i < preview.waveform.size(); ++i)
            {
                if (i > 0)
                    std::cout << ',';
                std::cout << preview.waveform[i];
            }
            std::cout << "],\"peak\":" << preview.peak;
            std::cout << ",\"duration\":" << duration;
            std::cout << ",\"sampleRate\":" << sampleRate;
            std::cout << "}" << std::endl;
        }
        else
        {
            writeWav(output, samples, sampleRate);
            std::cout << "Written: " << output << std::endl;
        }

        return 0;
    }
    catch (const std::exception& e)
    {
        std::cerr << e.what() << std::endl;
        return 1;
    }
}
