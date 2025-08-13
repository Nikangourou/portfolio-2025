import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useSpring, animated } from '@react-spring/three'
import ProjectList from './ProjectList'
import ProjectBorders from './ProjectBorders'
import projectsData from '../../data/projects.json'
import { useFrame } from '@react-three/fiber'
import { useStore } from '@/stores/store'
import useThemeStore from '@/stores/themeStore'
import ProjectInfoFloating from '../Interface/ProjectInfoFloating'
import { useProjectPositions } from '@/hooks/useProjectPositions'
import { useProjectInteraction } from '@/hooks/useProjectInteraction'
import { useProjectAnimations } from '@/hooks/useProjectAnimations'
import { useResizeCallback } from '@/hooks/useResize'

export default function Projects() {
  // console.log('Projects rendered')

  const groupRef = useRef(null)
  const { camera} = useThree()
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
  const isArrangementAnimationComplete = useStore(
    (state) => state.isArrangementAnimationComplete,
  )
  const setArrangementAnimationComplete = useStore(
    (state) => state.setArrangementAnimationComplete,
  )
  
  // Remplacer les states par des refs pour les animations
  const projectStatesRef = useRef([])
  const targetStatesRef = useRef([])
  const borderStatesRef = useRef([])
  const rotatingProjectsRef = useRef(new Set())
  const rotatingBordersRef = useRef(new Set())
  const animatingProjectsRef = useRef(new Set())
  
  // State minimal pour les données initiales (pas pour les animations)
  const [initialProjectStates, setInitialProjectStates] = useState([])
  
  // Garder quelques states pour les interactions et l'interface
  const [minDistance, setMinDistance] = useState(2.0)
  const currentTheme = useThemeStore((state) => state.currentTheme)
  const currentPage = useStore((state) => state.currentPage)


  // Hook pour la gestion des positions
  const {
    predefinedPositions,
    borderStates,
    projectSize,
    distance,
    borderPositions
  } = useProjectPositions()

  // Synchroniser borderStatesRef avec borderStates
  useEffect(() => {
    borderStatesRef.current = borderStates
  }, [borderStates])

  // Hook pour la gestion des interactions
  const {
    hoveredProject,
    displayedProject,
    projectMeshesRef,
    performRaycasting
  } = useProjectInteraction()

  // Ref pour les meshes des bordures
  const borderMeshesRef = useRef([])

  // Hook pour la gestion des animations
  const { animateProjects, animateBorders } = useProjectAnimations()

  const baseSpeed = 3

  // Gérer le redimensionnement pour les positions des projets arrangés
  useResizeCallback(() => {
    // Si on est en mode arrangé, mettre à jour les positions cibles
    if (isProjectsArranged && predefinedPositions.length > 0) {
      targetStatesRef.current = targetStatesRef.current.map((state, index) => ({
        ...state,
        position: predefinedPositions[index] || state.position,
      }))
    }
  })

  const findValidPosition = (positions, maxAttempts = 100) => {
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
        // Si on n'a pas trouvé de position valide après plusieurs tentatives,
        // on augmente légèrement la distance minimale
        currentMinDistance *= 0.9
        setMinDistance(currentMinDistance)
        attempts = 0
      }
    } while (
      positions.some((existingPos) => {
        const dx = position[0] - existingPos[0]
        const dy = position[1] - existingPos[1]
        const dz = position[2] - existingPos[2]
        return Math.sqrt(dx * dx + dy * dy + dz * dz) < currentMinDistance
      })
    )

    return position
  }

  useEffect(() => {
    if (!isProjectsArranged) {
      const newPositions = []
      const newTargetStates = projectStatesRef.current.map((state) => {
        const newPosition = findValidPosition(newPositions)
        newPositions.push(newPosition)

        return {
          ...state,
          position: newPosition,
          rotation: [
            // Math.random() * Math.PI * 0.5 - Math.PI * 0.25,
            Math.random() * Math.PI * 0.5 - Math.PI * 1.25,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 0.5 - Math.PI * 0.25,
          ],
          pageRotationX: 0,
          targetPageRotationX: 0,
        }
      })
      targetStatesRef.current = newTargetStates
      rotatingProjectsRef.current.clear()
      rotatingBordersRef.current.clear()
      animatingProjectsRef.current.clear()
      // Nettoyer les refs des bordures
      borderMeshesRef.current = []
      setArrangementAnimationComplete(false)
    } else {
      // Animation séquentielle pour éviter les superpositions
      animatingProjectsRef.current.clear()

      // Définir les positions cibles immédiatement
      targetStatesRef.current = predefinedPositions.map((pos, index) => ({
        ...projectStatesRef.current[index],
        position: pos,
        rotation: [0, 0, 0],
        pageRotationX: 0,
        targetPageRotationX: 0,
      }))

      // Créer un ordre aléatoire pour l'animation
      const randomOrder = Array.from(
        { length: projectStatesRef.current.length },
        (_, i) => i,
      ).sort(() => Math.random() - 0.5)

      // Démarrer l'animation des projets dans un ordre aléatoire
      randomOrder.forEach((projectIndex, animationIndex) => {
        setTimeout(() => {
          animatingProjectsRef.current.add(projectIndex)
        }, animationIndex * 100) // 100ms de délai entre chaque projet
      })

      // Attendre que tous les projets aient commencé leur animation
      const totalAnimationTime = projectStatesRef.current.length * 100 + 1000
      setTimeout(() => {
        setArrangementAnimationComplete(true)
      }, totalAnimationTime)
    }
  }, [isProjectsArranged])

  // Effet pour gérer les rotations une fois l'animation terminée
  useEffect(() => {
    if (isArrangementAnimationComplete) {
      // Vider et repeupler les Sets au lieu de les recréer
      rotatingProjectsRef.current.clear()
      projectStatesRef.current.forEach((_, index) => {
        rotatingProjectsRef.current.add(index)
      })

      // Utiliser les positions mémorisées au lieu de recalculer
      rotatingBordersRef.current.clear()
      borderPositions.forEach((_, index) => {
        rotatingBordersRef.current.add(index)
      })
    }
  }, [isArrangementAnimationComplete, borderPositions])

  useFrame((state, delta) => {
    // Animer les projets
    animateProjects(
      projectStatesRef,
      targetStatesRef,
      rotatingProjectsRef,
      animatingProjectsRef,
      projectMeshesRef,
      baseSpeed,
      delta
    )

    // Animer les bordures
    animateBorders(
      borderStatesRef,
      rotatingBordersRef,
      borderMeshesRef,
      baseSpeed,
      delta
    )

    // Raycasting pour détecter le projet sous le curseur
    performRaycasting(projectStatesRef.current, isProjectsArranged, groupRef)
  })

  // Initialiser les états des projets une seule fois au montage
  useMemo(() => {
    // Générer les positions aléatoires initiales
    const positions = []
    for (let i = 0; i < projectsData.projects.length; i++) {
      positions.push(findValidPosition(positions))
    }

    // Initialiser les états des projets
    const initialStates = projectsData.projects.map((project, index) => ({
      position: positions[index],
      rotation: [
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      ],
      project,
      pageRotationX: (currentPage - 1) * Math.PI,
      targetPageRotationX: (currentPage - 1) * Math.PI,
      pageRotationDelay: Math.random() * 0.5,
    }))

    projectStatesRef.current = initialStates
    setInitialProjectStates(initialStates) // Pour déclencher le premier render
  }, [])

  useEffect(() => {
    projectStatesRef.current.forEach((state, i) => {
      setTimeout(() => {
        projectStatesRef.current = projectStatesRef.current.map((s, j) =>
          j === i
            ? { ...s, targetPageRotationX: (currentPage - 1) * Math.PI }
            : s,
        )
      }, (state.pageRotationDelay || 0) * 1000)
    })
  }, [currentPage])

  return (
    <>
      <ProjectBorders
        isProjectsArranged={isProjectsArranged}
        borderStates={borderStates}
        projectSize={projectSize}
        currentTheme={currentTheme}
        distance={distance}
        borderMeshesRef={borderMeshesRef}
      />

      {!isProjectsArranged && displayedProject && (
        <ProjectInfoFloating project={displayedProject} isVisible={hoveredProject} />
      )}

      <ProjectList
        projectStates={initialProjectStates}
        projectMeshesRef={projectMeshesRef}
        groupRef={groupRef}
        distance={distance}
      />
    </>
  )
}
