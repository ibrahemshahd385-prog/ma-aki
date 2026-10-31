import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { getNotificationPermission, requestNotificationPermission } from '../lib/medReminders'
import { timeAgo } from '../lib/time'
import { useNotifications } from '../store/notifications'

export function Notifications() {
  const notes = useNotifications((s) => s.notes)
  const markAllRead = useNotifications((s) => s.markAllRead)
  const [perm, setPerm] = useState(() => getNotificationPermission())

  // Remember which ones were new when the screen opened, so their dot stays pink this time.
  const [fresh] = useState(() => new Set(useNotifications.getState().notes.filter((n) => !n.read).map((n) => n.id)))

  // Opening the screen counts as reading them, so the number on the bell goes away.
  useEffect(() => {
    markAllRead()
  }, [markAllRead])

  return (
    <>
      <h1 className="text-[22px] font-extrabold">الإشعارات</h1>

      {perm === 'default' && (
        <div className="flex flex-col gap-2 rounded-[18px] bg-white p-4 shadow-sm border border-brand/10">
          <div className="flex items-start gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-pink-50 text-brand shrink-0">
              <Icon name="bell" size={16} color="#E0177F" />
            </span>
            <div className="flex-1 text-xs leading-relaxed text-body">
              <b className="block text-brand text-[13px] mb-0.5">تفعيل إشعارات مواعيد الأدوية</b>
              فعّلي إشعارات المتصفح ليوصلك تنبيه فوري وصوتي عند حلول موعد كل دواء، حتى لو قفلتي التطبيق.
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              const ok = await requestNotificationPermission()
              if (ok) setPerm('granted')
            }}
            className="self-end rounded-xl bg-brand px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            تفعيل الإشعارات الآن
          </button>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-body">مفيش إشعارات لسه.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => {
            const isNew = fresh.has(n.id)
            return (
              <li key={n.id} className="flex gap-3 rounded-[18px] bg-white px-4 py-3.5">
                <span aria-hidden="true" className={'mt-2 size-2.5 shrink-0 rounded-full ' + (isNew ? 'bg-brand' : 'bg-brand-line')} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-extrabold">
                    {n.title}
                    {isNew && <span className="sr-only"> (جديد)</span>}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-[1.7] text-body">{n.text}</p>
                  <p className="mt-1 text-[11px] text-muted">{timeAgo(n.at)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
