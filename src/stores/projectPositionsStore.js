import { create } from 'zustand'
import projectsData from '../data/projects.json'

export const useProjectPositionsStore = create((set, get) => ({
  // État calculé
  arrangedDistance: null,
  predefinedPositions: [],
  borderPositions: [],
  projectSize: { width: 1, height: 1 },
  gridConfig: null,
  
  // Fonction pour calculer les positions des projets
  calculateProjectPositions: (camera, gridConfig) => {
    const {
      projectSize,
      cols,
      rows,
      gap,
      margin,
      distance
    } = gridConfig

    const width = projectSize
    const height = projectSize
    const totalWidth = width * cols + gap * (cols - 1)
    const totalHeight = height * rows + gap * (rows - 1)
    const fov = camera.fov * (Math.PI / 180)
    const aspect = camera.aspect

    // Calcul de arrangedDistance
    const distanceForWidth =
      Math.max(totalWidth / aspect, totalHeight) / (2 * Math.tan(fov / 2)) + margin
    const distanceForHeight =
      Math.max(totalHeight, totalWidth / aspect) / (2 * Math.tan(fov / 2)) + margin

    const distanceMax = Math.max(distanceForWidth, distanceForHeight)
    const arrangedDistance = -distanceMax - distance

    // Calcul des positions des projets
    const predefinedPositions = []
    const totalProjects = projectsData.projects.length

    for (let i = 0; i < totalProjects; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * (width + gap) - totalWidth / 2 + width / 2
      const y = -(row * (height + gap)) + totalHeight / 2 - height / 2
      predefinedPositions.push([x, y, arrangedDistance])
    }

    set({
      arrangedDistance,
      predefinedPositions,
      projectSize: { width, height },
      gridConfig
    })
  },

  // Fonction pour calculer les positions des bordures
  calculateBorderPositions: (camera, gridConfig) => {
    const state = get()
    const { arrangedDistance } = state
    
    if (!arrangedDistance) return

    const {
      projectSize,
      cols,
      rows,
      gap,
      distance,
      borderColsLeft,
      borderColsRight,
      borderRowsTop,
      borderRowsBottom
    } = gridConfig

    const width = projectSize
    const height = projectSize
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

    set({ borderPositions: positions })
  },

  // Fonction pour recalculer toutes les positions
  recalculateAll: (camera, gridConfig) => {    
    const { calculateProjectPositions, calculateBorderPositions } = get()
    calculateProjectPositions(camera, gridConfig)
    calculateBorderPositions(camera, gridConfig)
  }
}))
