// Wanas's built-in replies: no AI yet (that comes in step 14). Each message is matched by key words.
import { hasAny, normalize } from '../lib/arabic'
import { everyText } from '../store/reminder'
import { plural } from '../lib/dates'
import type { Level } from './assessment'
import { HOTLINES, likelyTests } from './care'
import type { Mode } from './clinic'
import type { JourneyKey } from './journey'
import { SELF_EXAM_STEPS } from './selfExam'

export type Tone = 'pink' | 'green' | 'urgent'

// A button inside a card either opens a screen (go) or sends a message to Wanas (say).
export type CardButton = { label: string; go?: string; say?: string }

export type Card = {
  tone: Tone
  title: string
  lines?: string[]
  sections?: { head: string; lines: string[] }[]
  numbers?: { label: string; number: string }[]
  buttons?: CardButton[]
  progress?: number // 1 to 5, for the self-exam guide
  breathing?: boolean // the breathing exercise circle
  copy?: string // text she can copy, like the summary for the doctor
}

export type BotMessage = { text: string; card?: Card }

// What Wanas is waiting for after her last question, if anything.
export type Awaiting = 'coach' | 'coachEnd' | 'period' | null
export type Conversation = { awaiting: Awaiting; coachStep: number; flagged: boolean }

export type Reply = {
  messages: BotMessage[]
  chips: string[] // the quick answers shown under the chat
  awaiting?: Awaiting
  coachStep?: number
  flagged?: boolean // she mentioned a warning sign
  reminderDays?: number // set a self-exam reminder this many days from today
  reminderEvery?: number // she asked for the reminder every this many months
  fallback?: boolean // none of the written replies fit: Claude answers instead (store/chat.ts)
}

// During treatment: what Wanas knows about her plan, written out for the cards.
export type FollowInfo = {
  stage: string
  receptors: string // like "ER+/PR+/HER2−"
  hormonal: boolean // ER or PR positive
  her2: boolean
  grade: string
  current: string | null // the current step and when, like "كيماوي: الجلسة 3 من 6 · بعد يومين"
  nextAppt: string | null
  doses: number // doses to take today
  meds: string[] // "name · dose · times"
  lastNote: string | null // the doctor's latest note
  labs: string[] // her latest results, newest first
}

// What Wanas knows about her, taken from the rest of the app.
export type WanasContext = {
  name: string
  assessed: boolean
  level: Level
  levelLabel: string
  levelMessage: string
  factors: string[]
  age: number
  familyHistory: boolean
  mode: Mode // where she is with her doctor (see data/clinic.ts)
  doctorName: string | null
  doctorPlace: string
  doctorPhone: string | null
  doctorHours: string // when the doctor answers messages
  uploads: string[] // the names of the tests she uploaded
  hasScan: boolean // a mammogram or an ultrasound is among them
  analyzed: boolean // she pressed "حلّلي النتائج"
  biopsy: boolean // the biopsy report is uploaded
  journeyKey: JourneyKey
  journeyMessage: string
  follow: FollowInfo | null // only during treatment
  reminderEvery: number // how often she wants the self-exam reminder, in months (store/reminder.ts)
}

// Mental health support from the Ministry of Health. Since March 2026 the unified line 105 takes these calls too.
const PSY = [
  { label: 'خط الدعم النفسي (24 ساعة)', number: '16328' },
  { label: 'الخط الموحد لوزارة الصحة', number: '105' },
]
const EMERGENCY = { label: 'الإسعاف', number: '123' }

const FREE = HOTLINES.map((h) => ({ label: h.label, number: h.number }))

const bot = (text: string, card?: Card): BotMessage => ({ text, card })

const isLinked = (c: WanasContext) => c.mode === 'linked' || c.mode === 'follow' || c.mode === 'routine'

// Her doctor's number (once the doctor has written it), and the ambulance for an emergency.
function doctorNumbers(c: WanasContext, emergency: boolean) {
  const out: { label: string; number: string }[] = []
  if (isLinked(c) && c.doctorPhone) out.push({ label: c.doctorName || 'طبيبك', number: c.doctorPhone })
  if (emergency) out.push(EMERGENCY)
  return out
}

function defaultChips(c: WanasContext) {
  if (c.mode === 'follow') return ['حاسة بتعب النهارده', 'عندي غثيان بعد الجلسة', 'ساعديني أكتب رسالة لطبيبي', 'إيه الخطوة الجاية في علاجي؟', 'اشرحيلي تشخيصي', 'أنا قلقانة']
  if (!c.assessed) return ['علميني الفحص الذاتي', 'حاسة بكتلة، أعمل إيه؟', 'فكّريني بالفحص كل شهر', 'أنا قلقانة', 'فين أكشف ببلاش؟']
  if (c.uploads.length === 0) return ['اشرحيلي نتيجتي', 'حضّريلي أسئلة للدكتور', 'فين أكشف ببلاش؟', 'أعمل فحوصات إيه؟', 'أنا قلقانة']
  if (!c.analyzed) return ['ليه لازم أحلل الفحوصات؟', 'حضّريلي أسئلة للدكتور', 'أنا قلقانة', 'فكّريني بالفحص كل شهر']
  return ['اشرحيلي تقرير الأشعة', 'يعني إيه BI-RADS؟', 'حضّريلي أسئلة للدكتور', 'أنا قلقانة']
}

// The buttons for her next step, depending on where she is.
function nextButtons(c: WanasContext): CardButton[] {
  if (c.journeyKey === 'monthly_self_exam') return [{ label: 'فكّريني كل شهر', say: 'فكّريني بالفحص كل شهر' }]
  if (c.mode === 'pre') return [{ label: 'صفحة الدكتور', go: '/doctor' }, { label: 'حضّريلي للزيارة', say: 'حضّريلي أسئلة للدكتور' }]
  if (c.mode === 'pending') return [{ label: 'صفحة الدكتور', go: '/doctor' }]
  if (c.uploads.length === 0) return [{ label: 'رفع الفحوصات', go: '/tests' }]
  if (!c.analyzed) return [{ label: c.hasScan ? 'حلّلي النتائج' : 'رفع الفحوصات', go: '/tests' }]
  return [{ label: 'اشرحيلي التقرير', say: 'اشرحيلي تقرير الأشعة' }]
}

