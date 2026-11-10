import { useMemo, useSyncExternalStore } from 'react'
import { isMobile } from '@/utils/deviceUtils'
import projectsData from '@/data/projects.json'

let isMobileDevice = typeof window !== 'undefined' ? isMobile() : false
let isListening = false
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

const subscribe = (callback) => {
  subscribers.add(callback)

  if (!isListening && typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
    isListening = true
  }

  return () => {
    subscribers.delete(callback)

    if (subscribers.size === 0 && isListening && typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize)
      isListening = false

      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId)
        resizeTimeoutId = null
      }
    }
  }
}

const getSnapshot = () => isMobileDevice
const getServerSnapshot = () => false

// Répartit les projets à intervalles réguliers parmi les cases libres (hors croix et flèches) ;
// les tuiles vides prennent les cases restantes, dans l'ordre.
const getTileSlots = (tileCount, projectCount, reservedSlots) => {
  const free = Array.from({ length: tileCount }, (_, slot) => slot).filter((slot) => !reservedSlots.includes(slot))
  if (projectCount > free.length) {
    return Array.from({ length: tileCount }, (_, slot) => slot)
  }

  const projectSlots = Array.from({ length: projectCount }, (_, k) => (
    free[projectCount === 1 ? 0 : Math.round((k * (free.length - 1)) / (projectCount - 1))]
  ))
  const otherSlots = Array.from({ length: tileCount }, (_, slot) => slot).filter((slot) => !projectSlots.includes(slot))
  return [...projectSlots, ...otherSlots]
}

/**
 * Hook centralisé pour la configuration de la grille selon le type d'appareil
 * Évite la duplication de logique mobile/desktop dans plusieurs composants
 */
export const useGridConfig = () => {
  const currentIsMobile = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  return useMemo(() => {
    const cols = currentIsMobile ? 3 : 5
    const rows = currentIsMobile ? 5 : 3
    const tileCount = Math.max(cols * rows, projectsData.projects.length)
    const arrowUpPosition = currentIsMobile ? 12 : 4
    const arrowDownPosition = (cols * rows) - 1
    const crossPosition = currentIsMobile ? 13 : 9

    return {
      // Configuration de base
      isMobile: currentIsMobile,
      cols,
      rows,
      // Nombre de tuiles de la page projet : une tuile par projet, complétée par des tuiles vides
      // (invisibles sur l'accueil) pour que la grille et ses flèches de navigation existent toujours.
      tileCount,
      // Case d'arrivée de chaque tuile (index de tuile -> case de la grille) : les projets sont éparpillés
      tileSlots: getTileSlots(tileCount, projectsData.projects.length, [arrowUpPosition, arrowDownPosition, crossPosition]),

      // Positions adaptatives pour la navigation
      arrowUpPosition,
      arrowDownPosition,
      crossPosition,

      // Configuration de la grille
      projectSize: 1,
      gap: 0.005,
      margin: 0.5,
      distance: -5
    }
  }, [currentIsMobile])
}
