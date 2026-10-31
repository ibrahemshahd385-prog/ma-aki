import { Link } from 'react-router'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { JourneyCard } from '../components/JourneyCard'
import { LinkBanner } from '../components/LinkBanner'
import { SelfExamCard } from '../components/SelfExamCard'
import { dayLabel } from '../lib/time'
import { useAssessment } from '../store/assessment'
import { useMode } from '../store/doctor'
import { useJourney } from '../store/journey'
import { afterText, everyText, useReminder } from '../store/reminder'
import { HomeFollow } from './HomeFollow'

function greeting() {
  return new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير'
}

// During treatment the home screen is about the treatment (HomeFollow); otherwise it is the monthly self-exam.
export function Home() {
  return useMode() === 'follow' ? <HomeFollow /> : <HomeExam />
}

function HomeExam() {
  const name = useAssessment((s) => s.name.trim()) || 'جميلة'
  const journey = useJourney()
  const nextExam = useReminder((s) => s.nextExam)
  const setNextExam = useReminder((s) => s.setNextExam)
  const everyMonths = useReminder((s) => s.everyMonths)
  const examDue = nextExam !== null && Date.now() >= Date.parse(nextExam)

  return (
    <>
      <div>
        <p className="text-sm text-muted">
          {greeting()} يا {name}،
        </p>
        <h1 className="mt-0.5 text-2xl font-extrabold">{everyMonths === 1 ? 'فحصك الذاتي الشهري' : 'فحصك الذاتي'}</h1>
      </div>

      <LinkBanner />

      {/* The tip, or her next self-exam day once Wanas has set it. */}
      <div className="flex items-center gap-3 rounded-[20px] bg-brand-soft px-4 py-3.5">
        <span className="flex size-[42px] shrink-0 items-center justify-center rounded-[14px] bg-white">
          <Icon name="calendar" color="#E0177F" />
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-sm leading-[1.7] text-body">
            {examDue ? (
              <>
                <b className="text-brand-deep">النهارده ميعاد فحصك الذاتي.</b> اعمليه بالخطوات اللي تحت.
              </>
            ) : nextExam ? (
              <>
                <b className="text-brand-deep">ميعاد فحصك الجاي:</b> {dayLabel(nextExam)}، وبعدها {everyText(everyMonths)}.
              </>
            ) : (
              <>
                <b className="text-brand-deep">نصيحة:</b> أفضل وقت للفحص الذاتي بعد الدورة بـ 3 لـ 5 أيام. قولي لونس «فكّريني» وهي تظبطلك الميعاد.
              </>
            )}
          </p>
          {examDue && (
            <Button variant="solid" className="self-start" onClick={() => setNextExam(30 * everyMonths)}>
              {everyMonths === 1 ? 'عملته، فكّريني الشهر الجاي' : `عملته، فكّريني ${afterText(everyMonths)}`}
            </Button>
          )}
        </div>
      </div>

      <SelfExamCard />

      <JourneyCard states={journey.states} message={journey.message} />

      <Link
        to="/assess"
        className="relative flex shrink-0 flex-col gap-2.5 overflow-hidden rounded-[22px] bg-brand p-[18px] text-white"
      >
        <span aria-hidden="true" className="absolute -bottom-20 -left-[60px] size-[170px] rounded-full bg-[#C8106F]" />
        <span className="relative text-lg font-extrabold">لاحظتي أي تغيير؟</span>
        <span className="relative text-sm leading-[1.7] font-semibold">
          جاوبي على أسئلة بسيطة في دقيقتين، وهنقولك محتاجة تكشفي ولا تطمني.
        </span>
        <span className="relative flex h-[50px] items-center justify-center rounded-[14px] bg-white text-base font-extrabold text-brand">
          ابدئي التقييم
        </span>
      </Link>
    </>
  )
}
