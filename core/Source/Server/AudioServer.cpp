#include "AudioServer.h"

#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <vector>

#include <windows.h>
#include <wincrypt.h>

#pragma comment(lib, "Advapi32.lib")

namespace
{
constexpr auto websocketGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
constexpr int defaultPreviewPoints = 512;
constexpr double defaultDurationPadding = 0.35;
constexpr double maxRenderDuration = 3.0;

bool isNumericVar(const juce::var& value)
{
    return value.isInt() || value.isInt64() || value.isDouble() || value.isBool();
}

double toDouble(const juce::var& value, double fallback = 0.0)
{
    return isNumericVar(value) ? static_cast<double>(value) : fallback;
}

juce::String makeJsonResponse(const juce::var& requestId,
                              const juce::String& command,
                              bool success,
                              const juce::String& errorMessage = {},
                              std::function<void(juce::DynamicObject&)> extra = {})
{
    auto response = juce::DynamicObject::Ptr(new juce::DynamicObject());
    response->setProperty("cmd", command);
    response->setProperty("success", success);

    if (!requestId.isVoid())
        response->setProperty("id", requestId);

    if (errorMessage.isNotEmpty())
        response->setProperty("error", errorMessage);

    if (extra)
        extra(*response);

    return juce::JSON::toString(juce::var(response.get()), false);
}

bool writeWaveFile(const juce::AudioBuffer<float>& buffer, const juce::File& file, double sampleRate, juce::String& errorMessage)
{
    if (auto parent = file.getParentDirectory(); !parent.exists())
        parent.createDirectory();

    std::unique_ptr<juce::FileOutputStream> output(file.createOutputStream());
    if (output == nullptr)
    {
        errorMessage = "Failed to create output stream";
        return false;
    }

    juce::WavAudioFormat wav;
    std::unique_ptr<juce::AudioFormatWriter> writer(wav.createWriterFor(output.get(), sampleRate, static_cast<unsigned int>(buffer.getNumChannels()), 16, {}, 0));
    if (writer == nullptr)
    {
        errorMessage = "Failed to create WAV writer";
        return false;
    }

    output.release();

    if (!writer->writeFromAudioSampleBuffer(buffer, 0, buffer.getNumSamples()))
    {
        errorMessage = "Failed to write audio buffer";
        return false;
    }

    return true;
}

bool consumeBytes(juce::MemoryBlock& pendingData, size_t numBytes, std::vector<std::uint8_t>& destination)
{
    if (pendingData.getSize() < numBytes)
        return false;

    const auto* data = static_cast<const std::uint8_t*>(pendingData.getData());
    destination.assign(data, data + numBytes);
    pendingData.removeSection(0, numBytes);
    return true;
}
} // namespace

void AudioServer::PlaybackSource::prepareToPlay(int samplesPerBlockExpected, double sampleRate)
{
    juce::ignoreUnused(samplesPerBlockExpected);
    const juce::ScopedLock scopedLock(lock);
    currentSampleRate = sampleRate;
}

void AudioServer::PlaybackSource::releaseResources()
{
}

void AudioServer::PlaybackSource::getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill)
{
    bufferToFill.clearActiveBufferRegion();

    const juce::ScopedLock scopedLock(lock);
    if (buffer.getNumSamples() <= 0 || bufferToFill.numSamples <= 0)
        return;

    const auto available = buffer.getNumSamples() - position;
    if (available <= 0)
    {
        buffer.setSize(buffer.getNumChannels(), 0);
        position = 0;
        return;
    }

    const auto toCopy = juce::jmin(bufferToFill.numSamples, available);
    for (int channel = 0; channel < bufferToFill.buffer->getNumChannels(); ++channel)
    {
        const auto sourceChannel = juce::jmin(channel, buffer.getNumChannels() - 1);
        bufferToFill.buffer->copyFrom(channel,
                                      bufferToFill.startSample,
                                      buffer,
                                      sourceChannel,
                                      position,
                                      toCopy);
    }

    if (toCopy < bufferToFill.numSamples)
        bufferToFill.buffer->clear(bufferToFill.startSample + toCopy, bufferToFill.numSamples - toCopy);

    position += toCopy;
    if (position >= buffer.getNumSamples())
    {
        buffer.setSize(buffer.getNumChannels(), 0);
        position = 0;
    }
}

