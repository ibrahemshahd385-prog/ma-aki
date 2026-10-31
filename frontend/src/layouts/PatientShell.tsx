import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { Toast } from '../components/Toast'
import { modeOf, ORDER_LABEL, type Mode } from '../data/clinic'
import { checkMedDoses, startMedReminderService } from '../lib/medReminders'
import { useAssessment } from '../store/assessment'
import { fromOtherTab, loadAll, subscribeRealtime, useClinic } from '../store/clinic'
import { getMine, getMyDoctor, getMyRecord, syncMyRecord, useMode, useMyRecord } from '../store/doctor'
import { useNotifications } from '../store/notifications'
import { useTests } from '../store/tests'
import { toast } from '../store/toast'
import { fillFromRecord, restoreMyFile, restoreUploads } from '../store/uploads'

// What the app last saw in her file.
type Seen = { mode: Mode; ordersAt: string | null; doctorMessages: Set<string>; medsCount: number }

function look(): Seen {
  const p = getMyRecord()
  return {
    mode: modeOf(p),
    ordersAt: p && p.orders ? p.orders.at : null,
    doctorMessages: new Set(getMine('messages').filter((m) => m.from === 'doctor').map((m) => m.id)),
    medsCount: p?.meds?.length || 0,
  }
}

// The doctor changed something in her file: a short message on the screen, and a note under the bell.
function announce(before: Seen, after: Seen) {
  const dn = getMyDoctor()?.name || 'طبيبك'
  const notify = useNotifications.getState().add

  if (before.mode !== after.mode) {
    if (before.mode === 'pending' && after.mode === 'linked') {
      toast(dn + ': اتقبل طلب الربط')
      notify('اتقبل طلب الربط', `حسابك مربوط دلوقتي مع ${dn}، وأي فحص ترفعيه هيوصل على طول.`)
    } else if (after.mode === 'follow') {
      toast('اتأكد التشخيص، وخطة علاجك نزلت في «متابعتي»')
      notify('خطة علاجك جاهزة', 'التشخيص اتأكد، وخطة علاجك نزلت في «متابعتي». ونس معاكِ لو عندك أي سؤال.')
    } else if (after.mode === 'routine') {
      toast('نتايجك اتراجعت: نتيجتك مطمّنة')
      notify('نتيجتك مطمّنة', 'نتايجك اتراجعت. كمّلي الفحص الذاتي كل شهر، والفحص الدوري حسب طبيبك.')
    } else if (after.mode === 'pre') {
      const declined = before.mode === 'pending'
      toast(declined ? 'طلب الربط ما اتقبلش' : 'الربط اتلغى')
      notify(
        declined ? 'طلب الربط ما اتقبلش' : 'الربط اتلغى',
        declined ? 'اتأكدي من الكود مع العيادة، وابعتي الطلب تاني.' : 'حسابك مش مربوط بطبيب دلوقتي.',
      )
    }
  } else if (after.mode === 'linked' && after.ordersAt && after.ordersAt !== before.ordersAt) {
    const tests = getMyRecord()?.orders?.tests.map((id) => ORDER_LABEL[id]) ?? []
    toast('طلب فحوصات جديد من ' + dn)
    notify('طلب فحوصات من ' + dn, `الفحوصات المطلوبة: ${tests.join('، ')}. اعمليها وارفعيها من تاب «الفحوصات».`)
  }

  // Doctor added or changed medications
  if (after.medsCount > before.medsCount) {
    const p = getMyRecord()
    const lastMed = p?.meds?.[p.meds.length - 1]
    const name = lastMed ? lastMed.name : 'دواء جديد'
    toast(`طبيبك أضاف علاج جديد لخطتك: ${name}`)
    notify('أدوية جديدة في خطتك 💊', `طبيبك أضاف ${name} لخطة علاجك. تفقّدي مواعيد الجرعات في «متابعتي».`)
    checkMedDoses()
  }

  const messages = useClinic.getState().messages
  for (const id of after.doctorMessages) {
    if (before.doctorMessages.has(id) || !messages[id]) continue
    const text = messages[id].text
    notify('رسالة من ' + dn, text.length > 90 ? text.slice(0, 90) + '…' : text)
  }
}

// Everything under the patient's screens: keeps her file at the clinic up to date, tells her about the
// doctor's changes, and shows the short messages.
export function PatientShell() {
  // Watch her file for the doctor's changes (they come from the doctor's tab).
  useEffect(() => {
    loadAll()
    const unsubRealtime = subscribeRealtime()
    const stopMedReminders = startMedReminderService()

    // Her file comes back from the clinic (her name, answers and uploads, from any phone). Until it does, nothing from
    // this phone is sent to her file. When the server can't be reached, it tries again every 5 seconds.
    let stopped = false
    let retry: number | undefined
    const restore = async () => {
      const ok = await restoreMyFile()
      if (!ok && !stopped) retry = window.setTimeout(restore, 5000)
    }
    restore()

    let seen = look()
    const unsubClinic = useClinic.subscribe(() => {
      const now = look()
      if (fromOtherTab()) announce(seen, now)
      seen = now
      checkMedDoses()
    })

    return () => {
      stopped = true
      window.clearTimeout(retry)
      stopMedReminders()
      unsubRealtime()
      unsubClinic()
    }
  }, [])

  // Her file changed at the clinic: what this app doesn't have yet is filled in from it.
  const myRecord = useMyRecord()
  useEffect(() => {
    if (!myRecord) return
    fillFromRecord(myRecord, false)
    restoreUploads()
  }, [myRecord])

  // Send the doctor what changed in her app (the assessment, an upload, the scan reading).
  const assessment = useAssessment()
  const uploads = useTests((s) => s.uploads)
  const analyzed = useTests((s) => s.analyzed)
  const mode = useMode()
  useEffect(() => {
    syncMyRecord()
  }, [assessment, uploads, analyzed, mode])

  return (
    <>
      <Outlet />
      <Toast />
    </>
  )
}