// During treatment: where she is in the plan, with buttons to log today's symptoms and to write to her doctor.
function followCard(c: WanasContext): Card {
  const f = c.follow
  const lines: string[] = []
  if (f?.current) lines.push('الخطوة الحالية: ' + f.current)
  if (f?.nextAppt) lines.push('الميعاد الجاي: ' + f.nextAppt)
  if (f?.doses) lines.push('أدوية النهارده: ' + plural(f.doses, 'جرعة', 'جرعتين', 'جرعات', 'جرعة'))
  return {
    tone: 'pink',
    title: 'رحلة علاجك',
    lines: lines.length ? lines : ['خطة علاجك موجودة في «متابعتي»'],
    buttons: [
      { label: 'سجّلي أعراض النهارده', go: '/follow/symptoms' },
      { label: 'الرسائل', go: '/messages' },
    ],
  }
}

// How to write a clear message to the doctor, and where.
function messageReply(c: WanasContext): Reply {
  return {
    messages: [
      bot(`اكتبي رسالتك من شاشة الرسائل، والرد ${c.doctorHours}. علشان طبيبك يفهم على طول، قولي:`, {
        tone: 'pink',
        title: 'رسالة واضحة لطبيبك',
        lines: ['إيه اللي حاساه، ومن إمتى', 'قد إيه شديد، من 1 لـ 10', 'الحرارة لو قستيها', 'الأدوية اللي أخدتيها', 'الرسائل مش للطوارئ. للطوارئ اتصلي 123'],
        buttons: [{ label: 'افتحي الرسائل', go: '/messages' }],
      }),
    ],
    chips: defaultChips(c),
  }
}

const HELP: Card = {
  tone: 'pink',
  title: 'أقدر أساعدك في',
  lines: [
    'أشرحلك نتيجة التقييم بالعامية',
    'أعلّمك الفحص الذاتي خطوة بخطوة',
    'أفكّرك بميعاد الفحص الذاتي، كل شهر أو المدة اللي تحبيها',
    'أقولك تكشفي فين ببلاش',
    'أحضّرلك أسئلة وملخص للدكتور',
    'أطمنك وأهدّيكي لما تقلقي',
  ],
}

export function welcome(c: WanasContext): Reply {
  const status: Card = c.follow
    ? followCard(c)
    : c.assessed
    ? { tone: 'pink', title: 'أنا شايفة حالتك', lines: ['التقييم الأولي: ' + c.levelLabel, c.journeyMessage], buttons: nextButtons(c) }
    : {
        tone: 'pink',
        title: 'نبدأ منين؟',
        lines: ['لسه ما عملتيش تقييم الاحتمالية', 'دقيقتين بس وهتعرفي محتاجة تكشفي ولا تطمني'],
        buttons: [{ label: 'ابدئي التقييم', go: '/assess' }],
      }
  return {
    messages: [
      bot(
        c.follow
          ? `أهلاً يا ${c.name}، أنا ونس، رفيقتك في معاكِ.\nأنا معاكِ في رحلة علاجك: أشرحلك خطتك وتشخيصك، وأساعدك مع الأعراض، وأوصّلك بطبيبك.`
          : `أهلاً يا ${c.name}، أنا ونس، رفيقتك في معاكِ.\nأقدر أشرحلك نتيجتك، وأعلّمك الفحص الذاتي، وأفكّرك بميعاده، وأطمّنك في أي وقت.`,
      ),
      bot('', status),
      bot('اسأليني في أي حاجة، أو اختاري من تحت.'),
    ],
    chips: defaultChips(c),
  }
}

function coachReply(step: number): Reply {
  const s = SELF_EXAM_STEPS[step]
  return {
    messages: [
      bot(step === 0 ? 'يلا نعمله سوا خطوة بخطوة. اعملي كل خطوة وبعدين دوسي «خلصت».' : '', {
        tone: 'pink',
        title: `الخطوة ${step + 1} من 5: ${s.title}`,
        lines: [s.text],
        progress: step + 1,
      }),
    ],
    chips: ['خلصت، اللي بعده', 'لاحظت حاجة غريبة'],
    awaiting: 'coach',
    coachStep: step,
  }
}

// How often she asked to be reminded, in months: "كل 3 شهور"، "كل تلات شهور"، "كل شهرين"، "كل سنة".
// null when she didn't say. The text is already normalized (lib/arabic.ts), so the digits are 0-9.
const NUMBER_WORDS: Record<string, number> = {
  واحد: 1, اتنين: 2, اثنين: 2, تلات: 3, تلاته: 3, ثلاث: 3, ثلاثه: 3, تلت: 3, اربع: 4, اربعه: 4, خمس: 5, خمسه: 5, ست: 6, سته: 6,
}
function monthsAsked(t: string): number | null {
  if (/كل\s*سنه/.test(t)) return 12
  if (/كل\s*شهرين/.test(t)) return 2
  const m = t.match(/كل\s*(\d{1,2}|[^\s\d]+)\s*(?:شهور|اشهر|شهر)/)
  if (m) {
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUMBER_WORDS[m[1]]
    if (n && n >= 1 && n <= 12) return n
  }
  if (/كل\s*شهر/.test(t)) return 1
  return null
}

