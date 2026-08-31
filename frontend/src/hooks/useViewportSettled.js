import { useEffect, useState } from 'react'

/**
 * False for the first moments after mount, then true for good.
 *
 * On first load an iOS standalone PWA reports the full-screen height and
 * corrects it a beat later — 402x874 → 402x812 on an iPhone 16 Pro, exactly
 * the 62pt status-bar inset. Anything anchored to the bottom of the viewport
 * (the tab bar, the Spotify pill) gets painted against the first value and
 * then visibly jumps to the second. iOS cannot be told to skip that, so
 * bottom-anchored chrome stays transparent until the height holds still.
 *
 * A resize re-arms the quiet timer, but `maxWaitMs` caps the whole wait: iOS
 * Safari fires resize continuously while its toolbar collapses, and without
 * the cap that stream of events would keep the chrome hidden indefinitely.
 * Only ever transitions false → true, so later resizes never hide it again.
 */
export function useViewportSettled(quietMs = 160, maxWaitMs = 500) {
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    let quiet
    const done = () => setSettled(true)
    const arm = () => {
      clearTimeout(quiet)
      quiet = setTimeout(done, quietMs)
    }
    arm()
    const deadline = setTimeout(done, maxWaitMs)
    window.addEventListener('resize', arm)
    window.visualViewport?.addEventListener('resize', arm)
    return () => {
      clearTimeout(quiet)
      clearTimeout(deadline)
      window.removeEventListener('resize', arm)
      window.visualViewport?.removeEventListener('resize', arm)
    }
  }, [quietMs, maxWaitMs])

  return settled
}
