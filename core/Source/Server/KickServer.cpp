#include "KickServer.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <functional>

#include <juce_audio_formats/juce_audio_formats.h>
#include <windows.h>
#include <wincrypt.h>

#pragma comment(lib, "Advapi32.lib")

namespace
{
constexpr const char* webSocketGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
constexpr int socketTimeoutMs = 250;

bool readExact(juce::StreamingSocket* socket, void* destination, int bytesToRead, int waitTimeoutMs = 2000)
{
    auto* out = static_cast<char*>(destination);
    auto totalRead = 0;

    while (totalRead < bytesToRead)
    {
        if (socket->waitUntilReady(true, waitTimeoutMs) <= 0)
            return false;

        const auto bytesRead = socket->read(out + totalRead, bytesToRead - totalRead, false);
        if (bytesRead <= 0)
            return false;

        totalRead += bytesRead;
    }

    return true;
}

bool writeExact(juce::StreamingSocket* socket, const void* source, int bytesToWrite, int waitTimeoutMs = 2000)
{
    auto* data = static_cast<const char*>(source);
    auto totalWritten = 0;

    while (totalWritten < bytesToWrite)
    {
        if (socket->waitUntilReady(false, waitTimeoutMs) <= 0)
            return false;

        const auto bytesWritten = socket->write(data + totalWritten, bytesToWrite - totalWritten);
        if (bytesWritten <= 0)
            return false;

        totalWritten += bytesWritten;
    }

    return true;
}
juce::String extractWebSocketKey(const juce::String& request)
{
    juce::StringArray lines;
    lines.addLines(request);

    for (const auto& line : lines)
        if (line.startsWithIgnoreCase("Sec-WebSocket-Key:"))
            return line.fromFirstOccurrenceOf(":", false, false).trim();

    return {};
}

juce::String buildWebSocketAccept(const juce::String& key)
{
    const juce::String combinedString = key + webSocketGuid;
    const auto combined = combinedString.toRawUTF8();

    HCRYPTPROV provider = 0;
    HCRYPTHASH hash = 0;
    BYTE digest[20] {};
    DWORD digestSize = sizeof(digest);

    if (! CryptAcquireContext(&provider, nullptr, nullptr, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT))
        return {};

    if (! CryptCreateHash(provider, CALG_SHA1, 0, 0, &hash))
    {
        CryptReleaseContext(provider, 0);
        return {};
    }

    const auto data = reinterpret_cast<const BYTE*>(combined);
    const auto len = static_cast<DWORD>(std::strlen(combined));

    if (! CryptHashData(hash, data, len, 0) || ! CryptGetHashParam(hash, HP_HASHVAL, digest, &digestSize, 0))
    {
        CryptDestroyHash(hash);
        CryptReleaseContext(provider, 0);
        return {};
    }

    CryptDestroyHash(hash);
    CryptReleaseContext(provider, 0);

    return juce::Base64::toBase64(digest, digestSize);
}

void assignFloat(const juce::DynamicObject* object, const juce::Identifier& key, float& target)
{
    if (object != nullptr && object->hasProperty(key))
        target = static_cast<float>(double(object->getProperty(key)));
}

void assignInt(const juce::DynamicObject* object, const juce::Identifier& key, int& target)
{
    if (object != nullptr && object->hasProperty(key))
        target = int(object->getProperty(key));
}

void assignBool(const juce::DynamicObject* object, const juce::Identifier& key, bool& target)
{
    if (object != nullptr && object->hasProperty(key))
        target = static_cast<bool>(object->getProperty(key));
}

KickParams paramsFromJson(const juce::var& paramsVar, const KickParams& fallback)
{
    auto result = fallback;
    auto* object = paramsVar.getDynamicObject();
    if (object == nullptr)
        return result;

    assignFloat(object, "startPitch", result.startPitch);
    assignFloat(object, "endPitch", result.endPitch);
    assignFloat(object, "pitchDecay", result.pitchDecay);
    assignFloat(object, "pitchCurve", result.pitchCurve);
    assignFloat(object, "phase", result.phase);
    assignInt(object, "waveform", result.waveform);

    assignFloat(object, "attack", result.attack);
    assignFloat(object, "decay", result.decay);
    assignFloat(object, "sustain", result.sustain);
    assignFloat(object, "release", result.release);
    assignFloat(object, "punch", result.punch);

    assignFloat(object, "clickLevel", result.clickLevel);
    assignFloat(object, "clickDecay", result.clickDecay);

    assignFloat(object, "drive", result.drive);
    assignInt(object, "satType", result.satType);
    assignFloat(object, "noise", result.noise);
    assignFloat(object, "subLevel", result.subLevel);
    assignFloat(object, "subHarmonic", result.subHarmonic);

    assignFloat(object, "driftAmount", result.driftAmount);
    assignFloat(object, "driftRate", result.driftRate);

    assignFloat(object, "gain", result.gain);
    assignFloat(object, "lowCutHz", result.lowCutHz);
    assignFloat(object, "eqLowCut", result.lowCutHz);
    assignFloat(object, "highCutHz", result.highCutHz);
    assignFloat(object, "eqHighCut", result.highCutHz);
    assignBool(object, "limiterEnabled", result.limiterEnabled);
    assignBool(object, "compress", result.limiterEnabled);

    assignFloat(object, "eqLowShelfHz", result.eqLowShelfHz);
    assignFloat(object, "eqLowShelfDb", result.eqLowShelfDb);
    assignFloat(object, "eqLowMidHz", result.eqLowMidHz);
    assignFloat(object, "eqLowMidDb", result.eqLowMidDb);
    assignFloat(object, "eqLowMidQ", result.eqLowMidQ);
    assignFloat(object, "eqHighMidHz", result.eqHighMidHz);
    assignFloat(object, "eqHighMidDb", result.eqHighMidDb);
    assignFloat(object, "eqHighMidQ", result.eqHighMidQ);
    assignFloat(object, "eqHighShelfHz", result.eqHighShelfHz);
    assignFloat(object, "eqHighShelfDb", result.eqHighShelfDb);

    assignBool(object, "snapToKey", result.snapToKey);
    assignInt(object, "snapNote", result.snapNote);
    assignInt(object, "snapOctave", result.snapOctave);

    assignFloat(object, "velocity", result.velocity);
    assignFloat(object, "velocityToGain", result.velocityToGain);
    assignFloat(object, "velocityToDrive", result.velocityToDrive);

    assignFloat(object, "lfoRate", result.lfoRate);
    assignFloat(object, "lfoDepth", result.lfoDepth);
    assignInt(object, "lfoTarget", result.lfoTarget);

    return result;
}

SampleLayerParams sampleParamsFromJson(const juce::var& paramsVar, const SampleLayerParams& fallback)
{
    auto result = fallback;
    auto* object = paramsVar.getDynamicObject();
    if (object == nullptr)
        return result;

    assignFloat(object, "volume", result.volume);
    assignFloat(object, "pitchSemitones", result.pitchSemitones);
    assignFloat(object, "startOffset", result.startOffset);
    assignFloat(object, "lowCut", result.lowCut);
    assignFloat(object, "highCut", result.highCut);
    assignBool(object, "enabled", result.enabled);
    assignBool(object, "reverse", result.reverse);
    return result;
}

void updateSampleLayerArrayFromJson(const juce::var& layersVar, std::array<SampleLayerParams, 3>& layers)
{
    if (! layersVar.isArray())
        return;

    const auto* array = layersVar.getArray();
    if (array == nullptr)
        return;

    for (int i = 0; i < juce::jmin(3, array->size()); ++i)
        layers[static_cast<size_t>(i)] = sampleParamsFromJson(array->getReference(i), layers[static_cast<size_t>(i)]);
}

juce::var sampleParamsToVar(const SampleLayerParams& params, const juce::String& filename)
{
    auto obj = std::make_unique<juce::DynamicObject>();
    obj->setProperty("filename", filename);
    obj->setProperty("volume", params.volume);
    obj->setProperty("pitchSemitones", params.pitchSemitones);
    obj->setProperty("startOffset", params.startOffset);
    obj->setProperty("lowCut", params.lowCut);
    obj->setProperty("highCut", params.highCut);
    obj->setProperty("enabled", params.enabled);
    obj->setProperty("reverse", params.reverse);
    return juce::var(obj.release());
}

juce::var kickParamsToVar(const KickParams& p)
{
    auto obj = std::make_unique<juce::DynamicObject>();
    obj->setProperty("startPitch", p.startPitch);
    obj->setProperty("endPitch", p.endPitch);
    obj->setProperty("pitchDecay", p.pitchDecay);
    obj->setProperty("pitchCurve", p.pitchCurve);
    obj->setProperty("phase", p.phase);
    obj->setProperty("waveform", p.waveform);
    obj->setProperty("attack", p.attack);
    obj->setProperty("decay", p.decay);
    obj->setProperty("sustain", p.sustain);
    obj->setProperty("release", p.release);
    obj->setProperty("punch", p.punch);
    obj->setProperty("clickLevel", p.clickLevel);
    obj->setProperty("clickDecay", p.clickDecay);
    obj->setProperty("drive", p.drive);
    obj->setProperty("satType", p.satType);
    obj->setProperty("noise", p.noise);
    obj->setProperty("subLevel", p.subLevel);
    obj->setProperty("subHarmonic", p.subHarmonic);
    obj->setProperty("driftAmount", p.driftAmount);
    obj->setProperty("driftRate", p.driftRate);
    obj->setProperty("gain", p.gain);
    obj->setProperty("lowCutHz", p.lowCutHz);
    obj->setProperty("highCutHz", p.highCutHz);
    obj->setProperty("limiterEnabled", p.limiterEnabled);
    obj->setProperty("eqLowShelfHz", p.eqLowShelfHz);
    obj->setProperty("eqLowShelfDb", p.eqLowShelfDb);
    obj->setProperty("eqLowMidHz", p.eqLowMidHz);
    obj->setProperty("eqLowMidDb", p.eqLowMidDb);
    obj->setProperty("eqLowMidQ", p.eqLowMidQ);
    obj->setProperty("eqHighMidHz", p.eqHighMidHz);
    obj->setProperty("eqHighMidDb", p.eqHighMidDb);
    obj->setProperty("eqHighMidQ", p.eqHighMidQ);
    obj->setProperty("eqHighShelfHz", p.eqHighShelfHz);
    obj->setProperty("eqHighShelfDb", p.eqHighShelfDb);
    obj->setProperty("snapToKey", p.snapToKey);
    obj->setProperty("snapNote", p.snapNote);
    obj->setProperty("snapOctave", p.snapOctave);
    obj->setProperty("velocity", p.velocity);
    obj->setProperty("velocityToGain", p.velocityToGain);
    obj->setProperty("velocityToDrive", p.velocityToDrive);
    obj->setProperty("lfoRate", p.lfoRate);
    obj->setProperty("lfoDepth", p.lfoDepth);
    obj->setProperty("lfoTarget", p.lfoTarget);
    return juce::var(obj.release());
}

juce::String previewToJson(const KickPreviewData& preview)
{
    auto obj = std::make_unique<juce::DynamicObject>();
    juce::Array<juce::var> waveform;
    juce::Array<juce::var> subWaveform;
    juce::Array<juce::var> samples;

    waveform.ensureStorageAllocated(static_cast<int>(preview.waveform.size()));
    subWaveform.ensureStorageAllocated(static_cast<int>(preview.subWaveform.size()));

    for (auto sample : preview.waveform)
        waveform.add(sample);
    for (auto sample : preview.subWaveform)
        subWaveform.add(sample);

    for (const auto& layer : preview.sampleWaveforms)
    {
        juce::Array<juce::var> layerWave;
        layerWave.ensureStorageAllocated(static_cast<int>(layer.size()));
        for (auto sample : layer)
            layerWave.add(sample);
        samples.add(juce::var(layerWave));
    }

    obj->setProperty("type", "preview");
    obj->setProperty("waveform", juce::var(waveform));
    obj->setProperty("subWaveform", juce::var(subWaveform));
    obj->setProperty("sampleWaveforms", juce::var(samples));
    obj->setProperty("peak", preview.peak);
    return juce::JSON::toString(juce::var(obj.release()));
}

juce::String makeResponse(const juce::var& requestId,
                          const juce::String& command,
                          bool success,
                          const juce::String& error = {},
                          std::function<void(juce::DynamicObject&)> extra = {})
{
    auto response = std::make_unique<juce::DynamicObject>();
    response->setProperty("cmd", command);
    response->setProperty("success", success);

    if (! requestId.isVoid())
        response->setProperty("id", requestId);

    if (error.isNotEmpty())
        response->setProperty("error", error);

    if (extra)
        extra(*response);

    return juce::JSON::toString(juce::var(response.release()));
}

juce::AudioBuffer<float> renderKickBuffer(const KickParams& params, double sampleRate, double durationSeconds)
{
    const auto numSamples = juce::jmax(1, static_cast<int>(std::ceil(sampleRate * durationSeconds)));

    KickEngine renderEngine;
    renderEngine.prepare(sampleRate, 512);
    renderEngine.setParams(params);
    renderEngine.trigger(params.velocity);

    juce::AudioBuffer<float> buffer(2, numSamples);
    buffer.clear();
    renderEngine.processBlock(buffer, numSamples);
    return buffer;
}

bool writeWaveFile(const juce::AudioBuffer<float>& buffer, const juce::File& path, double sampleRate, juce::String& error)
{
    if (auto parent = path.getParentDirectory(); !parent.exists())
        parent.createDirectory();

    auto stream = std::unique_ptr<juce::FileOutputStream>(path.createOutputStream());
    if (stream == nullptr)
    {
        error = "Failed to create output stream";
        return false;
    }

    juce::WavAudioFormat format;
    auto writer = std::unique_ptr<juce::AudioFormatWriter>(format.createWriterFor(stream.get(), sampleRate, static_cast<unsigned int>(buffer.getNumChannels()), 16, {}, 0));
    if (writer == nullptr)
    {
        error = "Failed to create WAV writer";
        return false;
    }

    stream.release();
    if (! writer->writeFromAudioSampleBuffer(buffer, 0, buffer.getNumSamples()))
    {
        error = "Failed to write WAV data";
        return false;
    }

    return true;
}
}

