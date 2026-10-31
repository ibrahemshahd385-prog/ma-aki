import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '../components/Icon'
import { fmtWhen, hoursText, isOfficeHours, tOf } from '../lib/dates'
import { isLinked, markMessagesRead, sendToDoctor, useMine, useMode, useMyDoctor } from '../store/doctor'

// Her messages with her doctor. The list scrolls; the box to write stays at the bottom.
export function Messages() {
  const navigate = useNavigate()
  const mode = useMode()
  const doctor = useMyDoctor()
  const messages = useMine('messages')
  const [draft, setDraft] = useState('')
  const end = useRef<HTMLDivElement>(null)

  // Opening the messages (and a new one arriving while they're open) counts as reading them.
  const unread = messages.filter((m) => m.from !== 'patient' && !m.readP).length
  useEffect(() => {
    if (unread) markMessagesRead()
  }, [unread])

  // Keep the newest message in view.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  if (!isLinked(mode)) {
    return (
      <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pt-2 pb-6">
        <section className="wcard">
          <h1 className="h1">الرسائل</h1>
          <p className="body15">الرسائل مع طبيبك بتشتغل بعد ما تربطي حسابك بيه من تاب «الدكتور».</p>
          <button type="button" className="grad-btn" onClick={() => navigate('/doctor')}>
            اربطي حسابك
          </button>
        </section>
      </div>
    )
  }

  const dn = doctor ? doctor.name : 'طبيبك'
  function send() {
    if (sendToDoctor(draft)) setDraft('')
  }

  return (
    <>
      <div className="shrink-0 px-5 pt-1 pb-2.5">
        <h1 className="b15">{dn}</h1>
        <p className="muted12">
          {isOfficeHours(doctor?.hours) ? 'في ساعات الرد دلوقتي' : 'برّه ساعات الرد'} · الرد {hoursText(doctor?.hours)}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-2.5">
        <div className="thread">
          <p className="sysnote">الرسائل مش للطوارئ. للطوارئ اتصلي 123 أو روحي أقرب طوارئ.</p>
          {messages.map((m) =>
            m.from === 'patient' ? (
              <div key={m.id} className="m-me">
                {m.text}
                <span className="m-meta">
                  {fmtWhen(tOf(m))}
                  {m.urgent ? ' · وصلت كعاجلة' : ''}
                </span>
              </div>
            ) : m.from === 'system' ? (
              <p key={m.id} className="sysnote">
                {m.text}
              </p>
            ) : (
              <div key={m.id} className="m-dr">
                <b>{dn}</b>
                {m.text}
                <span className="m-meta">{fmtWhen(tOf(m))}</span>
              </div>
            ),
          )}
        </div>
        <div ref={end} />
      </div>

      <form
        className="flex shrink-0 flex-col items-start gap-2 border-t border-[#FFD6EA] bg-white px-4 pt-2 pb-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <button type="button" className="chip" onClick={() => navigate('/chat', { state: { ask: 'ساعديني أكتب رسالة لطبيبي' } })}>
          اكتبيها مع ونس
        </button>
        <div className="flex items-center gap-2 self-stretch">
          <label htmlFor="ptMsg" className="sr-only">
            رسالتك للطبيب
          </label>
          <input
            id="ptMsg"
            type="text"
            autoComplete="off"
            placeholder="اكتبي رسالتك…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-brand-line bg-app px-4 text-[15px] outline-brand focus:outline-2 focus:outline-offset-1"
          />
          <button
            type="submit"
            aria-label="إرسال"
            disabled={!draft.trim()}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand disabled:opacity-45"
          >
            <Icon name="send" color="#FFFFFF" stroke={2.4} />
          </button>
        </div>
      </form>
    </>
  )
}
