#include "PluginEditor.h"

namespace
{
    const auto bgColour = juce::Colour::fromRGB(0x05, 0x08, 0x10);
    const auto panelColour = juce::Colour::fromRGB(0x0A, 0x10, 0x20);
    const auto panelAlt = juce::Colour::fromRGB(0x0F, 0x18, 0x2C);
    const auto accent = juce::Colour::fromRGB(0x00, 0xD4, 0xFF);
    const auto accentSoft = juce::Colour::fromRGB(0x7C, 0x3A, 0xED);
    const auto textColour = juce::Colour::fromRGB(0xE8, 0xF4, 0xF8);
    const auto knobBody = juce::Colour::fromRGB(0x1A, 0x28, 0x40);
    const auto outlineColour = juce::Colour::fromRGB(0x1E, 0x36, 0x59);
}

WaveformDisplay::WaveformDisplay(KickSynthProcessor& processor)
    : proc(processor)
{
    startTimerHz(30);
}

void WaveformDisplay::timerCallback()
{
    preview = proc.renderPreview(768);
    repaint();
}

void WaveformDisplay::paint(juce::Graphics& g)
{
    auto area = getLocalBounds().toFloat().reduced(2.0f);

    g.setGradientFill(juce::ColourGradient(panelAlt.brighter(0.08f), area.getTopLeft(), panelColour, area.getBottomRight(), false));
    g.fillRoundedRectangle(area, 18.0f);

    g.setColour(accent.withAlpha(0.14f));
    for (int i = 1; i < 5; ++i)
    {
        const auto y = juce::jmap<float>(static_cast<float>(i), 0.0f, 5.0f, area.getY(), area.getBottom());
        g.drawHorizontalLine(static_cast<int>(y), area.getX() + 14.0f, area.getRight() - 14.0f);
    }

    g.setColour(textColour.withAlpha(0.72f));
    g.setFont(juce::Font(15.0f, juce::Font::bold));
    g.drawText("KICK WAVE PREVIEW", area.reduced(18.0f, 10.0f).removeFromTop(22.0f), juce::Justification::centredLeft, false);

    if (preview.empty())
        preview = proc.renderPreview(768);

    juce::Path waveformPath;
    auto plot = area.reduced(18.0f, 34.0f);
    const auto centreY = plot.getCentreY();
    const auto halfHeight = plot.getHeight() * 0.42f;

    waveformPath.startNewSubPath(plot.getX(), centreY);
    for (size_t i = 0; i < preview.size(); ++i)
    {
        const auto x = juce::jmap<float>(static_cast<float>(i), 0.0f, static_cast<float>(preview.size() - 1), plot.getX(), plot.getRight());
        const auto y = centreY - preview[i] * halfHeight;
        waveformPath.lineTo(x, y);
    }

    g.setColour(accentSoft.withAlpha(0.25f));
    g.strokePath(waveformPath, juce::PathStrokeType(7.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    g.setColour(accent);
    g.strokePath(waveformPath, juce::PathStrokeType(2.6f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    g.setColour(accent.withAlpha(0.85f));
    g.drawRoundedRectangle(area, 18.0f, 1.0f);
}

SynthLookAndFeel::SynthLookAndFeel()
{
    setColour(juce::Slider::textBoxTextColourId, textColour);
    setColour(juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    setColour(juce::Slider::textBoxBackgroundColourId, juce::Colours::transparentBlack);
    setColour(juce::Label::textColourId, textColour);
    setColour(juce::ComboBox::textColourId, textColour);
    setColour(juce::ComboBox::backgroundColourId, panelAlt);
    setColour(juce::ComboBox::outlineColourId, accent.withAlpha(0.25f));
    setColour(juce::PopupMenu::backgroundColourId, panelColour);
    setColour(juce::PopupMenu::textColourId, textColour);
    setColour(juce::TextButton::buttonColourId, panelAlt);
    setColour(juce::TextButton::textColourOffId, textColour);
    setColour(juce::TextButton::textColourOnId, textColour);
}

void SynthLookAndFeel::drawRotarySlider(juce::Graphics& g, int x, int y, int width, int height,
                                        float sliderPosProportional, float rotaryStartAngle,
                                        float rotaryEndAngle, juce::Slider& slider)
{
    juce::ignoreUnused(slider);

    auto bounds = juce::Rectangle<float>(static_cast<float>(x), static_cast<float>(y), static_cast<float>(width), static_cast<float>(height)).reduced(8.0f);
    const auto radius = juce::jmin(bounds.getWidth(), bounds.getHeight()) * 0.5f;
    const auto centre = bounds.getCentre();
    const auto angle = juce::jmap(sliderPosProportional, 0.0f, 1.0f, rotaryStartAngle, rotaryEndAngle);

    g.setColour(accentSoft.withAlpha(0.18f));
    g.fillEllipse(bounds.expanded(2.5f));

    g.setColour(knobBody);
    g.fillEllipse(bounds);

    g.setColour(outlineColour);
    g.drawEllipse(bounds, 1.3f);

    juce::Path track;
    track.addCentredArc(centre.x, centre.y, radius * 0.78f, radius * 0.78f, 0.0f, rotaryStartAngle, rotaryEndAngle, true);
    g.setColour(juce::Colours::white.withAlpha(0.08f));
    g.strokePath(track, juce::PathStrokeType(4.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    juce::Path active;
    active.addCentredArc(centre.x, centre.y, radius * 0.78f, radius * 0.78f, 0.0f, rotaryStartAngle, angle, true);
    g.setColour(accent.withAlpha(0.95f));
    g.strokePath(active, juce::PathStrokeType(4.2f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    juce::Path pointer;
    juce::Rectangle<float> pointerRect(-2.4f, -radius * 0.72f, 4.8f, radius * 0.40f);
    pointer.addRoundedRectangle(pointerRect, 2.0f);
    pointer.applyTransform(juce::AffineTransform::rotation(angle).translated(centre.x, centre.y));

    g.setColour(accentSoft.withAlpha(0.34f));
    g.fillPath(pointer, juce::AffineTransform::translation(0.0f, 1.5f));
    g.setColour(accent);
    g.fillPath(pointer);

    g.setColour(textColour.withAlpha(0.9f));
    g.setFont(juce::Font(11.0f));
    const auto valueText = slider.getTextFromValue(slider.getValue());
    g.drawText(valueText, bounds.withTrimmedTop(bounds.getHeight() * 0.58f).toNearestInt(), juce::Justification::centredBottom, false);
}

void SynthLookAndFeel::drawButtonBackground(juce::Graphics& g, juce::Button& button, const juce::Colour&, bool highlighted, bool down)
{
    auto area = button.getLocalBounds().toFloat().reduced(0.5f);
    auto fill = button.getButtonText().contains("TRIGGER") ? accent : panelAlt.brighter(0.02f);
    if (down)
        fill = fill.brighter(0.18f);
    else if (highlighted)
        fill = fill.brighter(0.08f);

    g.setColour(fill.withAlpha(button.getButtonText().contains("TRIGGER") ? 0.92f : 0.86f));
    g.fillRoundedRectangle(area, 11.0f);

    g.setColour(button.getButtonText().contains("TRIGGER") ? accent.brighter(0.4f) : accent.withAlpha(0.35f));
    g.drawRoundedRectangle(area, 11.0f, 1.2f);
}

void SynthLookAndFeel::drawComboBox(juce::Graphics& g, int width, int height, bool,
                                    int buttonX, int, int buttonW, int, juce::ComboBox&)
{
    auto area = juce::Rectangle<float>(0.0f, 0.0f, static_cast<float>(width), static_cast<float>(height)).reduced(0.5f);
    g.setColour(panelAlt);
    g.fillRoundedRectangle(area, 10.0f);
    g.setColour(accent.withAlpha(0.28f));
    g.drawRoundedRectangle(area, 10.0f, 1.1f);

    juce::Path arrow;
    const auto cx = static_cast<float>(buttonX + buttonW / 2);
    const auto cy = area.getCentreY();
    arrow.startNewSubPath(cx - 5.0f, cy - 2.0f);
    arrow.lineTo(cx, cy + 4.0f);
    arrow.lineTo(cx + 5.0f, cy - 2.0f);

    g.setColour(accent);
    g.strokePath(arrow, juce::PathStrokeType(2.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
}

juce::Font SynthLookAndFeel::getComboBoxFont(juce::ComboBox&)
{
    return juce::Font(13.5f, juce::Font::plain);
}

KnobWithLabel::KnobWithLabel(const juce::String& name,
                             juce::AudioProcessorValueTreeState& apvts,
                             const juce::String& paramId,
                             SynthLookAndFeel& customLookAndFeel)
{
    knob.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    knob.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 64, 14);
    knob.setLookAndFeel(&customLookAndFeel);
    knob.setRotaryParameters(juce::degreesToRadians(225.0f), juce::degreesToRadians(495.0f), true);
    addAndMakeVisible(knob);

    label.setText(name, juce::dontSendNotification);
    label.setJustificationType(juce::Justification::centred);
    label.setFont(juce::Font(12.0f, juce::Font::bold));
    label.setColour(juce::Label::textColourId, textColour);
    addAndMakeVisible(label);

    attachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(apvts, paramId, knob);
}

void KnobWithLabel::resized()
{
    auto area = getLocalBounds();
    label.setBounds(area.removeFromTop(16));
    knob.setBounds(area.reduced(2, 0));
}

KickSynthEditor::KickSynthEditor(KickSynthProcessor& processor)
    : AudioProcessorEditor(&processor),
      proc(processor),
      waveform(processor),
      startPitch("Start", proc.apvts, "startPitch", lookAndFeel),
      endPitch("End", proc.apvts, "endPitch", lookAndFeel),
      pitchDecay("Decay", proc.apvts, "pitchDecay", lookAndFeel),
      pitchCurve("Curve", proc.apvts, "pitchCurve", lookAndFeel),
      attack("Attack", proc.apvts, "attack", lookAndFeel),
      decay("Decay", proc.apvts, "decay", lookAndFeel),
      punch("Punch", proc.apvts, "punch", lookAndFeel),
      drive("Drive", proc.apvts, "drive", lookAndFeel),
      noise("Noise", proc.apvts, "noise", lookAndFeel),
      clickLevel("Click", proc.apvts, "clickLevel", lookAndFeel),
      subLevel("Sub", proc.apvts, "subLevel", lookAndFeel),
      gain("Gain", proc.apvts, "gain", lookAndFeel)
{
    setLookAndFeel(&lookAndFeel);
    setSize(700, 500);
    setResizable(false, false);

    titleLabel.setText("KickSynth Pro", juce::dontSendNotification);
    titleLabel.setFont(juce::Font(24.0f, juce::Font::bold));
    titleLabel.setColour(juce::Label::textColourId, textColour);
    addAndMakeVisible(titleLabel);

    addAndMakeVisible(waveform);

    presetBox.setLookAndFeel(&lookAndFeel);
    presetBox.onChange = [this]
    {
        const auto idx = presetBox.getSelectedItemIndex();
        if (idx >= 0)
            loadPreset(idx);
    };
    addAndMakeVisible(presetBox);

    savePreset.setLookAndFeel(&lookAndFeel);
    savePreset.onClick = [this] { saveCurrentPreset(); };
    addAndMakeVisible(savePreset);

    triggerBtn.setLookAndFeel(&lookAndFeel);
    triggerBtn.onClick = [this] { proc.triggerManual(); };
    addAndMakeVisible(triggerBtn);

    waveformBox.addItemList({ "Sine", "Triangle", "Tanh" }, 1);
    waveformBox.setLookAndFeel(&lookAndFeel);
    waveformAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment>(proc.apvts, "waveform", waveformBox);
    addAndMakeVisible(waveformBox);

    for (auto* component : std::initializer_list<juce::Component*>
         { &startPitch, &endPitch, &pitchDecay, &pitchCurve,
           &attack, &decay, &punch,
           &drive, &noise, &clickLevel,
           &subLevel, &gain })
    {
        addAndMakeVisible(component);
    }

    setupPresets();
    presetBox.setSelectedItemIndex(0, juce::sendNotificationSync);
}

KickSynthEditor::~KickSynthEditor()
{
    waveformAttachment.reset();
    presetBox.setLookAndFeel(nullptr);
    savePreset.setLookAndFeel(nullptr);
    triggerBtn.setLookAndFeel(nullptr);
    waveformBox.setLookAndFeel(nullptr);
    setLookAndFeel(nullptr);
}

void KickSynthEditor::setupPresets()
{
    presets = {
        { "Classic", {{ "startPitch", 210.0f }, { "endPitch", 48.0f }, { "pitchDecay", 0.065f }, { "pitchCurve", 2.2f },
                       { "attack", 0.002f }, { "decay", 0.45f }, { "punch", 0.72f }, { "drive", 0.28f },
                       { "noise", 0.08f }, { "clickLevel", 0.35f }, { "subLevel", 1.0f }, { "gain", 0.82f }, { "waveform", 0.0f } } },
        { "Hard", {{ "startPitch", 280.0f }, { "endPitch", 52.0f }, { "pitchDecay", 0.05f }, { "pitchCurve", 3.5f },
                    { "attack", 0.001f }, { "decay", 0.35f }, { "punch", 0.95f }, { "drive", 0.68f },
                    { "noise", 0.14f }, { "clickLevel", 0.62f }, { "subLevel", 0.95f }, { "gain", 0.8f }, { "waveform", 2.0f } } },
        { "Sub Bass", {{ "startPitch", 165.0f }, { "endPitch", 38.0f }, { "pitchDecay", 0.11f }, { "pitchCurve", 1.5f },
                        { "attack", 0.003f }, { "decay", 0.7f }, { "punch", 0.45f }, { "drive", 0.18f },
                        { "noise", 0.03f }, { "clickLevel", 0.18f }, { "subLevel", 1.0f }, { "gain", 0.9f }, { "waveform", 0.0f } } },
        { "Punchy", {{ "startPitch", 240.0f }, { "endPitch", 46.0f }, { "pitchDecay", 0.055f }, { "pitchCurve", 2.8f },
                      { "attack", 0.0015f }, { "decay", 0.39f }, { "punch", 0.9f }, { "drive", 0.42f },
                      { "noise", 0.1f }, { "clickLevel", 0.52f }, { "subLevel", 0.92f }, { "gain", 0.84f }, { "waveform", 1.0f } } },
        { "Techno Click", {{ "startPitch", 320.0f }, { "endPitch", 58.0f }, { "pitchDecay", 0.04f }, { "pitchCurve", 4.6f },
                             { "attack", 0.001f }, { "decay", 0.28f }, { "punch", 1.0f }, { "drive", 0.55f },
                             { "noise", 0.22f }, { "clickLevel", 0.82f }, { "subLevel", 0.78f }, { "gain", 0.76f }, { "waveform", 2.0f } } }
    };

    presetBox.clear(juce::dontSendNotification);
    for (const auto& preset : presets)
        presetBox.addItem(preset.name, presetBox.getNumItems() + 1);
}

void KickSynthEditor::loadPreset(int idx)
{
    if (juce::isPositiveAndBelow(idx, static_cast<int>(presets.size())))
        proc.applyPreset(presets[static_cast<size_t>(idx)].values);
}

void KickSynthEditor::saveCurrentPreset()
{
    std::map<juce::String, float> values;
    for (const auto& paramId : { "startPitch", "endPitch", "pitchDecay", "pitchCurve", "attack", "decay", "punch",
                                 "drive", "noise", "clickLevel", "subLevel", "gain", "waveform" })
    {
        if (auto* param = proc.apvts.getParameter(paramId))
            values[paramId] = param->getValueForText(param->getCurrentValueAsText());
    }

    presets.push_back({ "User " + juce::String(userPresetCounter++), values });
    presetBox.addItem(presets.back().name, presetBox.getNumItems() + 1);
    presetBox.setSelectedItemIndex(presetBox.getNumItems() - 1, juce::dontSendNotification);
}

void KickSynthEditor::paintSection(juce::Graphics& g, juce::Rectangle<int> area, const juce::String& title) const
{
    auto panel = area.toFloat().reduced(1.0f);
    g.setColour(panelColour.withAlpha(0.96f));
    g.fillRoundedRectangle(panel, 16.0f);

    g.setColour(accent.withAlpha(0.14f));
    g.fillRoundedRectangle(panel.removeFromTop(30.0f), 16.0f);

    g.setColour(accent.withAlpha(0.75f));
    g.drawRoundedRectangle(area.toFloat().reduced(1.0f), 16.0f, 1.0f);

    g.setColour(textColour);
    g.setFont(juce::Font(15.0f, juce::Font::bold));
    g.drawText(title, area.removeFromTop(28).reduced(14, 2), juce::Justification::centredLeft, false);

    g.setColour(accentSoft.withAlpha(0.35f));
    g.fillRect(area.removeFromTop(1).reduced(12, 0));
}

void KickSynthEditor::paint(juce::Graphics& g)
{
    g.fillAll(bgColour);

    juce::ColourGradient backGlow(accent.withAlpha(0.12f), 70.0f, 35.0f, bgColour, static_cast<float>(getWidth()), static_cast<float>(getHeight()), false);
    g.setGradientFill(backGlow);
    g.fillAll();

    auto outer = getLocalBounds().reduced(14);
    auto body = outer.withTrimmedTop(54 + 126);

    auto pitchArea = body.removeFromLeft(220);
    auto ampArea = body.removeFromLeft(200);
    auto charArea = body;

    paintSection(g, pitchArea.reduced(0, 6), "PITCH");
    paintSection(g, ampArea.reduced(0, 6), "AMPLITUDE");
    paintSection(g, charArea.reduced(0, 6), "CHARACTER");

    auto footer = getLocalBounds().reduced(14).removeFromBottom(68);
    g.setColour(panelColour.withAlpha(0.97f));
    g.fillRoundedRectangle(footer.toFloat(), 16.0f);
    g.setColour(accent.withAlpha(0.7f));
    g.drawRoundedRectangle(footer.toFloat(), 16.0f, 1.0f);

    g.setColour(textColour.withAlpha(0.78f));
    g.setFont(juce::Font(13.0f, juce::Font::bold));
    g.drawText("OUTPUT", footer.removeFromLeft(74), juce::Justification::centred, false);

    auto waveLabel = footer.removeFromRight(130);
    g.drawText("WAVEFORM", waveLabel.removeFromLeft(80), juce::Justification::centredRight, false);
}

void KickSynthEditor::resized()
{
    auto area = getLocalBounds().reduced(14);

    auto header = area.removeFromTop(48);
    titleLabel.setBounds(header.removeFromLeft(220));
    presetBox.setBounds(header.removeFromLeft(150).reduced(4, 6));
    savePreset.setBounds(header.removeFromLeft(84).reduced(4, 6));
    triggerBtn.setBounds(header.removeFromRight(132).reduced(4, 4));

    waveform.setBounds(area.removeFromTop(116));
    area.removeFromTop(8);
    auto footer = area.removeFromBottom(68);
    area.removeFromTop(4);

    auto pitchArea = area.removeFromLeft(220).reduced(0, 6);
    auto ampArea = area.removeFromLeft(200).reduced(0, 6);
    auto charArea = area.reduced(0, 6);

    auto layoutColumn = [] (juce::Rectangle<int> column, std::initializer_list<juce::Component*> comps)
    {
        column.removeFromTop(34);
        const auto count = static_cast<int>(comps.size());
        const auto slotHeight = count > 0 ? column.getHeight() / count : 0;
        int index = 0;
        for (auto* comp : comps)
        {
            auto slot = column.withTop(column.getY() + slotHeight * index).withHeight(index == count - 1 ? column.getBottom() - (column.getY() + slotHeight * index) : slotHeight);
            comp->setBounds(slot.reduced(8, 4));
            ++index;
        }
    };

    layoutColumn(pitchArea, { &startPitch, &endPitch, &pitchDecay, &pitchCurve });
    layoutColumn(ampArea, { &attack, &decay, &punch });
    layoutColumn(charArea, { &drive, &noise, &clickLevel });

    auto footerContent = footer.reduced(16, 10);
    subLevel.setBounds(footerContent.removeFromLeft(86));
    gain.setBounds(footerContent.removeFromLeft(86));
    footerContent.removeFromLeft(18);
    waveformBox.setBounds(footerContent.removeFromRight(122).reduced(0, 10));
}

