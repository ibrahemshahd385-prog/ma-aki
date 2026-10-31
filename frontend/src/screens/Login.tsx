import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clinicFetch } from '../lib/api'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Ribbon } from '../components/Icon'
import { LangToggle } from '../components/LangToggle'
import type { Doctor } from '../data/clinic'
import { checkRealEmail } from '../lib/email'
import { supabase } from '../lib/supabase'
import { chooseRole, holdSignIn, homeFor, lastRole, rememberRole, useAuth, type Role } from '../store/auth'
import { saveDoctorLocally, useClinic } from '../store/clinic'
import { markRestored } from '../store/doctor'
import { toast } from '../store/toast'
import { restoreMyFile } from '../store/uploads'

type RoleTabProps = { active: boolean; onClick: () => void; children: ReactNode }

function RoleTab({ active, onClick, children }: RoleTabProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={'min-h-12 rounded-xl text-[15px] ' + (active ? 'bg-brand font-extrabold text-white' : 'font-bold text-muted')}
    >
      {children}
    </button>
  )
}

function arabicError(message: string) {
  const m = message.toLowerCase()
  if (m.includes('sending confirmation') || m.includes('confirmation email')) {
    return 'مش قادرين نعمل حسابات جديدة دلوقتي: «Confirm email» لسه مفتوح في إعدادات Supabase. لازم يتقفل.'
  }
  if (m.includes('for security purposes') || m.includes('over_email_send_rate_limit')) {
    const match = message.match(/\d+/)
    const sec = match ? match[0] : '15'
    return `برجاء الانتظار ${sec} ثانية قبل طلب كود تأكيد جديد.`
  }
  if (m.includes('token has expired') || m.includes('otp expired')) return 'انتهت صلاحية كود التأكيد. اضغطي على إعادة إرسال الكود.'
  if (m.includes('token is invalid') || m.includes('invalid token') || m.includes('otp')) return 'كود التأكيد غير صحيح. راجعي الكود في إيميلك وجرّبي تاني.'
  if (m.includes('password should') || m.includes('at least 6')) return 'الباسورد لازم يكون 6 حروف أو أرقام على الأقل.'
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) return 'الإيميل أو كلمة المرور غير صحيحة.'
  if (m.includes('rate limit') || m.includes('too many')) return 'محاولات كتير ورا بعض. استني شوية وجرّبي تاني.'
  if (m.includes('email not confirmed')) return 'الحساب ده لسه محتاج كود التأكيد اللي وصلك على الإيميل.'
  if (m.includes('not authorized')) return 'مش قادرين نبعت إيميل للعنوان ده. لازم إعداد إيميل الإرسال (SMTP) في Supabase.'
  if (m.includes('token has expired') || m.includes('is invalid') || m.includes('otp')) return 'الكود غلط أو انتهت صلاحيته. اطلبي كود جديد.'
  if (m.includes('is invalid') || m.includes('invalid email') || m.includes('email address')) return 'برجاء كتابة بريد إلكتروني حقيقي وصحيح (مثل Gmail).'
  if (m.includes('fetch') || m.includes('network')) return 'مش قادرين نوصل للسيرفر. اتأكدي من النت وجرّبي تاني.'
  return 'حصل خطأ: ' + message
}

// A new account needs a strong password: 8 or more characters, with letters and numbers. Not harder than that,
// so any woman can make one. Arabic and Arabic-Indic digits count too.
function passwordStrength(pw: string) {
  const letters = /[A-Za-z\u0600-\u06FF]/.test(pw)
  const digits = /[0-9\u0660-\u0669]/.test(pw)
  const symbols = /[^A-Za-z0-9\u0600-\u06FF\u0660-\u0669\s]/.test(pw)
  const ok = pw.length >= 8 && letters && digits
  const level: 'weak' | 'good' | 'strong' = !ok ? 'weak' : pw.length >= 12 || symbols ? 'strong' : 'good'
  return { ok, level }
}

const STRENGTH = {
  weak: { label: 'ضعيفة', color: '#A3123A', width: '33%' },
  good: { label: 'كويسة', color: '#B4541A', width: '66%' },
  strong: { label: 'قوية', color: '#1E6B34', width: '100%' },
} as const

