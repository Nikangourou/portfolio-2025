import { useState, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import projectsData from '../data/projects.json'

export function useProjectPositions() {
  const { camera } = useThree()
  const [predefinedPositions, setPredefinedPositions] = useState([])
  const [borderStates, setBorderStates] = useState([])

  // Configuration de la grille
  const projectSize = 1
  const width = projectSize
  const height = projectSize
  const cols = 5
  const rows = 3
  const gap = 0.005
  const margin = 0.5
  const distance = -5

  // Calcul dynamique de arrangedDistance
  const calculateArrangedDistance = () => {
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
  }

  // Positions prédéfinies pour l'arrangement
  const calculatePredefinedPositions = (arrangedDistance) => {
    const positions = []
    const totalProjects = projectsData.projects.length

    // Calculer la taille totale de la grille
    const totalWidth = width * cols + gap * (cols - 1)
    const totalHeight = height * rows + gap * (rows - 1)

    for (let i = 0; i < totalProjects; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * (width + gap) - totalWidth / 2 + width / 2
      const y = -(row * (height + gap)) + totalHeight / 2 - height / 2
      positions.push([x, y, arrangedDistance])
    }

    // Stocker la taille des projets pour l'utiliser dans le composant Projet
    window.projectSize = { width, height }

    return positions
  }

  const calculateBorderPositions = (arrangedDistance) => {
    const positions = []

    // Créer une bordure plus large
    const borderSize = 2 // Nombre de carrés de bordure de chaque côté

    // Calculer les dimensions de la grille totale (projets + bordure)
    const totalCols = cols + borderSize * 2
    const totalRows = rows + borderSize * 2
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
          col >= borderSize &&
          col < borderSize + cols &&
          row >= borderSize &&
          row < borderSize + rows

        if (!isInProjectArea) {
          positions.push([x, y, arrangedDistance])
        }
      }
    }

    return positions
  }

  // Initialiser les positions
  useEffect(() => {
    const dist = calculateArrangedDistance()
    setPredefinedPositions(calculatePredefinedPositions(dist))
    
    // Initialiser les états des carrés de bordure
    const borderPositions = calculateBorderPositions(dist)
    setBorderStates(
      borderPositions.map((pos) => ({
        position: pos,
        rotation: [0, 0, 0],
      })),
    )
  }, [camera])

  // Gérer le redimensionnement de la fenêtre
  useEffect(() => {
    const handleResize = () => {
      const dist = calculateArrangedDistance()
      setPredefinedPositions(calculatePredefinedPositions(dist))
      
      // Recalculer les bordures
      const borderPositions = calculateBorderPositions(dist)
      setBorderStates(
        borderPositions.map((pos) => ({
          position: pos,
          rotation: [0, 0, 0],
        })),
      )
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    predefinedPositions,
    borderStates,
    setBorderStates,
    calculateArrangedDistance,
    calculatePredefinedPositions,
    calculateBorderPositions,
    projectSize: { width, height },
    distance,
    cols,
    rows,
    gap,
    margin
  }
} 