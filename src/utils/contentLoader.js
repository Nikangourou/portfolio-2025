import { useState, useEffect, useMemo } from 'react'
import { useStore } from '@/stores/store'
import { createTextureWithBackground, configureTexture } from './textureUtils'
import { isMobile } from './deviceUtils'

/**
 * Détermine les positions de grille à affecter en fonction du span
 * @param {string} span - Span du contenu (ex: "2-2", "3-2")
 * @param {number} startPosition - Position de départ (valeur position du JSON)
 * @param {number} currentPosition - Position actuelle pour calculer l'offset
 * @returns {Object} - { positions: number[], offsetX: number, offsetY: number }
 */
export const getGridPositionsFromSpan = (span, startPosition, currentPosition = null) => {
  if (!span || startPosition === undefined) {
    return { positions: [], offsetX: 0, offsetY: 0 }
  }

  const positions = []
  const [width, height] = span.split('-').map(Number)
  const isMobileDevice = isMobile()
  const cols = isMobileDevice ? 3 : 5
  
  // Gérer la nouvelle structure de position (objet avec desktop/mobile)
  let adaptedStartPosition
  if (typeof startPosition === 'object' && startPosition.desktop !== undefined) {
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
        offsetX = (1 / width) * (relativeCol - 1) - 0.14
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
        // Cas spécial pour les spans de largeur 2
        offsetY = relativeRow === 0 ? 0.25 : -0.25
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

// Cache global pour éviter de recalculer les Maps à chaque render
const contentCache = new Map()

/**
 * Génère une clé unique pour le cache basée sur le projet et la page
 */
const getCacheKey = (projectId, page, isMobile) => {
  return `${projectId}-${page}-${isMobile ? 'mobile' : 'desktop'}`
}

/**
 * Hook pour charger les textures de contenu
 */
export const useContentTexture = (gridPosition) => {
  const [contentTexture, setContentTexture] = useState(null)
  const selectedProject = useStore((state) => state.selectedProject)
  const currentPage = useStore((state) => state.currentPage)
  
  // Nettoyer le cache si il devient trop volumineux
  useEffect(() => {
    if (contentCache.size > 20) {
      const entries = Array.from(contentCache.entries())
      // Garder les 10 plus récents
      contentCache.clear()
      entries.slice(-10).forEach(([key, value]) => {
        contentCache.set(key, value)
      })
    }
  }, [selectedProject?.id, currentPage])

  // Trouver l'image correspondant à cette position de grille et calculer ses positions
  const { contentImage, validPositions } = useMemo(() => {
    if (!selectedProject?.contents) return { contentImage: null, validPositions: { positions: [], offsetX: 0, offsetY: 0 } }
    
    // Récupérer le contenu de la page actuelle
    const currentContent = selectedProject.contents[currentPage - 1]
    if (!currentContent?.images) return { contentImage: null, validPositions: { positions: [], offsetX: 0, offsetY: 0 } }
    
    // Générer la clé de cache
    const isMobileDevice = isMobile()
    const cacheKey = getCacheKey(selectedProject.id, currentPage, isMobileDevice)
    
    // Vérifier si on a déjà calculé cette page
    let cachedData = contentCache.get(cacheKey)
    
    if (!cachedData) {
      // Calculer et mettre en cache
      const imageMap = new Map()
      const offsetCache = new Map()
      
      for (const image of currentContent.images) {
        const allPositions = getGridPositionsFromSpan(image.span, image.position)
        allPositions.positions.forEach(pos => {
          imageMap.set(pos, image)
          // Calculer et cacher les offsets pour cette position spécifique
          const positionOffsets = getGridPositionsFromSpan(image.span, image.position, pos)
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
        url: foundImage.url,
        span: foundImage.span,
        position: foundImage.position
      }
      return { contentImage, validPositions }
    }
    
    return { contentImage: null, validPositions: { positions: [], offsetX: 0, offsetY: 0 } }
  }, [selectedProject?.id, currentPage, gridPosition])


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
  const isMobileDevice = isMobile()
  
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
        textPosition = isMobileDevice ? text.position.mobile : text.position.desktop
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
  }, [selectedProject, currentPage, gridPosition, isMobileDevice])

  return { contentText }
} 