import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import projectsData from '../data/projects.json'
import { useGridConfig } from './useGridConfig'
import { useResizeCallback } from './useResize'

// Cache global pour éviter les recalculs entre différentes instances du hook
let globalCache = {
  lastKey: null,
  arrangedDistance: null,
  predefinedPositions: null,
  borderPositions: null
}

export function useProjectPositions() {
  const { camera } = useThree()
  const [predefinedPositions, setPredefinedPositions] = useState([])
  const [borderStates, setBorderStates] = useState([])

  // Configuration de la grille - déstructurer pour éviter les changements de référence
  const gridConfig = useGridConfig()
  const {
    projectSize,
    cols,
    rows,
    gap,
    margin,
    distance,
    borderColsLeft,
    borderColsRight,
    borderRowsTop,
    borderRowsBottom
  } = gridConfig
  
  const width = projectSize
  const height = projectSize

  // Mémoriser les dimensions de la grille pour éviter les recalculs
  const gridDimensions = useMemo(() => ({
    totalWidth: width * cols + gap * (cols - 1),
    totalHeight: height * rows + gap * (rows - 1)
  }), [width, height, cols, rows, gap])

  // Calcul dynamique de arrangedDistance avec cache global
  const arrangedDistance = useMemo(() => {
    // Créer une clé unique basée sur toutes les dépendances
    const dependencyKey = `${width}-${height}-${cols}-${rows}-${gap}-${margin}-${distance}-${Math.round(camera.fov * 100)}-${Math.round(camera.aspect * 10000)}`
    
    // Si la clé n'a pas changé, utiliser le cache global
    if (globalCache.lastKey === dependencyKey && globalCache.arrangedDistance !== null) {
      return globalCache.arrangedDistance
    }
        
    const totalWidth = width * cols + gap * (cols - 1)
    const totalHeight = height * rows + gap * (rows - 1)
    const fov = camera.fov * (Math.PI / 180)
    const aspect = camera.aspect

    const distanceForWidth =
      Math.max(totalWidth / aspect, totalHeight) / (2 * Math.tan(fov / 2)) +
      margin

    const distanceForHeight =
      Math.max(totalHeight, totalWidth / aspect) / (2 * Math.tan(fov / 2)) +
      margin

    const distanceMax = Math.max(distanceForWidth, distanceForHeight)
    const result = -distanceMax - distance
    
    // Mettre à jour le cache global
    globalCache.lastKey = dependencyKey
    globalCache.arrangedDistance = result

    return result
  }, [width, height, cols, rows, gap, margin, distance, camera.fov, camera.aspect])

  // Positions prédéfinies pour l'arrangement - avec cache global
  const predefinedPositionsCalculated = useMemo(() => {
    const cacheKey = `${arrangedDistance}-${cols}-${rows}-${width}-${height}-${gap}`
    
    if (globalCache.predefinedPositions && globalCache.lastKey?.includes(cacheKey)) {
      return globalCache.predefinedPositions
    }
    
    const positions = []
    const totalProjects = projectsData.projects.length

    for (let i = 0; i < totalProjects; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * (width + gap) - gridDimensions.totalWidth / 2 + width / 2
      const y = -(row * (height + gap)) + gridDimensions.totalHeight / 2 - height / 2
      positions.push([x, y, arrangedDistance])
    }
    
    globalCache.predefinedPositions = positions
    return positions
  }, [arrangedDistance, cols, rows, width, height, gap, gridDimensions])

  const calculateBorderPositions = useCallback((arrangedDistance) => {
    const cacheKey = `border-${arrangedDistance}-${cols}-${rows}-${width}-${height}-${gap}-${camera.fov}-${camera.aspect}`
    
    if (globalCache.borderPositions && globalCache.lastKey?.includes(cacheKey)) {
      return globalCache.borderPositions
    }
    
    const positions = []

    // Calculer l'espace visible de l'écran
    const fov = camera.fov * (Math.PI / 180)
    const aspect = camera.aspect
    const cameraDistance = Math.abs(distance)
    
    // Calculer la largeur et hauteur visibles à la distance de la caméra
    const visibleWidth = 2 * cameraDistance * Math.tan(fov / 2) * aspect
    const visibleHeight = 2 * cameraDistance * Math.tan(fov / 2)
    
    // Déterminer la taille des bordures selon le type d'appareil
    let finalBorderColsLeft = borderColsLeft
    let finalBorderColsRight = borderColsRight
    let finalBorderRowsTop = borderRowsTop
    let finalBorderRowsBottom = borderRowsBottom
    
    // Ajuster selon l'aspect ratio pour éviter les bordures excessives
    const aspectRatio = visibleWidth / visibleHeight
    if (aspectRatio > 1.5) {
      // Écran très large, réduire les bordures verticales
      finalBorderRowsTop = Math.min(finalBorderRowsTop, 2)
      finalBorderRowsBottom = finalBorderRowsTop
    } else if (aspectRatio < 0.7) {
      // Écran très haut, réduire les bordures horizontales
      finalBorderColsLeft = Math.min(finalBorderColsLeft, 2)
      finalBorderColsRight = finalBorderColsLeft
    }
    
    // Calculer les dimensions de la grille totale (projets + bordures)
    const totalCols = cols + finalBorderColsLeft + finalBorderColsRight
    const totalRows = rows + finalBorderRowsTop + finalBorderRowsBottom
    
    const totalWidth = totalCols * width + (totalCols - 1) * gap
    const totalHeight = totalRows * height + (totalRows - 1) * gap

    // Calculer les positions de départ pour centrer la grille
    const startX = -totalWidth / 2 + width / 2
    const startY = totalHeight / 2 - height / 2

    // Créer la grille de carrés
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        const x = startX + col * (width + gap)
        const y = startY - row * (height + gap)

        // Vérifier si la position est dans la zone des projets
        const isInProjectArea =
          col >= finalBorderColsLeft &&
          col < finalBorderColsLeft + cols &&
          row >= finalBorderRowsTop &&
          row < finalBorderRowsTop + rows

        if (!isInProjectArea) {
          positions.push([x, y, arrangedDistance])
        }
      }
    }
    
    globalCache.borderPositions = positions
    return positions
  }, [width, height, cols, rows, gap, camera.fov, camera.aspect, distance, borderColsLeft, borderColsRight, borderRowsTop, borderRowsBottom])

  // Mémoriser les positions des bordures pour éviter les recalculs
  const borderPositions = useMemo(() => {
    return calculateBorderPositions(arrangedDistance)
  }, [calculateBorderPositions, arrangedDistance])

  // Initialiser les positions
  useEffect(() => {
    setPredefinedPositions(predefinedPositionsCalculated)
    
    // Initialiser les états des carrés de bordure avec les positions mémorisées
    setBorderStates(
      borderPositions.map((pos) => ({
        position: pos,
        rotation: [0, 0, 0],
      })),
    )
  }, [predefinedPositionsCalculated, borderPositions])

  // Gérer le redimensionnement de la fenêtre
  useResizeCallback(() => {
    setPredefinedPositions(predefinedPositionsCalculated)
    
    setBorderStates(
      borderPositions.map((pos) => ({
        position: pos,
        rotation: [0, 0, 0],
      })),
    )
  })

  return {
    predefinedPositions,
    borderStates,
    setBorderStates,
    borderPositions, 
    projectSize: { width, height },
    distance,
    cols,
    rows,
    gap,
    margin
  }
} 