import { useMemo, useSyncExternalStore } from 'react'
import { isMobile } from '@/utils/deviceUtils'

let isMobileDevice = typeof window !== 'undefined' ? isMobile() : false
let resizeListening = false
let resizeTimeoutId = null
const subscribers = new Set()

const notifySubscribers = () => {
  subscribers.forEach((callback) => callback())
}

const handleResize = () => {
  if (resizeTimeoutId) {
    clearTimeout(resizeTimeoutId)
  }

  resizeTimeoutId = setTimeout(() => {
    const nextIsMobile = isMobile()
    if (nextIsMobile !== isMobileDevice) {
      isMobileDevice = nextIsMobile
      notifySubscribers()
    }
  }, 100)
}

const subscribeToViewport = (callback) => {
  subscribers.add(callback)

  if (!resizeListening && typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
    resizeListening = true
  }

  return () => {
    subscribers.delete(callback)

    if (subscribers.size === 0 && resizeListening && typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize)
      resizeListening = false

      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId)
        resizeTimeoutId = null
      }
    }
  }
}

const getSnapshot = () => isMobileDevice
const getServerSnapshot = () => false

/**
 * Hook centralisé pour la configuration de la grille selon le type d'appareil
 * Évite la duplication de logique mobile/desktop dans plusieurs composants
 */
export const useGridConfig = () => {
  const currentIsMobile = useSyncExternalStore(
    subscribeToViewport,
    getSnapshot,
    getServerSnapshot,
  )

  return useMemo(() => {
    return {
      // Configuration de base
      isMobile: currentIsMobile,
      cols: currentIsMobile ? 3 : 5,
      rows: currentIsMobile ? 5 : 3,

      // Configuration des bordures
      borderColsLeft: currentIsMobile ? 4 : 3,
      borderColsRight: currentIsMobile ? 4 : 3,
      borderRowsTop: currentIsMobile ? 6 : 4,
      borderRowsBottom: currentIsMobile ? 6 : 4,

      // Positions adaptatives pour la navigation
      arrowUpPosition: currentIsMobile ? 12 : 4,
      crossPosition: currentIsMobile ? 13 : 9,

      // Configuration de la grille
      projectSize: 1,
      gap: 0.005,
      margin: 0.5,
      distance: -5
    }
  }, [currentIsMobile])
}
