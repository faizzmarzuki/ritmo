import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8')

test('does not opt into an iOS status bar style that overlays app content', () => {
  assert.doesNotMatch(
    indexHtml,
    /<meta\s+[^>]*name=["']apple-mobile-web-app-status-bar-style["'][^>]*>/i,
  )
  assert.doesNotMatch(indexHtml, /black-translucent/i)
})

test('retains the metadata needed for an installable standalone mobile app', () => {
  assert.match(
    indexHtml,
    /<meta\s+name=["']viewport["']\s+content=["'][^"']*viewport-fit=cover[^"']*["']\s*\/?>/i,
  )
  assert.match(
    indexHtml,
    /<meta\s+name=["']apple-mobile-web-app-capable["']\s+content=["']yes["']\s*\/?>/i,
  )
  assert.match(
    indexHtml,
    /<meta\s+name=["']mobile-web-app-capable["']\s+content=["']yes["']\s*\/?>/i,
  )
  assert.match(
    indexHtml,
    /<meta\s+name=["']apple-mobile-web-app-title["']\s+content=["']Ritmo["']\s*\/?>/i,
  )
})
