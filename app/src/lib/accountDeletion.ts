import type { SupabaseClient } from '@supabase/supabase-js'

type Api = Pick<SupabaseClient, 'rpc' | 'storage' | 'auth'>
const BUCKET = 'listing-photos'
const PAGE = 100

/** Every file in the person's own photo folder: listing and lost & found photos, with their thumbnails. */
export async function ownPhotoPaths(api: Api, userId: string): Promise<string[]> {
  const paths: string[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await api.storage.from(BUCKET).list(userId, { limit: PAGE, offset })
    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const file of page) if (file.id) paths.push(`${userId}/${file.name}`) // entries without an id are folders
    if (page.length < PAGE) return paths
  }
}

/**
 * Deletes the signed-in person's account. Photos go first, through the Storage API (Storage refuses SQL deletes),
 * then delete_my_account() removes the account and everything that belongs to it. A failure stops before the
 * account is touched, so the person can simply try again.
 */
export async function deleteMyAccount(api: Api, userId: string, progress: (step: string) => void = () => {}): Promise<void> {
  progress('Removing your photos…')
  const paths = await ownPhotoPaths(api, userId)
  for (let i = 0; i < paths.length; i += PAGE) {
    const { error } = await api.storage.from(BUCKET).remove(paths.slice(i, i + PAGE))
    if (error) throw new Error(`Could not remove your photos (${error.message}). Nothing else was deleted; please try again.`)
  }
  progress('Deleting your account…')
  const { error } = await api.rpc('delete_my_account')
  if (error) throw new Error(`Could not delete your account (${error.message}). Please try again.`)
  // The account is gone on the server, so only the copy of the session in this browser is left to clear.
  await api.auth.signOut({ scope: 'local' })
}