KickAudioServer::KickAudioServer()
    : juce::Thread("KickAudioServer")
{
}

KickAudioServer::~KickAudioServer()
{
    stop();
}

bool KickAudioServer::start(int port)
{
    if (isThreadRunning())
        return true;

    if (deviceManager.initialiseWithDefaultDevices(0, 2).isNotEmpty())
        return false;

    deviceManager.addAudioCallback(this);

    serverSocket = std::make_unique<juce::StreamingSocket>();
    if (! serverSocket->createListener(port))
    {
        deviceManager.removeAudioCallback(this);
        deviceManager.closeAudioDevice();
        serverSocket.reset();
        return false;
    }

    startThread();
    return true;
}

void KickAudioServer::stop()
{
    signalThreadShouldExit();

    if (serverSocket != nullptr)
        serverSocket->close();

    for (auto& client : clients)
        if (client != nullptr)
            client->close();

    stopThread(2000);
    clients.clear();
    serverSocket.reset();

    deviceManager.removeAudioCallback(this);
    deviceManager.closeAudioDevice();
}

void KickAudioServer::audioDeviceAboutToStart(juce::AudioIODevice* device)
{
    if (device == nullptr)
        return;

    const juce::ScopedLock lock(engineLock);
    engine.prepare(device->getCurrentSampleRate(), device->getCurrentBufferSizeSamples());
    engine.setParams(currentParams);

    for (int slot = 0; slot < serverSampleLayers; ++slot)
        if (currentSamplePaths[slot].isNotEmpty())
            engine.loadSample(slot, currentSamplePaths[slot]);
}

