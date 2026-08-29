# project-fitness backend

Node/Express + SQLite backend for the fitness dashboard. It syncs **Strava** and
**Garmin**, stores everything locally, streams updates to the browser in
**realtime** (SSE), and includes a **vision agent** that estimates calories and
macros from a food photo.

```
server/
├── data/                  ← everything lives here (gitignored)
│   ├── fitness.db         ← SQLite (WAL mode)
│   ├── raw/<provider>/    ← every provider payload archived verbatim
│   └── photos/            ← food photos (downscaled)
├── src/
│   ├── index.js           ← Express app + SSE endpoint
│   ├── config.js          ← env parsing + boot warnings
│   ├── db/                ← migrations + repositories
│   ├── providers/
│   │   ├── strava/        ← OAuth2, webhook sync, backfill, streams
│   │   └── garmin/        ← official Health API (push) + garmin-connect (poll)
│   ├── agent/foodAgent.js ← photo → calories/macros (OpenAI/Anthropic/Google)
│   ├── realtime/hub.js    ← per-user SSE broadcast
│   ├── routes/            ← auth, provider connect, webhooks, data, food
│   └── services/          ← summary aggregation, raw archive
└── scripts/               ← migrate, strava-subscription, garmin-backfill, test-food-agent
```

## Quick start

```bash
cd server
npm install
npm run migrate
npm run dev            # http://localhost:4000
```

`.env` was generated from `.env.example` with fresh secrets. Check
`GET /api/health` any time — it lists exactly what is still unconfigured.

Frontend: `src/lib/api.js` in the Vite app calls this server
(`VITE_API_URL`, default `http://localhost:4000`) and `subscribeEvents()`
opens the realtime stream.

## Realtime model

* **Strava → push.** Strava webhooks POST to `/api/webhooks/strava` seconds
  after an activity is uploaded. We ACK instantly, then pull the full activity
  + HR/pace streams and broadcast `activity` over SSE.
* **Garmin (official) → push.** The Health API POSTs dailies / sleeps /
  activities / stress (body battery) / userMetrics / bodyComps to
  `/api/webhooks/garmin` as they sync from the watch.
* **Garmin (connect fallback) → poll.** Without partner approval, the
  `garmin-connect` package logs into Garmin Connect and polls every
  `GARMIN_POLL_SECONDS` (default 300 s).
* **Browser.** Every page keeps `GET /api/events` open (SSE). Any new data —
  webhook, poll, manual log — triggers a typed event; the UI refetches only the
  affected slice. No browser polling.

Webhooks require the server to be reachable from the internet:

```bash
cloudflared tunnel --url http://localhost:4000   # or: ngrok http 4000
```

Put the https URL in `PUBLIC_URL`, restart, then register the webhooks (below).

## Strava setup (full sync)

1. Create an API app at https://www.strava.com/settings/api — set the
   *Authorization Callback Domain* to your `PUBLIC_URL` host.
2. Fill `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` in `.env`, restart.
3. In the app's Settings page hit **Connect** (calls `/api/auth/strava/connect`,
   redirects to Strava). On return the server backfills the last year of
   activities automatically.
4. Register the webhook once per API app: `npm run strava:subscribe`
   (`strava:list` / `strava:delete` to inspect or remove).

## Garmin setup

**Official (push, realtime):** requires an approved app in the
[Garmin Developer Program](https://developer.garmin.com/health-api/) (free, but
reviewed). Set `GARMIN_MODE=official` + consumer key/secret, register
`${PUBLIC_URL}/api/webhooks/garmin` as the Push URL in the portal, then users
connect via OAuth from the Settings page. `npm run garmin:backfill -- you@mail 90`
re-requests history.

**Connect fallback (works today, no approval):** `GARMIN_MODE=connect` +
`GARMIN_EMAIL`/`GARMIN_PASSWORD` (or POST them to
`/api/auth/garmin/connect-credentials`). Uses the unofficial `garmin-connect`
package (`npm i garmin-connect` — it's an optional dep) and polls every 5 min:
activities, steps, HR samples, sleep, weight. Caveat: it's reverse-engineered,
so Garmin could break it at any time; treat it as the bridge until Health API
approval lands.

## Food photo agent

`POST /api/food/analyze` (multipart `photo`) → identifies items, portions,
kcal + protein/carbs/fat/fiber/sugar with per-item confidence.
`POST /api/food/analyze-and-log` also writes the meal (slot inferred from the
time of day). Results are cached by image hash — re-uploading the same photo
costs nothing. Photos are downscaled to ≤768 px / ~80 KB before upload.

Provider is pluggable via `.env` (`openai` | `anthropic` | `google`, or any
OpenAI-compatible gateway via `VISION_BASE_URL`). Default: `gpt-5-mini`.

Smoke test: `node scripts/test-food-agent.js path/to/meal.jpg`

## API surface

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `login` · `logout` · `GET /api/auth/me` · `GET/PATCH /api/auth/settings` |
| Integrations | `GET /api/auth/connections` · `GET /api/auth/{strava,garmin}/connect` · `POST …/disconnect` · `POST …/sync` |
| Webhooks | `GET+POST /api/webhooks/strava` · `POST /api/webhooks/garmin` |
| Realtime | `GET /api/events` (SSE) |
| Dashboard | `GET /api/summary?period=today\|week\|month\|year` |
| Workouts | `GET /api/workouts` · `GET /api/activities` · `GET /api/activities/:id` (with HR/pace streams) |
| Nutrition | `GET /api/nutrition?date=` · `POST /api/meals` · `POST /api/meals/:id/items` · `DELETE /api/meals/:id` · `DELETE /api/food-items/:id` · `POST /api/hydration` |
| Food agent | `GET /api/food/status` · `POST /api/food/analyze` · `POST /api/food/analyze-and-log` |
| Progress | `GET /api/progress` · `GET/POST /api/weights` · `GET /api/goals` · `POST /api/goals/:id/log` |
| Ops | `GET /api/health` · `GET /api/diagnostics` (recent webhooks + sync runs) |

`GET /api/summary` returns the exact shape of `fitnessData[period]` in
`src/lib/mockData.js`, so the dashboard can swap mock → live with minimal changes.

## Storage & durability

- SQLite in WAL mode: reads never block webhook writes; safe for a single-node app.
- Provider tokens encrypted at rest (AES-256-GCM with `TOKEN_ENC_KEY`).
- Every raw provider payload archived under `data/raw/` before normalization —
  if a mapping bug is found, history can be replayed without re-fetching.
- Upserts are keyed on `(user, provider, external_id)` → replayed webhooks and
  overlapping backfills are idempotent.
