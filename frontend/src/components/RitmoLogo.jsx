// Ritmo brand assets.
// The mark is the approved glyph skewed 10° with a r-130 circle head; the lockup is
// variant 03 (snug spacing, dotless i) — mark and text share the same slant and baseline.
const GLYPH_PATH =
  'M265 0C265 69 312 131 391 131C466 131 518 75 518 0L778 0C778 140 705 264 587 330C528 363 462 379 391 379C250 379 125 309 57 193C22 135 5 71 5 0ZM5 523L778 523L778 732L5 732ZM391 131C534 131 658 202 727 322C761 381 778 449 778 524L518 524C518 445 474 379 391 379Z'

function Mark() {
  return (
    <>
      <g transform="translate(-65 0) skewX(-10)">
        <g transform="scale(1,-1)">
          <path d={GLYPH_PATH} fill="currentColor" />
        </g>
      </g>
      <circle cx="485" cy="-902" r="130" fill="currentColor" />
    </>
  )
}

/** The bare mark (runner R), colored via CSS `color`. */
export function RitmoMark(props) {
  return (
    <svg viewBox="-70 -1042 922 1052" aria-label="Ritmo" {...props}>
      <Mark />
    </svg>
  )
}

/** App icon: neon green rounded square with the mark in matte black. */
export function RitmoIcon(props) {
  return (
    <svg viewBox="0 0 512 512" aria-label="Ritmo" {...props}>
      <rect width="512" height="512" rx="115" fill="#39ff14" />
      <g transform="translate(142.4 406) scale(0.2907)" style={{ color: '#0a0a0a' }}>
        <Mark />
      </g>
    </svg>
  )
}

/** Horizontal lockup: the mark as the R, "ıtmo" beside it at the same 10° slant. */
export default function RitmoLogo(props) {
  return (
    <svg viewBox="-70 -1042 3300 1062" preserveAspectRatio="xMinYMid meet" aria-label="Ritmo" {...props}>
      <Mark />
      <g transform="translate(758 0) skewX(-10)">
        <text
          x="0"
          y="0"
          fontFamily="Sora, system-ui, sans-serif"
          fontWeight="800"
          fontSize="976"
          letterSpacing="-20"
          fill="currentColor"
        >
          ıtmo
        </text>
      </g>
    </svg>
  )
}
