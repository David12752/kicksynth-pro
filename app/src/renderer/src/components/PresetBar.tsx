type PresetBarProps = {
  presets: Array<{ name: string }>
  activePreset: string
  onSelect: (name: string) => void
}

export default function PresetBar({ presets, activePreset, onSelect }: PresetBarProps) {
  return (
    <div className="preset-bar">
      {presets.map((preset) => (
        <button
          key={preset.name}
          className={`preset-chip ${activePreset === preset.name ? 'is-active' : ''}`}
          onClick={() => onSelect(preset.name)}
        >
          {preset.name}
        </button>
      ))}
    </div>
  )
}
