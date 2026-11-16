# Visit counter

A free, cookie-free count of how many devices open The Smugglr each day. Added 16 November 2026 (migration `0013_visit_counter.sql`).

## What is stored

Table `site_visits`, one row per day (India time): `visitors` (devices that opened the site that day) and `new_devices` (of those, first-ever visits from that browser). Nothing else: no IP address, email, user id or device id. The table has row-level security and no policies, so the API cannot read or write it directly.

## How it works

- `app/src/lib/visits.ts` runs once per page load in production builds (`main.tsx`). It reads two dates from the browser's local storage (`smugglr_last_visit`, `smugglr_seen_before`) and, if this device was not counted today, calls the database function `record_visit(p_new_device)`. The date is saved only after the call succeeds, so a failed call is retried next load.
- `record_visit` (anyone may call it, including signed-out visitors) only adds 1 to today's totals. Anyone can still call it by hand, so treat the numbers as an estimate, not an audit.
- `visit_summary()` returns the last 90 days, and only to an approved admin.
- A visitor who clears their browser data or uses another browser counts again; one person on two devices counts twice.
- The privacy page (`app/public/privacy.html`) describes this.

## Reading the numbers

Read-only query (needs the Supabase CLI signed in; `<ref>` is the project ref):

```bash
npx supabase db query --remote=<ref> --read-only "select day, visitors, new_devices from public.site_visits order by day desc limit 30"
```

Or ask a Claude agent, or run the same select in the Supabase SQL editor.
