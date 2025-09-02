import { useState, useEffect, useMemo } from 'react'
import { useStore } from '@/stores/store'
import { createTextureWithBackground, configureTexture, clearTextureCache } from './textureUtils'
import { useGridConfig } from '../hooks/useGridConfig'

/**
 * Utilitaire pour obtenir l'URL appropriée selon le type d'appareil
 * @param {string|object} url - URL simple ou objet avec propriétés desktop/mobile
 * @param {boolean} isMobile - Indique si l'appareil est mobile
 * @returns {string} URL appropriée
 */
const getAdaptiveUrl = (url, isMobile) => {
  // Si c'est un objet avec desktop/mobile, retourner l'URL appropriée
  if (typeof url === 'object' && url !== null) {
    if (url.desktop !== undefined && url.mobile !== undefined) {
      return isMobile ? url.mobile : url.desktop
    }
  }
  
  // Sinon, retourner l'URL telle quelle (rétrocompatibilité)
  return url
}

/**
 * Utilitaire pour obtenir le span approprié selon le type d'appareil
 * @param {string|object} span - Span simple ou objet avec propriétés desktop/mobile
 * @param {boolean} isMobile - Indique si l'appareil est mobile
 * @returns {string} Span approprié
 */
const getAdaptiveSpan = (span, isMobile) => {
  // Si c'est un objet avec desktop/mobile, retourner le span approprié
  if (typeof span === 'object' && span !== null) {
    if (span.desktop !== undefined && span.mobile !== undefined) {
      return isMobile ? span.mobile : span.desktop
    }
  }
  
  // Sinon, retourner le span tel quel (rétrocompatibilité)
  return span
}

/**
 * Détermine les positions de grille à affecter en fonction du span
 * @param {string} span - Span du contenu (ex: "2-2", "3-2")
 * @param {number} startPosition - Position de départ (valeur position du JSON)
 * @param {number} currentPosition - Position actuelle pour calculer l'offset
 * @returns {Object} - { positions: number[], offsetX: number, offsetY: number }
 */
export const getGridPositionsFromSpan = (span, startPosition, currentPosition = null, gridConfig = null) => {
  if (!span || startPosition === undefined) {
    return { positions: [], offsetX: 0, offsetY: 0 }
  }

  const positions = []
  const [width, height] = span.split('-').map(Number)
  
  // Utiliser la configuration passée en paramètre ou une valeur par défaut
  const cols = gridConfig ? gridConfig.cols : 5
  
  // Gérer la nouvelle structure de position (objet avec desktop/mobile)
  let adaptedStartPosition
  if (typeof startPosition === 'object' && startPosition.desktop !== undefined) {
    const isMobileDevice = gridConfig ? gridConfig.isMobile : false
    adaptedStartPosition = isMobileDevice ? startPosition.mobile : startPosition.desktop
  } else {
    // Fallback pour l'ancienne structure (nombre simple)
    adaptedStartPosition = startPosition
  }
  
  const startRow = Math.floor(adaptedStartPosition / cols)
  const startCol = adaptedStartPosition % cols
  
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const position = (startRow + row) * cols + (startCol + col)
      positions.push(position)
    }
  }
  
  // Si on a une position actuelle, calculer l'offset pour cette position spécifique
  if (currentPosition !== null) {
    const currentRow = Math.floor(currentPosition / cols)
    const currentCol = currentPosition % cols
    
    // Calculer la position relative dans le span
    const relativeRow = currentRow - startRow
    const relativeCol = currentCol - startCol

    // Calculer les offsets pour cette position spécifique
    let offsetX, offsetY

    switch (width) {
      case 1:
        offsetX = 0
        break
      case 2:
        offsetX = relativeCol === 0 ? -0.25 : 0.25
        break
      case 4:
        offsetX = (1 / width) * (relativeCol - 1) - (1 / 8)
        break
      default:
        offsetX = (1 / width) * (relativeCol - 1)
        break
    }


    switch (height) {
      case 1:
        offsetY = 0
        break
      case 2:
        offsetY = relativeRow === 0 ? 0.25 : -0.25
        break
      case 4:
        offsetY = (1 / height) * (-relativeRow + 1) + (1 / 8)
        break
      default:
        // Logique générale pour les autres spans
        offsetY = (1 / height) * (-relativeRow + 1)
        break
    }
    
    
    return { positions, offsetX, offsetY }
  }
  
  // Fallback si pas de position spécifique
  return { positions, offsetX: 0, offsetY: 0 }
}

// Cache global optimisé pour éviter de recalculer les Maps à chaque render
const contentCache = new Map()
const MAX_CACHE_SIZE = 50 // Augmenter la taille du cache

/**
 * Génère une clé unique pour le cache basée sur le projet et la page
 */
const getCacheKey = (projectId, page, isMobile) => {
  return `${projectId}-${page}-${isMobile ? 'mobile' : 'desktop'}`
}

/**
 * Nettoie le cache de manière plus intelligente
 */
const cleanCache = () => {
  if (contentCache.size > MAX_CACHE_SIZE) {
    // Garder seulement les 30 entrées les plus récentes
    const entries = Array.from(contentCache.entries())
    const toKeep = entries.slice(-30)
    contentCache.clear()
    toKeep.forEach(([key, value]) => {
      contentCache.set(key, value)
    })
  }
}

