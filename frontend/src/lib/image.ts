// Makes a small preview (about 160px) of a picture, small enough to keep in the browser.
// Gives back null for files that aren't pictures, like PDF or DICOM.
export async function makeThumbnail(file: Blob, size = 160): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return null // a picture the browser can't open (for example HEIC): show its name instead
  } finally {
    URL.revokeObjectURL(url)
  }
}
