type ToggleProps = {
  label?: string
  value: boolean
  onChange: (value: boolean) => void
}

export default function Toggle({ label, value, onChange }: ToggleProps) {
  return (
    <button className={`toggle ${value ? 'is-active' : ''}`} onClick={() => onChange(!value)}>
      {label ? <span>{label}</span> : null}
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </button>
  )
}
