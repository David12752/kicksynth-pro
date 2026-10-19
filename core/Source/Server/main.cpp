#include "KickServer.h"

#include <csignal>
#include <cstdlib>
#include <iostream>

#include <juce_events/juce_events.h>
#include <juce_gui_basics/juce_gui_basics.h>

static KickAudioServer* gServer = nullptr;

void signalHandler(int)
{
    if (gServer != nullptr)
        gServer->stop();

    std::exit(0);
}

int main(int argc, char* argv[])
{
    int port = 9877;

    if (argc > 1)
    {
        try
        {
            port = std::stoi(argv[1]);
        }
        catch (...)
        {
            std::cerr << "Invalid port, falling back to 9877\n";
        }
    }

    juce::ScopedJuceInitialiser_GUI libraryInitialiser;

    KickAudioServer server;
    gServer = &server;

    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    if (! server.start(port))
    {
        std::cerr << "Failed to start server on port " << port << "\n";
        return 1;
    }

    std::cout << "KickSynth Audio Server running on port " << port << "\n";

    while (server.isThreadRunning())
        juce::Thread::sleep(100);

    return 0;
}
