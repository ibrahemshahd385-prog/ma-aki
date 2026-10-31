import { useEffect, useState } from 'react'
import type { SharedFile } from '../data/clinic'
import type { TestId } from '../data/tests'
import { fmtAgo } from '../lib/dates'
import { practiceFile } from '../lib/demoScans'
import { fileKey, getFile, sizeText } from '../lib/files'
import type { ScanSource } from './ScanViewer'

// Where a file comes from: the file store of this browser, or (for the practice patients) a practice picture.
export type ScanSpec = { pid: string; test: TestId; at: string; practice: boolean }

// Loads a file to show it. Gives null while loading, and 'missing' when the file isn't kept here
// (for example a file uploaded before the file store was added).
export function useScanSource(spec: ScanSpec | null): ScanSource | 'missing' | null {
  const id = spec ? `${spec.practice ? 'practice' : 'kept'}:${spec.pid}/${spec.test}@${spec.at}` : null
  const [loaded, setLoaded] = useState<{ id: string; value: ScanSource | 'missing' } | null>(null)

  useEffect(() => {
    if (!spec || !id) return
    let alive = true
    let url = ''
    const load = spec.practice
      ? practiceFile(spec.test, spec.pid).then((f) => ({ blob: f.blob, name: f.name, type: f.type }))
      : getFile(fileKey(spec.pid, spec.test), { at: spec.at }).then((f) =>
          f ? { blob: f.blob, name: f.name, type: f.type || f.blob.type } : null,
        )
    load
      .then((f) => {
        if (!alive) return
        if (!f) return setLoaded({ id, value: 'missing' })
        url = URL.createObjectURL(f.blob)
        setLoaded({ id, value: { url, type: f.type, name: f.name, size: f.blob.size } })
      })
      .catch(() => {
        if (alive) setLoaded({ id, value: 'missing' })
      })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
    // "id" stands for everything in spec, so it is the only thing to watch.
  }, [id])

  return loaded && loaded.id === id ? loaded.value : null
}

type TileProps = { label: string; file: SharedFile; spec: ScanSpec; onOpen: (source: ScanSource) => void }

// One file in the doctor's "الأشعة والملفات": a preview, what it is, its size and when it came.
export function ScanTile({ label, file, spec, onOpen }: TileProps) {
  const source = useScanSource(spec)
  const ready = source && source !== 'missing' ? source : null
  const isImage = (ready ? ready.type : file.type).startsWith('image/')
  const kind = file.type === 'application/pdf' ? 'PDF' : /\.dcm$/i.test(file.name) ? 'DICOM' : 'ملف'
  const size = ready ? ready.size : file.size

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => ready && onOpen(ready)}
      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border-[1.5px] border-brand-line bg-white text-right enabled:hover:border-brand"
    >
      <span className="relative flex h-32 w-full items-center justify-center bg-[#120A0F]">
        {ready && isImage ? (
          <img src={ready.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center text-sm font-extrabold text-white/85">
            {source === 'missing' ? 'الملف مش محفوظ' : ready ? kind : 'بيحمّل…'}
          </span>
        )}
        {file.demo && (
          <span className="absolute top-2 left-2 rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-extrabold text-white">تجريبي</span>
        )}
      </span>
      <span className="flex w-full min-w-0 flex-col gap-0.5 p-2.5">
        <b className="text-sm">{label}</b>
        <bdi className="truncate text-xs text-muted">{file.name}</bdi>
        <span className="text-xs text-muted">
          {size ? sizeText(size) : ''}
          {file.at ? (size ? ' · ' : '') + fmtAgo(Date.parse(file.at)) : ''}
        </span>
        {source === 'missing' && <span className="text-xs font-bold text-[#A3123A]">اطلبي من المريضة ترفعه تاني</span>}
      </span>
    </button>
  )
}
