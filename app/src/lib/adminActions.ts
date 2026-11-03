import type { SupabaseClient } from '@supabase/supabase-js'

type AdminApi = Pick<SupabaseClient, 'from' | 'rpc'>
type ReportTarget = { id: string; listing_id: string | null }
type PendingMember = { id: string; email: string; status: string }
export const ROSTER_BATCH_SIZE = 200
const requireCurrent = (current: () => boolean) => {
  if (!current()) throw new Error('Administrator action stopped. Reload before retrying.')
}

export async function changeMemberStatus(api: AdminApi, id: string, status: string) {
  const result = await api.rpc('admin_set_status', { p_user: id, p_status: status })
  if (result.error) throw new Error('Could not update this member. Refresh and try again.')
  const confirmed = await api.from('profiles').select('id,status').eq('id', id).single()
  if (confirmed.error || confirmed.data?.id !== id || confirmed.data?.status !== status) {
    throw new Error('Could not confirm this member update. Refresh and try again.')
  }
}

export async function updateReportStatus(api: AdminApi, id: string, status: 'resolved' | 'dismissed') {
  const result = await api.from('reports').update({ status }).eq('id', id).select('id,status').single()
  if (result.error || result.data?.id !== id || result.data?.status !== status) {
    throw new Error('Could not update this report. Refresh and try again.')
  }
}

export async function removeReportedListing(api: AdminApi, report: ReportTarget) {
  if (!report.listing_id) throw new Error('This report has no listing to remove.')
  const result = await api.from('listings').update({ status: 'removed' }).eq('id', report.listing_id).select('id,status').single()
  // RLS can produce a successful response with no affected row. Require the
  // returned listing before hiding the report from the administrator's queue.
  if (result.error || result.data?.id !== report.listing_id || result.data?.status !== 'removed') {
    throw new Error('Could not remove the listing. The report is still open; refresh and try again.')
  }
  try {
    await updateReportStatus(api, report.id, 'resolved')
  } catch {
    throw new Error('The listing was removed, but the report could not be resolved. Refresh and retry resolving the report.')
  }
}

async function approvePendingRosterMember(api: AdminApi, id: string, current: () => boolean) {
  requireCurrent(current)
  // Preserve a suspension applied since the directory snapshot was loaded.
  // The existing admin policy/trigger still authorizes this conditional write.
  const result = await api.from('profiles').update({ status: 'approved' }).eq('id', id).eq('status', 'pending').select('id,status').maybeSingle()
  requireCurrent(current)
  if (result.error) throw new Error('Could not confirm member approval.')
  let member = result.data
  if (!member) {
    const confirmed = await api.from('profiles').select('id,status').eq('id', id).single()
    requireCurrent(current)
    if (confirmed.error) throw new Error('Could not confirm member approval.')
    member = confirmed.data
  }
  if (member?.id !== id || member.status !== 'approved') throw new Error('Could not confirm member approval.')
}

export async function addStudentRoster(api: AdminApi, input: string, users: PendingMember[], current: () => boolean = () => true) {
  requireCurrent(current)
  const emails = [...new Set(input.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean))]
  if (!emails.length || emails.some(e => !/^[^\s@]+@iiitd\.ac\.in$/.test(e))) {
    throw new Error('Enter only valid @iiitd.ac.in emails; no entries were added.')
  }
  let confirmed = 0
  for (let start = 0; start < emails.length; start += ROSTER_BATCH_SIZE) {
    requireCurrent(current)
    const batch = emails.slice(start, start + ROSTER_BATCH_SIZE)
    try {
      const result = await api.from('student_roster').upsert(batch.map(email => ({ email }))).select('email')
      requireCurrent(current)
      const returned = new Set((Array.isArray(result.data) ? result.data : []).map(row => row?.email))
      if (result.error || !batch.every(email => returned.has(email))) throw new Error('Unconfirmed roster batch')
      confirmed += batch.length
    } catch {
      requireCurrent(current)
      throw new Error(`Could not confirm the full roster update (${confirmed} entries confirmed). Other entries may have been saved. Keep these emails and retry.`)
    }
  }
  // Start existing-member approvals only after every roster batch is confirmed.
  // Partial writes remain retryable; never remove entries as a rollback.
  let approved = 0, failed = 0
  const listed = new Set(emails)
  for (const user of users.filter(u => u.status === 'pending' && listed.has(u.email.toLowerCase()))) {
    requireCurrent(current)
    try { await approvePendingRosterMember(api, user.id, current); approved++ }
    catch { requireCurrent(current); failed++ }
  }
  return { added: emails.length, approved, failed }
}
