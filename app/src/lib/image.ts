import { MAX_PHOTO_BYTES } from './constants'

const MAX_EDGE = 1600
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif']
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/heic': 'heic', 'image/heif': 'heif' }

export interface PreparedPhoto { blob: Blob; ext: string; type: string }

/**
 * Shrinks a phone or camera photo to a web-friendly JPEG before upload. Re-encoding also drops EXIF data such
 * as the GPS location the photo was taken at. If the browser cannot decode the file (for example HEIC on some
 * laptops) the original is uploaded as long as it is an allowed type under the size limit.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) throw new Error('Choose an image file.')
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(bitmap, 0, 0, width, height)
      bitmap.close()
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      if (blob && blob.size <= MAX_PHOTO_BYTES) return { blob, ext: 'jpg', type: 'image/jpeg' }
    }
  } catch { /* fall through to the original file */ }
  if (ALLOWED.includes(file.type) && file.size <= MAX_PHOTO_BYTES) return { blob: file, ext: EXT[file.type], type: file.type }
  throw new Error("Couldn't read that photo. Try a JPG or PNG.")
}
