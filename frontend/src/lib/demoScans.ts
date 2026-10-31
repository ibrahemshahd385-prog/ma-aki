import type { TestId } from '../data/tests'

// Practice pictures for "جرّبي بملفات تجريبية" and for the practice patients in the doctor's dashboard.
// They are drawn here in the browser, they are nobody's scans, and each one says so on the picture itself.
// They only let the journey be shown (upload, the doctor opens and zooms) without real files.

export type PracticeFile = { blob: Blob; name: string; type: string }

// A small random-number generator with a seed, so the same patient always gets the same pictures.
function seeded(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FONT = 'Cairo, "Segoe UI", Tahoma, sans-serif'

function newCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  return { c, g }
}

function arabic(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight = 700) {
  g.direction = 'rtl'
  g.textAlign = 'right'
  g.font = `${weight} ${size}px ${FONT}`
  g.fillStyle = color
  g.fillText(text, x, y)
}

function latin(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight = 600) {
  g.direction = 'ltr'
  g.textAlign = 'left'
  g.font = `${weight} ${size}px ${FONT}`
  g.fillStyle = color
  g.fillText(text, x, y)
}

// "تجريبي" across the picture, and a band at the bottom that says it isn't real.
function markAsPractice(g: CanvasRenderingContext2D, w: number, h: number, dark: boolean) {
  g.save()
  g.translate(w / 2, h / 2)
  g.rotate(-Math.PI / 6)
  g.globalAlpha = dark ? 0.13 : 0.08
  for (let i = -2; i <= 2; i++) arabic(g, 'تجريبي · تجريبي', 330, i * 300, 120, dark ? '#FFFFFF' : '#A3123A', 800)
  g.restore()
  g.fillStyle = dark ? 'rgba(224,23,127,0.85)' : 'rgba(224,23,127,0.92)'
  g.fillRect(0, h - 64, w, 64)
  arabic(g, 'صورة تجريبية للعرض في تطبيق «معاكِ» · مش أشعة ولا تقرير حقيقي', w - 24, h - 22, 26, '#FFFFFF', 800)
}

// Film grain: a little noise on every pixel.
function grain(g: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, amount: number) {
  const img = g.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount
    d[i] = Math.max(0, Math.min(255, d[i] + n))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n))
  }
  g.putImageData(img, 0, 0)
}

// A mammogram-like picture (left breast, side view) with a small bright spot.
function mammogram(rnd: () => number) {
  const W = 900
  const H = 1200
  const { c, g } = newCanvas(W, H)
  g.fillStyle = '#000000'
  g.fillRect(0, 0, W, H)
  const breast = new Path2D()
  breast.moveTo(0, 70)
  breast.bezierCurveTo(380, 110, 760, 420, 780, 690)
  breast.bezierCurveTo(795, 900, 520, 1100, 0, 1130)
  breast.closePath()
  g.save()
  g.clip(breast)
  const base = g.createRadialGradient(140, 620, 40, 140, 620, 840)
  base.addColorStop(0, '#9C9C9C')
  base.addColorStop(0.55, '#6E6E6E')
  base.addColorStop(1, '#262626')
  g.fillStyle = base
  g.fillRect(0, 0, W, H)
  // The tissue: soft bright streaks, drawn on their own layer and blurred.
  const tissue = newCanvas(W, H)
  for (let i = 0; i < 320; i++) {
    tissue.g.fillStyle = `rgba(235,235,235,${0.04 + rnd() * 0.08})`
    tissue.g.beginPath()
    tissue.g.ellipse(60 + rnd() * 620, 240 + rnd() * 760, 20 + rnd() * 80, 6 + rnd() * 20, (rnd() - 0.5) * 0.9, 0, Math.PI * 2)
    tissue.g.fill()
  }
  g.filter = 'blur(7px)'
  g.drawImage(tissue.c, 0, 0)
  g.filter = 'none'
  g.fillStyle = 'rgba(205,205,205,0.33)'
  g.beginPath()
  g.moveTo(0, 50)
  g.lineTo(340, 95)
  g.lineTo(0, 560)
  g.closePath()
  g.fill()
  const fx = 460 + rnd() * 130
  const fy = 540 + rnd() * 170
  const spot = g.createRadialGradient(fx, fy, 2, fx, fy, 32)
  spot.addColorStop(0, 'rgba(255,255,255,0.95)')
  spot.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = spot
  g.beginPath()
  g.arc(fx, fy, 32, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.32)'
  g.lineWidth = 2
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2
    const r = 26 + rnd() * 32
    g.beginPath()
    g.moveTo(fx, fy)
    g.lineTo(fx + Math.cos(a) * r, fy + Math.sin(a) * r)
    g.stroke()
  }
  g.restore()
  g.strokeStyle = 'rgba(255,255,255,0.45)'
  g.lineWidth = 3
  g.stroke(breast)
  grain(g, W, H, rnd, 22)
  latin(g, 'L MLO', W - 150, 70, 34, '#FFFFFF', 700)
  markAsPractice(g, W, H, true)
  return c
}

