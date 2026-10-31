// Free check-up places, and the tests a doctor usually asks for.
// (The doctors themselves are in the shared data: data/seed.ts and store/clinic.ts.)

// Free breast check-ups in Egypt.
export const HOTLINES = [
  { label: 'مبادرة دعم صحة المرأة', number: '15335', note: 'كشف مجاني في أقرب وحدة صحية لأي ست من 18 سنة.' },
  { label: 'مستشفى بهية', number: '16602', note: 'كشف مبكر وعلاج مجاني، وليها فروع في الشيخ زايد والهرم وإسكندرية وطنطا.' },
]

// What a doctor usually asks for, by age. The doctor is the one who decides, in the visit.
export function likelyTests(ageText: string) {
  const age = parseInt(ageText, 10) || 0
  return age > 0 && age < 40
    ? ['سونار على الثدي والإبط', 'ماموجرام لو الطبيب شاف إنه لازم', 'عيّنة (خزعة) بس لو الأشعة احتاجت تأكيد']
    : ['ماموجرام (أشعة على الثدي)', 'سونار على الثدي والإبط', 'عيّنة (خزعة) بس لو الأشعة احتاجت تأكيد']
}