void AudioServer::PlaybackSource::setBuffer(juce::AudioBuffer<float>&& newBuffer)
{
    const juce::ScopedLock scopedLock(lock);
    buffer = std::move(newBuffer);
    position = 0;
}

AudioServer::AudioServer()
    : juce::Thread("KickSynthAudioServer")
{
    sourcePlayer.setSource(&playbackSource);
    const auto initError = deviceManager.initialise(0, 2, nullptr, true);
    if (initError.isNotEmpty())
        std::cerr << "Audio device init warning: " << initError << std::endl;

    deviceManager.addAudioCallback(&sourcePlayer);
}

AudioServer::~AudioServer()
{
    stopServer();
    deviceManager.removeAudioCallback(&sourcePlayer);
    sourcePlayer.setSource(nullptr);
}

bool AudioServer::startServer(int port)
{
    stopServer();

    portNumber = port;
    listener = std::make_unique<juce::StreamingSocket>();
    if (!listener->createListener(portNumber, "127.0.0.1"))
    {
        listener.reset();
        return false;
    }

    startThread();
    return true;
}

void AudioServer::stopServer()
{
    signalThreadShouldExit();

    if (listener != nullptr)
        listener->close();

    stopThread(2000);
    listener.reset();
}

void AudioServer::run()
{
    while (!threadShouldExit())
    {
        if (listener == nullptr)
            return;

        std::unique_ptr<juce::StreamingSocket> client(listener->waitForNextConnection());
        if (client == nullptr)
        {
            if (!threadShouldExit())
                juce::Thread::sleep(50);
            continue;
        }

        juce::MemoryBlock pendingData;
        if (!performHandshake(*client, pendingData))
            continue;

        while (!threadShouldExit())
        {
            juce::String message;
            if (!readFrame(*client, pendingData, message))
                break;

            const auto response = handleMessage(message);
            if (response.isNotEmpty() && !sendText(*client, response))
                break;
        }

        client->close();
    }
}

juce::String AudioServer::handleMessage(const juce::String& message)
{
    const auto parsed = juce::JSON::parse(message);
    auto* object = parsed.getDynamicObject();
    if (object == nullptr)
        return makeJsonResponse({}, "error", false, "Invalid JSON payload");

    const auto requestId = object->getProperty("id");
    const auto command = object->getProperty("cmd").toString().trim();

    if (command == "trigger")
    {
        const auto params = parseParams(object->getProperty("params"), true);
        trigger(params);
        return makeJsonResponse(requestId, command, true);
    }

    if (command == "preview")
    {
        const auto points = juce::jlimit(64, 4096, static_cast<int>(toDouble(object->getProperty("points"), defaultPreviewPoints)));
        const auto params = parseParams(object->getProperty("params"), true);
        const auto waveform = preview(params, points);

        return makeJsonResponse(requestId, command, true, {}, [&](juce::DynamicObject& response)
        {
            juce::Array<juce::var> values;
            values.ensureStorageAllocated(static_cast<int>(waveform.size()));
            for (const auto sample : waveform)
                values.add(sample);

            response.setProperty("waveform", juce::var(values));
            response.setProperty("sampleRate", 44100);
            response.setProperty("duration", juce::jlimit(0.1, maxRenderDuration, static_cast<double>(params.decay) + defaultDurationPadding));
        });
    }

    if (command == "setParam")
    {
        const auto name = object->getProperty("name").toString().trim();
        if (name.isEmpty())
            return makeJsonResponse(requestId, command, false, "Missing parameter name");

        if (!isNumericVar(object->getProperty("value")))
            return makeJsonResponse(requestId, command, false, "Missing parameter value");

        {
            const juce::ScopedLock scopedLock(stateLock);
            applyParamMutation(currentParams, name, toDouble(object->getProperty("value")));
            KickParams normalized = currentParams;
            currentParams = normalized;
        }

        return makeJsonResponse(requestId, command, true);
    }

    if (command == "export")
    {
        const auto outputPath = object->getProperty("path").toString().trim();
        if (outputPath.isEmpty())
            return makeJsonResponse(requestId, command, false, "Missing export path");

        const auto params = parseParams(object->getProperty("params"), true);
        juce::String errorMessage;
        const auto success = exportToFile(params, juce::File(outputPath), errorMessage);
        return makeJsonResponse(requestId, command, success, errorMessage, [&](juce::DynamicObject& response)
        {
            response.setProperty("path", outputPath);
        });
    }

    if (command == "ping")
        return makeJsonResponse(requestId, command, true);

    return makeJsonResponse(requestId, command, false, "Unsupported command");
}

