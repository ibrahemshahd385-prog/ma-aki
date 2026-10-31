import type { Doctor } from '../data/clinic'
import { normalize } from '../lib/arabic'
import { Icon } from './Icon'

// A phone number as a tel: link, or null when it isn't a real number yet. Egyptian mobiles get +2.
export function telOf(phone: string) {
  const digits = normalize(phone).replace(/\D/g, '')
  if (digits.length < 8) return null
  return 'tel:' + (digits.length === 11 && digits[0] === '0' ? '+2' + digits : digits)
}

// The doctor's number as a call button. It shows once the doctor writes it in the dashboard ("حسابي").
export function DoctorPhone({ doctor }: { doctor: Doctor | null }) {
  const tel = doctor && doctor.phone ? telOf(doctor.phone) : null
  if (!doctor || !tel) return null
  return (
    <a href={tel} className="pill-phone">
      <Icon name="phone" size={18} color="#B80F68" stroke={2.2} />
      <span dir="ltr">{doctor.phone}</span>
    </a>
  )
}
