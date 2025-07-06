import { useState, useEffect, useMemo } from 'react'
import { useStore } from '@/stores/store'
import { createTextureWithBackground, configureTexture } from './textureUtils'

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
  const cols = 5
  const startRow = Math.floor(startPosition / cols)
  const startCol = startPosition % cols
  
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
    const offsetX = (relativeCol - 1 + 1 / width) / width
    const offsetY = -(relativeRow - 1 + 1 / height) / height
    
    return { positions, offsetX, offsetY }
  }
  
  // Fallback si pas de position spécifique
  return { positions, offsetX: 0, offsetY: 0 }
}

/**
 * Hook pour charger les textures de contenu
 */
export const useContentTexture = (gridPosition) => {
  const [contentTexture, setContentTexture] = useState(null)
  const selectedProject = useStore((state) => state.selectedProject)
  const currentPage = useStore((state) => state.currentPage)
  
  // Trouver l'image correspondant à cette position de grille
  const contentImage = useMemo(() => {
    if (!selectedProject?.contents) return null
    
    // Récupérer le contenu de la page actuelle
    const currentContent = selectedProject.contents[currentPage - 1]
    if (!currentContent?.images) return null
    
    // Chercher l'image qui correspond à cette position
    for (const image of currentContent.images) {
      const validPositions = getGridPositionsFromSpan(image.span, image.position)
      if (validPositions.positions.includes(gridPosition)) {
        return {
          url: image.url,
          span: image.span,
          position: image.position
        }
      }
    }
    return null
  }, [selectedProject, currentPage, gridPosition])

  // Déterminer les positions valides pour cette image
  const validPositions = useMemo(() => 
    contentImage ? getGridPositionsFromSpan(contentImage.span, contentImage.position, gridPosition) : { positions: [], offsetX: 0, offsetY: 0 }, 
    [contentImage, gridPosition]
  )

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
  }, [contentImage?.url, gridPosition, validPositions, targetFace, selectedProject?.color?.background])

  return { contentTexture, targetFace }
}

/**
 * Hook pour récupérer les textes de contenu
 */
export const useContentText = (gridPosition) => {
  const selectedProject = useStore((state) => state.selectedProject)
  const currentPage = useStore((state) => state.currentPage)
  
  // Trouver le texte correspondant à cette position de grille
  const contentText = useMemo(() => {
    if (!selectedProject?.contents) return null
    
    // Récupérer le contenu de la page actuelle
    const currentContent = selectedProject.contents[currentPage - 1]
    if (!currentContent?.texts) return null
    
    // Chercher le texte qui correspond à cette position
    for (const text of currentContent.texts) {
      if (text.position === gridPosition) {
        return {
          text: text.text,
          position: text.position
        }
      }
    }
    
    return null
  }, [selectedProject, currentPage, gridPosition])

  return { contentText }
} 