KickParams AudioServer::parseParams(const juce::var& paramsVar, bool useStoredDefaults) const
{
    KickParams params;
    if (useStoredDefaults)
    {
        const juce::ScopedLock scopedLock(stateLock);
        params = currentParams;
    }

    if (auto* object = paramsVar.getDynamicObject())
    {
        const auto assign = [&](const char* key, auto& target)
        {
            const auto value = object->getProperty(key);
            if (isNumericVar(value))
                target = static_cast<std::decay_t<decltype(target)>>(toDouble(value));
        };

        assign("startPitch", params.startPitch);
        assign("endPitch", params.endPitch);
        assign("pitchDecay", params.pitchDecay);
        assign("pitchCurve", params.pitchCurve);
        assign("attack", params.attack);
        assign("decay", params.decay);
        assign("punch", params.punch);
        assign("drive", params.drive);
        assign("tone", params.tone);
        assign("noise", params.noise);
        assign("waveform", params.waveform);
        assign("subLevel", params.subLevel);
        assign("clickLevel", params.clickLevel);
        assign("click", params.clickLevel);
        assign("clickDecay", params.clickDecay);
        assign("gain", params.gain);
        assign("bpm", params.bpm);
    }

    KickEngine normalizer;
    normalizer.prepare(44100.0, 512);
    normalizer.setParams(params);

    params.clickDecay = juce::jmap(params.clickLevel, 0.0f, 1.0f, 0.004f, 0.014f);
    params.tone = juce::jlimit(0.0f, 1.0f, 0.7f - 0.45f * params.noise + 0.2f * params.subLevel);
    return params;
}

void AudioServer::applyParamMutation(KickParams& params, const juce::String& name, double value) const
{
    if (name == "startPitch") params.startPitch = static_cast<float>(value);
    else if (name == "endPitch") params.endPitch = static_cast<float>(value);
    else if (name == "pitchDecay") params.pitchDecay = static_cast<float>(value);
    else if (name == "pitchCurve") params.pitchCurve = static_cast<float>(value);
    else if (name == "attack") params.attack = static_cast<float>(value);
    else if (name == "decay") params.decay = static_cast<float>(value);
    else if (name == "punch") params.punch = static_cast<float>(value);
    else if (name == "drive") params.drive = static_cast<float>(value);
    else if (name == "tone") params.tone = static_cast<float>(value);
    else if (name == "noise") params.noise = static_cast<float>(value);
    else if (name == "waveform") params.waveform = static_cast<int>(std::lround(value));
    else if (name == "subLevel") params.subLevel = static_cast<float>(value);
    else if (name == "clickLevel" || name == "click") params.clickLevel = static_cast<float>(value);
    else if (name == "clickDecay") params.clickDecay = static_cast<float>(value);
    else if (name == "gain") params.gain = static_cast<float>(value);
    else if (name == "bpm") params.bpm = static_cast<float>(value);

    params.clickDecay = juce::jmap(params.clickLevel, 0.0f, 1.0f, 0.004f, 0.014f);
    params.tone = juce::jlimit(0.0f, 1.0f, 0.7f - 0.45f * params.noise + 0.2f * params.subLevel);
}

void AudioServer::trigger(const KickParams& params)
{
    {
        const juce::ScopedLock scopedLock(stateLock);
        currentParams = params;
    }

    auto* device = deviceManager.getCurrentAudioDevice();
    const auto sampleRate = device != nullptr ? device->getCurrentSampleRate() : 44100.0;
    const auto duration = juce::jlimit(0.1, maxRenderDuration, static_cast<double>(params.decay) + defaultDurationPadding);
    playbackSource.setBuffer(renderKickBuffer(params, sampleRate, duration));
}

