import { useEffect, useMemo, useState } from 'react'
import { clinicFetch } from '../lib/api'
import { Icon, Ribbon } from '../components/Icon'
import { LangToggle } from '../components/LangToggle'
import { dxShort, priority, type Alert, type Doctor, type Patient, type Priority, type Records } from '../data/clinic'
import { fmtAgo, hoursText, tOf } from '../lib/dates'
import { doctorIdOf, useAuth } from '../store/auth'
import { listOf, loadAll, loadSavedDoctors, saveDoctorLocally, subscribeRealtime, useClinic } from '../store/clinic'
import {
  accept,
  decline,
  DOC_ID,
  generateUniqueDoctorCode,
  getCurrentDoctor,
  logOpen,
  resetDemo,
  saveDoctorProfile,
  sendDoctorToServer,
} from '../store/dashboard'
import { useToast } from '../store/toast'
import { PatientFile } from './PatientFile'

// A button that copies a text and says so for a moment.
function CopyButton({ text }: { text: string }) {
  const [label, setLabel] = useState('نسخ')
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setLabel('اتنسخ')
    } catch {
      setLabel('حدّديه وانسخيه')
    }
    window.setTimeout(() => setLabel('نسخ'), 1500)
  }
  return (
    <button type="button" className="mbtn" style={{ minHeight: 36 }} onClick={copy}>
      {label}
    </button>
  )
}

function Pill({ tone, children }: { tone: 'red' | 'yellow' | 'green'; children: string }) {
  return (
    <span className={'pill ' + tone}>
      <i aria-hidden="true" />
      {children}
    </span>
  )
}

function PatientRow({ p, pr, on, onOpen }: { p: Patient; pr: Priority; on: boolean; onOpen: () => void }) {
  return (
    <button type="button" className={'prow' + (on ? ' on' : '')} aria-current={on ? 'true' : undefined} onClick={onOpen}>
      <span className="avatar-i" aria-hidden="true">
        {(p.name || '؟').trim().charAt(0)}
      </span>
      <span className="prow-main">
        <span className="prow-top">
          <b>{p.name}</b>
          {p.age ? <span className="muted12">{p.age} سنة</span> : null}
          {!p.demo && <span className="tag-live">من العرض</span>}
        </span>
        <span className="prow-sub">{dxShort(p)}</span>
        <Pill tone={pr.tone}>{pr.word}</Pill>
        <span className="prow-reason">{pr.reason}</span>
      </span>
      {pr.unread > 0 && (
        <span className="badge" aria-label={pr.unread + ' رسالة جديدة'}>
          {pr.unread}
        </span>
      )}
    </button>
  )
}

function AlertRow({ a, p, onOpen }: { a: Alert; p: Patient | undefined; onOpen: () => void }) {
  return (
    <button type="button" className="prow" onClick={onOpen}>
      <Pill tone={a.severity === 'red' ? 'red' : 'yellow'}>{a.severity === 'red' ? 'عاجل' : 'مراجعة'}</Pill>
      <span className="prow-main">
        <b>{p ? p.name : ''}</b>
        <span className="prow-sub">{a.text}</span>
        <span className="prow-reason">
          {fmtAgo(tOf(a))}
          {a.by === 'ai' ? ' · رصده الذكاء الاصطناعي' : ''}
        </span>
      </span>
    </button>
  )
}

