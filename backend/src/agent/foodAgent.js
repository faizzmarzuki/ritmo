import fs from 'node:fs'
import path from 'node:path'
import { config, visionBaseUrl } from '../config.js'
import { sha256, randomId } from '../lib/crypto.js'
import { request } from '../lib/http.js'
import { saveAnalysis, findAnalysisByHash } from '../db/repo/nutrition.js'
import { learnFood, listFoodMemory } from '../db/repo/foodMemory.js'
import { visionKeyFor } from '../services/apiKeys.js'
import { logger } from '../lib/log.js'

const log = logger('food-agent')

export const PROMPT_VERSION = 'v2'

export const hintText = (hint) =>
  hint
    ? `Analyze this meal photo. The user says it is: "${hint}". Trust the user for identification (they know the dish); still estimate portions and nutrition from the image.`
    : 'Analyze this meal photo.'

/** The user's personal food dictionary, injected so repeat meals are recognized by name. */
const memoryBlock = (foods) =>
  foods.length
    ? '\n\nFoods this user has logged before — when the photo matches one, use its exact name and treat its macros as the reference (scale to the visible portion):\n' +
      foods
        .map((f) => `- ${f.display_name}${f.kcal ? ` (~${Math.round(f.kcal)} kcal${f.grams ? ` / ${Math.round(f.grams)} g` : ''}, P${Math.round(f.protein || 0)} C${Math.round(f.carbs || 0)} F${Math.round(f.fat || 0)})` : ''}`)
        .join('\n')
    : ''

const SYSTEM_PROMPT = `You are a nutritionist AI that estimates the nutritional content of food from a photo.
Identify every distinct food/drink item visible. Estimate realistic portion sizes from visual cues
(plate size, utensils, packaging). Use standard nutrition databases (USDA-style values).
Be conservative: if unsure between two portion sizes, pick the middle.

The user is in Malaysia — prefer Malaysian/Southeast Asian identifications when plausible:
- Iced brown drinks in a clear cup or tied plastic bag ("ikat tepi") are usually kopi ais / teh ais /
  teh tarik / Milo ais (coffee or tea with condensed milk), NOT chocolate milkshake or iced chocolate,
  unless branding clearly says otherwise.
- Common dishes: nasi lemak, nasi putih + sup ayam, mee/mihun goreng, roti canai, ayam goreng,
  ikan bakar, sambal, kuih. Name them in local terms when recognized.
- Distinguish proteins carefully: chicken has thicker bones, drumstick/thigh shapes and skin; fish has
  flaky white flesh, fins or fine bones. Soups: sup ayam has chicken pieces and fried shallots; fish
  soup usually has fish slices. If genuinely ambiguous, say so in notes and lower confidence.
Respond ONLY with JSON matching this schema, no markdown fences, no commentary:
{
  "is_food": boolean,            // false if the image contains no food or drink
  "dish_name": string,           // short overall name, e.g. "Nasi lemak with fried chicken"
  "confidence": number,          // 0-1 overall confidence
  "items": [
    {
      "name": string,            // e.g. "Grilled chicken breast"
      "portion": string,         // human description, e.g. "1 medium bowl (~250 g)"
      "grams": number,           // estimated weight in grams
      "kcal": number,
      "protein": number,         // grams
      "carbs": number,           // grams
      "fat": number,             // grams
      "fiber": number,           // grams
      "sugar": number,           // grams
      "confidence": number       // 0-1 for this item
    }
  ],
  "notes": string                // 1 short sentence of caveats, or ""
}`

/** Downscale + recompress so we send ~50-100 KB instead of a 4 MB phone photo. */
async function prepareImage(buffer) {
  try {
    const { default: sharp } = await import('sharp')
    const out = await sharp(buffer)
      .rotate()
      .resize({ width: config.vision.maxEdge, height: config.vision.maxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer()
    return { buffer: out, mime: 'image/jpeg' }
  } catch {
    log.debug('sharp unavailable — sending original image')
    return { buffer, mime: null }
  }
}

function extractJson(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
    throw new Error(`model did not return valid JSON (got: ${cleaned.slice(0, 120) || '<empty>'})`)
  }
}

// ── provider adapters ─────────────────────────────────────────────────────────
async function callOpenAI(b64, mime, userMsg, apiKey) {
  const res = await request(`${visionBaseUrl()}/chat/completions`, {
    method: 'POST',
    timeoutMs: 90_000,
    redirect: 'error', // never follow a redirect carrying the API key
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.vision.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userMsg },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      // gpt-5-family models spend completion tokens on reasoning first; keep
      // effort low and leave enough headroom for the actual JSON answer.
      ...(/^(gpt-5|o\d)/.test(config.vision.model) ? { reasoning_effort: 'medium' } : {}),
      max_completion_tokens: 4000,
    }),
  })
  const data = await res.json()
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  }
}