std::vector<float> AudioServer::preview(const KickParams& params, int numSamples) const
{
    KickEngine engine;
    engine.prepare(44100.0, 512);
    engine.setParams(params);
    return engine.renderPreview(numSamples);
}

bool AudioServer::exportToFile(const KickParams& params, const juce::File& file, juce::String& errorMessage) const
{
    const auto duration = juce::jlimit(0.1, maxRenderDuration, static_cast<double>(params.decay) + defaultDurationPadding);
    const auto buffer = renderKickBuffer(params, 44100.0, duration);
    return writeWaveFile(buffer, file, 44100.0, errorMessage);
}

bool AudioServer::appendUntil(juce::StreamingSocket& socket, juce::MemoryBlock& pendingData, size_t minBytes, int timeoutMs) const
{
    while (pendingData.getSize() < minBytes && !threadShouldExit())
    {
        if (socket.waitUntilReady(true, timeoutMs) <= 0)
            continue;

        std::array<char, 4096> scratch {};
        const auto bytesRead = socket.read(scratch.data(), static_cast<int>(scratch.size()), false);
        if (bytesRead <= 0)
            return false;

        pendingData.append(scratch.data(), static_cast<size_t>(bytesRead));
    }

    return pendingData.getSize() >= minBytes;
}

juce::String AudioServer::createWebSocketAccept(const juce::String& clientKey)
{
    const auto source = clientKey.trim() + websocketGuid;

    HCRYPTPROV provider = 0;
    HCRYPTHASH hash = 0;
    std::array<std::uint8_t, 20> digest {};
    DWORD digestSize = static_cast<DWORD>(digest.size());

    if (!CryptAcquireContext(&provider, nullptr, nullptr, PROV_RSA_AES, CRYPT_VERIFYCONTEXT))
        return {};

    if (!CryptCreateHash(provider, CALG_SHA1, 0, 0, &hash))
    {
        CryptReleaseContext(provider, 0);
        return {};
    }

    const auto utf8 = source.toRawUTF8();
    const auto utf8Length = static_cast<DWORD>(std::strlen(utf8));
    if (!CryptHashData(hash, reinterpret_cast<const BYTE*>(utf8), utf8Length, 0)
        || !CryptGetHashParam(hash, HP_HASHVAL, digest.data(), &digestSize, 0))
    {
        CryptDestroyHash(hash);
        CryptReleaseContext(provider, 0);
        return {};
    }

    CryptDestroyHash(hash);
    CryptReleaseContext(provider, 0);

    return juce::Base64::toBase64(digest.data(), digestSize);
}

juce::AudioBuffer<float> AudioServer::renderKickBuffer(const KickParams& params, double sampleRate, double durationSeconds)
{
    const auto totalSamples = juce::jmax(1, static_cast<int>(std::ceil(sampleRate * durationSeconds)));

    KickEngine engine;
    engine.prepare(sampleRate, 512);
    engine.setParams(params);
    engine.trigger();

    juce::AudioBuffer<float> buffer(2, totalSamples);
    buffer.clear();
    engine.processBlock(buffer, totalSamples);
    return buffer;
}

bool AudioServer::performHandshake(juce::StreamingSocket& socket, juce::MemoryBlock& pendingData)
{
    const auto headerTerminator = juce::String("\r\n\r\n").toRawUTF8();

    while (!threadShouldExit())
    {
        const auto* data = static_cast<const char*>(pendingData.getData());
        const std::string request(data, data + pendingData.getSize());
        const auto terminatorPos = request.find("\r\n\r\n");
        if (terminatorPos != std::string::npos)
        {
            const auto headerText = juce::String::fromUTF8(request.data(), static_cast<int>(terminatorPos));
            const auto lines = juce::StringArray::fromLines(headerText);

            juce::String clientKey;
            for (const auto& line : lines)
            {
                if (line.startsWithIgnoreCase("Sec-WebSocket-Key:"))
                {
                    clientKey = line.fromFirstOccurrenceOf(":", false, false).trim();
                    break;
                }
            }

            if (clientKey.isEmpty())
                return false;

            const auto accept = createWebSocketAccept(clientKey);
            if (accept.isEmpty())
                return false;

            const auto response = juce::String()
                + "HTTP/1.1 101 Switching Protocols\r\n"
                + "Upgrade: websocket\r\n"
                + "Connection: Upgrade\r\n"
                + "Sec-WebSocket-Accept: " + accept + "\r\n\r\n";

            if (socket.write(response.toRawUTF8(), response.getNumBytesAsUTF8()) <= 0)
                return false;

            pendingData.removeSection(0, terminatorPos + 4);
            return true;
        }

        if (!appendUntil(socket, pendingData, pendingData.getSize() + 1, 2000))
            return false;
    }

    juce::ignoreUnused(headerTerminator);
    return false;
}

