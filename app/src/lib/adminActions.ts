import type { SupabaseClient } from '@supabase/supabase-js'

type AdminApi = Pick<SupabaseClient, 'from' | 'rpc'>
type ReportTarget = { id: string; listing_id: string | null }
type PendingMember = { id: string; email: string; status: string }

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

export async function addStudentRoster(api: AdminApi, input: string, users: PendingMember[]) {
  const emails = [...new Set(input.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean))]
  if (!emails.length || emails.some(e => !/^[^\s@]+@iiitd\.ac\.in$/.test(e))) {
    throw new Error('Enter only valid @iiitd.ac.in emails; no entries were added.')
  }
  const result = await api.from('student_roster').upsert(emails.map(email => ({ email }))).select('email')
  if (result.error || !emails.every(email => result.data?.some(row => row.email === email))) {
    throw new Error('Could not confirm the roster update. Keep these emails and retry.')
  }
  // Approval is a separate RPC for each existing member. Preserve partial
  // results instead of overwriting failures with a blanket success message.
  let approved = 0, failed = 0
  for (const user of users.filter(u => u.status === 'pending' && emails.includes(u.email.toLowerCase()))) {
    try { await changeMemberStatus(api, user.id, 'approved'); approved++ }
    catch { failed++ }
  }
  return { added: emails.length, approved, failed }
}
