import * as THREE from 'three'
import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../stores/store'

/**
 * Détermine les positions de grille à affecter en fonction du span
 * @param {string} span - Span du contenu (ex: "2-2", "3-2")
 * @param {number} startPosition - Position de départ
 * @param {number} currentPosition - Position actuelle pour calculer l'offset
 * @returns {Object} - { positions: number[], offsetX: number, offsetY: number }
 */
export const getGridPositionsFromSpan = (span, startPosition = 5, currentPosition = null) => {
  if (!span) {
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
    const offsetX = relativeCol * 0.5 - 0.25
    const offsetY = -relativeRow * 0.5 + 0.25
    
    return { positions, offsetX, offsetY }
  }
  
  // Fallback si pas de position spécifique
  return { positions, offsetX: 0, offsetY: 0 }
}

/**
 * Hook simple pour charger les textures de contenu
 */
export const useContentTexture = (gridPosition) => {
  const [contentTexture, setContentTexture] = useState(null)
  const content = useStore((state) => state.selectedProject?.contents?.[0])
  const currentPage = useStore((state) => state.currentPage)
  const contentImage = content?.image

  // Déterminer les positions valides pour ce contenu
  const validPositions = useMemo(() => 
    getGridPositionsFromSpan(content?.span, 5, gridPosition), 
    [content?.span, gridPosition]
  )

  // Déterminer quelle face utiliser selon la parité de la page
  const isEvenPage = currentPage % 2 === 0
  const targetFace = isEvenPage ? 'front' : 'back'

  useEffect(() => {
    if (!contentImage || !validPositions.positions.includes(gridPosition)) {
      setContentTexture(null)
      return
    }

    const loader = new THREE.TextureLoader()
    loader.load(
      contentImage,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        
        // Rotation différente selon la face cible
        if (targetFace === 'back') {
          texture.rotation = Math.PI // Rotation de 180° pour la face arrière
        } else {
          texture.rotation = 0 // Pas de rotation pour la face avant
        }
        
        texture.center.set(0.5, 0.5)
        texture.repeat.set(0.5, 0.5)
        texture.offset.set(
          validPositions.offsetX,
          validPositions.offsetY
        )
        setContentTexture(texture)
      },
      undefined,
      (error) => {
        console.warn('Error loading content texture:', error)
        setContentTexture(null)
      }
    )
  }, [contentImage, gridPosition, validPositions, targetFace])

  return { contentTexture, targetFace }
} 