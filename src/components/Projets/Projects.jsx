import React, { useMemo, useRef, useState, useEffect } from 'react'
import ProjectList from './ProjectList'
import ProjectBorders from './ProjectBorders'
import projectsData from '../../data/projects.json'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '@/stores/store'
import { useShallow } from 'zustand/react/shallow'
import useThemeStore from '@/stores/themeStore'
import ProjectInfoFloating from '../Interface/ProjectInfoFloating'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { useGridConfig } from '@/hooks/useGridConfig'
import { useProjectInteraction } from '@/hooks/useProjectInteraction'
import { useSceneRippleField } from '@/hooks/useGlobalRipple'

export default function Projects() {
  // console.log('Projects rendered')

  const { camera } = useThree()
  const gridConfig = useGridConfig()
  const groupRef = useRef(null)
  const lastScrollNavigationRef = useRef(0)
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 })

  const [
    selectedProject,
    currentPage,
    isProjectsArranged,
  ] = useStore(
    useShallow((state) => [
      state.selectedProject,
      state.currentPage,
      state.isProjectsArranged,
    ]),
  )
  const setCurrentPage = useStore((state) => state.setCurrentPage)

  // Ref minimal pour le raycasting (ne contient que les données des projets)
  const projectDataRef = useRef([])

  // Garder quelques states pour les interactions et l'interface
  const [minDistance, setMinDistance] = useState(2.0)
  const currentTheme = useThemeStore((state) => state.currentTheme)

  // Utiliser directement le store pour les positions
  const { projectSize, recalculateAll } = useProjectPositionsStore()

  // Calculer les positions une seule fois au niveau parent
  useEffect(() => {
    recalculateAll(camera, gridConfig)
  }, [
    camera.fov,
    camera.aspect,
    gridConfig.projectSize,
    gridConfig.cols,
    gridConfig.rows,
    gridConfig.gap,
    gridConfig.margin,
    gridConfig.distance,
    gridConfig.borderColsLeft,
    gridConfig.borderColsRight,
    gridConfig.borderRowsTop,
    gridConfig.borderRowsBottom,
    recalculateAll
  ])

  // Hook pour la gestion des interactions
  const {
    hoveredProject,
    displayedProject,
    projectGroupsRef,
    performRaycasting,
    displaySpring,
    displayApi
  } = useProjectInteraction()

  useSceneRippleField()

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
        (Math.random() - 0.5) * Math.PI * 0.4,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * Math.PI * 0.40
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

  useEffect(() => {
    const maxPage = selectedProject?.contents?.length || 0

    const canNavigate = () => {
      if (!isProjectsArranged || maxPage <= 1) {
        return false
      }

      const now = Date.now()
      if (now - lastScrollNavigationRef.current < 360) {
        return false
      }

      lastScrollNavigationRef.current = now
      return true
    }

    const goToNextPage = () => {
      if (currentPage < maxPage) {
        setCurrentPage(currentPage + 1)
      }
    }

    const goToPreviousPage = () => {
      if (currentPage > 1) {
        setCurrentPage(currentPage - 1)
      }
    }

    const handleWheel = (event) => {
      if (!isProjectsArranged) {
        return
      }

      if (Math.abs(event.deltaY) < 8 || !canNavigate()) {
        return
      }

      event.preventDefault()

      if (event.deltaY > 0) {
        goToNextPage()
      } else {
        goToPreviousPage()
      }
    }

    const handleTouchStart = (event) => {
      const touch = event.touches?.[0]
      if (!touch) {
        return
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      }
    }

    const handleTouchEnd = (event) => {
      if (!isProjectsArranged || !canNavigate()) {
        return
      }

      const touch = event.changedTouches?.[0]
      if (!touch) {
        return
      }

      const start = touchStartRef.current
      const deltaX = touch.clientX - start.x
      const deltaY = touch.clientY - start.y
      const elapsed = Date.now() - start.time

      if (elapsed > 700) {
        return
      }

      const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX)
      if (!isVerticalSwipe || Math.abs(deltaY) < 24) {
        return
      }

      if (deltaY < 0) {
        goToNextPage()
      } else {
        goToPreviousPage()
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [selectedProject?.contents?.length, currentPage, isProjectsArranged, setCurrentPage])


  useFrame(() => {
    // Raycasting optimisé pour détecter le projet sous le curseur
    performRaycasting(projectDataRef.current, isProjectsArranged, groupRef)
  })

  return (
    <>
      <ProjectBorders
        isProjectsArranged={isProjectsArranged}
        projectSize={projectSize}
        currentTheme={currentTheme}
        distance={gridConfig.distance}
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
        distance={gridConfig.distance}
      />
    </>
  )
}
