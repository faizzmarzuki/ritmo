// Scrape all exercises from fitnessprogramer.com into the exercises table,
// downloading each demo GIF to data/exercise-gifs/<slug>.gif.
// Usage: node scripts/scrape-exercises.js <urls.txt>
import fs from 'node:fs'
import path from 'node:path'
import { db, migrate } from '../src/db/index.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
const GIF_DIR = path.resolve('data/exercise-gifs')
fs.mkdirSync(GIF_DIR, { recursive: true })

const urls = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter(Boolean)
migrate()

const upsert = db.prepare(`
  INSERT INTO exercises (slug, name, source_url, gif_url, gif_path, overview, instructions, tips, mistakes, content_text, muscles, equipment)
  VALUES (@slug, @name, @source_url, @gif_url, @gif_path, @overview, @instructions, @tips, @mistakes, @content_text, @muscles, @equipment)
  ON CONFLICT(slug) DO UPDATE SET
    name=excluded.name, gif_url=excluded.gif_url, gif_path=excluded.gif_path,
    overview=excluded.overview, instructions=excluded.instructions, tips=excluded.tips,
    mistakes=excluded.mistakes, content_text=excluded.content_text,
    muscles=excluded.muscles, equipment=excluded.equipment, scraped_at=datetime('now')
`)
const have = new Set(db.prepare('SELECT slug FROM exercises WHERE gif_path IS NOT NULL').all().map(r => r.slug))

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, "'").replace(/&#8211;|&ndash;/g, '–')
  .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

function listAfter(html, headingRe) {
  // Find the first <ol>/<ul> after a heading matching headingRe; return items as plain text.
  const m = html.match(headingRe)
  if (!m) return null
  const rest = html.slice(m.index + m[0].length)
  const lm = rest.match(/<(ol|ul)[\s\S]*?<\/\1>/)
  if (!lm) return null
  const items = [...lm[0].matchAll(/<li[\s\S]*?<\/li>/g)].map(x => strip(x[0])).filter(Boolean)
  // Guard against matching tag/nav link lists: real steps are sentences, not labels.
  const avg = items.reduce((a, s) => a + s.length, 0) / (items.length || 1)
  return items.length && avg > 25 ? JSON.stringify(items) : null
}

function parse(url, html) {
  const slug = url.replace(/\/$/, '').split('/').pop()
  const name = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || html.match(/property="og:title" content="([^"]+)"/) || [,''])[1])
    .replace(/:.*(Proper Form|How To|Guide).*$/i, '').replace(/\s*[:|–-]\s*(Proper Form|Muscles Worked|Benefits).*$/i, '').trim()
  const gif_url = (html.match(/property="og:image" content="([^"]+\.gif)"/) || [])[1]
    || (html.match(/https:\/\/fitnessprogramer\.com\/wp-content\/uploads\/[^"']+\.gif/) || [])[0] || null

  const cls = (html.match(/<article[^>]+class="([^"]+)"/) || [, ''])[1]
  const muscles = [...cls.matchAll(/winner_exercise_pri_muscle-([\w-]+)/g)].map(m => m[1])
  const equipment = [...cls.matchAll(/winner_exercise_equipment-([\w-]+)/g)].map(m => m[1])

  const artStart = html.indexOf('<article')
  const artEnd = html.indexOf('</article>')
  let body = artStart >= 0 && artEnd > artStart ? html.slice(artStart, artEnd) : html
  body = body.replace(/<(script|style)[\s\S]*?<\/\1>/g, '')

  const ovM = body.match(/<h2[^>]*>\s*(?:<strong[^>]*>)?\s*Overview[\s\S]*?<\/h2>\s*(?:<\/?[^>]+>\s*)*?<p[^>]*>([\s\S]*?)<\/p>/i)
    || body.match(/Overview<\/strong><\/h2><p>([\s\S]*?)<\/p>/i)
  const overview = ovM ? strip(ovM[1]) : null

  return {
    slug, name: name || slug, source_url: url, gif_url, gif_path: null,
    overview,
    instructions: listAfter(body, /<h[23][^>]*>[^<]*(?:<strong[^>]*>)?[^<]*How to[\s\S]{0,200}?<\/h[23]>/i),
    tips: listAfter(body, /<h[23][^>]*>[\s\S]{0,120}?Tips[\s\S]{0,120}?<\/h[23]>/i),
    mistakes: listAfter(body, /<h[23][^>]*>[\s\S]{0,120}?Mistakes[\s\S]{0,120}?<\/h[23]>/i),
    content_text: strip(body).slice(0, 20000),
    muscles: JSON.stringify(muscles), equipment: JSON.stringify(equipment),
  }
}

async function get(url, type = 'text', tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return type === 'text' ? await r.text() : Buffer.from(await r.arrayBuffer())
    } catch (e) {
      if (i === tries - 1) throw e
      await new Promise(res => setTimeout(res, 1500 * (i + 1)))
    }
  }
}

let done = 0, failed = []
async function worker(queue) {
  for (;;) {
    const url = queue.pop()
    if (!url) return
    const slug = url.replace(/\/$/, '').split('/').pop()
    if (have.has(slug)) { done++; continue }
    try {
      const html = await get(url)
      const row = parse(url, html)
      if (row.gif_url) {
        const gifFile = path.join(GIF_DIR, `${slug}.gif`)
        if (!fs.existsSync(gifFile) || fs.statSync(gifFile).size === 0) {
          fs.writeFileSync(gifFile, await get(row.gif_url, 'buf'))
        }
        row.gif_path = `data/exercise-gifs/${slug}.gif`
      }
      upsert.run(row)
      done++
      if (done % 25 === 0) console.log(`${done}/${urls.length}`)
    } catch (e) {
      failed.push(url)
      console.error(`FAIL ${url}: ${e.message}`)
    }
  }
}

const queue = [...urls]
await Promise.all(Array.from({ length: 6 }, () => worker(queue)))
console.log(`done: ${done} ok, ${failed.length} failed`)
if (failed.length) fs.writeFileSync('data/exercise-scrape-failed.txt', failed.join('\n'))
