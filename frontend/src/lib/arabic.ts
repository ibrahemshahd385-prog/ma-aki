// Makes Arabic text easy to compare: removes tashkeel and tatweel, writes أ إ آ as ا, ة as ه, ى as ي,
// ؤ as و and ئ as ي, turns Arabic digits into 0-9, and lower-cases English letters.
export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
}

// True when the (already normalized) text contains any of the words.
export function hasAny(normalizedText: string, words: string[]) {
  return words.some((w) => normalizedText.includes(normalize(w)))
}
