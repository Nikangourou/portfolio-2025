import { useMemo, useState, useEffect } from 'react'
import { isMobile } from '@/utils/deviceUtils'

/**
 * Hook centralisé pour la configuration de la grille selon le type d'appareil
 * Évite la duplication de logique mobile/desktop dans plusieurs composants
 */
export const useGridConfig = () => {
  const [isMobileDevice, setIsMobileDevice] = useState(isMobile())
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobileDevice(isMobile())
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  return useMemo(() => {
    return {
      // Configuration de base
      isMobile: isMobileDevice,
      cols: isMobileDevice ? 3 : 5,
      rows: isMobileDevice ? 5 : 3,
      
      // Configuration des bordures
      borderColsLeft: isMobileDevice ? 4 : 3,
      borderColsRight: isMobileDevice ? 4 : 3,
      borderRowsTop: isMobileDevice ? 6 : 4,
      borderRowsBottom: isMobileDevice ? 6 : 4,
      
      // Positions adaptatives pour la navigation
      arrowUpPosition: isMobileDevice ? 12 : 4,
      crossPosition: isMobileDevice ? 13 : 9,
      
      // Configuration de la grille
      projectSize: 1,
      gap: 0.005,
      margin: 0.5,
      distance: -5
    }
  }, [isMobileDevice])
}
