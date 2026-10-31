import { Link } from 'react-router'
import { useNotifications } from '../store/notifications'
import { Icon, Ribbon } from './Icon'
import { LangToggle } from './LangToggle'

export function TopBar() {
  const unread = useNotifications((s) => s.notes.filter((n) => !n.read).length)

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between px-4 pt-5">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-brand">
          <Ribbon />
        </div>
        <span className="text-2xl font-extrabold text-brand">معاكِ</span>
      </div>
      <div className="flex items-center gap-2">
        <LangToggle short className="border-0" />
        <Link to="/account" aria-label="حسابي" className="flex size-11 items-center justify-center rounded-2xl bg-white">
          <Icon name="user" color="#3A1027" />
        </Link>
        <Link
          to="/notifications"
          aria-label={unread ? `الإشعارات، ${unread} جديدة` : 'الإشعارات'}
          className="relative flex size-11 items-center justify-center rounded-2xl bg-white"
        >
          <Icon name="bell" color="#3A1027" />
          {/* The pink number: how many she hasn't seen yet. */}
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 left-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white"
            >
              {unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
