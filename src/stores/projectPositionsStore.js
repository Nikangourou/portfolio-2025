import { create } from 'zustand'
import { generateCloudPositions } from '../utils/cloudLayout'
import projectsData from '../data/projects.json'

export const useProjectPositionsStore = create((set, get) => ({
  // État calculé
  arrangedDistance: null,
  predefinedPositions: [],
  borderPositions: [],
  // Positions de départ dans le nuage de l'accueil : d'abord les tuiles des projets, puis celles des bordures
  cloudPositions: [],
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
    const totalProjects = gridConfig.tileCount

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

  // Fonction pour calculer les positions des bordures :
  // on ajoute juste assez de tuiles autour de la grille pour couvrir tout l'écran, quel que soit son ratio
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
    } = gridConfig

    const width = projectSize
    const height = projectSize
    const pitchX = width + gap
    const pitchY = height + gap

    // Les tuiles sont rangées dans un plan perpendiculaire à la caméra (placée à l'origine),
    // à la distance de la grille rangée : on en déduit la zone visible dans ce plan.
    const planeDistance = Math.abs(distance + arrangedDistance)
    const fov = camera.fov * (Math.PI / 180)
    const visibleHeight = 2 * planeDistance * Math.tan(fov / 2)
    const visibleWidth = visibleHeight * camera.aspect

    const gridWidth = cols * pitchX - gap
    const gridHeight = rows * pitchY - gap

    // Nombre de tuiles à ajouter de chaque côté (la grille est centrée). La petite marge évite
    // qu'une bordure qui se penche au survol, ou l'ondulation, laisse apparaître le fond sur le bord de l'écran.
    const EDGE_SAFETY = 0.1
    const extraCols = Math.max(0, Math.ceil((visibleWidth - gridWidth) / 2 / pitchX + EDGE_SAFETY))
    const extraRows = Math.max(0, Math.ceil((visibleHeight - gridHeight) / 2 / pitchY + EDGE_SAFETY))

    const totalCols = cols + extraCols * 2
    const totalRows = rows + extraRows * 2

    const totalWidth = totalCols * width + (totalCols - 1) * gap
    const totalHeight = totalRows * height + (totalRows - 1) * gap

    // Calculer les positions de départ pour centrer la grille
    const startX = -totalWidth / 2 + width / 2
    const startY = totalHeight / 2 - height / 2

    const positions = []

    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        // La zone des projets est occupée par les tuiles des projets
        const isInProjectArea =
          col >= extraCols &&
          col < extraCols + cols &&
          row >= extraRows &&
          row < extraRows + rows

        if (!isInProjectArea) {
          positions.push([
            startX + col * pitchX,
            startY - row * pitchY,
            arrangedDistance,
          ])
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

    const total = gridConfig.tileCount + get().borderPositions.length
    const cloudPositions = generateCloudPositions(total, camera, gridConfig.distance, projectsData.projects.length, get().projectSize)
    set({ cloudPositions })
  }
}))
