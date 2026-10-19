import { useEffect, useMemo, useRef, useState } from 'react'

type KnobProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
  size?: number  // knob diameter in px, default 34
  defaultValue?: number  // double-click resets to this value
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export default function Knob({
  label,
  value,
  min,
  max,
  step = (max - min) / 160,
  onChange,
  formatValue,
  size = 34,
  defaultValue
}: KnobProps) {
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const startYRef = useRef(0)
  const startValueRef = useRef(value)

  const normalized = useMemo(() => clamp((value - min) / (max - min), 0, 1), [max, min, value])

  // Arc geometry — 270° sweep, starting at bottom-left
  const START_ANGLE = 135   // degrees from top (SVG convention)
  const SWEEP = 270
  const viewSize = 64
  const cx = 32
  const cy = 32
  const trackR = 26          // track arc radius
  const bodyR  = 20          // knob body radius
  const pointerInner = 6    // pointer starts near center
  const pointerOuter = 17   // pointer ends near body edge

  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180

  const polar = (deg: number, r: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg))
  })

  const arcPath = (fromDeg: number, toDeg: number, r: number) => {
    const s = polar(fromDeg, r)
    const e = polar(toDeg, r)
    const large = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const valueAngle = START_ANGLE + normalized * SWEEP
  const trackPath = arcPath(START_ANGLE, START_ANGLE + SWEEP, trackR)
  const fillPath  = normalized > 0 ? arcPath(START_ANGLE, valueAngle, trackR) : ''

  // Pointer tip
  const pTip = polar(valueAngle, pointerOuter)
  const pBase = polar(valueAngle, pointerInner)

  useEffect(() => {
    if (!dragging) return undefined

    const handleMove = (event: MouseEvent) => {
      const delta = startYRef.current - event.clientY
      const range = max - min
      const next = clamp(startValueRef.current + (delta / 140) * range, min, max)
      const snapped = Math.round(next / step) * step
      onChange(Number(clamp(snapped, min, max).toFixed(4)))
    }

    const handleUp = () => setDragging(false)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, max, min, onChange, step])

  const valueText = formatValue ? formatValue(value) : value.toFixed(max <= 10 ? 3 : 0)
  const sz = size ?? 34

  const gradId = `kg-${label.replace(/\W/g, '')}-${sz}`

  return (
    <div
      className={`knob ${dragging ? 'is-dragging' : ''} ${hovered ? 'is-hovered' : ''}`}
      style={{ '--ks': `${sz}px` } as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(event) => {
        if (event.detail === 2) {
          event.preventDefault()
          const resetTo = defaultValue !== undefined ? defaultValue : (min + max) / 2
          onChange(Number(clamp(resetTo, min, max).toFixed(4)))
          return
        }
        event.preventDefault()
        setDragging(true)
        startYRef.current = event.clientY
        startValueRef.current = value
      }}
    >
      <div className="knobVisual">
        <svg viewBox={`0 0 ${viewSize} ${viewSize}`} className="knobSvg" aria-hidden="true">
          <defs>
            {/* Radial gradient: lighter in center, darker at edge — machined metal look */}
            <radialGradient id={gradId} cx="36%" cy="32%" r="68%">
              <stop offset="0%"   stopColor="#565656" />
              <stop offset="30%"  stopColor="#353535" />
              <stop offset="70%"  stopColor="#212121" />
              <stop offset="100%" stopColor="#111111" />
            </radialGradient>
            {/* Shadow ring filter */}
            <filter id={`${gradId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.7" />
            </filter>
          </defs>

          {/* ── Depth shadow circle behind knob ── */}
          <circle cx={cx} cy={cy} r={bodyR + 3} fill="rgba(0,0,0,0.55)" />

          {/* ── Track arc (full range, dark) ── */}
          <path
            d={trackPath}
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Track highlight (subtle inner glow) */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* ── Value arc (accent color) ── */}
          {fillPath && (
            <path
              d={fillPath}
              fill="none"
              stroke={dragging ? '#9ec4e8' : hovered ? '#7aadd4' : '#5B8DB8'}
              strokeWidth="3.5"
              strokeLinecap="round"
              style={{ filter: dragging ? 'drop-shadow(0 0 2px rgba(91,141,184,0.6))' : hovered ? 'drop-shadow(0 0 1.5px rgba(91,141,184,0.4))' : 'none', transition: 'stroke 100ms' }}
            />
          )}

          {/* ── Knob body (metallic radial gradient) ── */}
          <circle
            cx={cx} cy={cy} r={bodyR}
            fill={`url(#${gradId})`}
            filter={`url(#${gradId}-shadow)`}
          />

          {/* ── Edge highlight (top-left rim shine) ── */}
          <circle
            cx={cx} cy={cy} r={bodyR}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1"
          />
          {/* Inner specular ring — machined bevel catch-light */}
          <circle
            cx={cx - 1} cy={cy - 1} r={bodyR - 3}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1.5"
          />
          {/* Bottom-right shadow rim */}
          <circle
            cx={cx} cy={cy} r={bodyR - 0.5}
            fill="none"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth="0.8"
          />

          {/* ── Pointer line (center → edge) ── */}
          <line
            x1={pBase.x} y1={pBase.y}
            x2={pTip.x}  y2={pTip.y}
            stroke={dragging ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.85)'}
            strokeWidth={dragging ? 2.2 : 1.8}
            strokeLinecap="round"
            style={{ transition: 'stroke 100ms, stroke-width 100ms' }}
          />

          {/* ── Pointer dot at tip ── */}
          <circle
            cx={pTip.x} cy={pTip.y} r="2"
            fill={dragging ? '#fff' : 'rgba(255,255,255,0.88)'}
          />

          {/* ── Center dot (depth) ── */}
          <circle cx={cx} cy={cy} r="2.5" fill="rgba(0,0,0,0.5)" />
          <circle cx={cx} cy={cy} r="1.2" fill="rgba(255,255,255,0.18)" />
        </svg>
      </div>
      <div className="knobCaption">
        <div className="knobLabel">{label}</div>
        <div className="knobReadout">{valueText}</div>
      </div>
    </div>
  )
}
