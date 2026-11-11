import { useEffect, useRef } from 'react'
import { useStore } from '@/stores/store'

// Rotation cible des tuiles de l'accueil, pilotée par la molette et le toucher.
// L'angle vit dans une ref : un cran de molette ne déclenche aucun rendu React (sinon toute la scène serait
// recalculée à chaque événement). C'est ProjectList qui, à chaque image, rapproche la rotation affichée de cette cible.
export function useRotationControl() {
  const targetRef = useRef(0)
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
  const isProjectsArrangedRef = useRef(isProjectsArranged)

  useEffect(() => {
    isProjectsArrangedRef.current = isProjectsArranged
  }, [isProjectsArranged])

  useEffect(() => {
    const addToTarget = (delta) => {
      targetRef.current += delta
    }

    const handleWheel = (event) => {
      if (isProjectsArrangedRef.current) {
        return
      }

      const screenFactor = Math.min(window.innerWidth / 1920, 1)
      addToTarget(event.deltaY * 0.0007 * screenFactor)
    }

    // Gestion du touch pour mobile
    let touchStartX = 0
    let touchStartY = 0
    let touchStartTime = 0

    const handleTouchStart = (event) => {
      touchStartX = event.touches[0].clientX
      touchStartY = event.touches[0].clientY
      touchStartTime = Date.now()
    }

    const handleTouchMove = (event) => {
      if (isProjectsArrangedRef.current) {
        return
      }

      event.preventDefault()
      const touchCurrentX = event.touches[0].clientX
      const touchCurrentY = event.touches[0].clientY
      const deltaX = touchStartX - touchCurrentX
      const deltaY = touchStartY - touchCurrentY
      const touchTime = Date.now() - touchStartTime

      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY)

      let finalDelta
      if (isHorizontal) {
        const velocity = Math.abs(deltaX) / Math.max(touchTime, 1)
        finalDelta = -deltaX * 0.15 * Math.min(velocity / 4, 2)
      } else {
        const velocity = Math.abs(deltaY) / Math.max(touchTime, 1)
        finalDelta = deltaY * 0.1 * Math.min(velocity / 5, 2)
      }

      const screenFactor = Math.min(window.innerWidth / 1920, 1)
      addToTarget(finalDelta * screenFactor)

      touchStartX = touchCurrentX
      touchStartY = touchCurrentY
      touchStartTime = Date.now()
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  return { targetRef }
}