async function callAnthropic(b64, mime, userMsg, apiKey) {
  const res = await request('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    timeoutMs: 90_000,
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.vision.model,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text: userMsg + ' JSON only.' },
        ],
      }],
    }),
  })
  const data = await res.json()
  return {
    text: data.content?.[0]?.text ?? '',
    tokensIn: data.usage?.input_tokens,
    tokensOut: data.usage?.output_tokens,
  }
}

async function callGoogle(b64, mime, userMsg, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.vision.model}:generateContent?key=${apiKey}`
  const res = await request(url, {
    method: 'POST',
    timeoutMs: 90_000,
    redirect: 'error',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mime, data: b64 } },
          { text: userMsg + ' JSON only.' },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1200 },
    }),
  })
  const data = await res.json()
  return {
    text: data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '',
    tokensIn: data.usageMetadata?.promptTokenCount,
    tokensOut: data.usageMetadata?.candidatesTokenCount,
  }
}

const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v) * 10) / 10) : 0)

function sanitize(result) {
  const items = (Array.isArray(result.items) ? result.items : []).map((i) => {
    const protein = num(i.protein)
    const carbs = num(i.carbs)
    const fat = num(i.fat)
    // Keep kcal consistent with the macros (Atwater 4/4/9) so the numbers
    // always tally in the UI; fall back to the model's kcal for macro-less items.
    const fromMacros = Math.round(protein * 4 + carbs * 4 + fat * 9)
    return {
      name: String(i.name || 'Unknown item').slice(0, 120),
      portion: String(i.portion || '').slice(0, 120),
      grams: num(i.grams) || null,
      kcal: fromMacros > 0 ? fromMacros : num(i.kcal),
      protein,
      carbs,
      fat,
      fiber: num(i.fiber),
      sugar: num(i.sugar),
      confidence: Math.min(1, Math.max(0, Number(i.confidence) || 0)),
    }
  })
  return {
    isFood: Boolean(result.is_food ?? items.length > 0),
    dishName: String(result.dish_name || 'Meal').slice(0, 160),
    confidence: Math.min(1, Math.max(0, Number(result.confidence) || 0)),
    items,
    totals: items.reduce(
      (t, i) => ({
        kcal: t.kcal + i.kcal, protein: t.protein + i.protein, carbs: t.carbs + i.carbs,
        fat: t.fat + i.fat, fiber: t.fiber + i.fiber, sugar: t.sugar + i.sugar,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
    ),
    notes: String(result.notes || '').slice(0, 300),
  }
}

/**
 * Analyze a food photo → structured items with kcal + macros.
 * Caches by image hash so re-uploading the same photo is free.
 */
export async function analyzeFoodPhoto(userId, imageBuffer, originalMime = 'image/jpeg', hint = '') {
  const apiKey = visionKeyFor(userId)
  if (config.vision.provider === 'disabled' || !apiKey) {
    const fix = config.vision.provider === 'openai'
      ? 'Add your OpenAI API key in Settings → Integrations.'
      : `Set VISION_API_KEY for the "${config.vision.provider}" provider on the server.`
    throw Object.assign(new Error(`Food agent is not configured. ${fix}`), { status: 503 })
  }

  const memory = listFoodMemory(userId)
  // hint and the memory fingerprint participate in the cache key: the same photo
  // re-analyzes when the user adds a hint or their food dictionary has grown.
  const memoryFp = sha256(Buffer.from(memory.map((f) => f.display_name).join('|'))).slice(0, 12)
  const originalSha = sha256(Buffer.concat([imageBuffer, Buffer.from(`|${PROMPT_VERSION}|hint:${hint || ''}|mem:${memoryFp}`)]))
  if (config.vision.cache) {
    const cached = findAnalysisByHash(userId, originalSha)
    if (cached) {
      log.info(`cache hit for image ${originalSha.slice(0, 12)}`)
      return { ...cached.result, cached: true, analysisId: cached.id, photoPath: cached.photo_path }
    }
  }

  const prepared = await prepareImage(imageBuffer)
  const mime = prepared.mime || originalMime
  const b64 = prepared.buffer.toString('base64')

  // Persist the (downscaled) photo so the meal log can show it.
  const photoName = `${Date.now()}_${randomId(6)}.jpg`
  const photoAbs = path.join(config.photoDir, photoName)
  fs.writeFileSync(photoAbs, prepared.buffer)
  const photoPath = `photos/${photoName}`

  const started = Date.now()
  const caller = { openai: callOpenAI, anthropic: callAnthropic, google: callGoogle }[config.vision.provider]
  if (!caller) throw new Error(`Unknown VISION_PROVIDER "${config.vision.provider}"`)

  const { text, tokensIn, tokensOut } = await caller(b64, mime, hintText(hint) + memoryBlock(memory), apiKey)
  const latencyMs = Date.now() - started
  const result = sanitize(extractJson(text))

  const analysisId = saveAnalysis(userId, {
    imageSha: originalSha,
    photoPath,
    provider: config.vision.provider,
    model: config.vision.model,
    promptVer: PROMPT_VERSION,
    result,
    tokensIn,
    tokensOut,
    latencyMs,
  })
  log.info(`analyzed photo in ${latencyMs}ms — ${result.items.length} item(s), ${Math.round(result.totals.kcal)} kcal (${tokensIn ?? '?'}→${tokensOut ?? '?'} tokens)`)

  // A user-supplied name is ground truth — remember it with the macros we settled on.
  if (hint && result.isFood) {
    try {
      learnFood(userId, hint, result.totals, result.items.reduce((g, i) => g + (Number(i.grams) || 0), 0) || null)
    } catch (err) {
      log.warn(`food memory save failed: ${err.message}`)
    }
  }

  return { ...result, cached: false, analysisId, photoPath }
}

/**
 * Estimate nutrition for a named food with no photo (manual add).
 * Memory hit is free; otherwise a cheap text-only model call.
 */
export async function estimateFoodByName(userId, name) {
  const memory = listFoodMemory(userId, 50)
  const hit = memory.find((f) => f.display_name.toLowerCase() === name.trim().toLowerCase())
  if (hit && hit.kcal) {
    return {
      isFood: true,
      dishName: hit.display_name,
      confidence: 1,
      fromMemory: true,
      items: [{
        name: hit.display_name,
        portion: hit.grams ? `1 serving (~${Math.round(hit.grams)} g)` : '1 serving',
        grams: hit.grams ?? null,
        kcal: hit.kcal ?? 0, protein: hit.protein ?? 0, carbs: hit.carbs ?? 0, fat: hit.fat ?? 0,
        fiber: 0, sugar: 0, confidence: 1,
      }],
      totals: { kcal: hit.kcal ?? 0, protein: hit.protein ?? 0, carbs: hit.carbs ?? 0, fat: hit.fat ?? 0, fiber: 0, sugar: 0 },
      notes: 'From your food dictionary.',
    }
  }

  if (config.vision.provider !== 'openai') {
    throw Object.assign(new Error('Name-only estimates need the OpenAI vision provider.'), { status: 501 })
  }
  const apiKey = visionKeyFor(userId)
  if (!apiKey) {
    throw Object.assign(new Error('Food estimates need an OpenAI API key. Add yours in Settings → Integrations.'), { status: 503 })
  }
  const res = await request(`${visionBaseUrl()}/chat/completions`, {
    method: 'POST',
    timeoutMs: 60_000,
    redirect: 'error',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.vision.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `No photo. The user manually logged: "${name}". Assume one typical serving as sold in Malaysia and estimate its nutrition.` + memoryBlock(memory),
        },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4000,
      ...(/^(gpt-5|o\d)/.test(config.vision.model) ? { reasoning_effort: 'low' } : {}),
    }),
  })
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  const result = sanitize(extractJson(text))
  if (result.isFood) {
    try {
      learnFood(userId, name, result.totals, result.items.reduce((g, i) => g + (Number(i.grams) || 0), 0) || null)
    } catch (err) {
      log.warn(`food memory save failed: ${err.message}`)
    }
  }
  return { ...result, fromMemory: false }
}
