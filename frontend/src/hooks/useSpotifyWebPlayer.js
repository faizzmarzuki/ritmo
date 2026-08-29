import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

let sdkPromise = null

function loadSdk() {
  if (window.Spotify) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)
  })
  return sdkPromise
}

/**
 * Turns this browser tab into a Spotify Connect device ("Project Fitness")
 * that plays FULL songs — Spotify Premium only. On success, playback is
 * transferred here automatically.
 */
export function useSpotifyWebPlayer() {
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [error, setError] = useState('')
  const playerRef = useRef(null)

  async function enable() {
    setError('')
    setStatus('loading')
    try {
      // Spotify streams with Widevine DRM — bail out early with a clear
      // message on browsers that can't decrypt it (some embedded webviews).
      try {
        await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [
          { initDataTypes: ['cenc'], audioCapabilities: [{ contentType: 'audio/mp4;codecs="mp4a.40.2"' }] },
        ])
      } catch {
        throw new Error('This browser cannot play DRM audio. Open the app in Chrome, Edge or Firefox to play here.')
      }
      await loadSdk()
      const player = new window.Spotify.Player({
        name: 'Project Fitness',
        getOAuthToken: (cb) => {
          api.spotifyToken().then(({ accessToken }) => cb(accessToken)).catch(() => cb(''))
        },
        volume: 0.7,
      })
      playerRef.current = player
      player.addListener('ready', async ({ device_id: deviceId }) => {
        try {
          await api.spotifyTransfer(deviceId)
          setStatus('ready')
        } catch (err) {
          setError(err.message)
          setStatus('error')
        }
      })
      player.addListener('initialization_error', ({ message }) => { setError(message); setStatus('error') })
      player.addListener('authentication_error', ({ message }) => { setError(message); setStatus('error') })
      player.addListener('account_error', () => {
        setError('Playing full songs in the browser requires Spotify Premium.')
        setStatus('error')
      })
      const ok = await player.connect()
      if (!ok) {
        setError('Could not start the in-browser player.')
        setStatus('error')
      }
    } catch (err) {
      setError(err.message || 'Web Playback SDK failed to load')
      setStatus('error')
    }
  }

  function disable() {
    playerRef.current?.disconnect()
    playerRef.current = null
    setStatus('idle')
  }

  useEffect(() => () => playerRef.current?.disconnect(), [])

  return { status, error, enable, disable }
}
