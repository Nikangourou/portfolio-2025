import { useState, useEffect, useCallback, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import projectsData from '../data/projects.json'
import { useGridConfig } from './useGridConfig'
import { useResizeCallback } from './useResize'

export function useProjectPositions() {
  const { camera } = useThree()
  const [predefinedPositions, setPredefinedPositions] = useState([])
  const [borderStates, setBorderStates] = useState([])

  // Configuration de la grille
  const gridConfig = useGridConfig()
  const projectSize = gridConfig.projectSize
  const width = projectSize
  const height = projectSize
  const cols = gridConfig.cols
  const rows = gridConfig.rows
  const gap = gridConfig.gap
  const margin = gridConfig.margin
  const distance = gridConfig.distance

  // Calcul dynamique de arrangedDistance - mémorisé avec useCallback
  const calculateArrangedDistance = useCallback(() => {
    console.log('calculateArrangedDistance')
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

    return -distanceMax - distance
  }, [width, height, cols, rows, gap, margin, distance, camera.fov, camera.aspect])

  // Mémoriser les dimensions de la grille pour éviter les recalculs
  const gridDimensions = useMemo(() => ({
    totalWidth: width * cols + gap * (cols - 1),
    totalHeight: height * rows + gap * (rows - 1)
  }), [width, height, cols, rows, gap])

  // Positions prédéfinies pour l'arrangement - mémorisé avec useCallback
  const calculatePredefinedPositions = useCallback((arrangedDistance) => {
    const positions = []
    const totalProjects = projectsData.projects.length

    for (let i = 0; i < totalProjects; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * (width + gap) - gridDimensions.totalWidth / 2 + width / 2
      const y = -(row * (height + gap)) + gridDimensions.totalHeight / 2 - height / 2
      positions.push([x, y, arrangedDistance])
    }

    return positions
  }, [width, height, cols, rows, gap, gridDimensions])

  const calculateBorderPositions = useCallback((arrangedDistance) => {
    const positions = []

    // Calculer l'espace visible de l'écran
    const fov = camera.fov * (Math.PI / 180)
    const aspect = camera.aspect
    const cameraDistance = Math.abs(distance)
    
    // Calculer la largeur et hauteur visibles à la distance de la caméra
    const visibleWidth = 2 * cameraDistance * Math.tan(fov / 2) * aspect
    const visibleHeight = 2 * cameraDistance * Math.tan(fov / 2)
    
    // Déterminer la taille des bordures selon le type d'appareil
    let borderColsLeft = gridConfig.borderColsLeft
    let borderColsRight = gridConfig.borderColsRight
    let borderRowsTop = gridConfig.borderRowsTop
    let borderRowsBottom = gridConfig.borderRowsBottom
    
    // Ajuster selon l'aspect ratio pour éviter les bordures excessives
    const aspectRatio = visibleWidth / visibleHeight
    if (aspectRatio > 1.5) {
      // Écran très large, réduire les bordures verticales
      borderRowsTop = Math.min(borderRowsTop, 2)
      borderRowsBottom = borderRowsTop
    } else if (aspectRatio < 0.7) {
      // Écran très haut, réduire les bordures horizontales
      borderColsLeft = Math.min(borderColsLeft, 2)
      borderColsRight = borderColsLeft
    }
    
    // Calculer les dimensions de la grille totale (projets + bordures)
    const totalCols = cols + borderColsLeft + borderColsRight
    const totalRows = rows + borderRowsTop + borderRowsBottom
    
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
          col >= borderColsLeft &&
          col < borderColsLeft + cols &&
          row >= borderRowsTop &&
          row < borderRowsTop + rows

        if (!isInProjectArea) {
          positions.push([x, y, arrangedDistance])
        }
      }
    }

    return positions
  }, [width, height, cols, rows, gap, camera.fov, camera.aspect, distance, gridConfig.borderColsLeft, gridConfig.borderColsRight, gridConfig.borderRowsTop, gridConfig.borderRowsBottom])

  // Mémoriser les positions des bordures pour éviter les recalculs
  const borderPositions = useMemo(() => {
    const dist = calculateArrangedDistance()
    return calculateBorderPositions(dist)
  }, [calculateArrangedDistance, calculateBorderPositions])

  // Fonction pour initialiser les positions - mémorisée
  const initializePositions = useCallback(() => {
    const dist = calculateArrangedDistance()
    setPredefinedPositions(calculatePredefinedPositions(dist))
    
    // Initialiser les états des carrés de bordure avec les positions mémorisées
    setBorderStates(
      borderPositions.map((pos) => ({
        position: pos,
        rotation: [0, 0, 0],
      })),
    )
  }, [calculateArrangedDistance, calculatePredefinedPositions, borderPositions])

  // Initialiser les positions
  useEffect(() => {
    initializePositions()
  }, [initializePositions])

  // Gérer le redimensionnement de la fenêtre
  useResizeCallback(() => {
    initializePositions()
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