/**
 * Official-mode only: ask Garmin to re-push historical data for a user.
 *   node scripts/garmin-backfill.js <userEmail> [days=30]
 * Data arrives asynchronously at /api/webhooks/garmin.
 */
import { config } from '../src/config.js'
import { findUserByEmail } from '../src/db/repo/users.js'
import { requestBackfill } from '../src/providers/garmin/official.js'

const [email, daysArg] = process.argv.slice(2)
if (!email) {
  console.error('usage: node scripts/garmin-backfill.js <userEmail> [days=30]')
  process.exit(1)
}
if (config.garmin.mode !== 'official') {
  console.error('GARMIN_MODE must be "official" for Health API backfill. In "connect" mode data backfills automatically on each poll.')
  process.exit(1)
}
const user = findUserByEmail(email)
if (!user) {
  console.error(`no user with email ${email}`)
  process.exit(1)
}
const days = Math.min(Number(daysArg) || 30, 90)
const now = Math.floor(Date.now() / 1000)

for (const summary of ['dailies', 'sleeps', 'activities', 'stressDetails', 'userMetrics', 'bodyComps']) {
  await requestBackfill(user.id, summary, now - days * 86_400, now)
  console.log(`requested ${summary} (${days} days)`)
}
console.log('Done — watch the server logs for incoming pushes.')
