import React, { useMemo, useRef, useEffect } from 'react'
import ProjectList from './ProjectList'
import projectsData from '../../data/projects.json'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '@/stores/store'
import { useShallow } from 'zustand/react/shallow'
import ProjectInfoFloating from '../Interface/ProjectInfoFloating'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { useGridConfig } from '@/hooks/useGridConfig'
import { useProjectInteraction } from '@/hooks/useProjectInteraction'
import { useSceneRippleField } from '@/hooks/useGlobalRipple'
import { preloadFirstPages, preloadProjectContents, releaseProjectContents } from '@/utils/contentLoader'

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

  // Utiliser directement le store pour les positions
  const { recalculateAll, cloudPositions } = useProjectPositionsStore()

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
    recalculateAll
  ])

  // Premières pages de tous les projets : préchargées en tâche de fond et gardées en cache
  useEffect(() => {
    return preloadFirstPages(projectsData.projects, gridConfig.isMobile)
  }, [gridConfig.isMobile])

  // Précharger toutes les images du projet dès sa sélection (évite le délai à chaque changement de page)
  // et les libérer à la fermeture du projet (le cleanup s'exécute quand selectedProject change).
  useEffect(() => {
    preloadProjectContents(selectedProject, gridConfig.isMobile)

    return () => {
      releaseProjectContents(selectedProject, gridConfig.isMobile)
    }
  }, [selectedProject, gridConfig.isMobile])

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

  // Créer les données des projets : position de départ dans le nuage (répartie sur l'écran) et rotation aléatoire
  const projectData = useMemo(() => {
    return Array.from({ length: gridConfig.tileCount }, (_, index) => {
      const project = projectsData.projects[index] || null

      const randomRotation = [
        (Math.random() - 0.5) * Math.PI * 0.4,
        (Math.random() - 0.5) * Math.PI * 2,
        (Math.random() - 0.5) * Math.PI * 0.40
      ]

      return {
        project,
        initialPosition: cloudPositions[index] || [0, 0, 0],
        initialRotation: randomRotation,
        pageRotationDelay: Math.random() * 0.5,
      }
    })
  }, [gridConfig.tileCount, cloudPositions])

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
