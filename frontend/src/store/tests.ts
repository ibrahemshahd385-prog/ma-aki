import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TestId } from '../data/tests'
import type { LabResult, ScanResult } from '../lib/api'

export type Upload = {
  name: string // the file name
  size: number // in bytes
  type?: string // like "image/jpeg" or "application/pdf"
  thumb: string | null // a small preview picture, or null for PDF and DICOM files
  demo: boolean // a practice file from "جرّبي بملفات تجريبية"
  at: string // when it was added
}

// The real model's reading of her scans (from the server), with when it was made and whether the files were practice ones.
export type ScanReading = ScanResult & { at: string; demo: boolean }
// The blood test values read from her lab report, compared with the normal ranges.
export type LabReading = LabResult & { at: string; demo: boolean }

type TestsState = {
  uploads: Partial<Record<TestId, Upload>>
  analyzed: boolean // she pressed "حلّلي النتائج" and the model answered
  reading: ScanReading | null
  labs: LabReading | null
  add: (id: TestId, upload: Upload) => void
  addDemo: (demo: Partial<Record<TestId, Upload>>) => void
  remove: (id: TestId) => void
  setReading: (reading: ScanReading | null) => void
  setLabs: (labs: LabReading | null) => void
  restore: (uploads: Partial<Record<TestId, Upload>>, analyzed: boolean, reading?: ScanReading | null) => void
  setThumb: (id: TestId, thumb: string) => void
  reset: () => void
}

// What she uploaded: the file details and a small preview. The files themselves are kept in lib/files.ts
// (and in the database once it is added); store/uploads.ts does both.
export const useTests = create<TestsState>()(
  persist(
    (set) => ({
      uploads: {},
      analyzed: false,
      reading: null,
      labs: null,
      // A new file makes its old reading out of date.
      add: (id, upload) =>
        set((s) => ({
          uploads: { ...s.uploads, [id]: upload },
          ...(id === 'mammo' || id === 'us' ? { analyzed: false, reading: null } : {}),
          ...(id === 'lab' ? { labs: null } : {}),
        })),
      // Practice files for the empty boxes, so the journey can be tried without real scans (her own files stay).
      addDemo: (demo) => set((s) => ({ uploads: { ...demo, ...s.uploads }, analyzed: false, reading: null, labs: null })),
      remove: (id) =>
        set((s) => {
          const next = { ...s.uploads }
          delete next[id]
          return {
            uploads: next,
            ...(id === 'mammo' || id === 'us' ? { analyzed: false, reading: null } : {}),
            ...(id === 'lab' ? { labs: null } : {}),
          }
        }),
      setReading: (reading) => set({ reading, analyzed: !!reading }),
      setLabs: (labs) => set({ labs }),
      // After signing in again: what her file at the clinic says she uploaded.
      restore: (uploads, analyzed, reading = null) => set({ uploads, analyzed, reading }),
      setThumb: (id, thumb) =>
        set((s) => {
          const u = s.uploads[id]
          return u ? { uploads: { ...s.uploads, [id]: { ...u, thumb } } } : s
        }),
      reset: () => set({ uploads: {}, analyzed: false, reading: null, labs: null }),
    }),
    { name: 'maaki-tests' },
  ),
)

// A mammogram or an ultrasound: the scans the reading model looks at.
export const hasScan = (uploads: Partial<Record<TestId, Upload>>) => !!(uploads.mammo || uploads.us)
