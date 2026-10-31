import { useNavigate } from 'react-router'
import { useMode, useMyDoctor, useMyRecord } from '../store/doctor'
import { useTests } from '../store/tests'
import { Icon } from './Icon'

// On the home screen: where things stand with her doctor (a dark bar), or the good news after the review.
export function LinkBanner() {
  const navigate = useNavigate()
  const mode = useMode()
  const doctor = useMyDoctor()
  const record = useMyRecord()
  const localUploads = useTests((s) => Object.keys(s.uploads).length)
  const dn = doctor ? doctor.name : 'طبيبك'

  if (mode === 'pending') {
    return (
      <button type="button" className="banner" onClick={() => navigate('/doctor')}>
        طلب الربط مع {dn} مستني الموافقة
      </button>
    )
  }
  if (mode === 'linked') {
    const hasFiles = localUploads > 0 || !!(record && record.uploads && record.uploads.length)
    const ordered = !!(record && record.orders && record.orders.tests.length)
    return (
      <button type="button" className="banner" onClick={() => navigate('/doctor')}>
        {hasFiles ? `نتايجك عند ${dn} للمراجعة` : ordered ? `عندك فحوصات مطلوبة من ${dn}` : `حسابك مربوط مع ${dn}`}
      </button>
    )
  }
  if (mode === 'routine') {
    const benign = record?.diagnosis?.result === 'benign'
    return (
      <section className="wcard" style={{ background: '#EAF7EE' }}>
        <h2 className="h2p" style={{ color: '#1E6B34' }}>
          <Icon name="check" color="#1E6B34" stroke={3} />
          نتيجتك مطمّنة
        </h2>
        <p className="body15">
          نتايجك اتراجعت عند {dn}: {benign ? 'الورم حميد' : 'كل حاجة سليمة'}. كمّلي الفحص الذاتي كل شهر، والفحص الدوري حسب طبيبك، وأي تغيير قوليلنا.
        </p>
        <button type="button" className="mbtn" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/messages')}>
          الرسائل
        </button>
      </section>
    )
  }
  return null
}
