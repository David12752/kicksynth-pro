import { useCallback, useEffect, useRef, useState } from 'react'

type Option = { label: string; value: number }

type CustomSelectProps = {
  options: Option[]
  value: number
  onChange: (value: number) => void
  label?: string
  color?: string
}

export default function CustomSelect({ options, value, onChange, label, color = '#5B8DB8' }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selected = options.find((o) => o.value === value) ?? options[0]

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = useCallback((opt: Option) => {
    onChange(opt.value)
    setOpen(false)
  }, [onChange])

  return (
    <div className="customSelect" ref={rootRef} style={{ '--cs-color': color } as React.CSSProperties}>
      {label && <span className="customSelectLabel">{label}</span>}
      <button
        className={`customSelectTrigger${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="customSelectValue">{selected?.label ?? '—'}</span>
        <svg className="customSelectChevron" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="customSelectDropdown" role="listbox">
          {options.map((opt) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`customSelectOption${opt.value === value ? ' selected' : ''}`}
              onClick={() => handleSelect(opt)}
              type="button"
            >
              {opt.label}
              {opt.value === value && (
                <svg viewBox="0 0 10 8" fill="none" className="customSelectCheck">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
