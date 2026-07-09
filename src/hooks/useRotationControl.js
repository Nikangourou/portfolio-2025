import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/stores/store'

export function useRotationControl() {
  const [rotationY, setRotationY] = useState(Math.PI)
  const [targetRotationY, setTargetRotationY] = useState(Math.PI)
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
  const isProjectsArrangedRef = useRef(isProjectsArranged)
  const lastFreeRotationRef = useRef(Math.PI)
  const wasArrangedRef = useRef(false)

  useEffect(() => {
    isProjectsArrangedRef.current = isProjectsArranged
  }, [isProjectsArranged])

  useEffect(() => {
    if (isProjectsArranged) {
      if (wasArrangedRef.current) {
        return
      }

      wasArrangedRef.current = true

      const currentRotation = lastFreeRotationRef.current
      const targetRotation = 0

      // Normaliser les rotations entre -π et π pour prendre le chemin le plus court.
      const normalizedCurrent = ((currentRotation + Math.PI) % (2 * Math.PI)) - Math.PI
      const normalizedTarget = ((targetRotation + Math.PI) % (2 * Math.PI)) - Math.PI

      let shortestPath = normalizedTarget - normalizedCurrent
      if (Math.abs(shortestPath) > Math.PI) {
        shortestPath = shortestPath > 0
          ? shortestPath - 2 * Math.PI
          : shortestPath + 2 * Math.PI
      }

      setTargetRotationY(currentRotation + shortestPath)
      return
    }

    wasArrangedRef.current = false
    setTargetRotationY(lastFreeRotationRef.current)
  }, [isProjectsArranged])

  useEffect(() => {
    if (isProjectsArranged) {
      return
    }

    lastFreeRotationRef.current = rotationY
    setTargetRotationY(rotationY)
  }, [rotationY, isProjectsArranged])

  useEffect(() => {
    const handleWheel = (event) => {
      if (isProjectsArrangedRef.current) {
        return
      }

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
      setRotationY((prev) => prev + finalDelta * screenFactor)

      touchStartX = touchCurrentX
      touchStartY = touchCurrentY
      touchStartTime = Date.now()
    }

    const handleTouchEnd = () => {
      // Cleanup si nécessaire
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
    rotationY: targetRotationY,
    rawRotationY: rotationY, // Rotation brute si besoin
    setRotationY,
  }
} 