// Sets up the self-exam reminder: first how often (when she said), then the best day from her last period.
function askPeriod(every?: number | null): Reply {
  const longer = !!every && every > 1
  const messages: BotMessage[] = []
  if (longer)
    messages.push(
      bot(
        `تمام، هفكّرك ${everyText(every)}.\nوللعلم، كتير من الأطباء بينصحوا بالفحص الذاتي كل شهر، لأن أي تغيير بيبان بدري. ولو حبيتي ترجعيه كل شهر، قوليلي «فكّريني كل شهر».`,
      ),
    )
  messages.push(bot((longer ? '' : 'أكيد! ') + 'علشان أختار أنسب يوم: آخر دورة بدأت إمتى تقريباً؟\nأفضل وقت للفحص بعد الدورة بكام يوم، لما الثدي يكون أهدى.'))
  return {
    messages,
    chips: ['من أقل من أسبوع', 'من حوالي أسبوعين', 'من 3 أسابيع أو أكتر', 'الدورة انقطعت أو مش منتظمة'],
    awaiting: 'period',
    ...(every ? { reminderEvery: every } : {}),
  }
}

function daysToFirstOfNextMonth() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return Math.max(1, Math.ceil((first.getTime() - now.getTime()) / 86400000))
}

function reminderReply(c: WanasContext, days: number, note: string): Reply {
  const day = new Date(Date.now() + days * 86400000).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })
  return {
    messages: [bot('تمام، ظبطتهولك.', { tone: 'green', title: 'تم ضبط التذكير', lines: ['الفحص الذاتي الجاي: ' + day, note, 'هتلاقي الميعاد في «الرئيسية» والإشعارات'] })],
    chips: defaultChips(c),
    reminderDays: days,
  }
}

function redFlagReply(): Reply {
  return {
    messages: [
      bot('شكراً إنك قلتيلي، ودي أهم خطوة. اطمني الأول: أغلب الكتل والتغيّرات بتطلع حميدة.\nبس العلامة دي محتاجة كشف عند طبيب قريب علشان نطمن.'),
      bot('', {
        tone: 'urgent',
        title: 'علامة محتاجة كشف خلال أسبوعين',
        lines: ['ما تستنيش الفحص الشهري الجاي', 'اكشفي عند جراح ثدي أو في أقرب وحدة صحية', 'خدي معاكِ أي أشعة أو تحاليل قديمة'],
        numbers: FREE,
        buttons: [{ label: 'سجّلي الأعراض في التقييم', go: '/assess' }],
      }),
    ],
    chips: ['حضّريلي أسئلة للدكتور', 'فين أكشف ببلاش؟', 'أنا قلقانة'],
    flagged: true,
  }
}

function resultReply(c: WanasContext): Reply {
  if (!c.assessed) {
    return {
      messages: [
        bot('لسه ما عملتيش التقييم. دقيقتين بس وأقدر أشرحلك نتيجتك بالتفصيل.', {
          tone: 'pink',
          title: 'تقييم الاحتمالية',
          lines: ['8 أسئلة بسيطة عن الأعراض والتاريخ العائلي'],
          buttons: [{ label: 'ابدئي التقييم', go: '/assess' }],
        }),
      ],
      chips: defaultChips(c),
    }
  }
  return {
    messages: [
      bot(`نتيجة تقييمك: ${c.levelLabel}.\n${c.levelMessage}`),
      bot(c.journeyMessage, {
        tone: c.level === 'urgent' ? 'urgent' : 'pink',
        title: 'العوامل اللي أثرت على النتيجة',
        lines: c.factors.length ? c.factors : ['مفيش عوامل خطورة واضحة في إجاباتك'],
        buttons: nextButtons(c),
      }),
      bot('وافتكري: ده تقييم احتمالية للتوعية، مش تشخيص. التشخيص بيكون بالأشعة والطبيب.'),
    ],
    chips: ['حضّريلي أسئلة للدكتور', 'أعمل فحوصات إيه؟', 'أنا قلقانة'],
  }
}

function visitReply(c: WanasContext, convo: Conversation): Reply {
  const questions: string[] = []
  if (convo.flagged || c.level === 'urgent') questions.push('التغيير اللي حاساه ده محتاج أشعة إيه؟')
  questions.push(c.age > 0 && c.age < 40 ? 'السونار كفاية ولا محتاجة ماموجرام كمان؟' : 'محتاجة ماموجرام وسونار ولا واحد بس؟')
  questions.push('لو احتجت عيّنة، هتكون إمتى وإزاي؟')
  if (c.familyHistory) questions.push('عندي تاريخ عائلي: محتاجة استشارة وراثية أو تحليل BRCA؟')
  questions.push('النتيجة هتطلع إمتى، وإيه الخطوة اللي بعدها؟')
  questions.push('إمتى ميعاد المتابعة الجاية؟')
  if (!c.doctorName) questions.push('ممكن كود العيادة علشان أربط حسابي في «معاكِ»؟')

  const summary = [
    'السن: ' + (c.age ? c.age + ' سنة' : 'مش متسجّل'),
    'التقييم الأولي: ' + (c.assessed ? c.levelLabel : 'لسه ما اتعملش'),
  ]
  if (c.factors.length) summary.push('عوامل الخطورة: ' + c.factors.join('، '))
  summary.push('الفحوصات المرفوعة: ' + (c.uploads.length ? c.uploads.join('، ') : 'لسه'))

  const copy = 'ملخص حالتي:\n- ' + summary.join('\n- ') + '\n\nأسئلتي للدكتور:\n- ' + questions.join('\n- ')
  return {
    messages: [
      bot('حضّرتلك كل حاجة. ورّي الملخص ده للدكتور، واسأليه الأسئلة دي:', {
        tone: 'pink',
        title: 'جاهزة لزيارة الدكتور',
        sections: [
          { head: 'ملخص حالتك', lines: summary },
          { head: 'أسئلة تسأليها في الكشف', lines: questions },
        ],
        copy,
      }),
    ],
    chips: ['فين أكشف ببلاش؟', 'أنا قلقانة', 'اشرحيلي نتيجتي'],
  }
}

