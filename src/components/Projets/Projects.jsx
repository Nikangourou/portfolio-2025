import React, { useMemo, useRef, useState, useEffect } from 'react'
import ProjectList from './ProjectList'
import ProjectBorders from './ProjectBorders'
import projectsData from '../../data/projects.json'
import { useFrame } from '@react-three/fiber'
import { useStore } from '@/stores/store'
import useThemeStore from '@/stores/themeStore'
import ProjectInfoFloating from '../Interface/ProjectInfoFloating'
import { useProjectPositions } from '@/hooks/useProjectPositions'
import { useProjectInteraction } from '@/hooks/useProjectInteraction'

export default function Projects() {
  // console.log('Projects rendered')

  const groupRef = useRef(null)
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
 
  // Ref minimal pour le raycasting (ne contient que les données des projets)
  const projectDataRef = useRef([])
  
  // Garder quelques states pour les interactions et l'interface
  const [minDistance, setMinDistance] = useState(2.0)
  const currentTheme = useThemeStore((state) => state.currentTheme)

  // Hook pour la gestion des positions
  const {
    projectSize,
    distance
  } = useProjectPositions()

  // Hook pour la gestion des interactions
  const {
    hoveredProject,
    displayedProject,
    projectGroupsRef,
    performRaycasting,
    displaySpring,
    displayApi
  } = useProjectInteraction()

  const findValidPosition = (positions = [], maxAttempts = 100) => {
    const xRange = [-2, 2]
    const yRange = [-2, 2]
    const zRange = [-2, 2]

    let attempts = 0
    let position
    let currentMinDistance = minDistance

    do {
      position = [
        Math.random() * (xRange[1] - xRange[0]) + xRange[0],
        Math.random() * (yRange[1] - yRange[0]) + yRange[0],
        Math.random() * (zRange[1] - zRange[0]) + zRange[0],
      ]
      attempts++

      if (attempts > maxAttempts) {
        currentMinDistance *= 0.9
        setMinDistance(currentMinDistance)
        attempts = 0
      }
    } while (
      positions.length > 0 && positions.some((existingPos) => {
        const dx = position[0] - existingPos[0]
        const dy = position[1] - existingPos[1]
        const dz = position[2] - existingPos[2]
        return Math.sqrt(dx * dx + dy * dy + dz * dz) < currentMinDistance
      })
    )

    return position
  }
  
  // Créer les données des projets avec positions initiales aléatoires
  const projectData = useMemo(() => {
    const usedPositions = []
    
    return projectsData.projects.map((project, index) => {
      const randomPosition = findValidPosition(usedPositions)
      usedPositions.push(randomPosition)
      
      const randomRotation = [
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      ]
      
      return {
        project,
        initialPosition: randomPosition,
        initialRotation: randomRotation,
        pageRotationDelay: Math.random() * 0.5,
      }
    })
  }, [])

  // Mettre à jour la ref pour le raycasting
  useEffect(() => {
    projectDataRef.current = projectData
  }, [projectData])


  useFrame((state, delta) => {
    // Raycasting pour détecter le projet sous le curseur
    performRaycasting(projectDataRef.current, isProjectsArranged, groupRef)
  })

  return (
    <>
      <ProjectBorders
        isProjectsArranged={isProjectsArranged}
        projectSize={projectSize}
        currentTheme={currentTheme}
        distance={distance}
      />

      {!isProjectsArranged && displayedProject && (
        <ProjectInfoFloating 
          project={displayedProject} 
          isVisible={!!hoveredProject}
          displaySpring={displaySpring}
          displayApi={displayApi}
        />
      )}

      <ProjectList
        projectStates={projectData}
        projectGroupsRef={projectGroupsRef}
        groupRef={groupRef}
        distance={distance}
      />
    </>
  )
}
