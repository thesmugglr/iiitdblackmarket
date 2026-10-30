import { MAX_PHOTOS, MAX_PHOTO_BYTES } from './constants.ts'

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'])
type Photo = Pick<File, 'type' | 'size'>

/** Validate the whole selection before uploading any file. Storage enforces these limits too. */
export function validatePhotoBatch(existing: number, files: readonly Photo[]): string | undefined {
  if (existing + files.length > MAX_PHOTOS) return `At most ${MAX_PHOTOS} photos.`
  if (files.some(file => !imageTypes.has(file.type))) return 'Choose JPEG, PNG, WebP, GIF, AVIF or HEIC/HEIF images.'
  if (files.some(file => file.size > MAX_PHOTO_BYTES)) return 'Each photo must be under 5 MB.'
}

/** Commit each success immediately so later network failures do not hide completed uploads. */
export async function uploadPhotoBatch<T extends Photo>(existing: number, files: readonly T[], upload: (file: T) => Promise<string>, onUploaded: (path: string) => void) {
  const error = validatePhotoBatch(existing, files)
  if (error) throw new Error(error)
  for (const file of files) onUploaded(await upload(file))
}