/**
 * Hook pour charger les textures de contenu
 */
export const useContentTexture = (gridPosition) => {
  const [contentTexture, setContentTexture] = useState(null)
  const selectedProject = useStore((state) => state.selectedProject)
  const currentPage = useStore((state) => state.currentPage)
  const gridConfig = useGridConfig()
  
  // Nettoyer le cache de contenu de manière optimisée
  useEffect(() => {
    cleanCache()
    // Note: On garde le cache des textures global pour les performances
    // Il se nettoie automatiquement quand il atteint MAX_CACHE_SIZE
  }, [selectedProject?.id])

  // Trouver l'image correspondant à cette position de grille et calculer ses positions
  const { contentImage, validPositions } = useMemo(() => {
    if (!selectedProject?.contents) return { contentImage: null, validPositions: { positions: [], offsetX: 0, offsetY: 0 } }
    
    // Récupérer le contenu de la page actuelle
    const currentContent = selectedProject.contents[currentPage - 1]
    if (!currentContent?.images) return { contentImage: null, validPositions: { positions: [], offsetX: 0, offsetY: 0 } }
    
    // Générer la clé de cache
    const cacheKey = getCacheKey(selectedProject.id, currentPage, gridConfig.isMobile)
    
    // Vérifier si on a déjà calculé cette page
    let cachedData = contentCache.get(cacheKey)
    
    if (!cachedData) {
      // Calculer et mettre en cache
      const imageMap = new Map()
      const offsetCache = new Map()
      
      for (const image of currentContent.images) {
        const adaptiveSpan = getAdaptiveSpan(image.span, gridConfig.isMobile)
        const allPositions = getGridPositionsFromSpan(adaptiveSpan, image.position, null, gridConfig)
        allPositions.positions.forEach(pos => {
          imageMap.set(pos, image)
          // Calculer et cacher les offsets pour cette position spécifique
          const positionOffsets = getGridPositionsFromSpan(adaptiveSpan, image.position, pos, gridConfig)
          offsetCache.set(pos, positionOffsets)
        })
      }
      
      cachedData = { imageMap, offsetCache }
      contentCache.set(cacheKey, cachedData)
    }
    
    // Lookup direct dans le cache
    const foundImage = cachedData.imageMap.get(gridPosition)
    if (foundImage) {
      const validPositions = cachedData.offsetCache.get(gridPosition)
      const contentImage = {
        url: getAdaptiveUrl(foundImage.url, gridConfig.isMobile),
        span: getAdaptiveSpan(foundImage.span, gridConfig.isMobile),
        position: foundImage.position
      }
      return { contentImage, validPositions }
    }
    
    return { contentImage: null, validPositions: { positions: [], offsetX: 0, offsetY: 0 } }
  }, [selectedProject?.id, currentPage, gridPosition, gridConfig.isMobile])


  // Déterminer quelle face utiliser selon la parité de la page
  const isEvenPage = currentPage % 2 === 0
  const targetFace = isEvenPage ? 'front' : 'back'

  useEffect(() => {
    if (!contentImage?.url || !validPositions.positions.includes(gridPosition)) {
      setContentTexture(null)
      return
    }

    const backgroundColor = selectedProject?.color?.background || '#ffffff'
    
    createTextureWithBackground(contentImage.url, backgroundColor)
      .then((texture) => {
        configureTexture(texture, contentImage.span, validPositions, targetFace)
        setContentTexture(texture)
      })
      .catch((error) => {
        console.warn('Error loading content texture:', error)
        setContentTexture(null)
      })

    // Cleanup : libérer l'ancienne texture
    return () => {
      setContentTexture((prevTexture) => {
        if (prevTexture && prevTexture.dispose) {
          prevTexture.dispose()
        }
        return null
      })
    }
  }, [contentImage?.url, gridPosition, validPositions, targetFace, selectedProject?.color?.background])

  return { contentTexture, targetFace }
}

/**
 * Hook pour récupérer les textes de contenu
 */
export const useContentText = (gridPosition) => {
  const selectedProject = useStore((state) => state.selectedProject)
  const currentPage = useStore((state) => state.currentPage)
  const gridConfig = useGridConfig()
  
  // Trouver le texte correspondant à cette position de grille
  const contentText = useMemo(() => {
    if (!selectedProject?.contents) return null
    
    // Récupérer le contenu de la page actuelle
    const currentContent = selectedProject.contents[currentPage - 1]
    if (!currentContent?.texts) return null
    
    // Chercher le texte qui correspond à cette position
    for (const text of currentContent.texts) {
      // Gérer la nouvelle structure de position (objet avec desktop/mobile)
      let textPosition
      if (typeof text.position === 'object' && text.position.desktop !== undefined) {
        textPosition = gridConfig.isMobile ? text.position.mobile : text.position.desktop
      } else {
        // Fallback pour l'ancienne structure (nombre simple)
        textPosition = text.position
      }
      
      if (textPosition === gridPosition) {
        return {
          text: text.text,
          position: text.position
        }
      }
    }
    
    return null
  }, [selectedProject, currentPage, gridPosition, gridConfig.isMobile])

  return { contentText }
} 