function freeReply(): Reply {
  return {
    messages: [
      bot('فيه أماكن بتكشف ببلاش، اختاري الأقرب ليكي:', {
        tone: 'pink',
        title: 'كشف مجاني في مصر',
        lines: HOTLINES.map((h) => `${h.label}: ${h.note}`),
        numbers: FREE,
      }),
    ],
    chips: ['حضّريلي أسئلة للدكتور', 'هل الماموجرام بيوجع؟', 'أنا قلقانة'],
  }
}

function testsReply(c: WanasContext): Reply {
  const under40 = c.age > 0 && c.age < 40
  return {
    messages: [
      bot(
        (under40
          ? 'علشان سنك تحت 40، غالبًا أول فحص هيكون السونار، لأن أنسجة الثدي بتكون كثيفة والسونار بيشوفها أوضح.'
          : 'في سنك، الماموجرام هو الفحص الأساسي، والسونار بيكمّله لو الأنسجة كثيفة.') +
          '\nبس الدكتور هو اللي يحدد في الكشف، والعيّنة ما بتتعملش غير بطلبه.',
        {
          tone: 'pink',
          title: 'الفحوصات اللي غالبًا هيطلبها الدكتور',
          lines: likelyTests(String(c.age)),
          buttons: [
            { label: 'صفحة الدكتور', go: '/doctor' },
            { label: 'فين أكشف ببلاش؟', say: 'فين أكشف ببلاش؟' },
          ],
        },
      ),
    ],
    chips: defaultChips(c),
  }
}

function reportReply(c: WanasContext): Reply {
  // What a radiologist writes in any scan report (the paper she has). The reading made in the app is for her doctor:
  // a percentage alone, without the exam, would frighten or wrongly reassure her, so Wanas never says it.
  const birads: Card = {
    tone: 'pink',
    title: 'تصنيف BI-RADS باختصار',
    lines: [
      '0: محتاجين صور زيادة',
      '1 و 2: طبيعي أو حميد',
      '3: غالباً حميد، ومتابعة بعد 6 شهور',
      '4: فيه اشتباه، ومحتاج عيّنة',
      '5: اشتباه عالي، ومحتاج عيّنة بسرعة',
      '6: تشخيص مؤكد قبل كده',
    ],
    buttons: [{ label: c.uploads.length ? 'الفحوصات' : 'ارفعي الفحوصات', go: '/tests' }],
  }
  if (c.analyzed) {
    const messages = [
      bot(
        isLinked(c)
          ? `قراءة الذكاء الاصطناعي للأشعة وصلت عند ${c.doctorName || 'طبيبك'} مع الصور. القراءة دي معمولة علشان تساعد الدكتور وهو بيقرا الصور، فهو اللي هيشرحهالك مع الكشف.`
          : 'قراءة الذكاء الاصطناعي للأشعة اتحفظت في ملفك. القراءة دي معمولة علشان تساعد الدكتور وهو بيقرا الصور، فلما تكشفي وتربطي حسابك هيشوفها ويشرحهالك.',
      ),
      bot('أما تقرير الأشعة الورق اللي بيكتبه طبيب الأشعة، فأهم حاجة فيه تصنيف BI-RADS:', birads),
      c.biopsy
        ? bot('وتقرير العيّنة وصل لطبيبك. لما يشرحهولك، دي أهم الحاجات اللي هتلاقيها فيه:', {
            tone: 'pink',
            title: 'إزاي تقري تقرير العيّنة',
            lines: [
              'ER وPR: لو موجبين، الورم بيستجيب للعلاج الهرموني',
              'HER2: لو موجب، فيه علاجات موجّهة مخصوص للنوع ده',
              'Grade: من 1 لـ 3، بيوصف سرعة نمو الخلايا',
              'المرحلة (Stage): بتتحدد من التقرير ده مع الفحوصات التانية، مش من الأشعة لوحدها',
            ],
          })
        : bot('ولو الطبيب طلب عيّنة، ارفعي تقريرها في تاب «الفحوصات» وأنا أشرحلك كل كلمة فيه. المرحلة (Stage) بتتحدد من تقرير العيّنة، مش من الأشعة.'),
      bot('ولو قلقانة أو عايزة أسئلة تسأليها للدكتور، أنا معاكِ.'),
    ]
    return { messages, chips: ['حضّريلي أسئلة للدكتور', 'أنا قلقانة', 'اتصلي بالدكتور'] }
  }
  if (c.uploads.length && c.hasScan) {
    return {
      messages: [
        bot('رفعتي الفحوصات، شاطرة. فاضل خطوة: اضغطي «حلّلي النتائج»، والنموذج هيقرا الأشعة ويبعت قراءته لطبيبك، وهو اللي يشرحهالك.', {
          tone: 'pink',
          title: 'الخطوة الجاية',
          lines: ['قراءة الأشعة بالذكاء الاصطناعي لطبيبك'],
          buttons: [{ label: 'روحي للفحوصات', go: '/tests' }],
        }),
      ],
      chips: defaultChips(c),
    }
  }
  return {
    messages: [
      bot(
        c.uploads.length
          ? 'القراءة بتحتاج ماموجرام أو سونار. لما ترفعي واحد منهم، اضغطي «حلّلي النتائج» والقراءة هتروح لطبيبك. ودي فكرة سريعة عن التصنيف اللي هتلاقيه في أي تقرير:'
          : 'لما تعملي الأشعة وترفعيها، هشرحلك تقريرك كلمة كلمة. ودي فكرة سريعة عن تصنيف BI-RADS اللي هتلاقيه في أي تقرير:',
        birads,
      ),
    ],
    chips: defaultChips(c),
  }
}

