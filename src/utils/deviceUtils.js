/**
 * Utilitaires pour détecter les capacités de l'appareil
 */
import { useState, useEffect } from 'react'

/**
 * Détecte si l'utilisateur est sur un appareil mobile
 * @returns {boolean} true si mobile, false sinon
 */
export const isMobile = () => {
  // Détection basée sur la largeur d'écran
  const isSmallScreen = window.innerWidth < 768
  
  // Détection basée sur l'user agent
  const isMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  
  // Détection basée sur le support du touch
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  
  // Combinaison des détections pour plus de fiabilité
  return isSmallScreen || (isMobileUA && hasTouch)
}

/**
 * Détecte si l'appareil a des performances limitées
 * @returns {boolean} true si l'appareil est considéré comme peu puissant
 */
export const isLowEndDevice = () => {
  // Détection basée sur la mémoire (si disponible)
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4
  
  // Détection basée sur le nombre de cœurs CPU (si disponible)
  const lowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
  
  // Si on est sur mobile, on considère par défaut comme potentiellement peu puissant
  const mobile = isMobile()
  
  return lowMemory || lowCPU || mobile
}

/**
 * Obtient un facteur de qualité basé sur les capacités de l'appareil
 * @returns {number} facteur entre 0.5 et 1.0
 */
export const getQualityFactor = () => {
  if (isLowEndDevice()) {
    return 0.5 // Qualité réduite pour les appareils peu puissants
  }
  return 1.0 // Qualité normale
}

/**
 * Obtient la fréquence de mise à jour recommandée
 * @returns {number} fréquence en FPS
 */
export const getRecommendedFPS = () => {
  if (isLowEndDevice()) {
    return 30 // 30 FPS pour les appareils peu puissants
  }
  return 60 // 60 FPS pour les appareils performants
}

/**
 * Hook React pour détecter les changements de taille d'écran
 * @returns {boolean} true si mobile
 */
export const useIsMobile = () => {
  const [mobile, setMobile] = useState(isMobile())
  
  useEffect(() => {
    const handleResize = () => {
      setMobile(isMobile())
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  return mobile
}

// Export d'une instance globale pour éviter les recalculs
export const deviceInfo = {
  isMobile: isMobile(),
  isLowEnd: isLowEndDevice(),
  qualityFactor: getQualityFactor(),
  recommendedFPS: getRecommendedFPS()
}
