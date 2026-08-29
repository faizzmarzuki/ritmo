/**
 * Smoke-test the vision food agent without the HTTP layer:
 *   node scripts/test-food-agent.js path/to/meal.jpg [userEmail]
 */
import fs from 'node:fs'
import { migrate } from '../src/db/index.js'
import { findUserByEmail, createUser } from '../src/db/repo/users.js'
import { analyzeFoodPhoto } from '../src/agent/foodAgent.js'

const [file, email = 'agent-test@local'] = process.argv.slice(2)
if (!file || !fs.existsSync(file)) {
  console.error('usage: node scripts/test-food-agent.js <image> [userEmail]')
  process.exit(1)
}
migrate()
const user = findUserByEmail(email) || createUser({ email, password: 'test-password-123', name: 'Agent Test' })
const buf = fs.readFileSync(file)
const started = Date.now()
const result = await analyzeFoodPhoto(user.id, buf)
console.log(JSON.stringify(result, null, 2))
console.log(`\n${result.items.length} item(s), ${Math.round(result.totals.kcal)} kcal total, ${Date.now() - started}ms${result.cached ? ' (cached)' : ''}`)