function calmReply(c: WanasContext): Reply {
  return {
    messages: [
      bot('حقك تقلقي، وده إحساس طبيعي جداً. إنتِ مش لوحدك، وأنا معاكِ خطوة بخطوة.'),
      bot('تعالي نهدّي نفسنا سوا دقيقة:', {
        tone: 'pink',
        title: 'تمرين تنفّس',
        lines: ['خدي نفس لما الدايرة تكبر، واطلّعيه بالراحة لما تصغر', 'كرريه 4 مرات'],
        breathing: true,
      }),
      bot('وافتكري: لما المرض بيتكشف بدري وهو لسه في مكانه، نسبة النجاة بعد 5 سنين بتوصل لحوالي 99%. وده بالظبط اللي بتعمليه دلوقتي.'),
    ],
    chips: ['خلصت التمرين', 'عايزة أكلم حد', c.assessed ? 'اشرحيلي نتيجتي' : 'علميني الفحص الذاتي'],
  }
}

function fact(c: WanasContext, text: string): Reply {
  return { messages: [bot(text)], chips: ['خرافات تانية؟', ...defaultChips(c).slice(0, 3)] }
}

// During treatment: symptoms, medicines, the next step, the doctor's note, the diagnosis and the lab results.
// Returns null when the message is about something else (then the general replies answer it).
function followReply(t: string, has: (words: string[]) => boolean, c: WanasContext): Reply | null {
  const f = c.follow
  if (!f) return null
  const chips = defaultChips(c)
  // Worry and fear get the calming reply (below), not a medical one.
  if (has(['قلق', 'خايف', 'خوف', 'متوتر', 'نفسيا', 'مكتئب', 'زعلان', 'بعيط'])) return null

  if (has(['سخونيه', 'حراره', 'حرارت', 'رعشه', 'سخن'])) {
    const n = t.match(/(\d{2}(?:[.,]\d)?)/)
    const temp = n ? parseFloat(n[1].replace(',', '.')) : null
    if (temp != null && temp >= 38 && temp <= 43) {
      return {
        messages: [
          bot(`حرارة ${temp} وإنتِ على العلاج محتاجة تتصلي بطبيبك فوراً، ولو مش عارفة توصليله روحي أقرب طوارئ.`, {
            tone: 'urgent',
            title: 'كلّمي طبيبك دلوقتي',
            lines: ['ما تستنيش لبكرة', 'خدي معاكِ أوراق العلاج'],
            numbers: doctorNumbers(c, true),
            buttons: [{ label: 'سجّليها في يومياتك', go: '/follow/symptoms' }],
          }),
        ],
        chips,
      }
    }
    return {
      messages: [
        bot('قيسي الحرارة بالترمومتر. لو 38 أو أكتر وإنتِ على العلاج كلّمي طبيبك فوراً أو روحي الطوارئ. ولو أقل، سجّليها في يومياتك علشان طبيبك يتابع.', {
          tone: 'pink',
          title: 'سجّلي الحرارة',
          lines: ['لو الحرارة عالية، طبيبك بيوصله تنبيه على طول'],
          buttons: [{ label: 'يومياتي', go: '/follow/symptoms' }],
        }),
      ],
      chips,
    }
  }
  if (has(['غثيان', 'ترجيع', 'مقرفه', 'نفسي غامه'])) {
    return {
      messages: [
        bot('الغثيان بعد الجلسات معروف. جربي وجبات صغيرة على مرات، واشربي سوايل على رشفات، وابعدي عن الأكل الدسم والروايح القوية. ولو مش قادرة تشربي خالص، كلّمي طبيبك.', {
          tone: 'pink',
          title: 'سجّليه علشان طبيبك يتابع',
          lines: ['التسجيل اليومي بيساعد طبيبك يظبط العلاج'],
          buttons: [
            { label: 'سجّلي أعراضك', go: '/follow/symptoms' },
            { label: 'رسالة للطبيب', go: '/messages' },
          ],
        }),
      ],
      chips,
    }
  }
  if (has(['تعبانه', 'تعب', 'مرهقه', 'مجهده', 'هبقان'])) {
    return {
      messages: [
        bot('التعب من أكتر الأعراض المعروفة أثناء العلاج. ارتاحي على فترات، واتمشي مشي خفيف لو تقدري، ونامي كويس. ولو التعب شديد أو بيزيد، قولي لطبيبك.', {
          tone: 'pink',
          title: 'سجّلي إحساسك النهارده',
          lines: ['طبيبك بيشوف يومياتك'],
          buttons: [{ label: 'سجّلي أعراضك', go: '/follow/symptoms' }],
        }),
      ],
      chips,
    }
  }
  if (has(['الدوا', 'دوا', 'ادويه', 'الحبوب', 'الجرعه'])) {
    return {
      messages: [
        f.meds.length
          ? bot('دي الأدوية اللي طبيبك كتبها:', { tone: 'pink', title: 'أدويتك', lines: f.meds, buttons: [{ label: 'سجّلي إنك أخدتيها', go: '/follow/meds' }] })
          : bot('طبيبك لسه ما كتبش أدوية في التطبيق.'),
        bot('أي سؤال عن الجرعات ابعتيه لطبيبك، أنا ما بغيّرش في الأدوية.'),
      ],
      chips,
    }
  }
  if (has(['الميعاد', 'ميعاد', 'الجلسه الجايه', 'الخطوه الجايه', 'امتي'])) return { messages: [bot('', followCard(c))], chips }
  if (has(['رساله', 'ابعتي للدكتور', 'اسال الدكتور', 'اقول للدكتور', 'اكلم الدكتور'])) return messageReply(c)
  if (has(['ملاحظه', 'الدكتور قال', 'الدكتوره قالت', 'الدكتور كتب', 'الدكتوره كتبت'])) {
    return {
      messages: f.lastNote
        ? [bot('آخر ملاحظة من طبيبك:', { tone: 'pink', title: 'ملاحظة الطبيب', lines: [f.lastNote] }), bot('لو فيه كلمة مش واضحة، اسأليني عنها.')]
        : [bot('طبيبك لسه ما كتبش ملاحظات.')],
      chips,
    }
  }
  if (has(['تشخيصي', 'المرحله', 'stage', 'her2', 'هرمون'])) {
    return {
      messages: [
        bot('ده تشخيصك زي ما طبيبك أكده، بكلام بسيط:', {
          tone: 'pink',
          title: `Stage ${f.stage} · ${f.receptors}`,
          lines: [
            'المرحلة (Stage) بتوصف حجم الورم والغدد وهل انتشر، وعلى أساسها بتتحدد الخطة',
            f.hormonal
              ? 'ER/PR موجب: الورم بيستجيب للهرمونات، فالعلاج الهرموني بيكون جزء من الخطة'
              : 'ER/PR سالب: العلاج الهرموني مش هيفيد، وطبيبك بيختار علاجات تانية',
            f.her2 ? 'HER2 موجب: فيه علاجات موجّهة مخصوص للنوع ده' : 'HER2 سالب: نوع شائع وليه علاجات معروفة',
            ...(f.grade ? [`Grade ${f.grade}: سرعة نمو الخلايا من 1 (بطيئة) لـ 3 (أسرع)`] : []),
          ],
        }),
        bot('اسألي طبيبك عن أي حاجة في خطتك، وأنا أساعدك تكتبي السؤال.'),
      ],
      chips,
    }
  }
  if (has(['تحاليل', 'تحليل', 'نتايج', 'ca 15', 'wbc', 'هيموجلوبين'])) {
    return {
      messages: f.labs.length
        ? [
            bot('دي آخر نتايج تحاليلك:', { tone: 'pink', title: 'نتايجك', lines: f.labs, buttons: [{ label: 'التحاليل', go: '/follow/labs' }] }),
            bot('طبيبك بيشوف النتايج دي. ولو رقم برّه المرجعي، ده مش معناه إن فيه مشكلة أكيد؛ اسألي طبيبك عنه.'),
          ]
        : [bot('لسه ما ضفتيش نتايج تحاليل. ضيفيها من «متابعتي»، وطبيبك هيشوفها على طول.', { tone: 'pink', title: 'ضيفي نتيجة', lines: ['CA 15-3 وصورة الدم'], buttons: [{ label: 'التحاليل', go: '/follow/labs' }] })],
      chips,
    }
  }
  return null
}

