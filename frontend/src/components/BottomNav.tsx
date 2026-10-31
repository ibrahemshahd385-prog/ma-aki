import { Link, NavLink, useLocation } from 'react-router'
import { useMode, useUnread } from '../store/doctor'
import { Icon, type IconName } from './Icon'

type TabProps = { to: string; label: string; icon: IconName; also?: string[]; badge?: number }

// One button of the bar. "also" lists other screens that light it up (the doctor's tab stays on in the messages).
function Tab({ to, label, icon, also = [], badge = 0 }: TabProps) {
  const { pathname } = useLocation()
  const isActive = [to, ...also].some((p) => pathname === p || pathname.startsWith(p + '/'))
  return (
    <Link to={to} aria-current={isActive ? 'page' : undefined} className="relative flex flex-col items-center justify-center gap-1">
      <span
        className={
          'flex h-[30px] w-[52px] items-center justify-center rounded-full ' + (isActive ? 'bg-brand text-white' : 'text-muted')
        }
      >
        <Icon name={icon} />
      </span>
      {badge > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 left-[calc(50%-32px)] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-extrabold text-white"
        >
          {badge}
        </span>
      )}
      <span className={'text-xs ' + (isActive ? 'font-extrabold text-brand-deep' : 'font-semibold text-muted')}>
        {label}
        {badge > 0 && <span className="sr-only">، {badge} جديدة</span>}
      </span>
    </Link>
  )
}

function WanasButton() {
  return (
    <NavLink to="/chat" aria-label="ونس، المساعدة الذكية" className="flex flex-col items-center justify-end gap-0.5">
      <span
        className="-mt-8 flex size-[60px] items-center justify-center rounded-full border-4 border-white shadow-[0_8px_20px_rgba(224,23,127,0.35)]"
        style={{ background: 'linear-gradient(270deg, #CC0F72, #E8268A)' }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.4A8.4 8.4 0 1 1 21 11.5z" />
          <path d="M12 15s-3-1.8-3-3.9a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8C15 13.2 12 15 12 15z" fill="#FFFFFF" />
        </svg>
      </span>
      <span className="text-xs font-extrabold text-brand-deep">ونس</span>
    </NavLink>
  )
}

// During treatment, "متابعتي" and "الرسائل" take the places of the assessment and the doctor.
export function BottomNav() {
  const follow = useMode() === 'follow'
  const unread = useUnread()
  return (
    <nav
      aria-label="التنقل"
      className="grid h-20 shrink-0 grid-cols-5 border-t border-[#FFD6EA] bg-white px-1 pt-2 pb-3.5 shadow-[0_-6px_20px_rgba(224,23,127,0.06)]"
    >
      <Tab to="/home" label="الرئيسية" icon="home" />
      {follow ? <Tab to="/follow" label="متابعتي" icon="pulse" /> : <Tab to="/assess" label="التقييم" icon="assess" />}
      <WanasButton />
      {follow ? (
        <Tab to="/messages" label="الرسائل" icon="chat" badge={unread} />
      ) : (
        <Tab to="/doctor" label="الدكتور" icon="doctor" also={['/messages']} badge={unread} />
      )}
      <Tab to="/tests" label="الفحوصات" icon="tests" />
    </nav>
  )
}
