import { useState } from 'react'
import { useNavigate } from 'react-router'
import { DoctorPhone } from '../components/DoctorPhone'
import { Icon } from '../components/Icon'
import { apptsOf, flagAdvice, planInfo } from '../data/clinic'
import { clockLabel, dateOfRel, fmtAgo, fmtDayLong, fmtIn, fmtTime, plural, tOf, ymd } from '../lib/dates'
import { getNotificationPermission, requestNotificationPermission } from '../lib/medReminders'
import { useAssessment } from '../store/assessment'
import { takeDose, useMine, useMyDoctor, useMyRecord, useUnread } from '../store/doctor'

function greeting() {
  return new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير'
}

// The home screen during treatment: today's medicines and symptoms, the plan, and the doctor's latest note.
export function HomeFollow() {
  const navigate = useNavigate()
  const [perm, setPerm] = useState(() => getNotificationPermission())
  const name = useAssessment((s) => s.name.trim()) || 'جميلة'
  const p = useMyRecord()
  const doctor = useMyDoctor()
  const logs = useMine('medlogs')
  const symptoms = useMine('symptoms')
  const notes = useMine('notes')
  const alerts = useMine('alerts')
  const unread = useUnread()
  if (!p) return null

  const dn = doctor ? doctor.name : 'طبيبك'
  const pi = planInfo(p)
  const today = ymd(new Date())
  const now = Date.now()
  const doses = (p.meds || [])
    .flatMap((m) => m.times.map((tm) => ({ m, tm, at: Date.parse(today + 'T' + tm), taken: logs.some((l) => l.medId === m.id && l.day === today && l.time === tm) })))
    .sort((a, b) => a.at - b.at)
  const loggedToday = symptoms.some((s) => ymd(new Date(tOf(s))) === today)
  const nextAppt = apptsOf(p).find((a) => a.t >= Date.now() - 2 * 3600000)
  const lastNote = notes[notes.length - 1]
  const red = alerts.filter((a) => a.status === 'open' && a.severity === 'red' && (a.kind === 'fever' || a.kind === 'pain')).pop()

  return (
    <>
      <div>
        <p className="text-sm text-muted">
          {greeting()} يا {name}،
        </p>
        <h1 className="mt-0.5 text-2xl font-extrabold">رحلة علاجك</h1>
      </div>

      {red && (
        <div className="alert-card">
          <div className="at">{red.text}</div>
          <div>{flagAdvice(red.kind)}</div>
          <div className="muted12">طبيبك وصله تنبيه.</div>
          <DoctorPhone doctor={doctor} />
        </div>
      )}

      {unread > 0 && (
        <button type="button" className="banner" onClick={() => navigate('/messages')}>
          {plural(unread, 'رسالة جديدة', 'رسالتين جداد', 'رسايل جديدة', 'رسالة جديدة')} من {dn}
        </button>
      )}

      <section className="wcard">
        <h2 className="h2p">
          <Icon name="clock" color="#E0177F" stroke={2.2} />
          النهارده
        </h2>
        {doses.length ? (
          <>
            <div className="dose-btns">
              {doses.map((x) => {
                const isDue = now >= x.at && !x.taken
                return (
                  <button
                    key={x.m.id + x.tm}
                    type="button"
                    className={'dose' + (x.taken ? ' on' : isDue ? ' due' : '')}
                    aria-pressed={x.taken}
                    onClick={() => takeDose(x.m.id, x.tm)}
                  >
                    {x.taken && <Icon name="check" size={16} color="#FFFFFF" stroke={3} />}
                    {x.m.name} · {clockLabel(x.tm)}
                    {isDue && (
                      <span style={{ fontSize: 11, background: '#E0177F', color: '#fff', borderRadius: 999, padding: '1px 7px', fontWeight: 700 }}>
                        حان موعدها ⏰
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="muted12">دوسي على الجرعة لما تاخديها.</div>
            {perm === 'default' && (
              <button
                type="button"
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-pink-50 py-2 px-3 text-xs font-bold text-brand hover:bg-pink-100 transition-colors"
                onClick={async () => {
                  const ok = await requestNotificationPermission()
                  if (ok) setPerm('granted')
                }}
              >
                <Icon name="bell" size={14} color="#E0177F" />
                <span>تفعيل تنبيهات مواعيد الأدوية على جهازك</span>
              </button>
            )}
          </>
        ) : (
          <div className="muted14">مفيش أدوية مكتوبة النهارده</div>
        )}
        {nextAppt && ymd(new Date(nextAppt.t)) === today && (
          <div className="ln">
            النهارده: {nextAppt.title} الساعة {fmtTime(nextAppt.t)}
          </div>
        )}
        {loggedToday ? (
          <div className="done-pill">
            <Icon name="check" size={16} color="#1E6B34" stroke={3} />
            سجّلتي أعراض النهارده
          </div>
        ) : (
          <button type="button" className="grad-btn" onClick={() => navigate('/follow/symptoms')}>
            سجّلي أعراض النهارده
          </button>
        )}
      </section>

      <section className="wcard">
        <h2 className="h2p">
          <Icon name="pulse" color="#E0177F" stroke={2.2} />
          خطة علاجك
        </h2>
        {pi.cur && (
          <div className="cur-step">
            <b>{pi.cur.title}</b>
            <span>
              {fmtIn(dateOfRel(pi.cur).getTime())} · {fmtDayLong(dateOfRel(pi.cur).getTime())}
            </span>
          </div>
        )}
        <div className="stepbar" aria-hidden="true">
          {pi.steps.map((s) => (
            <span key={s.id} className={s.status} />
          ))}
        </div>
        <div className="muted14">
          {pi.done} من {pi.total} خطوات خلصت
        </div>
        {nextAppt && (
          <div className="ln">
            الميعاد الجاي: {nextAppt.title} · {fmtIn(nextAppt.t)} الساعة {fmtTime(nextAppt.t)}
          </div>
        )}
        <button type="button" className="mbtn" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/follow/plan')}>
          الخطة كاملة
        </button>
      </section>

      {lastNote && (
        <section className="wcard">
          <h2 className="h2p">آخر ملاحظة من {dn}</h2>
          <p className="body15">{lastNote.text}</p>
          <div className="muted12">{fmtAgo(tOf(lastNote))}</div>
          <button
            type="button"
            className="out-btn"
            onClick={() => navigate('/chat', { state: { ask: 'اشرحيلي آخر ملاحظة من الدكتور' } })}
          >
            <Icon name="chat" size={20} color="#E0177F" />
            اسألي ونس تشرحها
          </button>
        </section>
      )}
    </>
  )
}
