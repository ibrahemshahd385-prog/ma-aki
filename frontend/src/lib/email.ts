// Is this an email someone really has? A new account needs one. Without sending a code the app can't be sure that a
// mailbox exists, but it turns away the made-up ones: a wrong form, a typo in the provider, a domain that doesn't
// exist or doesn't take email, a throwaway inbox, or names like test@... . Returns what to tell her, or null.

const KNOWN = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'yandex.com',
  'mail.ru',
  'zoho.com',
  'mail.com',
  'email.com',
])

// Providers people mistype, to say "did you mean ...?"
const POPULAR = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com']

// Inboxes that last a few minutes
const THROWAWAY = [
  'mailinator',
  'tempmail',
  'temp-mail',
  'tempmailo',
  '10minutemail',
  'guerrillamail',
  'sharklasers',
  'yopmail',
  'trashmail',
  'getnada',
  'dispostable',
  'maildrop',
  'fakeinbox',
  'fakemail',
  'emailfake',
  'throwawaymail',
  'mintemail',
  'mohmal',
  'emailondeck',
  'spamgourmet',
  'tempail',
  'burnermail',
  'moakt',
  'tmpmail',
  'discard.email',
  'mailnesia',
  'mytemp.email',
  '1secmail',
  'tempr.email',
  'inboxkitten',
]

// Domains people write when they make an email up
const MADE_UP = new Set([
  'test.com',
  'test.net',
  'test.org',
  'fake.com',
  'example.com',
  'example.net',
  'example.org',
  'domain.com',
  'email.test',
  'abc.com',
  'xyz.com',
  'aaa.com',
  'asd.com',
  'asdf.com',
  'qwe.com',
  'qwerty.com',
  '123.com',
])

// Names people write when they make an email up (and numbers after them: test1, asdf123 ...)
const MADE_UP_NAME =
  /^(test|testing|tester|fake|asdf|asd|qwe|qwer|qwerty|example|sample|demo|dummy|temp|tmp|null|none|nothing|abc|abcd|abcde|xyz|xxx|user|email|mail|name|admin|aaa+|111+|123|1234|12345|123456)\d*$/

const RESERVED_TLD = /\.(test|example|invalid|localhost|local)$/

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = keep
    }
  }
  return row[b.length]
}

// Does the domain take email? Google's public DNS answers from the browser. No answer (no internet): don't block.
async function takesEmail(domain: string): Promise<boolean | null> {
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), 4000)
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, { signal: stop.signal })
    if (!res.ok) return null
    const data = await res.json()
    if (data?.Status === 3) return false // the domain doesn't exist
    if (data?.Status !== 0) return null
    const mx = (Array.isArray(data.Answer) ? data.Answer : []).filter((r: { type?: number }) => r?.type === 15)
    // "0 ." means the domain says it takes no email
    return mx.some((r: { data?: string }) => typeof r.data === 'string' && !/^\s*0\s+\.\s*$/.test(r.data))
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function checkRealEmail(email: string): Promise<string | null> {
  const clean = email.trim().toLowerCase()
  const at = clean.lastIndexOf('@')
  const local = at > 0 ? clean.slice(0, at) : ''
  const domain = at > 0 ? clean.slice(at + 1) : ''
  const fake = 'الإيميل ده باين إنه تجريبي أو مش حقيقي. اكتبي إيميلك الحقيقي اللي بتستخدميه.'

  if (
    !/^[a-z0-9._%+-]+$/.test(local) ||
    !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(domain) ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..')
  ) {
    return 'الإيميل مش مكتوب صح. مثال: name@gmail.com'
  }
  if (RESERVED_TLD.test(domain) || MADE_UP.has(domain)) return fake
  if (THROWAWAY.some((t) => domain === t || domain.startsWith(t + '.') || domain.includes(t))) {
    return 'الإيميلات المؤقتة مش مقبولة. اكتبي إيميلك الحقيقي (زي Gmail).'
  }

  const name = local.split('+')[0]
  if (MADE_UP_NAME.test(name.replace(/[._-]/g, '')) || /^(.)\1+$/.test(name.replace(/[._-]/g, ''))) return fake

  // A Gmail name is 6 to 30 letters and numbers (the dots don't count)
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    if (!/^[a-z0-9]{6,30}$/.test(name.replace(/\./g, ''))) {
      return 'ده مش إيميل Gmail حقيقي: اسم الإيميل في Gmail بيبقى من 6 لـ 30 حرف ورقم.'
    }
    return null
  }
  if (KNOWN.has(domain)) return null

  // A typo in a well-known provider: gmail.co, gmial.com, hotmial.com ...
  const near = POPULAR.find((p) => distance(domain, p) <= 2)
  if (near) return `اتأكدي من الإيميل: تقصدي ${local}@${near}؟`

  const ok = await takesEmail(domain)
  if (ok === false) return `مفيش عنوان اسمه ${domain} بيستقبل إيميلات. اتأكدي من الإيميل.`
  return null
}
