import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { useAuth } from '../store/auth'

export function Account() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)

  return (
    <>
      <section className="flex flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center shadow-[0_6px_22px_rgba(224,23,127,0.08)]">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft">
          <Icon name="user" size={30} color="#E0177F" />
        </span>
        <h1 className="text-xl font-extrabold">حسابي</h1>
        {user?.guest ? (
          <p className="leading-relaxed text-body">دخلتي كضيفة، وبياناتك محفوظة على الجهاز ده بس.</p>
        ) : (
          <p dir="ltr" className="font-bold break-all text-body">
            {user?.email}
          </p>
        )}
      </section>
      {/* After logout, RequireRole notices nobody is signed in and opens the login screen by itself. */}
      <Button variant="outline" onClick={logout}>
        تسجيل الخروج
      </Button>
    </>
  )
}