void KickAudioServer::audioDeviceStopped() {}

void KickAudioServer::audioDeviceIOCallbackWithContext(const float* const*, int,
                                                       float* const* outputChannelData,
                                                       int numOutputChannels,
                                                       int numSamples,
                                                       const juce::AudioIODeviceCallbackContext&)
{
    if (numOutputChannels <= 0 || outputChannelData == nullptr)
        return;

    for (int channel = 0; channel < numOutputChannels; ++channel)
        if (outputChannelData[channel] != nullptr)
            juce::FloatVectorOperations::clear(outputChannelData[channel], numSamples);

    juce::AudioBuffer<float> buffer(const_cast<float**>(outputChannelData), numOutputChannels, numSamples);

    const juce::ScopedLock lock(engineLock);

    if (triggerRequested.exchange(false))
    {
        currentParams.velocity = triggerVelocity.load();
        engine.setParams(currentParams);
        engine.trigger(currentParams.velocity);
    }

    for (int slot = 0; slot < serverSampleLayers; ++slot)
    {
        if (pendingSampleTriggers[slot].pending)
        {
            engine.triggerSample(slot, pendingSampleTriggers[slot].params, pendingSampleTriggers[slot].velocity);
            pendingSampleTriggers[slot].pending = false;
        }
    }

    engine.processBlock(buffer, numSamples);
}