// The doctor's onboarding/setup screen when registering for the first time
function DoctorProfileSetup({
  userEmail,
  onLogout,
}: {
  userEmail?: string
  onLogout: () => void
}) {
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState('جراحة وأورام الثدي')
  const [hospital, setHospital] = useState('')
  const [code, setCode] = useState(() => generateUniqueDoctorCode())
  const [phone, setPhone] = useState('')
  const [syndicateNo, setSyndicateNo] = useState('')
  const [fromHour, setFromHour] = useState(10)
  const [toHour, setToHour] = useState(16)
  const [error, setError] = useState('')
  // Is he new? The server knows: "new" only when it answers that it has no doctor with this email.
  const [check, setCheck] = useState<'checking' | 'new' | 'offline'>(userEmail ? 'checking' : 'new')
  const [attempt, setAttempt] = useState(0)

  const SUGGESTED_SPECIALTIES = [
    'جراحة وأورام الثدي',
    'طب الأورام والعلاج الكيميائي',
    'علاج الأورام بالإشعاع',
    'أشعة تشخيصية وتصوير الثدي',
    'جراحة عامة وجراحة أورام',
  ]

  // توليد كود فريد من السيرفر المركزي: the server knows every doctor's code, so the code it gives is nobody else's
  const [saving, setSaving] = useState(false)
  async function newCode() {
    try {
      const res = await clinicFetch('/api/clinic/doctors/generate-code')
      const data = res.ok ? await res.json() : null
      if (data?.code) {
        setCode(data.code)
        return
      }
    } catch {
      // no server: a code nobody on this computer has
    }
    setCode(generateUniqueDoctorCode())
  }
  useEffect(() => {
    newCode()
  }, [])

  // فحص هل الطبيب مسجل مسبقاً بهذا الإيميل على السيرفر المركزي أو محلياً
  useEffect(() => {
    if (!userEmail) return
    const cleanEmail = userEmail.toLowerCase().trim()
    let alive = true
    const show = (doc: Doctor) => {
      useClinic.setState((s) => ({ doctors: { ...s.doctors, [doc.id]: doc } }))
      saveDoctorLocally(doc)
    }
    // A profile kept on this computer, from before
    const kept = (): Doctor | null => {
      try {
        const raw = localStorage.getItem('maaki_doctor_email_' + cleanEmail)
        const parsed = raw ? (JSON.parse(raw) as Doctor) : null
        if (parsed?.name && parsed?.code) return parsed
        const found = Object.values(loadSavedDoctors()).find((d) => d.email && d.email.toLowerCase().trim() === cleanEmail)
        return found?.name && found?.code ? found : null
      } catch {
        return null
      }
    }
    setCheck('checking')
    clinicFetch(`/api/clinic/doctors/by-email/${encodeURIComponent(cleanEmail)}`)
      .then(async (res) => {
        if (!alive) return
        if (res.ok) {
          const doc = await res.json()
          if (doc?.id && doc?.code) show(doc)
          else setCheck('new')
          return
        }
        if (res.status !== 404) throw new Error(String(res.status))
        // The server has no profile for him. One kept on this computer goes to the server; otherwise he is new.
        const local = kept()
        if (local) {
          show(local)
          sendDoctorToServer(local)
        } else setCheck('new')
      })
      .catch(() => {
        if (!alive) return
        // No server: the copy on this computer if there is one, otherwise "try again" (never the new-doctor form)
        const local = kept()
        if (local) show(local)
        else setCheck('offline')
      })
    return () => {
      alive = false
    }
  }, [userEmail, attempt])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (!name.trim()) {
      setError('من فضلك اكتب اسمك مع اللقب (مثال: د. أحمد كمال)')
      return
    }
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) {
      setError('استنى ثانية لحد ما كود الربط يظهر.')
      return
    }

    // The code must be nobody else's: first the doctors this app knows, then the server, which knows them all
    const mine = (userEmail || '').toLowerCase().trim()
    const taken = () => {
      setError('الكود ده اتاخد لطبيب تاني، فطلعنالك كود جديد. اضغط «حفظ» تاني.')
      newCode()
    }
    const existing = Object.values(useClinic.getState().doctors).find(
      (d) =>
        d.code.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanCode.replace(/[^A-Z0-9]/g, '') &&
        d.email?.toLowerCase().trim() !== mine,
    )
    if (existing) {
      taken()
      return
    }
    setSaving(true)
    try {
      const res = await clinicFetch(`/api/clinic/doctors/${encodeURIComponent(cleanCode)}`)
      if (res.ok) {
        const holder = await res.json()
        if (holder?.id && (holder.email || '').toLowerCase().trim() !== mine) {
          taken()
          return
        }
      }
    } catch {
      // no server: the check above is all we can do
    } finally {
      setSaving(false)
    }

    saveDoctorProfile({
      name: name.trim(),
      specialty: specialty.trim() || 'جراحة وأورام الثدي',
      hospital: hospital.trim() || 'عيادة خاصة',
      code: cleanCode,
      hours: { from: fromHour, to: toHour },
      phone: phone.trim(),
      syndicateNo: syndicateNo.trim(),
      email: userEmail,
    })
  }

  if (check === 'checking') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-neutral-50 p-6 text-center" dir="rtl">
        <div className="size-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        <div className="text-[16px] font-bold text-ink">جاري استرجاع بيانات الطبيب وكود الربط...</div>
      </div>
    )
  }

  if (check === 'offline') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-neutral-50 p-6 text-center" dir="rtl">
        <div className="text-[16px] font-bold text-ink">مش قادرين نوصل للسيرفر علشان نجيب بيانات حسابك.</div>
        <p className="text-sm text-muted">اتأكد إن السيرفر شغال، وجرّب تاني.</p>
        <div className="flex gap-2">
          <button type="button" className="pbtn" onClick={() => setAttempt((n) => n + 1)}>
            جرّب تاني
          </button>
          <button type="button" className="soft-btn" onClick={onLogout}>
            تسجيل خروج
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dd min-h-dvh flex flex-col justify-center items-center py-10 px-4" dir="rtl">
      <div className="dcard w-full max-w-[560px] p-6 shadow-xl border border-brand-line">
        <div className="flex items-center justify-between border-b border-brand-line pb-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="dd-brand-ico">
              <Ribbon />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#E0177F', lineHeight: 1.2 }}>معاكِ</div>
              <div className="muted12">إعداد حساب الطبيب الجديد</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle short />
            <button type="button" className="soft-btn text-xs" onClick={onLogout}>
              تسجيل خروج
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-xl font-extrabold text-ink mb-1">أهلاً بحضرتك دكتور 🩺</h1>
          <p className="body15 text-muted mb-4">
            استكمل بيانات ملفك المهني للحصول على كود الربط الخاص بك وبدء استقبال مريضاتك ومتابعتهن.
            {userEmail && <span className="block text-xs text-brand font-semibold mt-1">البريد: {userEmail}</span>}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <label className="fl">
            الاسم واللقب *
            <input
              className="inp"
              type="text"
              required
              placeholder="مثال: د. أحمد كمال"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
            />
          </label>

          <label className="fl">
            التخصص الدقيق
            <input
              className="inp mb-1.5"
              type="text"
              placeholder="مثال: جراحة وأورام الثدي"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
            <div className="tglrow">
              {SUGGESTED_SPECIALTIES.map((spec) => (
                <button
                  key={spec}
                  type="button"
                  className={'tgl text-xs py-1 px-2.5 min-h-8' + (specialty === spec ? ' on' : '')}
                  aria-pressed={specialty === spec}
                  onClick={() => setSpecialty(spec)}
                >
                  {spec}
                </button>
              ))}
            </div>
          </label>

          <div className="form-grid">
            <label className="fl">
              المستشفى / العيادة
              <input
                className="inp"
                type="text"
                placeholder="مثال: مستشفى بهية / عيادة خاصة"
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
              />
            </label>
            <label className="fl">
              رقم القيد بالنقابة (اختياري)
              <input
                className="inp"
                dir="ltr"
                type="text"
                placeholder="مثال: 148290"
                value={syndicateNo}
                onChange={(e) => setSyndicateNo(e.target.value)}
              />
            </label>
          </div>

          <label className="fl">
            رقم هاتف التواصل للمريضات (واتساب/موبايل)
            <input
              className="inp"
              dir="ltr"
              type="tel"
              placeholder="مثال: 01012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <div className="form-grid">
            <label className="fl">
              ساعات الرد على الرسائل (من)
              <input
                className="inp"
                type="number"
                min={0}
                max={23}
                value={fromHour}
                onChange={(e) => setFromHour(Number(e.target.value))}
              />
            </label>
            <label className="fl">
              ساعات الرد على الرسائل (إلى)
              <input
                className="inp"
                type="number"
                min={0}
                max={23}
                value={toHour}
                onChange={(e) => setToHour(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="rounded-2xl border-2 border-dashed border-brand bg-[#FFF5FA] p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-brand">كود الربط الطبي الخاص بك:</span>
              <button
                type="button"
                className="soft-btn text-xs font-bold"
                onClick={() => {
                  setError('')
                  newCode()
                }}
              >
                🔄 توليد كود آخر
              </button>
            </div>
            <input
              className="inp text-center font-extrabold text-xl tracking-widest text-brand bg-white"
              dir="ltr"
              readOnly
              aria-readonly="true"
              value={code}
            />
            <p className="text-xs text-muted leading-relaxed">
              ده الكود بتاعك لوحدك، ومفيش أي طبيب تاني عنده نفس الكود. اطبعه أو اديه لمريضاتك في العيادة، يكتبوه في
              التطبيق علشان ملفهم يتربط بيك.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm font-bold text-brand-deep">
              {error}
            </p>
          )}

          <button type="submit" className="pbtn w-full mt-2" style={{ minHeight: 48, fontSize: 16 }} disabled={saving}>
            {saving ? 'بنتأكد من الكود…' : 'حفظ وتفعيل الحساب الطبي 🩺'}
          </button>
        </form>
      </div>
    </div>
  )
}

