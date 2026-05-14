import { useCallback, useEffect, useState } from 'react'

/**
 * Chromium may fire `beforeinstallprompt` only once per full page load. Each
 * route mounts its own `<AppHeader />`, so we keep the deferred event in
 * module scope so client-side navigation does not lose `canInstall`.
 *
 * Listens for `beforeinstallprompt` and exposes a one-shot `promptInstall()`.
 *
 * The event only fires on Chromium-based browsers (Chrome, Edge, Brave, Samsung
 * Internet, Opera) when install criteria are met. iOS Safari does NOT fire it
 * — the only path there is Share → Add to Home Screen, which we surface via
 * the `isIosSafari` flag so the UI can show its own hint.
 */
let storedDeferredPrompt = null

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(() => storedDeferredPrompt)
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    )
  })

  useEffect(() => {
    function handleBeforeInstall(event) {
      event.preventDefault()
      storedDeferredPrompt = event
      setDeferredPrompt(event)
    }
    function handleInstalled() {
      storedDeferredPrompt = null
      setDeferredPrompt(null)
      setIsInstalled(true)
    }
    if (storedDeferredPrompt) {
      setDeferredPrompt(storedDeferredPrompt)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    const p = storedDeferredPrompt
    if (!p) return null
    await p.prompt()
    const choice = await p.userChoice
    storedDeferredPrompt = null
    setDeferredPrompt(null)
    return choice?.outcome ?? null
  }, [])

  const isIosSafari = (() => {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    const isSafari = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    return isIOS && isSafari
  })()

  return {
    canInstall: Boolean(storedDeferredPrompt),
    isInstalled,
    isIosSafari,
    promptInstall,
  }
}