void KickAudioServer::run()
{
    while (! threadShouldExit())
    {
        if (serverSocket == nullptr)
            break;

        std::unique_ptr<juce::StreamingSocket> client(serverSocket->waitForNextConnection());
        if (client == nullptr)
            continue;

        if (! doWebSocketHandshake(client.get()))
        {
            client->close();
            continue;
        }

        auto sampleRate = 44100.0;
        if (auto* device = deviceManager.getCurrentAudioDevice())
            sampleRate = device->getCurrentSampleRate();

        sendToClient(client.get(), juce::String("{\"type\":\"ready\",\"sampleRate\":") + juce::String(sampleRate, 0) + "}");

        clients.push_back(std::move(client));
        auto* activeClient = clients.back().get();
        handleClient(activeClient);
        activeClient->close();
        clients.erase(std::remove_if(clients.begin(), clients.end(), [activeClient](const auto& entry)
        {
            return entry.get() == activeClient;
        }), clients.end());
    }
}

void KickAudioServer::handleClient(juce::StreamingSocket* client)
{
    while (! threadShouldExit() && client != nullptr && client->isConnected())
    {
        const auto message = receiveWebSocketFrame(client);
        if (! client->isConnected())
            break;
        if (message.isNotEmpty())
            processMessage(message, client);
    }
}