// An ultrasound-like picture: the fan shape, speckle, a dark oval and the shadow under it.
function ultrasound(rnd: () => number) {
  const W = 1000
  const H = 760
  const { c, g } = newCanvas(W, H)
  const small = newCanvas(Math.round(W / 4), Math.round(H / 4))
  const s = small.g.createImageData(small.c.width, small.c.height)
  for (let i = 0; i < s.data.length; i += 4) {
    const v = Math.pow(rnd(), 1.6) * 255
    s.data[i] = s.data[i + 1] = s.data[i + 2] = v
    s.data[i + 3] = 255
  }
  small.g.putImageData(s, 0, 0)
  g.imageSmoothingEnabled = true
  g.filter = 'blur(1.5px)'
  g.drawImage(small.c, 0, 0, W, H)
  g.filter = 'none'
  const img = g.getImageData(0, 0, W, H)
  const d = img.data
  const cx = W / 2
  const top = 30
  const R = 700
  const half = 0.62
  const mass = { x: cx + (rnd() - 0.5) * 180, y: 330 + rnd() * 90, rx: 95, ry: 58 }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const dx = x - cx
      const dy = y - top
      const r = Math.hypot(dx, dy)
      if (r < 50 || r > R || Math.abs(Math.atan2(dx, dy)) > half) {
        d[i] = d[i + 1] = d[i + 2] = 0
        continue
      }
      let v = d[i] * (1 - (r / R) * 0.5)
      if (r < 110) v = Math.min(255, v + 55)
      const ex = (x - mass.x) / mass.rx
      const ey = (y - mass.y) / mass.ry
      const e = ex * ex + ey * ey + Math.sin(Math.atan2(ey, ex) * 7) * 0.06
      if (e < 1) v *= 0.16
      else if (e < 1.12) v = Math.min(255, v * 1.35)
      else if (Math.abs(x - mass.x) < mass.rx * 0.75 && y > mass.y + mass.ry) v *= 0.55
      d[i] = d[i + 1] = d[i + 2] = v
    }
  }
  g.putImageData(img, 0, 0)
  g.strokeStyle = 'rgba(255,255,255,0.7)'
  g.lineWidth = 2
  for (let k = 1; k <= 6; k++) {
    const y = top + k * 100
    g.beginPath()
    g.moveTo(W - 60, y)
    g.lineTo(W - 40, y)
    g.stroke()
    latin(g, k + ' cm', W - 130, y + 8, 20, '#FFFFFF', 600)
  }
  latin(g, 'L BREAST 2:00', 30, 60, 28, '#FFFFFF', 700)
  markAsPractice(g, W, H, true)
  return c
}

// A report page (the biopsy, or the blood tests), in the same practice values the app shows.
function report(kind: 'bio' | 'lab') {
  const W = 1240
  const H = 1500
  const { c, g } = newCanvas(W, H)
  g.fillStyle = '#FFFFFF'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#F6F2F4'
  g.fillRect(0, 0, W, 170)
  arabic(g, kind === 'bio' ? 'تقرير عيّنة (باثولوجي)' : 'تحاليل دم', W - 70, 95, 54, '#3A1027', 800)
  arabic(g, 'معمل تجريبي · نسخة للعرض بس', W - 70, 145, 28, '#7A4A60', 600)
  const rows: [string, string][] =
    kind === 'bio'
      ? [
          ['Specimen', 'Left breast, core biopsy (2 o’clock)'],
          ['Diagnosis', 'Invasive ductal carcinoma (NST)'],
          ['Histological grade', '2'],
          ['Estrogen receptor (ER)', 'Positive (90%)'],
          ['Progesterone receptor (PR)', 'Positive (70%)'],
          ['HER2', 'Negative (score 1+)'],
          ['Ki-67', '15%'],
        ]
      : [
          ['WBC', '6.2  x10³/µL   (4 – 11)'],
          ['Hemoglobin (Hb)', '12.8  g/dL   (12 – 16)'],
          ['Platelets', '250  x10³/µL   (150 – 450)'],
          ['CA 15-3', '24.1  U/mL   (below 30)'],
        ]
  let y = 290
  for (const [k, v] of rows) {
    latin(g, k, 80, y, 32, '#7A4A60', 700)
    latin(g, v, 520, y, 32, '#3A1027', 700)
    g.fillStyle = '#EFE6EA'
    g.fillRect(80, y + 30, W - 160, 2)
    y += 110
  }
  arabic(g, 'ده تقرير متعمل للتجربة في تطبيق «معاكِ»، ومش لمريضة حقيقية.', W - 70, y + 60, 30, '#A3123A', 700)
  markAsPractice(g, W, H, false)
  return c
}

function toJpeg(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.9))
}

const NAMES: Record<TestId, string> = {
  mammo: 'demo-mammogram.jpg',
  us: 'demo-ultrasound.jpg',
  bio: 'demo-biopsy-report.jpg',
  lab: 'demo-blood-test.jpg',
}

const made = new Map<string, Promise<PracticeFile>>()

// The practice picture for one box. "seed" (her file id) changes the details a little from patient to patient.
export function practiceFile(test: TestId, seed: string): Promise<PracticeFile> {
  const key = test + '|' + seed
  let p = made.get(key)
  if (!p) {
    p = (async () => {
      try {
        await document.fonts?.load(`800 40px ${FONT}`)
      } catch {
        // draw with the fallback font
      }
      const rnd = seeded(key)
      const c = test === 'mammo' ? mammogram(rnd) : test === 'us' ? ultrasound(rnd) : report(test)
      return { blob: await toJpeg(c), name: NAMES[test], type: 'image/jpeg' }
    })()
    made.set(key, p)
    p.catch(() => made.delete(key))
  }
  return p
}
