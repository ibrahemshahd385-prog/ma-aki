// The four kinds of test results she can upload.

export type TestId = 'mammo' | 'us' | 'bio' | 'lab'

export const TEST_SLOTS: { id: TestId; title: string; sub: string }[] = [
  { id: 'mammo', title: 'ماموجرام', sub: 'صور الأشعة (DICOM أو صورة)' },
  { id: 'us', title: 'سونار', sub: 'صور السونار أو التقرير' },
  { id: 'bio', title: 'تقرير العيّنة', sub: 'تقرير الباثولوجي (PDF أو صورة)' },
  { id: 'lab', title: 'تحاليل دم', sub: 'CBC و CA 15-3 للمتابعة' },
]