import { useState } from 'react'
import { fmtDay, fmtDayShort } from '../lib/dates'

export type Point = { t: number; v: number } // t: time in ms, v: the value

type Props = {
  points: Point[]
  label: string // read by screen readers
  unit: string
  empty: string // shown when there are fewer than two points
  yMin?: number // the axis reaches at least these values
  yMax?: number
  refValue?: number // the red line (fever 38, CA 15-3 at 30)
  alarmAbove?: boolean // dots on or above the red line turn dark red
}

// Round numbers for the axis, about n steps between lo and hi.
function niceScale(lo: number, hi: number, n: number) {
  if (hi - lo < 1e-9) {
    lo -= 1
    hi += 1
  }
  const raw = (hi - lo) / n
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag
  const a = Math.floor(lo / step) * step
  const b = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Math.round(v * 100) / 100)
  return { lo: a, hi: b, ticks }
}

const W = 520
const H = 200
const L = 36
const R = 40
const T = 16
const B = 28
const fmtV = (v: number) => String(Math.round(v * 10) / 10)

// One series over time: a 2px line, ringed dots, a light grid, a red reference line, and a crosshair with the
// value when you point at it (or use the arrow keys).
export function LineChart({ points, label, unit, empty, yMin, yMax, refValue, alarmAbove = false }: Props) {
  const [hi, setHi] = useState<number | null>(null)
  const pts = points.filter((p) => isFinite(p.v) && isFinite(p.t)).sort((a, b) => a.t - b.t)
  if (pts.length < 2) return <div className="chart-empty">{empty}</div>

  const vals = pts.map((p) => p.v).concat(refValue != null ? [refValue] : [])
  let lo = Math.min(...vals)
  let top = Math.max(...vals)
  if (yMin != null) lo = Math.min(lo, yMin)
  if (yMax != null) top = Math.max(top, yMax)
  const sc = niceScale(lo, top, 4)
  const x0 = pts[0].t
  const x1 = pts[pts.length - 1].t
  const sx = (t: number) => L + ((t - x0) / (x1 - x0 || 1)) * (W - L - R)
  const sy = (v: number) => T + (1 - (v - sc.lo) / (sc.hi - sc.lo || 1)) * (H - T - B)
  const line = pts.map((p, i) => (i ? 'L' : 'M') + sx(p.t).toFixed(1) + ' ' + sy(p.v).toFixed(1)).join(' ')
  const hp = hi != null ? pts[Math.min(hi, pts.length - 1)] : null
  const last = pts[pts.length - 1]
  const mid = pts[Math.floor((pts.length - 1) / 2)]
  const xTicks = pts.length > 2 ? [pts[0], mid, last] : [pts[0], last]
  const alarm = (v: number) => alarmAbove && refValue != null && v >= refValue
  const dot = (v: number) => (alarm(v) ? '#A3123A' : '#E0177F')

  // The point nearest to the pointer.
  function pick(e: { clientX: number; currentTarget: { getBoundingClientRect: () => DOMRect } }) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / (r.width || 1)) * W
    let best = 0
    let bd = Infinity
    pts.forEach((p, i) => {
      const d = Math.abs(sx(p.t) - x)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    if (best !== hi) setHi(best)
  }

  function onKey(e: { key: string; preventDefault: () => void }) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const cur = hi == null ? pts.length - 1 : hi
    setHi(Math.max(0, Math.min(pts.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))))
  }

  const tipLeft = hp ? Math.max(12, Math.min(88, (sx(hp.t) / W) * 100)) : 0
  return (
    <div className="chart-box" dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerMove={pick}
        onPointerLeave={() => setHi(null)}
        onFocus={() => setHi(pts.length - 1)}
        onBlur={() => setHi(null)}
        onKeyDown={onKey}
      >
        {sc.ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="#F6DCE8" strokeWidth={1} />
            <text x={L - 6} y={sy(v) + 4} textAnchor="end" fontSize={11} fill="#7A4A60">
              {fmtV(v)}
            </text>
          </g>
        ))}
        {refValue != null && (
          <g>
            <line x1={L} x2={W - R} y1={sy(refValue)} y2={sy(refValue)} stroke="#A3123A" strokeWidth={1} />
            <text x={L + 4} y={sy(refValue) - 5} fontSize={11} fontWeight={700} fill="#A3123A">
              {fmtV(refValue)}
            </text>
          </g>
        )}
        {xTicks.map((p, i) => (
          <text key={i} x={sx(p.t)} y={H - 8} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} fontSize={11} fill="#7A4A60">
            {fmtDayShort(p.t)}
          </text>
        ))}
        <path d={line} fill="none" stroke="#E0177F" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={sx(p.t)} cy={sy(p.v)} r={4} fill={dot(p.v)} stroke="#FFFFFF" strokeWidth={2} />
        ))}
        <text x={sx(last.t) + 8} y={sy(last.v) + 4} fontSize={12} fontWeight={700} fill="#3A1027">
          {fmtV(last.v)}
        </text>
        {hp && <line x1={sx(hp.t)} x2={sx(hp.t)} y1={T} y2={H - B} stroke="#7A4A60" strokeWidth={1} />}
        {hp && <circle cx={sx(hp.t)} cy={sy(hp.v)} r={6} fill={dot(hp.v)} stroke="#FFFFFF" strokeWidth={2} />}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" />
      </svg>
      {hp && (
        <div className="chart-tip" style={{ left: tipLeft + '%' }}>
          <b>
            {fmtV(hp.v)} {unit}
          </b>
          <span>{fmtDay(hp.t)}</span>
        </div>
      )}
    </div>
  )
}