// The doctor's account: the link code, the phone number patients see, editing profile, and restarting the demo.
function AccountCard({ doctor }: { doctor: Doctor }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(doctor.name)
  const [specialty, setSpecialty] = useState(doctor.specialty)
  const [hospital, setHospital] = useState(doctor.hospital)
  const [phone, setPhone] = useState(doctor.phone || '')
  const [syndicateNo, setSyndicateNo] = useState(doctor.syndicateNo || '')
  const [fromHour, setFromHour] = useState(doctor.hours?.from ?? 10)
  const [toHour, setToHour] = useState(doctor.hours?.to ?? 16)
  const [askReset, setAskReset] = useState(false)

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    saveDoctorProfile({
      id: doctor.id,
      name,
      specialty,
      hospital,
      phone,
      syndicateNo,
      hours: { from: fromHour, to: toHour },
      code: doctor.code, // the code stays: his patients and the printed QR already have it
      email: doctor.email,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="dcard border border-brand-line">
        <h2>تعديل البيانات المهنية</h2>
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
          <label className="fl">
            الاسم
            <input className="inp" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <div className="form-grid">
            <label className="fl">
              التخصص
              <input className="inp" type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
            </label>
            <label className="fl">
              المستشفى / العيادة
              <input className="inp" type="text" value={hospital} onChange={(e) => setHospital(e.target.value)} />
            </label>
          </div>
          <div className="form-grid">
            <label className="fl">
              رقم التواصل
              <input className="inp" dir="ltr" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="fl">
              رقم القيد بالنقابة
              <input className="inp" dir="ltr" type="text" value={syndicateNo} onChange={(e) => setSyndicateNo(e.target.value)} />
            </label>
          </div>
          <div className="form-grid">
            <label className="fl">
              ساعات الرد (من)
              <input className="inp" type="number" min={0} max={23} value={fromHour} onChange={(e) => setFromHour(Number(e.target.value))} />
            </label>
            <label className="fl">
              ساعات الرد (إلى)
              <input className="inp" type="number" min={0} max={23} value={toHour} onChange={(e) => setToHour(Number(e.target.value))} />
            </label>
          </div>
          <div className="muted14">
            كود الربط <b dir="ltr">{doctor.code}</b> ثابت، ومش بيتكرر لأي طبيب تاني.
          </div>
          <div className="row-btns pt-2">
            <button type="submit" className="pbtn">
              حفظ التعديلات
            </button>
            <button type="button" className="soft-btn" onClick={() => setEditing(false)}>
              إلغاء
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="dcard">
      <div className="flex items-center justify-between">
        <h2>حسابي</h2>
        <button type="button" className="soft-btn text-xs font-bold" onClick={() => setEditing(true)}>
          ✏️ تعديل الملف
        </button>
      </div>
      <div className="muted14 font-bold">{[doctor.name, doctor.specialty, doctor.hospital].filter(Boolean).join(' · ')}</div>
      {doctor.syndicateNo && <div className="muted12">رقم القيد بالنقابة: <span dir="ltr">{doctor.syndicateNo}</span></div>}
      <div className="muted14">
        كود الربط <b dir="ltr">{doctor.code}</b>: بيتطبع QR في العيادة، والمريضة بتكتبه في تاب «الدكتور».
      </div>
      <div className="muted14">الرد على الرسائل {hoursText(doctor.hours)}</div>
      {doctor.phone && (
        <div className="muted14">
          رقم التواصل: <span dir="ltr" className="font-bold">{doctor.phone}</span>
        </div>
      )}

      {doctor.demo && (
        <>
          <h3>للعرض التجريبي</h3>
          {askReset ? (
            <div className="row-btns">
              <button
                type="button"
                className="mbtn"
                onClick={() => {
                  resetDemo()
                  setAskReset(false)
                }}
              >
                أيوه، امسحيها
              </button>
              <button type="button" className="soft-btn" onClick={() => setAskReset(false)}>
                رجوع
              </button>
            </div>
          ) : (
            <button type="button" className="soft-btn" onClick={() => setAskReset(true)}>
              ابدئي العرض من الأول
            </button>
          )}
          <div className="muted12">بيمسح المريضة اللي ربطت حسابها في العرض، والمريضات التجريبيات بيفضلوا.</div>
        </>
      )}
    </div>
  )
}

// The doctor's dashboard uses the whole screen: the list of patients (sorted by who needs attention today)
// beside the open patient's file. On a narrow screen it shows one of the two at a time.
export function DoctorDashboard() {
  const logout = useAuth((s) => s.logout)
  const user = useAuth((s) => s.user)
  const doctors = useClinic((s) => s.doctors)
  const currentDocId = doctorIdOf(user) || DOC_ID
  const doctor = useMemo(() => {
    if (doctors[currentDocId]) return doctors[currentDocId]
    if (user?.email) {
      const cleanEmail = user.email.toLowerCase().trim()
      const byEmail = Object.values(doctors).find((d) => d.email && d.email.toLowerCase().trim() === cleanEmail)
      if (byEmail) return byEmail

      try {
        const raw = localStorage.getItem('maaki_doctor_email_' + cleanEmail)
        if (raw) {
          const parsed = JSON.parse(raw) as Doctor
          if (parsed?.id) {
            useClinic.setState((s) => ({ doctors: { ...s.doctors, [parsed.id]: parsed } }))
            return parsed
          }
        }
        const saved = loadSavedDoctors()
        if (saved[currentDocId]) {
          useClinic.setState((s) => ({ doctors: { ...s.doctors, [currentDocId]: saved[currentDocId] } }))
          return saved[currentDocId]
        }
        const savedByEmail = Object.values(saved).find((d) => d.email && d.email.toLowerCase().trim() === cleanEmail)
        if (savedByEmail) {
          useClinic.setState((s) => ({ doctors: { ...s.doctors, [savedByEmail.id]: savedByEmail } }))
          return savedByEmail
        }
      } catch {}
    }
    return null
  }, [doctors, currentDocId, user])

  const patients = useClinic((s) => s.patients)
  const alerts = useClinic((s) => s.alerts)
  const messages = useClinic((s) => s.messages)
  const symptoms = useClinic((s) => s.symptoms)
  const labs = useClinic((s) => s.labs)
  const notes = useClinic((s) => s.notes)
  const medlogs = useClinic((s) => s.medlogs)
  const access = useClinic((s) => s.access)
  const toastText = useToast((s) => s.text)
  const [sel, setSel] = useState<string | null>(null)
  const [tab, setTab] = useState<'patients' | 'alerts'>('patients')

  useEffect(() => {
    loadAll()
    const unsub = subscribeRealtime()
    return () => {
      unsub()
    }
  }, [])

  // استرجاع ملف الطبيب من السيرفر: the server's copy of his profile, once each time the dashboard opens. A profile
  // that is only on this computer (made while the server was off) goes to the server, so his phone knows him too.
  useEffect(() => {
    if (!user?.email) return
    const cleanEmail = user.email.toLowerCase().trim()
    let alive = true
    clinicFetch(`/api/clinic/doctors/by-email/${encodeURIComponent(cleanEmail)}`)
      .then(async (res) => {
        if (!alive) return
        if (res.ok) {
          const doc = await res.json()
          if (doc?.id && doc?.code) {
            useClinic.setState((s) => ({ doctors: { ...s.doctors, [doc.id]: doc } }))
            saveDoctorLocally(doc)
          }
        } else if (res.status === 404) {
          const local = getCurrentDoctor()
          if (local && !local.demo && (local.email || '').toLowerCase().trim() === cleanEmail) sendDoctorToServer(local)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [user?.email])

  const records: Records = useMemo(
    () => ({
      alerts: listOf<'alerts'>(alerts),
      messages: listOf<'messages'>(messages),
      symptoms: listOf<'symptoms'>(symptoms),
      labs: listOf<'labs'>(labs),
      notes: listOf<'notes'>(notes),
      medlogs: listOf<'medlogs'>(medlogs),
    }),
    [alerts, messages, symptoms, labs, notes, medlogs],
  )
  const accessList = useMemo(() => listOf<'access'>(access), [access])

  const all = listOf<'patients'>(patients).filter(
    (p) => (doctor ? p.doctorId === doctor.id : false) || (!p.doctorId && doctor?.id === DOC_ID),
  )
  const active = all.filter((p) => p.link === 'active')
  const pending = all.filter((p) => p.link === 'pending')
  const rows = active
    .map((p) => ({ p, pr: priority(p, records) }))
    .sort((a, b) => a.pr.level - b.pr.level || a.p.name.localeCompare(b.p.name, 'ar'))
  const counts = [0, 1, 2].map((lv) => rows.filter((r) => r.pr.level === lv).length)
  const selected = all.find((p) => p.id === sel && (p.link === 'active' || p.link === 'pending')) ?? null
  const openAlerts = records.alerts.filter((a) => a.status === 'open' && active.some((p) => p.id === a.pid)).sort((a, b) => tOf(b) - tOf(a))

  function open(pid: string) {
    setSel(pid)
    logOpen(pid)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!doctor) {
    return <DoctorProfileSetup userEmail={user?.email} onLogout={logout} />
  }
  return (
    <div className="dd min-h-dvh" dir="rtl">
      <header className="dd-head">
        <div className="dd-head-in">
          <div className="dd-brand">
            <div className="dd-brand-ico">
              <Ribbon />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#E0177F', lineHeight: 1.2 }}>معاكِ</div>
              <div className="muted12">لوحة الطبيب</div>
            </div>
          </div>
          <div className="dd-who">
            <b>{doctor.name}</b>
            {doctor.verified && (
              <span className="verified">
                <Icon name="check" size={14} color="#1E6B34" stroke={3} />
                حساب موثّق
              </span>
            )}
            <span className="code-chip">
              كود الربط <span dir="ltr">{doctor.code}</span>
              <CopyButton text={doctor.code} />
            </span>
            <LangToggle short />
            <button type="button" className="mbtn" onClick={logout}>
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className={'dd-body' + (selected ? ' has-sel' : '')}>
        <div className="dd-list">
          <div className="counts">
            <div className="count">
              <Pill tone="red">تحتاج انتباه</Pill>
              <b>{counts[0]}</b>
            </div>
            <div className="count">
              <Pill tone="yellow">مراجعة</Pill>
              <b>{counts[1]}</b>
            </div>
            <div className="count">
              <Pill tone="green">مستقرة</Pill>
              <b>{counts[2]}</b>
            </div>
          </div>

          {pending.length > 0 && (
            <div className="dcard">
              <h2>طلبات ربط جديدة</h2>
              {pending.map((p) => (
                <div key={p.id} className="req">
                  <div>
                    <b>{p.name}</b>
                    {p.age ? <span className="muted12"> · {p.age} سنة</span> : null}
                  </div>
                  <div className="muted12">
                    {p.assessment ? 'التقييم: ' + p.assessment.label : 'لسه ما عملتش التقييم'}
                    {p.prediction ? (
                      <>
                        {' · '}
                        <bdi>{p.prediction.birads}</bdi>
                      </>
                    ) : null}
                    {' · ' + fmtAgo(Date.parse(p.requestedAt || '') || Date.now())}
                  </div>
                  <div className="row-btns">
                    <button type="button" className="pbtn" onClick={() => accept(p)}>
                      قبول
                    </button>
                    <button type="button" className="mbtn" onClick={() => decline(p)}>
                      رفض
                    </button>
                    <button type="button" className="soft-btn" onClick={() => open(p.id)}>
                      تفاصيل
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="listtabs" role="tablist" aria-label="القائمة">
            <button type="button" role="tab" aria-selected={tab === 'patients'} className={tab === 'patients' ? 'on' : ''} onClick={() => setTab('patients')}>
              المريضات ({rows.length})
            </button>
            <button type="button" role="tab" aria-selected={tab === 'alerts'} className={tab === 'alerts' ? 'on' : ''} onClick={() => setTab('alerts')}>
              التنبيهات ({openAlerts.length})
            </button>
          </div>

          {tab === 'patients' ? (
            rows.length ? (
              rows.map((r) => <PatientRow key={r.p.id} p={r.p} pr={r.pr} on={sel === r.p.id} onOpen={() => open(r.p.id)} />)
            ) : (
              <div className="dcard p-5 text-center flex flex-col items-center gap-3 border border-dashed border-brand-line">
                <div style={{ fontSize: 36 }}>🩺</div>
                <h3 className="text-base font-bold text-ink mb-0">لوحة المتابعة جاهزة، {doctor.name}</h3>
                <p className="text-sm text-muted max-w-sm mb-1">
                  لم تقم أي مريضة بالربط معكِ بعد. شاركي كود الربط الخاص بكِ مع مريضاتك في العيادة لمتابعتهن هنا.
                </p>
                <div className="p-3 bg-brand-light rounded-xl flex items-center justify-center gap-3 border border-brand-line">
                  <span className="text-xs font-semibold text-muted">كود الربط الخاص بكِ:</span>
                  <b dir="ltr" className="text-brand font-extrabold text-lg tracking-wider">
                    {doctor.code}
                  </b>
                  <CopyButton text={doctor.code} />
                </div>
              </div>
            )
          ) : openAlerts.length ? (
            openAlerts.map((a) => <AlertRow key={a.id} a={a} p={patients[a.pid]} onOpen={() => open(a.pid)} />)
          ) : (
            <div className="chart-empty">مفيش تنبيهات مفتوحة</div>
          )}

          <AccountCard doctor={doctor} />
        </div>

        <div className="dd-detail">
          {selected ? (
            <PatientFile key={selected.id} p={selected} records={records} access={accessList} onBack={() => setSel(null)} />
          ) : (
            <div className="dcard">
              <h2>اختاري مريضة من القائمة</h2>
              <p className="body15">القائمة مترتبة بالأولوية: الحالات اللي محتاجة انتباهك النهارده فوق.</p>
            </div>
          )}
        </div>
      </div>

      <div role="status" aria-live="polite" className={toastText ? 'dd-toast' : 'sr-only'}>
        {toastText}
      </div>
    </div>
  )
}
