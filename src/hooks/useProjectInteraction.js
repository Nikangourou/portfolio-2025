import { useState, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSpring } from '@react-spring/web'
import { useGridConfig } from './useGridConfig'

export function useProjectInteraction() {
  const { camera, pointer } = useThree()
  const [hoveredProject, setHoveredProject] = useState(null)
  const [displayedProject, setDisplayedProject] = useState(null)
  const projectGroupsRef = useRef([])
  const raycasterRef = useRef(new THREE.Raycaster())
  const cachedProjectRootsRef = useRef([])
  const cachedRootToIndexRef = useRef(new Map())
  const groupsSnapshotRef = useRef([])
  const gridConfig = useGridConfig()

  // Animation pour l'affichage du projet
  const [displaySpring, displayApi] = useSpring(() => ({
    opacity: 0,
    scale: 0.95,
    y: 20,
    config: { tension: 300, friction: 30 },
    onRest: () => {
      // Quand l'animation de sortie est terminée, masquer le projet
      if (!hoveredProject && displayedProject) {
        setDisplayedProject(null)
      }
    }
  }))

  // Gérer l'affichage du projet avec animation Spring
  useEffect(() => {
    if (hoveredProject) {
      // Projet survolé : afficher immédiatement avec animation
      setDisplayedProject(hoveredProject)
      displayApi.start({
        opacity: 1,
        scale: 1,
        y: 0
      })
    } else {
      // Plus de projet survolé : animation de sortie
      displayApi.start({
        opacity: 0,
        scale: 0.95,
        y: 20
      })
      // Le masquage se fait automatiquement via onRest
    }
  }, [hoveredProject, displayApi])

  const rebuildRaycastCache = () => {
    const groups = projectGroupsRef.current
    const nextRoots = []
    const nextRootToIndex = new Map()

    groups.forEach((group, projectIndex) => {
      if (!group) {
        return
      }

      nextRoots.push(group)
      nextRootToIndex.set(group, projectIndex)
    })

    cachedProjectRootsRef.current = nextRoots
    cachedRootToIndexRef.current = nextRootToIndex
    groupsSnapshotRef.current = [...groups]
  }

  const ensureRaycastCache = () => {
    const groups = projectGroupsRef.current
    const snapshot = groupsSnapshotRef.current

    if (snapshot.length !== groups.length) {
      rebuildRaycastCache()
      return
    }

    for (let i = 0; i < groups.length; i++) {
      if (snapshot[i] !== groups[i]) {
        rebuildRaycastCache()
        return
      }
    }
  }

  // Fonction pour gérer le raycasting sur les meshes des projets
  const performRaycasting = (projectStates, isProjectsArranged, groupRef) => {
    if (
      gridConfig.isMobile ||
      isProjectsArranged ||
      projectGroupsRef.current.length === 0 ||
      !groupRef.current
    ) {
      return
    }

    ensureRaycastCache()

    const projectRoots = cachedProjectRootsRef.current
    if (projectRoots.length === 0) {
      if (hoveredProject) {
        setHoveredProject(null)
      }
      return
    }

    const rootToIndex = cachedRootToIndexRef.current

    raycasterRef.current.setFromCamera(pointer, camera)
    const intersects = raycasterRef.current.intersectObjects(projectRoots, true)

    if (intersects.length > 0) {
      let object = intersects[0].object
      let projectIndex

      while (object) {
        const index = rootToIndex.get(object)
        if (index !== undefined) {
          projectIndex = index
          break
        }
        object = object.parent
      }

      if (projectIndex !== undefined && projectStates[projectIndex]) {
        const project = projectStates[projectIndex].project

        if (!hoveredProject || hoveredProject.id !== project.id) {
          setHoveredProject(project)
        }
      }
    } else if (hoveredProject) {
      setHoveredProject(null)
    }
  }

  return {
    hoveredProject,
    displayedProject,
    projectGroupsRef,
    isMobileDevice: gridConfig.isMobile,
    performRaycasting,
    displaySpring,
    displayApi
  }
} 