import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { sizeText } from '../lib/files'
import { Icon } from './Icon'

// A file ready to show: a link to it in this browser, and what it is.
export type ScanSource = { url: string; type: string; name: string; size: number }

type Props = { title: string; source: ScanSource; demo?: boolean; onClose: () => void }

const TOOL = 'flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/20 px-3 text-sm font-bold text-white hover:bg-white/10'

// The full-screen viewer for a scan or a report. Pictures can be zoomed (wheel, pinch, + and −), moved (drag or
// arrows), made brighter, given more contrast, or inverted (white on black ↔ black on white), the way radiology
// viewers do. A PDF opens inside; any other file (like DICOM) can be downloaded.
export function ScanViewer({ title, source, demo = false, onClose }: Props) {
  const isImage = source.type.startsWith('image/')
  const isPdf = source.type === 'application/pdf'
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [light, setLight] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [invert, setInvert] = useState(false)
  const [dragging, setDragging] = useState(false)
  const closeButton = useRef<HTMLButtonElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)

  // While open: the focus is inside and the page behind doesn't scroll. On close the focus goes back.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButton.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      before?.focus()
    }
  }, [])

  const fit = (z: number) => Math.min(8, Math.max(0.5, z))
  const zoomBy = (f: number) => setZoom((z) => fit(z * f))
  function reset() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setLight(100)
    setContrast(100)
    setInvert(false)
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    // Keys inside the sliders move the sliders, not the picture.
    if (!isImage || e.target instanceof HTMLInputElement) return
    const step = 40
    if (e.key === '+' || e.key === '=') zoomBy(1.25)
    else if (e.key === '-') zoomBy(0.8)
    else if (e.key === '0') reset()
    else if (e.key === 'i' || e.key === 'I') setInvert((v) => !v)
    else if (e.key === 'ArrowLeft') setPan((p) => ({ ...p, x: p.x - step }))
    else if (e.key === 'ArrowRight') setPan((p) => ({ ...p, x: p.x + step }))
    else if (e.key === 'ArrowUp') setPan((p) => ({ ...p, y: p.y - step }))
    else if (e.key === 'ArrowDown') setPan((p) => ({ ...p, y: p.y + step }))
    else return
    e.preventDefault()
  }

  // Drag with one finger or the mouse to move; pinch with two fingers to zoom.
  function down(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setDragging(true)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom }
    }
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const before = pointers.current.get(e.pointerId)
    if (!before) return
    const now = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, now)
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      setZoom(fit((pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist))
      return
    }
    setPan((p) => ({ x: p.x + now.x - before.x, y: p.y + now.y - before.y }))
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) setDragging(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-title"
      dir="rtl"
      onKeyDown={onKey}
      className="fixed inset-0 z-50 flex flex-col bg-[#120A0F] text-white"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 id="scan-title" className="truncate text-base font-extrabold">
            {title}
            {demo && <span className="ms-2 rounded-md bg-brand px-1.5 py-0.5 align-middle text-[11px] font-extrabold">ملف تجريبي</span>}
          </h2>
          <p className="truncate text-xs text-white/60">
            <bdi>{source.name}</bdi> · {sizeText(source.size)}
          </p>
        </div>
        <a href={source.url} download={source.name} className={TOOL}>
          تنزيل
        </a>
        <a href={source.url} target="_blank" rel="noreferrer" className={TOOL}>
          فتح في تاب جديد
        </a>
        <button ref={closeButton} type="button" aria-label="إغلاق" onClick={onClose} className={TOOL + ' w-11 px-0'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {isImage ? (
        <>
          <div
            className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden select-none"
            style={{ cursor: dragging ? 'grabbing' : 'grab' }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
            onDoubleClick={() => zoomBy(2)}
          >
            <img
              src={source.url}
              alt={title}
              draggable={false}
              className="max-h-full max-w-full"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                filter: `brightness(${light}%) contrast(${contrast}%) invert(${invert ? 1 : 0})`,
                transition: dragging ? 'none' : 'transform 120ms ease-out',
              }}
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 px-4 py-3">
            <button type="button" aria-label="تكبير" onClick={() => zoomBy(1.25)} className={TOOL + ' w-11 px-0 text-xl'}>
              +
            </button>
            <button type="button" aria-label="تصغير" onClick={() => zoomBy(0.8)} className={TOOL + ' w-11 px-0 text-xl'}>
              −
            </button>
            <span className="min-w-12 text-center text-sm font-bold tabular-nums" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <button type="button" aria-pressed={invert} onClick={() => setInvert((v) => !v)} className={TOOL + (invert ? ' bg-white/15' : '')}>
              عكس الألوان
            </button>
            <label className="flex items-center gap-2 text-sm font-bold">
              الإضاءة
              <input type="range" min={40} max={200} value={light} onChange={(e) => setLight(Number(e.target.value))} className="w-28" />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              التباين
              <input type="range" min={40} max={250} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-28" />
            </label>
            <button type="button" onClick={reset} className={TOOL}>
              <Icon name="prev" size={18} color="#FFFFFF" />
              زي الأول
            </button>
            <p className="w-full text-xs text-white/55">
              اسحبي الصورة علشان تحرّكيها، وكبّري بالعجلة أو بصباعين أو بـ + و −. وEsc للخروج.
            </p>
          </div>
        </>
      ) : isPdf ? (
        <iframe title={title} src={source.url} className="min-h-0 flex-1 border-0 bg-white" />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-lg font-extrabold">الملف ده مش صورة ولا PDF</p>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            لو ده ملف أشعة DICOM، هيتفتح في عارض أشعة مخصوص هنضيفه مع قاعدة البيانات. دلوقتي تقدري تنزّليه وتفتحيه في برنامج الأشعة اللي عندك.
          </p>
          <a href={source.url} download={source.name} className={TOOL}>
            تنزيل الملف
          </a>
        </div>
      )}
    </div>
  )
}
