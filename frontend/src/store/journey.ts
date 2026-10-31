import { ORDER_LABEL, type Mode, type Patient } from '../data/clinic'
import { journeyFor } from '../data/journey'
import { scoreAssessment } from '../data/assessment'
import { useAssessment, useResult } from './assessment'
import { getMode, getMyDoctor, getMyRecord, useMode, useMyDoctor, useMyRecord } from './doctor'
import { hasScan, useTests } from './tests'

// The tests her doctor asked for, while she is linked and before the diagnosis.
export function orderedTests(mode: Mode, record: Patient | null): string[] {
  if (mode !== 'linked' || !record || !record.orders) return []
  return record.orders.tests.map((id) => ORDER_LABEL[id])
}

// Her journey (data/journey.ts) worked out from everything the app knows, for the screens...
export function useJourney() {
  const done = useAssessment((s) => s.done)
  const result = useResult()
  const mode = useMode()
  const record = useMyRecord()
  const doctor = useMyDoctor()
  const uploads = useTests((s) => s.uploads)
  const analyzed = useTests((s) => s.analyzed)
  return journeyFor({
    assessed: done,
    level: result.level,
    mode,
    doctorName: doctor ? doctor.name : null,
    uploads: Object.keys(uploads).length,
    hasScan: hasScan(uploads),
    analyzed: analyzed && hasScan(uploads),
    ordered: orderedTests(mode, record),
  })
}

// ...and for Wanas, outside React.
export function currentJourney() {
  const a = useAssessment.getState()
  const t = useTests.getState()
  const mode = getMode()
  const doctor = getMyDoctor()
  return journeyFor({
    assessed: a.done,
    level: scoreAssessment(a.age, a.chronic, a.answers).level,
    mode,
    doctorName: doctor ? doctor.name : null,
    uploads: Object.keys(t.uploads).length,
    hasScan: hasScan(t.uploads),
    analyzed: t.analyzed && hasScan(t.uploads),
    ordered: orderedTests(mode, getMyRecord()),
  })
}
