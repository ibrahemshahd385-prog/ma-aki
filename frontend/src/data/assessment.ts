// The assessment: the questions, the points for each answer, and how the points become a level.

export type Level = 'urgent' | 'high' | 'mid' | 'low'

type Option = {
  label: string
  points: number
  urgent?: boolean // this answer alone means "see a doctor soon"
  factor?: string // shown in the result under "what affected it"
}

type Question = { id: string; text: string; hint?: string; options: Option[] }

export const QUESTIONS: Question[] = [
  {
    id: 'fam',
    text: 'هل فيه حد من العيلة اتصاب بسرطان الثدي أو المبيض؟',
    hint: 'التاريخ العائلي من أهم عوامل الخطورة.',
    options: [
      { label: 'لا', points: 0 },
      { label: 'أيوه، قريبة درجة أولى (أم / أخت / بنت)', points: 3, factor: 'تاريخ عائلي من الدرجة الأولى' },
      { label: 'أيوه، درجة تانية (خالة / عمة / جدة)', points: 1, factor: 'تاريخ عائلي من الدرجة التانية' },
      { label: 'مش عارفة', points: 0.5 },
    ],
  },
  {
    id: 'lump',
    text: 'حاسة بكتلة أو تكتّل في الثدي أو تحت الإبط؟',
    hint: 'جربي بأطراف صوابعك زي ما شفتي في الفحص الذاتي.',
    options: [
      { label: 'لا', points: 0 },
      { label: 'أيوه، في الثدي', points: 3, urgent: true, factor: 'كتلة ملحوظة في الثدي' },
      { label: 'أيوه، تحت الإبط', points: 3, urgent: true, factor: 'تكتّل تحت الإبط' },
      { label: 'مش متأكدة', points: 1, factor: 'شك في وجود كتلة' },
    ],
  },
  {
    id: 'skin',
    text: 'فيه تغيّر في جلد الثدي؟',
    hint: 'زي احمرار، أو جلد شبه قشرة البرتقال، أو انكماش.',
    options: [
      { label: 'لا', points: 0 },
      { label: 'أيوه', points: 2, urgent: true, factor: 'تغيّر في الجلد' },
    ],
  },
  {
    id: 'nip',
    text: 'فيه إفرازات أو تغيّر في الحلمة؟',
    hint: 'من غير رضاعة أو حمل.',
    options: [
      { label: 'لا', points: 0 },
      { label: 'إفرازات شفافة أو لبنية', points: 1, factor: 'إفرازات من الحلمة' },
      { label: 'إفرازات فيها دم', points: 3, urgent: true, factor: 'إفرازات دموية' },
      { label: 'الحلمة دخلت لجوه حديثاً', points: 2, urgent: true, factor: 'انقلاب حديث في الحلمة' },
    ],
  },
  {
    id: 'size',
    text: 'لاحظتي تغيّر في حجم أو شكل أحد الثديين؟',
    hint: 'قارني بين الناحيتين قدام المراية.',
    options: [
      { label: 'لا', points: 0 },
      { label: 'أيوه', points: 2, factor: 'تغيّر في الحجم أو الشكل' },
    ],
  },
  {
    id: 'horm',
    text: 'استخدمتي علاج هرموني أو حبوب منع حمل أكتر من 5 سنين؟',
    options: [
      { label: 'لا', points: 0 },
      { label: 'أيوه', points: 1, factor: 'علاج هرموني لمدة طويلة' },
    ],
  },
  {
    id: 'rad',
    text: 'اتعرضتي قبل كده لعلاج إشعاعي على الصدر أو ورم سابق؟',
    options: [
      { label: 'لا', points: 0 },
      { label: 'أيوه', points: 2, factor: 'إشعاع أو ورم سابق' },
    ],
  },
  {
    id: 'mens',
    text: 'الدورة بدأت قبل سن 12، أو انقطعت بعد سن 55؟',
    hint: 'ده بيزوّد التعرّض للهرمونات على مدى العمر.',
    options: [
      { label: 'لا', points: 0 },
      { label: 'أيوه', points: 0.5, factor: 'تعرّض هرموني طويل' },
      { label: 'مش عارفة', points: 0 },
    ],
  },
]

export const CHRONIC = [
  { id: 'none', label: 'لا يوجد' },
  { id: 'diabetes', label: 'سكر' },
  { id: 'bp', label: 'ضغط' },
  { id: 'obesity', label: 'زيادة وزن' },
  { id: 'thyroid', label: 'غدة درقية' },
  { id: 'smoke', label: 'تدخين' },
]

export const LEVELS: Record<Level, { label: string; color: string; width: string; message: string }> = {
  urgent: {
    label: 'يُنصح بكشف قريب',
    color: '#A3123A',
    width: '92%',
    message: 'إجاباتك فيها علامات محتاجة كشف عند طبيب خلال أسبوعين. اطمني، أغلب الكتل بتطلع حميدة، بس الكشف بدري هو اللي بيفرق.',
  },
  high: {
    label: 'احتمال مرتفع',
    color: '#E0177F',
    width: '74%',
    message: 'عندك أكتر من عامل خطورة. الأفضل تكشفي عند طبيب، وهو يحدد الفحوصات المناسبة ليكي.',
  },
  mid: {
    label: 'احتمال متوسط',
    color: '#B4541A',
    width: '48%',
    message: 'فيه عوامل بسيطة تستاهل متابعة. اعملي فحص دوري عند الطبيب، وكمّلي الفحص الذاتي كل شهر.',
  },
  low: {
    label: 'احتمال منخفض',
    color: '#1E6B34',
    width: '16%',
    message: 'مفيش علامات مقلقة دلوقتي. كمّلي الفحص الذاتي كل شهر، وهنفكّرك بميعاده.',
  },
}

export type AssessmentResult = { score: number; level: Level; factors: string[] }

// Adds up the points. Any "urgent" answer makes the level urgent; otherwise 5+ is high and 2.5+ is mid.
export function scoreAssessment(ageText: string, chronic: string[], answers: Record<string, number>): AssessmentResult {
  const age = parseInt(ageText, 10) || 0
  let score = 0
  let urgent = false
  const factors: string[] = []

  if (age >= 50) {
    score += 2
    factors.push('السن فوق 50')
  } else if (age >= 40) {
    score += 1
    factors.push('السن فوق 40')
  }
  if (chronic.includes('obesity')) {
    score += 1
    factors.push('زيادة الوزن')
  }
  if (chronic.includes('smoke')) {
    score += 0.5
    factors.push('التدخين')
  }

  for (const q of QUESTIONS) {
    const chosen = answers[q.id]
    if (chosen === undefined) continue
    const option = q.options[chosen]
    if (!option) continue
    score += option.points
    if (option.urgent) urgent = true
    if (option.factor) factors.push(option.factor)
  }

  const level: Level = urgent ? 'urgent' : score >= 5 ? 'high' : score >= 2.5 ? 'mid' : 'low'
  return { score, level, factors }
}