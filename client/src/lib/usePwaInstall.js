import { useCallback, useEffect, useState } from 'react'

/**
 * Listens for `beforeinstallprompt` and exposes a one-shot `promptInstall()`.
 *
 * The event only fires on Chromium-based browsers (Chrome, Edge, Brave, Samsung
 * Internet, Opera) when install criteria are met. iOS Safari does NOT fire it
 * — the only path there is Share → Add to Home Screen, which we surface via
 * the `isIosSafari` flag so the UI can show its own hint.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
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
      setDeferredPrompt(event)
    }
    function handleInstalled() {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return choice?.outcome ?? null
  }, [deferredPrompt])

  const isIosSafari = (() => {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    const isSafari = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    return isIOS && isSafari
  })()

  return {
    canInstall: Boolean(deferredPrompt),
    isInstalled,
    isIosSafari,
    promptInstall,
  }
}