void KickAudioServer::processMessage(const juce::String& msg, juce::StreamingSocket* client)
{
    const auto parsed = juce::JSON::parse(msg);
    auto* object = parsed.getDynamicObject();

    if (object == nullptr)
    {
        sendToClient(client, makeResponse({}, "error", false, "Invalid JSON"));
        return;
    }

    const auto requestId = object->getProperty("id");
    const auto command = object->getProperty("cmd").toString();

    if (command == "ping")
    {
        sendToClient(client, makeResponse(requestId, command, true));
        return;
    }

    if (command == "load_sample")
    {
        const auto slot = juce::jlimit(0, serverSampleLayers - 1, int(object->getProperty("slot")));
        const auto path = object->getProperty("path").toString();

        const juce::ScopedLock lock(engineLock);
        const auto success = engine.loadSample(slot, path);
        if (success)
        {
            currentSamplePaths[slot] = path;
            sendToClient(client, makeResponse(requestId, command, true, {}, [&](juce::DynamicObject& response)
            {
                response.setProperty("slot", slot);
                response.setProperty("filename", engine.getSampleFilename(slot));
            }));
        }
        else
        {
            sendToClient(client, makeResponse(requestId, command, false, "Failed to load sample", [&](juce::DynamicObject& response)
            {
                response.setProperty("slot", slot);
            }));
        }
        return;
    }

    if (command == "trigger_sample")
    {
        const auto slot = juce::jlimit(0, serverSampleLayers - 1, int(object->getProperty("slot")));
        currentSampleParams[slot] = sampleParamsFromJson(object->getProperty("params"), currentSampleParams[slot]);
        pendingSampleTriggers[slot].params = currentSampleParams[slot];
        pendingSampleTriggers[slot].velocity = object->hasProperty("velocity") ? static_cast<float>(double(object->getProperty("velocity"))) : 1.0f;
        pendingSampleTriggers[slot].pending = true;
        sendToClient(client, makeResponse(requestId, command, true, {}, [&](juce::DynamicObject& response)
        {
            response.setProperty("slot", slot);
        }));
        return;
    }

    if (command == "get_state")
    {
        auto obj = std::make_unique<juce::DynamicObject>();
        obj->setProperty("params", kickParamsToVar(currentParams));

        juce::Array<juce::var> layers;
        for (int slot = 0; slot < serverSampleLayers; ++slot)
            layers.add(sampleParamsToVar(currentSampleParams[slot], engine.getSampleFilename(slot)));
        obj->setProperty("sampleLayers", juce::var(layers));

        sendToClient(client, makeResponse(requestId, command, true, {}, [&](juce::DynamicObject& response)
        {
            response.setProperty("state", juce::var(obj.release()));
        }));
        return;
    }

    if (command == "setParam")
    {
        const auto name = object->getProperty("name").toString();
        const auto value = object->getProperty("value");
        if (name.isEmpty() || value.isVoid())
        {
            sendToClient(client, makeResponse(requestId, command, false, "Missing setParam payload"));
            return;
        }

        auto params = currentParams;
        auto payload = std::make_unique<juce::DynamicObject>();
        payload->setProperty(name, value);
        params = paramsFromJson(juce::var(payload.release()), params);

        {
            const juce::ScopedLock lock(engineLock);
            currentParams = params;
            engine.setParams(currentParams);
        }

        sendToClient(client, makeResponse(requestId, command, true));
        return;
    }

    KickParams nextParams;
    std::array<SampleLayerParams, serverSampleLayers> nextSampleParams;
    {
        const juce::ScopedLock lock(engineLock);
        nextParams = currentParams;
        nextSampleParams = currentSampleParams;
    }
    nextParams = paramsFromJson(object->getProperty("params"), nextParams);
    updateSampleLayerArrayFromJson(object->getProperty("sampleLayers"), nextSampleParams);

    if (command == "trigger")
    {
        {
            const juce::ScopedLock lock(engineLock);
            currentParams = nextParams;
            currentSampleParams = nextSampleParams;
            for (int slot = 0; slot < serverSampleLayers; ++slot)
                engine.setSampleLayerParams(slot, currentSampleParams[slot]);
        }

        const auto velocity = object->hasProperty("velocity") ? static_cast<float>(double(object->getProperty("velocity"))) : nextParams.velocity;
        triggerVelocity.store(velocity);
        triggerRequested.store(true);
        sendToClient(client, makeResponse(requestId, command, true));
        return;
    }

    if (command == "preview")
    {
        KickPreviewData preview;
        {
            const juce::ScopedLock lock(engineLock);
            engine.setParams(nextParams);
            for (int slot = 0; slot < serverSampleLayers; ++slot)
                engine.setSampleLayerParams(slot, nextSampleParams[slot]);
            preview = engine.renderDetailedPreview(512);
        }

        sendToClient(client, makeResponse(requestId, command, true, {}, [&](juce::DynamicObject& response)
        {
            juce::Array<juce::var> waveform;
            juce::Array<juce::var> subWaveform;
            juce::Array<juce::var> sampleWaveforms;
            waveform.ensureStorageAllocated(static_cast<int>(preview.waveform.size()));
            subWaveform.ensureStorageAllocated(static_cast<int>(preview.subWaveform.size()));
            for (const auto sample : preview.waveform)
                waveform.add(sample);
            for (const auto sample : preview.subWaveform)
                subWaveform.add(sample);
            for (const auto& layer : preview.sampleWaveforms)
            {
                juce::Array<juce::var> layerWave;
                layerWave.ensureStorageAllocated(static_cast<int>(layer.size()));
                for (const auto sample : layer)
                    layerWave.add(sample);
                sampleWaveforms.add(juce::var(layerWave));
            }

            response.setProperty("waveform", juce::var(waveform));
            response.setProperty("subWaveform", juce::var(subWaveform));
            response.setProperty("sampleWaveforms", juce::var(sampleWaveforms));
            response.setProperty("sampleRate", 44100);
            response.setProperty("duration", static_cast<double>(nextParams.attack + nextParams.decay + nextParams.release + 0.1f));
            response.setProperty("peak", preview.peak);
        }));
        return;
    }

    if (command == "export")
    {
        const auto exportPath = object->getProperty("path").toString();
        if (exportPath.isEmpty())
        {
            sendToClient(client, makeResponse(requestId, command, false, "Missing export path"));
            return;
        }

        juce::String error;
        const auto duration = juce::jlimit(0.1, 4.0, static_cast<double>(nextParams.attack + nextParams.decay + nextParams.release + 0.1f));
        const auto buffer = renderKickBuffer(nextParams, 44100.0, duration);
        const auto success = writeWaveFile(buffer, juce::File(exportPath), 44100.0, error);
        sendToClient(client, makeResponse(requestId, command, success, error, [&](juce::DynamicObject& response)
        {
            response.setProperty("path", exportPath);
        }));
        return;
    }

    sendToClient(client, makeResponse(requestId, command, false, "Unknown command"));
}

