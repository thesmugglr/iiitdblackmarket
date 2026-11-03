import type { SupabaseClient } from '@supabase/supabase-js'
import type { PreparedPhoto } from './image.ts'
import { writeChatMessage } from './chatMessages.ts'

export interface AttachmentRequest { id: string; conversation: string; path: string; blob: Blob; type: string }
export interface AttachmentSnapshot { busy: boolean; pending: boolean; locked: boolean; name: string; error: string }
export const emptyAttachment = (): AttachmentSnapshot => ({ busy: false, pending: false, locked: false, name: '', error: '' })

function validPath(conversation: string, id: string, path: string) {
  const prefix = `${conversation}/${id}.`
  return !!conversation && !!id && path.startsWith(prefix) && path.split('/').length === 2 && /^[a-z0-9]+$/i.test(path.slice(prefix.length))
}

export async function uploadChatAttachment(api: Pick<SupabaseClient, 'storage'>, request: AttachmentRequest) {
  if (!validPath(request.conversation, request.id, request.path)) throw new Error('Invalid attachment path')
  const bucket = api.storage.from('chat-attachments')
  try {
    const result = await bucket.upload(request.path, request.blob, { contentType: request.type, upsert: false })
    if (!result.error && result.data?.path === request.path) return
  } catch { /* A lost response may follow a committed upload. Verify, never overwrite. */ }
  try {
    const existing = await bucket.download(request.path)
    if (existing.error || !existing.data || existing.data.size !== request.blob.size) throw new Error('Upload unavailable')
    const [expected, stored] = await Promise.all([request.blob.arrayBuffer(), existing.data.arrayBuffer()])
    const bytes = new Uint8Array(expected), actual = new Uint8Array(stored)
    if (!bytes.every((value, index) => actual[index] === value)) throw new Error('Upload differs')
  } catch {
    throw new Error('Photo upload could not be confirmed')
  }
}

export async function sendChatImage(api: Pick<SupabaseClient, 'from'>, conversation: string, sender: string, request: Pick<AttachmentRequest, 'id' | 'path'>) {
  if (!validPath(conversation, request.id, request.path)) throw new Error('Invalid attachment path')
  return writeChatMessage(api, { id: request.id, conversation_id: conversation, sender_id: sender, body: '', image_path: request.path })
}

interface AttachmentSource {
  conversation: string
  newId: () => string
  prepare: (file: File) => Promise<PreparedPhoto>
  upload: (request: AttachmentRequest) => Promise<void>
  link: (request: AttachmentRequest) => Promise<void>
  confirmed: () => void
  publish: (snapshot: AttachmentSnapshot) => void
}

// Keep one file/encoding/path/message ID until confirmed. Do not delete an
// uncertain upload: its message may already have committed despite a lost reply.
export function observeAttachment(source: AttachmentSource) {
  let active = true, busy = false
  let pending: { file: File; prepared?: PreparedPhoto; request?: AttachmentRequest; uploaded: boolean } | null = null
  let snapshot = emptyAttachment()
  const publish = (next: Partial<AttachmentSnapshot>) => {
    if (!active) return
    snapshot = { ...snapshot, ...next, pending: !!pending, locked: !!pending?.request, name: pending?.file.name ?? '' }
    source.publish(snapshot)
  }
  publish(snapshot)
  const retry = async () => {
    if (!active || busy || !pending) return
    const current = pending
    busy = true
    publish({ busy: true, error: '' })
    try {
      if (!current.prepared) {
        const prepared = await source.prepare(current.file)
        if (!active) return
        current.prepared = prepared
      }
      if (!current.request) {
        const id = source.newId()
        current.request = { id, conversation: source.conversation, path: `${source.conversation}/${id}.${current.prepared.ext}`, blob: current.prepared.blob, type: current.prepared.type }
      }
      if (!current.uploaded) {
        await source.upload(current.request)
        current.uploaded = true
        if (!active) return
      }
      await source.link(current.request)
      if (!active) return
      pending = null
      publish({ error: '' })
      source.confirmed()
    } catch {
      publish({ error: current.request ? 'Could not confirm sending the photo. Retry this photo before leaving the chat.' : 'Could not prepare this photo. Choose another image or retry.' })
    } finally {
      busy = false
      publish({ busy: false })
    }
  }
  const choose = async (file: File) => {
    if (!active || busy || pending?.request) return
    pending = { file, uploaded: false }
    publish({ error: '' })
    await retry()
  }
  return { choose, retry, dispose: () => { active = false } }
}
