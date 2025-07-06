import * as THREE from 'three'
import { useState, useEffect, useMemo } from 'react'
import { useStore } from '@/stores/store'

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

    const loader = new THREE.TextureLoader()
    loader.load(
      contentImage.url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        
        // Configuration pour la transparence PNG
        texture.format = THREE.RGBAFormat
        texture.premultiplyAlpha = false
        
        // Remplacer la transparence par la couleur de fond du projet
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        // Créer une image temporaire pour accéder aux pixels
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          
          // Dessiner l'image sur le canvas
          ctx.drawImage(img, 0, 0)
          
          // Récupérer les données des pixels
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          
          // Couleur de fond du projet (convertir hex en RGB)
          const backgroundColor = selectedProject?.color?.background || '#ffffff'
          const r = parseInt(backgroundColor.slice(1, 3), 16)
          const g = parseInt(backgroundColor.slice(3, 5), 16)
          const b = parseInt(backgroundColor.slice(5, 7), 16)
          
          // Remplacer les pixels transparents par la couleur de fond (optimisé)
          const hasTransparency = data.some((_, i) => i % 4 === 3 && data[i] < 128)
          
          if (hasTransparency) {
            for (let i = 0; i < data.length; i += 4) {
              const alpha = data[i + 3]
              if (alpha < 128) { // Si le pixel est assez transparent
                data[i] = r     // Rouge
                data[i + 1] = g // Vert
                data[i + 2] = b // Bleu
                data[i + 3] = 255 // Alpha opaque
              }
            }
            // Remettre les données modifiées sur le canvas
            ctx.putImageData(imageData, 0, 0)
          }
          
          // Créer une nouvelle texture à partir du canvas
          const newTexture = new THREE.CanvasTexture(canvas)
          newTexture.colorSpace = THREE.SRGBColorSpace
          newTexture.minFilter = THREE.LinearFilter
          newTexture.magFilter = THREE.LinearFilter
          newTexture.format = THREE.RGBAFormat
          newTexture.premultiplyAlpha = false
          
          // Rotation différente selon la face cible
          if (targetFace === 'back') {
            newTexture.rotation = Math.PI // Rotation de 180° pour la face arrière
          } else {
            newTexture.rotation = 0 // Pas de rotation pour la face avant
          }

          const spanWidth = contentImage.span.split('-')[0]
          const spanHeight = contentImage.span.split('-')[1]
     
          newTexture.center.set(1 / spanWidth, 1 /spanHeight)
          newTexture.repeat.set(1 / spanWidth , 1 / spanHeight)
          newTexture.offset.set(
            validPositions.offsetX,
            validPositions.offsetY
          )
          setContentTexture(newTexture)
        }
        
        img.src = contentImage.url
      },
      undefined,
      (error) => {
        console.warn('Error loading content texture:', error)
        setContentTexture(null)
      }
    )
  }, [contentImage?.url, gridPosition, validPositions, targetFace])

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