// Her message in, Wanas's reply out. The order of the checks matters: the most serious come first.
export function respond(raw: string, c: WanasContext, convo: Conversation): Reply {
  const t = normalize(raw)
  const has = (words: string[]) => hasAny(t, words)
  const chips = defaultChips(c)

  // 1) Safety first.
  if (has(['انتحر', 'اموت نفسي', 'عايزه اموت', 'عاوزه اموت', 'مش عايزه اعيش', 'اخلص من حياتي', 'اذي نفسي'])) {
    return {
      messages: [
        bot('أنا سامعاكِ، واللي حاسة بيه مهم. إنتِ مش لوحدك.\nلو حاسة إنك ممكن تأذي نفسك، كلّمي حد دلوقتي.', {
          tone: 'urgent',
          title: 'كلّمي حد دلوقتي',
          lines: ['خط الدعم النفسي بوزارة الصحة شغال 24 ساعة', 'ولو فيه خطر مباشر كلّمي الإسعاف'],
          numbers: [...PSY, EMERGENCY],
        }),
      ],
      chips: ['أنا قلقانة', 'عايزة أكلم حد'],
    }
  }

  // 2) During treatment, questions about the treatment.
  if (c.mode === 'follow' && !convo.awaiting) {
    const r = followReply(t, has, c)
    if (r) return r
  }

  // 3) Answers to a question Wanas just asked.
  if (convo.awaiting === 'period') {
    const note = `وبعدها هفكّرك ${everyText(c.reminderEvery)} في نفس الميعاد`
    if (has(['اقل من اسبوع', 'من يومين', 'من كام يوم', 'لسه', 'النهارده', 'امبارح'])) return reminderReply(c, 5, note)
    if (has(['اسبوعين'])) return reminderReply(c, 21, note)
    if (has(['3 اسابيع', 'تلات اسابيع', 'تلت اسابيع', 'اكتر'])) return reminderReply(c, 14, note)
    if (has(['انقطعت', 'مش منتظمه', 'مبتجيش', 'سن الياس', 'حامل', 'برضع']))
      return reminderReply(
        c,
        daysToFirstOfNextMonth(),
        c.reminderEvery > 1
          ? `وبعدها هفكّرك ${everyText(c.reminderEvery)} في أول الشهر، لأن الميعاد الثابت أسهل`
          : 'وبعدها هفكّرك أول كل شهر، لأن الميعاد الثابت أسهل',
      )
  }
  if (convo.awaiting === 'coach') {
    if (has(['لاحظت', 'غريبه', 'حسيت', 'كتله', 'تغيير'])) return redFlagReply()
    if (has(['خلصت', 'اللي بعده', 'التاليه', 'تمام', 'كملي', 'ماشي', 'ايوه'])) {
      const next = convo.coachStep + 1
      if (next >= SELF_EXAM_STEPS.length) {
        return {
          messages: [bot('برافو عليكِ! كده خلّصتي الفحص الذاتي كله.\nلو كل حاجة طبيعية، كرّريه كل شهر. تحبي أفكّرك بيه؟')],
          chips: ['أيوه فكّريني', 'لا شكراً'],
          awaiting: 'coachEnd',
          coachStep: 0,
        }
      }
      return coachReply(next)
    }
  }
  if (convo.awaiting === 'coachEnd') {
    if (has(['ايوه', 'فكريني', 'فكرني', 'ماشي', 'تمام'])) return askPeriod(monthsAsked(t))
    if (has(['لا شكرا', 'مش دلوقتي']) || t.trim() === 'لا')
      return { messages: [bot('ولا يهمك. أنا هنا لو احتجتيني في أي وقت.')], chips }
  }

  // 4) Reports and scans.
  if (has(['bi-rads', 'birads', 'bi rads', 'بايرادس', 'تقرير', 'نتيجه الاشعه', 'الاشعه بتقول', 'الاشعه طلعت', 'عينه', 'her2', 'stage', 'المرحله', 'grade', 'باثولوجي', 'حلل', 'التحليل', '4a']))
    return reportReply(c)

  // 5) Common myths and facts.
  if (has(['مزيل العرق', 'مزيل عرق', 'ديودرنت', 'مضاد التعرق']))
    return fact(c, 'لا. مفيش أي دليل علمي إن مزيل العرق أو مضاد التعرّق بيسبب سرطان الثدي. استخدميه عادي.')
  if (has(['سوتيان', 'البرا', 'الصدريه', 'بسلك'])) return fact(c, 'لا. لبس الصدرية، حتى اللي بسلك، مالوش علاقة بسرطان الثدي.')
  if (has(['راجل', 'رجاله', 'الرجال']))
    return fact(c, 'أيوه، بس نادر: حوالي 1% من الحالات بتكون في الرجالة. ولو راجل لاحظ كتلة في صدره لازم يكشف.')
  if (has(['ماموجرام', 'الاشعه']) && has(['بيوجع', 'وجع', 'اشعاع', 'خطر', 'مؤذي', 'موذي', 'ضرر']))
    return fact(c, 'الماموجرام بياخد ثواني، وممكن يضايق شوية من الضغط، بس الوجع بسيط وبيروح على طول.\nوالإشعاع فيه قليل جداً، وفايدته في الاكتشاف المبكر أكبر بكتير.')
  if (has(['وراثي', 'وراثه', 'مامتي', 'امي عندها', 'اختي عندها', 'خالتي', 'عمتي', 'جدتي', 'جينات', 'brca']))
    return fact(
      c,
      'التاريخ العائلي بيزوّد الاحتمال، خصوصاً لو أم أو أخت أو بنت. بس أغلب الستات اللي بيجيلهم المرض مالهمش تاريخ عائلي، والحالات الوراثية حوالي 5 لـ 10% بس.\nلو عندك قريبة من الدرجة الأولى، اسألي الطبيب عن بدء الفحص بدري وعن الاستشارة الوراثية.',
    )
  if (has(['رضاعه', 'برضع'])) return fact(c, 'الرضاعة الطبيعية بتقلل احتمال الإصابة شوية، وكل ما طالت مدتها كان أفضل.')
  if (has(['خرافات', 'خرافه', 'اشاعات', 'معلومات غلط'])) {
    return {
      messages: [
        bot('دي أشهر خرافات بنسمعها، والحقيقة:', {
          tone: 'green',
          title: 'الحقيقة',
          lines: [
            'مزيل العرق مش بيسبب سرطان',
            'الصدرية مالهاش علاقة، حتى اللي بسلك',
            'الرجالة ممكن يجيلهم، بس نادر',
            'أغلب الحالات من غير تاريخ عائلي',
            'الماموجرام آمن وبياخد ثواني',
            'الكتلة مش معناها سرطان: أغلبها حميد',
          ],
        }),
      ],
      chips,
    }
  }
  if (has(['حميد', 'خبيث']) && !has(['عندي', 'حاسه', 'لقيت', 'لاحظت']))
    return fact(
      c,
      'الورم الحميد: خلايا بتكبر، بس مش بتنتشر ولا بتهاجم الأنسجة اللي حواليها، زي الفيبروأدينوما والأكياس.\nالخبيث (السرطان): خلايا ممكن تنتشر، وعلشان كده الاكتشاف بدري بيفرق جداً. والفرق بينهم بيتأكد بالعيّنة.',
    )

  // 6) Warning signs.
  const bloody = has(['دم', 'نزيف'])
  if (
    has(['كتله', 'كتل', 'ورم', 'تكتل', 'حبايه', 'حاجه ناشفه', 'تورم', 'انكماش', 'قشره البرتقال', 'قشر البرتقال', 'دخلت لجوه', 'اتسحبت', 'احمرار', 'الجلد اتغير', 'نقره', 'غمازه']) ||
    (bloody && has(['حلمه', 'صدر', 'ثدي', 'افرازات', 'بيطلع', 'بينزل']))
  )
    return redFlagReply()
  if (has(['افرازات', 'سايل', 'بيطلع لبن', 'بينزل لبن'])) {
    return {
      messages: [
        bot('الإفرازات الشفافة أو اللبنية من الناحيتين غالباً بتكون هرمونية ومش مقلقة.\nبس اكشفي لو الإفرازات بتنزل لوحدها من غير ضغط، أو من ناحية واحدة بس، أو فيها دم.', {
          tone: 'pink',
          title: 'إمتى أكشف؟',
          lines: ['إفرازات فيها دم: كشف خلال أسبوعين', 'إفرازات من حلمة واحدة ومستمرة', 'معاها كتلة أو تغيّر في الجلد'],
          buttons: [{ label: 'ابدئي التقييم', go: '/assess' }],
        }),
      ],
      chips,
    }
  }
  if (has(['بيخف', 'بيتعالج', 'هموت', 'خطير', 'ليه علاج', 'الشفا', 'بيموت']))
    return fact(c, 'سرطان الثدي من أكتر الأنواع اللي ليها علاج ناجح، خصوصاً لما يتكشف بدري.\nلما بيتكشف وهو لسه في مكانه، نسبة النجاة بعد 5 سنين بتوصل لحوالي 99%.')
  if (has(['وجع', 'بيوجعني', 'بتوجعني', 'الم في', 'بيشد', 'شكه', 'بيحرقني'])) {
    return {
      messages: [
        bot('وجع الثدي لوحده غالباً مش علامة سرطان، وكتير بيكون مرتبط بالهرمونات قبل الدورة.\nبس اكشفي لو الوجع في مكان واحد ومستمر أكتر من أسبوعين، أو معاه كتلة أو احمرار.'),
      ],
      chips: ['حاسة بكتلة، أعمل إيه؟', 'علميني الفحص الذاتي', 'أنا قلقانة'],
    }
  }

  // 7) Things Wanas can do.
  if (has(['الفحص الذاتي', 'افحص نفسي', 'علميني', 'ازاي افحص', 'خطوات الفحص', 'اعمل الفحص', 'فحص ذاتي'])) return coachReply(0)
  if (has(['فكريني', 'فكرني', 'ذكريني', 'ذكرني', 'تذكير', 'منبه', 'نبهيني', 'نبهني', 'افتكر', 'كل شهر', 'خليها كل', 'خليه كل']))
    return askPeriod(monthsAsked(t))
  if (has(['نتيجتي', 'نتيجه التقييم', 'التقييم', 'احتمال', 'حالتي', 'طلعلي'])) return resultReply(c)
  if (has(['اسئله للدكتور', 'اسال الدكتور', 'اقول للدكتور', 'حضريلي', 'زياره', 'ملخص'])) return visitReply(c, convo)
  if (has(['اكلم حد', 'حد اكلمه', 'دعم نفسي', 'اتكلم مع حد', 'اخصائي', 'نفسيتي'])) {
    return {
      messages: [
        bot('أكيد، الكلام مع حد بيفرق. تقدري تكلّمي:', {
          tone: 'pink',
          title: 'ناس تسمعك',
          lines: ['خط الدعم النفسي بوزارة الصحة شغال 24 ساعة', 'أو كلّمي طبيبك وقوليله على قلقك'],
          numbers: PSY,
        }),
      ],
      chips,
    }
  }
  if (isLinked(c) && has(['رساله', 'ابعتي للدكتور', 'اسال الدكتور', 'اقول للدكتور'])) return messageReply(c)
  if (has(['خلصت التمرين', 'التمرين', 'احسن شويه', 'هديت']))
    return { messages: [bot('برافو عليكِ. التنفّس البطيء بيهدّي ضربات القلب ويخفّف التوتر. ارجعيله في أي وقت تحتاجيه.')], chips }
  if (has(['قلق', 'خايف', 'خوف', 'مرعوب', 'متوتر', 'توتر', 'زعلان', 'بعيط', 'مش قادره', 'مضايق', 'مخنوق', 'مكتئب'])) return calmReply(c)
  if (has(['ببلاش', 'مجان', 'فلوس', 'مش معايا', 'تكلفه', 'غالي', 'فين اكشف', 'اقرب مكان', 'مستشفي', 'وحده صحيه', 'بهيه', 'مبادره', '100 مليون']))
    return freeReply()
  if (has(['ماموجرام', 'سونار', 'فحوصات', 'اعمل ايه', 'اكشف ازاي', 'اشعه ايه', 'الاشعه'])) return testsReply(c)
  if (has(['ارفع', 'رفع'])) {
    return {
      messages: [
        bot(
          'ارفعي صور الأشعة أو التقارير من تاب «الفحوصات».' +
            (c.doctorName
              ? `\nوأي فحص ترفعيه هيظهر في ملفك عند ${c.doctorName}.`
              : '\nولو لسه ما ربطتيش حسابك بطبيبك، اربطيه بالكود من تاب «الدكتور» علشان يشوف الفحوصات.'),
          {
            tone: 'pink',
            title: 'رفع الفحوصات',
            lines: ['ماموجرام أو سونار', 'تقرير العيّنة لو موجود', 'تحاليل الدم للمتابعة'],
            buttons: [{ label: 'روحي للفحوصات', go: '/tests' }],
          },
        ),
      ],
      chips,
    }
  }
  if (has(['رقم الدكتور', 'اكلم الدكتور', 'اتصل', 'احجز', 'ميعاد', 'الدكتور', 'دكتور'])) {
    return {
      messages: c.doctorName
        ? [
            bot(c.mode === 'pending' ? 'طلب الربط مع طبيبك مستني الموافقة:' : 'ده طبيبك المربوط بحسابك:', {
              tone: 'pink',
              title: c.doctorName,
              lines: [c.doctorPlace],
              numbers: doctorNumbers(c, false),
              buttons: [
                { label: 'حضّريلي أسئلة للدكتور', say: 'حضّريلي أسئلة للدكتور' },
                { label: 'صفحة الدكتور', go: '/doctor' },
              ],
            }),
          ]
        : [
            bot('لسه ما ربطتيش حسابك بدكتور. في الكشف خدي الكود من العيادة واربطي حسابك، وساعتها هيشوف تقييمك وفحوصاتك.', {
              tone: 'pink',
              title: 'اربطي حسابك بطبيبك',
              lines: ['اكشفي عند دكتور', 'خدي الكود من العيادة', 'اكتبيه في تاب «الدكتور»'],
              buttons: [
                { label: 'صفحة الدكتور', go: '/doctor' },
                { label: 'فين أكشف ببلاش؟', say: 'فين أكشف ببلاش؟' },
              ],
            }),
          ],
      chips,
    }
  }

  // 8) Small talk, and everything else.
  if (has(['انتي مين', 'مين انتي', 'تقدري تعملي', 'بتعملي ايه', 'بتساعدي'])) return { messages: [bot('أنا ونس، رفيقتك الذكية في معاكِ.', HELP)], chips }
  if (has(['شكرا', 'متشكر', 'تسلمي', 'ميرسي', 'thank'])) return { messages: [bot(`العفو يا ${c.name}، أنا هنا في أي وقت.`)], chips }
  if (has(['اهلا', 'السلام', 'ازيك', 'هاي', 'صباح', 'مساء', 'hello']) || t.trim() === 'hi')
    return { messages: [bot(`أهلاً بيكي يا ${c.name}! أقدر أساعدك في إيه النهارده؟`)], chips }
  return { messages: [bot('سؤال حلو! أنا لسه بتعلّم، بس أقدر أساعدك في الحاجات دي:', HELP)], chips, fallback: true }
}
