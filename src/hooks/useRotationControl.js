import { useState, useEffect } from 'react'

export function useRotationControl() {
  const [rotationY, setRotationY] = useState(Math.PI)

  useEffect(() => {
    const handleWheel = (event) => {
      const screenFactor = Math.min(window.innerWidth / 1920, 1)
      const delta = event.deltaY * 0.0007 * screenFactor
      setRotationY((prev) => prev + delta)
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
      event.preventDefault() // Empêcher le scroll par défaut
      const touchCurrentX = event.touches[0].clientX
      const touchCurrentY = event.touches[0].clientY
      const deltaX = touchStartX - touchCurrentX
      const deltaY = touchStartY - touchCurrentY
      const touchTime = Date.now() - touchStartTime
      
      // Séparer le traitement horizontal et vertical pour une vitesse équilibrée
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY)
      
      let finalDelta
      if (isHorizontal) {
        // Scroll horizontal : inverser le sens et augmenter légèrement la sensibilité
        const velocity = Math.abs(deltaX) / Math.max(touchTime, 1)
        finalDelta = -deltaX * 0.15 * Math.min(velocity / 4, 2)
      } else {
        // Scroll vertical : garder le sens normal
        const velocity = Math.abs(deltaY) / Math.max(touchTime, 1)
        finalDelta = deltaY * 0.1 * Math.min(velocity / 5, 2)
      }
      
      const screenFactor = Math.min(window.innerWidth / 1920, 1)
      setRotationY((prev) => prev + finalDelta * screenFactor)
      
      touchStartX = touchCurrentX
      touchStartY = touchCurrentY
      touchStartTime = Date.now()
    }

    const handleTouchEnd = () => {
      // Pas besoin de gérer le raycasting sur mobile
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  return {
    rotationY,
    setRotationY,
  }
} 