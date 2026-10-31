import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Ribbon } from '../components/Icon'
import { homeFor, useAuth } from '../store/auth'

// The pink opening screen. It moves on by itself after a moment, or right away on a tap.
export function Splash() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const next = user ? homeFor(user.role) : '/login'

  useEffect(() => {
    const timer = setTimeout(() => navigate(next, { replace: true }), 2800)
    return () => clearTimeout(timer)
  }, [navigate, next])

  return (
    <button
      type="button"
      aria-label="ادخلي التطبيق"
      onClick={() => navigate(next, { replace: true })}
      className="relative flex h-full w-full flex-col items-center justify-center gap-5 overflow-hidden bg-brand text-white"
    >
      <span aria-hidden="true" className="absolute -top-40 -right-[170px] size-[420px] rounded-full bg-[#EC3B94]" />
      <span aria-hidden="true" className="absolute -bottom-[110px] -left-[120px] size-[300px] rounded-full bg-[#C8106F]" />
      <span className="relative motion-safe:animate-float">
        <Ribbon width={120} height={150} stroke={16} />
      </span>
      <span className="relative text-center">
        <span className="block text-[54px] leading-none font-extrabold">معاكِ</span>
        <span dir="ltr" className="mt-1.5 block text-lg font-bold tracking-[3px]">
          {"MA'AKI"}
        </span>
        <span className="mt-[18px] block text-base leading-relaxed font-semibold">
          اكتشاف بدري… أمل أكبر
          <br />
          رفيقتك في رحلة الاطمئنان
        </span>
      </span>
      <span className="absolute bottom-12 text-[13px] font-semibold">أكتوبر الوردي · اضغطي للدخول</span>
    </button>
  )
}