bool AudioServer::readFrame(juce::StreamingSocket& socket, juce::MemoryBlock& pendingData, juce::String& message)
{
    message.clear();

    if (!appendUntil(socket, pendingData, 2, 500))
        return false;

    const auto* header = static_cast<const std::uint8_t*>(pendingData.getData());
    const auto opcode = header[0] & 0x0f;
    const auto masked = (header[1] & 0x80) != 0;
    std::uint64_t payloadLength = header[1] & 0x7f;
    size_t offset = 2;

    if (payloadLength == 126)
    {
        if (!appendUntil(socket, pendingData, 4, 500))
            return false;

        header = static_cast<const std::uint8_t*>(pendingData.getData());
        payloadLength = (static_cast<std::uint64_t>(header[2]) << 8) | static_cast<std::uint64_t>(header[3]);
        offset = 4;
    }
    else if (payloadLength == 127)
    {
        if (!appendUntil(socket, pendingData, 10, 500))
            return false;

        header = static_cast<const std::uint8_t*>(pendingData.getData());
        payloadLength = 0;
        for (int i = 0; i < 8; ++i)
            payloadLength = (payloadLength << 8) | static_cast<std::uint64_t>(header[2 + i]);
        offset = 10;
    }

    const auto maskLength = masked ? static_cast<size_t>(4) : static_cast<size_t>(0);
    const auto totalBytes = offset + maskLength + static_cast<size_t>(payloadLength);
    if (!appendUntil(socket, pendingData, totalBytes, 500))
        return false;

    std::vector<std::uint8_t> frame;
    if (!consumeBytes(pendingData, totalBytes, frame))
        return false;

    if (opcode == 0x8)
        return false;

    if (opcode != 0x1)
        return true;

    const auto* maskKey = masked ? frame.data() + offset : nullptr;
    auto* payload = frame.data() + offset + maskLength;
    for (size_t index = 0; masked && index < payloadLength; ++index)
        payload[index] ^= maskKey[index % 4];

    message = juce::String::fromUTF8(reinterpret_cast<const char*>(payload), static_cast<int>(payloadLength));
    return true;
}

bool AudioServer::sendText(juce::StreamingSocket& socket, const juce::String& message)
{
    const auto utf8 = message.toRawUTF8();
    const auto payloadLength = static_cast<std::uint64_t>(std::strlen(utf8));

    std::vector<std::uint8_t> frame;
    frame.reserve(static_cast<size_t>(payloadLength) + 16);
    frame.push_back(0x81);

    if (payloadLength <= 125)
    {
        frame.push_back(static_cast<std::uint8_t>(payloadLength));
    }
    else if (payloadLength <= 0xffff)
    {
        frame.push_back(126);
        frame.push_back(static_cast<std::uint8_t>((payloadLength >> 8) & 0xff));
        frame.push_back(static_cast<std::uint8_t>(payloadLength & 0xff));
    }
    else
    {
        frame.push_back(127);
        for (int shift = 7; shift >= 0; --shift)
            frame.push_back(static_cast<std::uint8_t>((payloadLength >> (shift * 8)) & 0xff));
    }

    frame.insert(frame.end(), reinterpret_cast<const std::uint8_t*>(utf8), reinterpret_cast<const std::uint8_t*>(utf8) + payloadLength);
    return socket.write(frame.data(), static_cast<int>(frame.size())) == static_cast<int>(frame.size());
}
