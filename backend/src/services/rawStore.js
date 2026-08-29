import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'

/**
 * Every payload we receive from a provider is archived verbatim under
 * data/raw/<provider>/<yyyy-mm>/... before we normalize it. If a mapping bug is
 * found later, history can be re-imported without asking Garmin again.
 */
export function saveRaw(provider, name, payload) {
  const month = new Date().toISOString().slice(0, 7)
  const dir = path.join(config.rawDir, provider, month)
  fs.mkdirSync(dir, { recursive: true })
  const safe = String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
  const file = path.join(dir, `${Date.now()}_${safe}.json`)
  fs.writeFileSync(file, JSON.stringify(payload, null, 2))
  return path.relative(config.dataDir, file)
}
