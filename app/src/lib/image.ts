import { MAX_PHOTO_BYTES } from './constants.ts'

// Photos are what a free backend has to store and serve (1 GB of storage and 5 GB of bandwidth a month on the free
// Supabase plan), so every upload is kept small: a full-size copy for the listing page and, for listing photos, a much
// smaller copy for grids, previews and the home page.
export const FULL_EDGE = 1280
export const FULL_QUALITY = 0.8
export const THUMB_EDGE = 480
export const THUMB_QUALITY = 0.7

export interface PreparedPhoto { blob: Blob; ext: string; type: string; thumb?: Blob }

/** Storage path of the small copy kept next to a listing photo (`<name>_t.jpg`). Older photos may not have one. */
export function thumbPath(path: string): string {
  return path.replace(/\.[^./]+$/, '') + '_t.jpg'
}

async function encode(bitmap: ImageBitmap, edge: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Shrinks a phone or camera photo to a web-friendly JPEG before upload. Re-encoding also drops EXIF data such
 * as the GPS location the photo was taken at. If the browser cannot decode the file, ask for a compatible
 * image rather than silently uploading an original that may retain location metadata.
 *
 * With `thumb: true` a small copy is made as well, unless the photo is already no bigger than that.
 */
export async function preparePhoto(file: File, options: { thumb?: boolean } = {}): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) throw new Error('Choose an image file.')
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    try {
      const blob = await encode(bitmap, FULL_EDGE, FULL_QUALITY)
      if (blob && blob.size <= MAX_PHOTO_BYTES) {
        const wantsThumb = options.thumb && Math.max(bitmap.width, bitmap.height) > THUMB_EDGE
        const thumb = wantsThumb ? await encode(bitmap, THUMB_EDGE, THUMB_QUALITY) : null
        return thumb ? { blob, ext: 'jpg', type: 'image/jpeg', thumb } : { blob, ext: 'jpg', type: 'image/jpeg' }
      }
    } finally { bitmap.close() }
  } catch { /* Never fall back to original bytes: they may contain camera/GPS metadata. */ }
  throw new Error("Couldn't read that photo. Try a JPG or PNG.")
}