// What the clinic already has for an email: a doctor's profile, a patient's file, both or neither.
type Found = { doctor: Doctor | null; patient: boolean }

async function lookUp(email: string): Promise<Found> {
  const get = async (path: string) => {
    try {
      const res = await clinicFetch(path)
      return res.ok ? await res.json() : null
    } catch {
      return null
    }
  }
  const [doc, pat] = await Promise.all([
    get(`/api/clinic/doctors/by-email/${encodeURIComponent(email)}`),
    get(`/api/clinic/patients/by-email/${encodeURIComponent(email)}`),
  ])
  return { doctor: doc?.id && doc?.code ? (doc as Doctor) : null, patient: !!pat?.patient }
}

// Signed in, and the email is the other kind of account than the tab she picked: she says which one she means.
type Choice = { email: string; userId?: string; doctor: Doctor | null; theirs: Role; tab: Role }

export function Login() {
  const navigate = useNavigate()
  const login = useAuth((s) => s.login)
  const [role, setRole] = useState<Role>(() => lastRole()) // the tab used last on this device
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // The first time only: the code Supabase sends to her email to confirm the new account
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [choice, setChoice] = useState<Choice | null>(null)
  // While this screen signs her in, it opens the app itself once her data is back
  const busy = useRef(false)
  const user = useAuth((s) => s.user)
  const isDr = role === 'doctor'

  // تحويل المستخدم المسجل مسبقاً تلقائياً
  useEffect(() => {
    if (user && user.email && !busy.current) {
      navigate(homeFor(user.role), { replace: true })
    }
  }, [user, navigate])

  // The wait before she can ask for the code again (Supabase allows one a minute)
  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendIn])

  // Signed in. The same email is the same person: the clinic knows the email, so a doctor's profile or a patient's
  // file comes back on any phone. Answers true when it asks her which kind of account she means.
  async function finalizeLogin(cleanEmail: string, userId?: string): Promise<boolean> {
    const found = await lookUp(cleanEmail)
    const hasDoctor = !!found.doctor
    // The email is only one kind of account, and the other tab is chosen (a doctor who forgot «أنا طبيب»): ask
    if (hasDoctor !== found.patient) {
      const theirs: Role = hasDoctor ? 'doctor' : 'patient'
      if (theirs !== role) {
        setChoice({ email: cleanEmail, userId, doctor: found.doctor, theirs, tab: role })
        return true
      }
    }
    await enter(role, cleanEmail, userId, found.doctor)
    return false
  }

  // Opens the app as this kind of account, with her data already back.
  async function enter(as: Role, cleanEmail: string, userId: string | undefined, doctor: Doctor | null) {
    chooseRole(as)
    rememberRole(as)
    if (as === 'doctor' && doctor) {
      // His profile and link code, as the clinic has them
      useClinic.setState((s) => ({ doctors: { ...s.doctors, [doctor.id]: doctor } }))
      saveDoctorLocally(doctor)
    }
    markRestored(null) // nothing from this browser goes to her file before it is read back from the clinic
    login({ role: as, email: cleanEmail, guest: false, id: userId })
    holdSignIn(false)
    if (as === 'patient') await restoreMyFile() // her name, answers and uploads, before her home opens
    toast('تم تسجيل الدخول بنجاح')
    navigate(homeFor(as), { replace: true })
  }

  // Her answer on the "which account?" card
  async function pick(as: Role) {
    if (!choice) return
    const c = choice
    setLoading(true)
    busy.current = true
    try {
      setRole(as)
      await enter(as, c.email, c.userId, as === 'doctor' ? c.doctor : null)
    } finally {
      setLoading(false)
      busy.current = false
    }
  }

  // "رجوع" on that card: signs out, back to the form
  async function backToForm() {
    setChoice(null)
    holdSignIn(false)
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore
    }
  }

  // تسجيل الدخول المباشر بالبريد وكلمة المرور
  async function handleDirectAuth() {
    let cleanEmail = email.trim().toLowerCase()
    if (cleanEmail.endsWith('@gmai.com')) cleanEmail = cleanEmail.replace('@gmai.com', '@gmail.com')
    if (cleanEmail.endsWith('@gmial.com')) cleanEmail = cleanEmail.replace('@gmial.com', '@gmail.com')
    if (cleanEmail.endsWith('@gamil.com')) cleanEmail = cleanEmail.replace('@gamil.com', '@gmail.com')
    setEmail(cleanEmail)

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('الإيميل مش مكتوب صح. مثال: name@gmail.com')
      return
    }
    if (password.length < 6) {
      setError('الباسورد لازم يكون 6 حروف أو أرقام على الأقل.')
      return
    }

    setLoading(true)
    setError('')
    chooseRole(role)
    holdSignIn(true)
    busy.current = true
    let asking = false
    try {
      // Only a real sign-in from Supabase gets in: a wrong password, or no connection, stays on this screen.
      const signInRes = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      if (signInRes.data?.user && signInRes.data.session) {
        asking = await finalizeLogin(cleanEmail, signInRes.data.user.id)
        return
      }
      const signInError = signInRes.error?.message || ''
      // She made the account before but didn't type the code yet: send it again
      if (/email not confirmed/i.test(signInError)) {
        await sendCodeAgain(cleanEmail)
        setStep('code')
        return
      }
      if (signInRes.error && !/invalid login credentials/i.test(signInError)) {
        setError(arabicError(signInError))
        return
      }
      // No account with this email and password: make one (with a strong password). If the email already has an
      // account, the password is wrong.
      if (!passwordStrength(password).ok) {
        setError('لو ده حساب جديد: كلمة المرور لازم تكون 8 حروف على الأقل، وفيها حروف وأرقام. ولو عندك حساب: كلمة المرور غلط.')
        return
      }
      // A new account needs a real email, not a made-up one
      const notReal = await checkRealEmail(cleanEmail)
      if (notReal) {
        setError(notReal)
        return
      }
      const signUpRes = await supabase.auth.signUp({ email: cleanEmail, password, options: { data: { role } } })
      if (signUpRes.error) {
        setError(
          /already/i.test(signUpRes.error.message)
            ? 'الإيميل ده ليه حساب قبل كده، وكلمة المرور دي مش بتاعته. اكتبي كلمة المرور الصح.'
            : arabicError(signUpRes.error.message),
        )
        return
      }
      // Supabase doesn't say an email already has an account: it answers with a user that has no identities
      const made = signUpRes.data.user
      if (made && Array.isArray(made.identities) && made.identities.length === 0) {
        setError('الإيميل ده ليه حساب قبل كده، وكلمة المرور دي مش بتاعته. اكتبي كلمة المرور الصح.')
        return
      }
      if (signUpRes.data.session) {
        // Email confirmation is off in Supabase: she is in right away
        asking = await finalizeLogin(cleanEmail, made?.id)
        return
      }
      // A new account: the code went to her email (the first time only)
      setCode('')
      setResendIn(60)
      setStep('code')
      toast('بعتنالك كود على إيميلك 📩')
    } catch (err: unknown) {
      setError(arabicError(err instanceof Error ? err.message : 'network'))
    } finally {
      setLoading(false)
      busy.current = false
      if (!asking) holdSignIn(false)
    }
  }

  // The first time only: the code from her email confirms the new account and signs her in.
  async function handleVerifyCode() {
    const cleanEmail = email.trim().toLowerCase()
    const token = code.trim()
    if (token.length < 6) {
      setError('اكتبي الكود اللي وصلك على الإيميل.')
      return
    }
    setLoading(true)
    setError('')
    chooseRole(role)
    holdSignIn(true)
    busy.current = true
    let asking = false
    try {
      let res = await supabase.auth.verifyOtp({ email: cleanEmail, token, type: 'signup' })
      if (res.error) res = await supabase.auth.verifyOtp({ email: cleanEmail, token, type: 'email' })
      if (res.error || !res.data.session) {
        setError(arabicError(res.error?.message || 'token has expired'))
        return
      }
      asking = await finalizeLogin(cleanEmail, res.data.user?.id)
    } catch (err: unknown) {
      setError(arabicError(err instanceof Error ? err.message : 'network'))
    } finally {
      setLoading(false)
      busy.current = false
      if (!asking) holdSignIn(false)
    }
  }

  async function sendCodeAgain(to: string) {
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: to })
    if (resendError) {
      setError(arabicError(resendError.message))
      return
    }
    setResendIn(60)
    toast('بعتنالك الكود تاني 📩')
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-7 pt-[48px] pb-7">
      <div className="flex items-center gap-2.5">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand">
          <Ribbon width={26} height={32} stroke={18} />
        </div>
        <span className="text-[26px] font-extrabold text-brand">معاكِ</span>
        <LangToggle className="ms-auto" />
      </div>

      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border-[1.5px] border-brand-line bg-white p-1">
        <RoleTab
          active={!isDr}
          onClick={() => {
            setRole('patient')
            setError('')
          }}
        >
          أنا مريضة
        </RoleTab>
        <RoleTab
          active={isDr}
          onClick={() => {
            setRole('doctor')
            setError('')
          }}
        >
          أنا طبيب
        </RoleTab>
      </div>

      {choice ? (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2 rounded-2xl border border-brand-line bg-white p-4">
            <h2 className="text-base font-extrabold">
              {choice.theirs === 'doctor' ? 'الإيميل ده متسجّل كحساب طبيب' : 'الإيميل ده متسجّل كحساب مريضة'}
            </h2>
            <p className="text-[13px] leading-relaxed text-body">
              {choice.theirs === 'doctor'
                ? `ده حساب ${choice.doctor?.name || 'الطبيب'}، وبياناته وكود الربط بتاعه محفوظين. تفتح لوحة الطبيب؟`
                : 'ملفها كمريضة محفوظ بالإيميل ده، بإجاباتها وفحوصاتها. تفتحي حسابك كمريضة؟'}
            </p>
          </div>
          <Button type="button" disabled={loading} onClick={() => pick(choice.theirs)}>
            {choice.theirs === 'doctor' ? 'أيوه، افتح لوحة الطبيب' : 'أيوه، افتحي حسابي كمريضة'}
          </Button>
          <Button type="button" variant="soft" disabled={loading} onClick={() => pick(choice.tab)}>
            {choice.tab === 'doctor' ? 'لا، أعمل حساب طبيب بنفس الإيميل' : 'لا، أدخل كمريضة بنفس الإيميل'}
          </Button>
          <button type="button" onClick={backToForm} className="min-h-10 text-xs text-muted">
            رجوع
          </button>
        </div>
      ) : step === 'code' ? (
        <form
          noValidate
          className="flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault()
            handleVerifyCode()
          }}
        >
          <div className="flex flex-col gap-2 rounded-2xl border border-brand-line bg-white p-4">
            <h2 className="text-base font-extrabold">{isDr ? 'اكتب كود التأكيد' : 'اكتبي كود التأكيد'}</h2>
            <p className="text-[13px] leading-relaxed text-body">
              بعتنا كود على <bdi dir="ltr" className="font-bold text-brand">{email.trim().toLowerCase()}</bdi>. افتحي الإيميل
              (Gmail) واكتبي الكود هنا. ده أول مرة بس، وبعد كده هتدخلي بالإيميل وكلمة المرور على طول.
            </p>
          </div>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={10}
            autoFocus
            placeholder="• • • • • •"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/[^0-9٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)))
              setError('')
            }}
            className="h-[56px] w-full rounded-[16px] border-2 border-brand bg-white text-center text-2xl font-extrabold tracking-[0.4em] text-brand outline-brand focus:outline-2"
          />
          {error && (
            <p role="alert" className="text-center text-sm font-bold text-brand-deep">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading || code.trim().length < 6}>
            {loading ? 'جاري التحقق…' : 'تأكيد الكود والدخول'}
          </Button>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={loading || resendIn > 0}
              onClick={() => sendCodeAgain(email.trim().toLowerCase())}
              className="min-h-10 text-xs font-bold text-brand disabled:text-muted"
            >
              {resendIn > 0 ? `تقدري تطلبي كود جديد بعد ${resendIn} ثانية` : 'الكود ماوصلش؟ ابعتيه تاني'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('form')
                setError('')
              }}
              className="min-h-10 text-xs text-muted"
            >
              تعديل الإيميل أو كلمة المرور
            </button>
          </div>
        </form>
      ) : (
      <>
          <div>
            <h1 className="text-[26px] leading-snug font-extrabold">
              {isDr ? (
                <>
                  أهلاً بحضرتك دكتور،
                  <br />
                  لوحة متابعة المريضات
                </>
              ) : (
                <>
                  أهلاً بيكي،
                  <br />
                  معاكِ في كل خطوة
                </>
              )}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-body">
              {isDr
                ? 'ادخل بإيميلك وكلمة المرور. أول مرة؟ اكتب إيميلك وكلمة مرور جديدة، وحسابك هيتعمل على طول. وكل ما تدخل بنفس الإيميل هتلاقي بياناتك زي ما هي.'
                : 'ادخلي بإيميلك وكلمة المرور. أول مرة؟ اكتبي إيميلك وكلمة مرور جديدة، وحسابك هيتعمل على طول. وكل ما تدخلي بنفس الإيميل هتلاقي بياناتك زي ما هي.'}
            </p>
          </div>

          <form
            noValidate
            className="flex flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault()
              handleDirectAuth()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-bold">
                البريد الإلكتروني (جوجل / شخصي)
              </label>
              <input
                id="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                placeholder={isDr ? 'doctor@gmail.com' : 'name@gmail.com'}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                className="h-[50px] w-full rounded-[14px] border-[1.5px] border-brand-line bg-white px-3.5 text-base outline-brand focus:outline-2 focus:outline-offset-1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-bold">
                  كلمة المرور
                </label>
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="min-h-8 text-xs font-bold text-brand">
                  {showPassword ? 'إخفاء' : 'إظهار'}
                </button>
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                autoComplete="current-password"
                placeholder="8 حروف على الأقل، حروف وأرقام"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                className="h-[50px] w-full rounded-[14px] border-[1.5px] border-brand-line bg-white px-3.5 text-base outline-brand focus:outline-2 focus:outline-offset-1"
              />
              {password && (
                <div className="flex items-center gap-2" aria-live="polite">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-line">
                    <div
                      className="h-full rounded-full"
                      style={{ width: STRENGTH[passwordStrength(password).level].width, background: STRENGTH[passwordStrength(password).level].color }}
                    />
                  </div>
                  <span className="text-xs font-bold" style={{ color: STRENGTH[passwordStrength(password).level].color }}>
                    {STRENGTH[passwordStrength(password).level].label}
                  </span>
                </div>
              )}
              <p className="text-xs text-muted">للحساب الجديد: 8 حروف على الأقل، فيها حروف وأرقام.</p>
            </div>

            {error && (
              <p role="alert" className="text-sm font-bold text-brand-deep">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? 'جاري التحقق…' : 'تسجيل الدخول / إنشاء الحساب ✨'}
            </Button>

          </form>

          {isDr && (
            <div className="rounded-[14px] border border-brand-line bg-white p-3.5 flex flex-col gap-1.5">
              <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                <span>🩺</span> توثيق حساب الطبيب:
              </div>
              <p className="text-xs leading-relaxed text-muted">
                بياناتك وكود الربط الخاص بيك بيتحفظوا، ويرجعولك كل ما تدخل بنفس الإيميل وكلمة المرور.
              </p>
            </div>
          )}
        </>
      )}

      <p className="mt-auto text-center text-xs leading-relaxed text-muted">
        {isDr ? 'بالتسجيل حضرتك موافق على سياسة الخصوصية وحماية بيانات المريضات.' : 'بالتسجيل انتِ موافقة على سياسة الخصوصية.'}{' '}
        معاكِ أداة توعية ومتابعة، ومش بديل عن الطبيب.
      </p>
    </div>
  )
}
