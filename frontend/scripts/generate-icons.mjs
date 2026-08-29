// Renders the Ritmo brand mark (see src/components/RitmoLogo.jsx) to the PNG
// icons the PWA manifest and iOS home screen need. Run after changing the mark:
//   npm run icons
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const GLYPH_PATH =
  'M265 0C265 69 312 131 391 131C466 131 518 75 518 0L778 0C778 140 705 264 587 330C528 363 462 379 391 379C250 379 125 309 57 193C22 135 5 71 5 0ZM5 523L778 523L778 732L5 732ZM391 131C534 131 658 202 727 322C761 381 778 449 778 524L518 524C518 445 474 379 391 379Z'

const NEON = '#39ff14'
const INK = '#0a0a0a'

// The mark's own coordinate box is x -70..852, y -1042..10 (922 x 1052).
function mark(scale) {
  const w = 922 * scale
  const h = 1052 * scale
  const tx = (512 - w) / 2 + 70 * scale
  const ty = (512 - h) / 2 + 1042 * scale
  return `
    <g transform="translate(${tx} ${ty}) scale(${scale})" fill="${INK}">
      <g transform="translate(-65 0) skewX(-10)">
        <g transform="scale(1,-1)"><path d="${GLYPH_PATH}"/></g>
      </g>
      <circle cx="485" cy="-902" r="130"/>
    </g>`
}

function iconSvg({ rounded, markScale }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="${rounded ? 115 : 0}" fill="${NEON}"/>
    ${mark(markScale)}
  </svg>`
}

// Rounded app tile for browsers; full-bleed squares for iOS (it rounds the
// corners itself) and for the maskable variant (safe zone = inner 80%).
const appIcon = Buffer.from(iconSvg({ rounded: true, markScale: 0.2907 }))
const squareIcon = Buffer.from(iconSvg({ rounded: false, markScale: 0.2907 }))
const maskableIcon = Buffer.from(iconSvg({ rounded: false, markScale: 0.24 }))

await mkdir(outDir, { recursive: true })
await Promise.all([
  sharp(appIcon).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png')),
  sharp(appIcon).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png')),
  sharp(maskableIcon).resize(512, 512).png().toFile(path.join(outDir, 'icon-maskable-512.png')),
  sharp(squareIcon).resize(180, 180).png().toFile(path.join(outDir, 'apple-touch-icon.png')),
])
console.log('icons written to', outDir)