void KickAudioServer::sendToClient(juce::StreamingSocket* client, const juce::String& json)
{
    sendWebSocketFrame(client, json);
}

bool KickAudioServer::doWebSocketHandshake(juce::StreamingSocket* client)
{
    juce::String request;
    juce::HeapBlock<char> buffer(1024);

    while (! threadShouldExit())
    {
        if (client->waitUntilReady(true, 2000) <= 0)
            return false;

        const auto bytesRead = client->read(buffer.getData(), 1023, false);
        if (bytesRead <= 0)
            return false;

        buffer[bytesRead] = 0;
        request << juce::String::fromUTF8(buffer.getData(), bytesRead);

        if (request.contains("\r\n\r\n"))
            break;
    }

    const auto key = extractWebSocketKey(request);
    if (key.isEmpty())
        return false;

    const auto accept = buildWebSocketAccept(key);
    if (accept.isEmpty())
        return false;

    juce::MemoryOutputStream response;
    response.write("HTTP/1.1 101 Switching Protocols\r\n", 34);
    response.write("Upgrade: websocket\r\n", 20);
    response.write("Connection: Upgrade\r\n", 21);
    response.write("Sec-WebSocket-Accept: ", 22);
    response.write(accept.toRawUTF8(), static_cast<size_t>(accept.getNumBytesAsUTF8()));
    response.write("\r\n\r\n", 4);

    return writeExact(client, response.getData(), static_cast<int>(response.getDataSize()));
}

