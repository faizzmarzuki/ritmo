import { Router } from 'express'
import { config } from '../config.js'
import { recordWebhook, completeWebhook } from '../db/repo/ops.js'
import { ingestPush } from '../providers/garmin/ingest.js'
import { saveRaw } from '../services/rawStore.js'
import { logger } from '../lib/log.js'

const log = logger('webhooks')
const router = Router()

/** Garmin Health API push (register this URL in the developer portal). */
router.post('/garmin', (req, res) => {
  const body = req.body
  const id = recordWebhook('garmin', body)
  res.status(200).json({ ok: true }) // Garmin requires a fast 200 as well

  setImmediate(() => {
    try {
      saveRaw('garmin', 'webhook_push', body)
      const n = ingestPush(body)
      completeWebhook(id, 'ok')
      log.info(`garmin push ingested ${n} summaries`)
    } catch (err) {
      log.error(`garmin webhook processing failed: ${err.message}`)
      completeWebhook(id, 'failed', err.message)
    }
  })
})

export default router
