import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { config } from '../config.js'
import { logger } from '../lib/log.js'

const log = logger('db')
const here = path.dirname(fileURLToPath(import.meta.url))

export const db = new Database(config.dbFile)
db.pragma('journal_mode = WAL')       // concurrent reads while webhooks write
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')

export function migrate() {
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')))')
  const applied = new Set(db.prepare('SELECT name FROM _migrations').all().map((r) => r.name))
  const dir = path.join(here, 'migrations')
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
    })()
    log.info(`applied migration ${file}`)
  }
  return files.length
}

/** Small helpers so repos stay terse. */
export const one = (sql, ...args) => db.prepare(sql).get(...args)
export const all = (sql, ...args) => db.prepare(sql).all(...args)
export const run = (sql, ...args) => db.prepare(sql).run(...args)
export const tx = (fn) => db.transaction(fn)