juce::String KickAudioServer::receiveWebSocketFrame(juce::StreamingSocket* client)
{
    if (client == nullptr)
        return {};

    if (client->waitUntilReady(true, socketTimeoutMs) <= 0)
        return {};

    unsigned char header[2] {};
    if (! readExact(client, header, 2))
    {
        client->close();
        return {};
    }

    const auto opcode = header[0] & 0x0f;
    const bool masked = (header[1] & 0x80) != 0;
    std::uint64_t payloadLength = static_cast<std::uint64_t>(header[1] & 0x7f);

    if (opcode == 0x8)
    {
        client->close();
        return {};
    }

    if (payloadLength == 126)
    {
        unsigned char extended[2] {};
        if (! readExact(client, extended, 2))
        {
            client->close();
            return {};
        }
        payloadLength = (static_cast<std::uint64_t>(extended[0]) << 8) | static_cast<std::uint64_t>(extended[1]);
    }
    else if (payloadLength == 127)
    {
        unsigned char extended[8] {};
        if (! readExact(client, extended, 8))
        {
            client->close();
            return {};
        }

        payloadLength = 0;
        for (auto byte : extended)
            payloadLength = (payloadLength << 8) | static_cast<std::uint64_t>(byte);
    }

    unsigned char mask[4] {};
    if (masked && ! readExact(client, mask, 4))
    {
        client->close();
        return {};
    }

    if (payloadLength > 1024 * 1024)
    {
        client->close();
        return {};
    }

    juce::MemoryBlock payload(static_cast<size_t>(payloadLength));
    if (payloadLength > 0 && ! readExact(client, payload.getData(), static_cast<int>(payloadLength)))
    {
        client->close();
        return {};
    }

    if (masked)
    {
        auto* bytes = static_cast<unsigned char*>(payload.getData());
        for (std::uint64_t i = 0; i < payloadLength; ++i)
            bytes[i] ^= mask[i % 4];
    }

    if (opcode == 0x9)
    {
        sendWebSocketFrame(client, "pong");
        return {};
    }

    if (opcode != 0x1)
        return {};

    return juce::String::fromUTF8(static_cast<const char*>(payload.getData()), static_cast<int>(payloadLength));
}

void KickAudioServer::sendWebSocketFrame(juce::StreamingSocket* client, const juce::String& text)
{
    if (client == nullptr || ! client->isConnected())
        return;

    const auto utf8 = text.toUTF8();
    const auto payloadLength = static_cast<std::uint64_t>(utf8.sizeInBytes() - 1);

    juce::MemoryOutputStream frame;
    frame.writeByte(0x81);

    if (payloadLength <= 125)
    {
        frame.writeByte(static_cast<char>(payloadLength));
    }
    else if (payloadLength <= 0xffff)
    {
        frame.writeByte(126);
        frame.writeByte(static_cast<char>((payloadLength >> 8) & 0xff));
        frame.writeByte(static_cast<char>(payloadLength & 0xff));
    }
    else
    {
        frame.writeByte(127);
        for (int shift = 56; shift >= 0; shift -= 8)
            frame.writeByte(static_cast<char>((payloadLength >> shift) & 0xff));
    }

    frame.write(utf8.getAddress(), static_cast<size_t>(payloadLength));
    writeExact(client, frame.getData(), static_cast<int>(frame.getDataSize()));
}




