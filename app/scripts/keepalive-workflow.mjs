// The GitHub Actions workflow published next to the built site (see deploy-pages.mjs). It does two jobs, and both
// are needed to keep a free-tier deployment running with nobody touching it:
//
//  1. Ping the backend twice a week. A free Supabase project is paused after about a week without requests.
//  2. Keep this schedule itself switched on. GitHub disables scheduled workflows in a public repository after
//     60 days without a commit, so when the newest commit is 30 days old the workflow adds an empty one.
//
// The step that renews the schedule comes first so that a backend outage (which fails the ping) cannot skip it.
// Only first-party actions are used, and only the public project URL and publishable key appear in the file.

export const KEEPALIVE_CRON = '17 6 * * 1,4'
export const QUIET_DAYS_BEFORE_RENEWAL = 30

export const keepAlive = (url, key) => `name: Keep backend active
on:
  schedule:
    - cron: '${KEEPALIVE_CRON}'
  workflow_dispatch:
permissions:
  contents: write
jobs:
  keepalive:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Keep the schedule switched on
        run: |
          age=$(( ( $(date +%s) - $(git log -1 --format=%ct) ) / 86400 ))
          echo "Newest commit is $age days old."
          if [ "$age" -ge ${QUIET_DAYS_BEFORE_RENEWAL} ]; then
            git config user.name 'github-actions[bot]'
            git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
            git commit --allow-empty -m 'Keep scheduled workflows active (no site change)'
            git push
          fi
      - name: Call the public ping function
        run: |
          curl --fail --silent --show-error --max-time 30 -X POST \\
            -H "apikey: ${key}" -H "Content-Type: application/json" -d '{}' \\
            "${url}/rest/v1/rpc/ping"
`
