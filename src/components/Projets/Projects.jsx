import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import ProjectList from './ProjectList'
import ProjectBorders from './ProjectBorders'
import projectsData from '../../data/projects.json'
import { useFrame } from '@react-three/fiber'
import { useStore } from '@/stores/store'
import useThemeStore from '@/stores/themeStore'
import ProjectInfoFloating from '../Interface/ProjectInfoFloating'
import { useProjectPositions } from '@/hooks/useProjectPositions'
import { useRotationControl } from '@/hooks/useRotationControl'
import { useProjectInteraction } from '@/hooks/useProjectInteraction'
import { useProjectAnimations } from '@/hooks/useProjectAnimations'
import { useResizeCallback } from '@/hooks/useResize'

export default function Projects() {
  return <ProjectsContent />
}

function ProjectsContent() {
  const groupRef = useRef(null)
  const { camera} = useThree()
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
  const isArrangementAnimationComplete = useStore(
    (state) => state.isArrangementAnimationComplete,
  )
  const setArrangementAnimationComplete = useStore(
    (state) => state.setArrangementAnimationComplete,
  )
  const [projectStates, setProjectStates] = useState([])
  const [targetStates, setTargetStates] = useState([])
  const [minDistance, setMinDistance] = useState(2.0)
  const [rotatingProjects, setRotatingProjects] = useState(new Set())
  const [rotatingBorders, setRotatingBorders] = useState(new Set())
  const [animatingProjects, setAnimatingProjects] = useState(new Set())
  const currentTheme = useThemeStore((state) => state.currentTheme)
  const currentPage = useStore((state) => state.currentPage)


  // Hook pour la gestion des positions
  const {
    predefinedPositions,
    borderStates,
    setBorderStates,
    calculateArrangedDistance,
    calculatePredefinedPositions,
    calculateBorderPositions,
    projectSize,
    distance
  } = useProjectPositions()

  // Hook pour la gestion des contrôles de rotation
  const { rotationY, setRotationY } = useRotationControl()

  // Hook pour la gestion des interactions
  const {
    hoveredProject,
    setHoveredProject,
    displayedProject,
    projectMeshesRef,
    handleProjectHover,
    performRaycasting
  } = useProjectInteraction()

  // Hook pour la gestion des animations
  const { animateProjects, animateBorders, animateGroupRotation } = useProjectAnimations()

  const baseSpeed = 3

  // Gérer le redimensionnement pour les positions des projets arrangés
  useResizeCallback(() => {
    // Si on est en mode arrangé, mettre à jour les positions cibles
    if (isProjectsArranged && predefinedPositions.length > 0) {
      const dist = calculateArrangedDistance()
      setTargetStates((prevStates) =>
        prevStates.map((state, index) => ({
          ...state,
          position: calculatePredefinedPositions(dist)[index] || state.position,
        }))
      )
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
      const newTargetStates = projectStates.map((state) => {
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
      setTargetStates(newTargetStates)
      setRotatingProjects(new Set())
      setRotatingBorders(new Set())
      setAnimatingProjects(new Set())
      setArrangementAnimationComplete(false)
    } else {
      // Animation séquentielle pour éviter les superpositions
      setAnimatingProjects(new Set())

      // Définir les positions cibles immédiatement
      setTargetStates(
        predefinedPositions.map((pos, index) => ({
          ...projectStates[index],
          position: pos,
          rotation: [0, 0, 0],
          pageRotationX: 0,
          targetPageRotationX: 0,
        })),
      )

      // Créer un ordre aléatoire pour l'animation
      const randomOrder = Array.from(
        { length: projectStates.length },
        (_, i) => i,
      ).sort(() => Math.random() - 0.5)

      // Démarrer l'animation des projets dans un ordre aléatoire
      randomOrder.forEach((projectIndex, animationIndex) => {
        setTimeout(() => {
          setAnimatingProjects((prev) => new Set([...prev, projectIndex]))
        }, animationIndex * 100) // 100ms de délai entre chaque projet
      })

      // Attendre que tous les projets aient commencé leur animation
      const totalAnimationTime = projectStates.length * 100 + 1000
      setTimeout(() => {
        setArrangementAnimationComplete(true)
      }, totalAnimationTime)
    }
  }, [isProjectsArranged])

  // Effet pour gérer les rotations une fois l'animation terminée
  useEffect(() => {
    if (isArrangementAnimationComplete) {
      setRotatingProjects(new Set(projectStates.map((_, index) => index)))

      const borderPositions = calculateBorderPositions(calculateArrangedDistance())
      setRotatingBorders(new Set(borderPositions.map((_, index) => index)))
    }
  }, [isArrangementAnimationComplete])

  useFrame((state, delta) => {
    // Animer les projets
    animateProjects(
      projectStates,
      setProjectStates,
      targetStates,
      rotatingProjects,
      animatingProjects,
      baseSpeed,
      delta
    )

    // Animer les bordures
    animateBorders(
      borderStates,
      setBorderStates,
      rotatingBorders,
      baseSpeed,
      delta
    )

    // Animer la rotation du groupe
    animateGroupRotation(
      groupRef,
      rotationY,
      isProjectsArranged,
      baseSpeed,
      delta
    )

    // Raycasting pour détecter le projet sous le curseur
    performRaycasting(projectStates, isProjectsArranged, groupRef)
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

    setProjectStates(initialStates)
  }, [])

  // Initialiser la rotation du groupe au montage du composant
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = rotationY
    }
  }, [])

  useEffect(() => {
    projectStates.forEach((state, i) => {
      setTimeout(() => {
        setProjectStates((prev) =>
          prev.map((s, j) =>
            j === i
              ? { ...s, targetPageRotationX: (currentPage - 1) * Math.PI }
              : s,
          ),
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
      />

      {!isProjectsArranged && displayedProject && (
        <ProjectInfoFloating project={displayedProject} isVisible={!!hoveredProject} />
      )}

      <ProjectList
        projectStates={projectStates}
        projectMeshesRef={projectMeshesRef}
        camera={camera}
        handleProjectHover={handleProjectHover}
        setHoveredProject={setHoveredProject}
        groupRef={groupRef}
        distance={distance}
      />
    </>
  )
}
