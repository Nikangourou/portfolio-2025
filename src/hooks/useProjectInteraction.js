import { useState, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGridConfig } from './useGridConfig'

export function useProjectInteraction() {
  const { camera, pointer } = useThree()
  const [hoveredProject, setHoveredProject] = useState(null)
  const [displayedProject, setDisplayedProject] = useState(null)
  const projectMeshesRef = useRef([])
  const gridConfig = useGridConfig()

  // Gérer l'affichage du projet avec animation de sortie
  useEffect(() => {
    if (hoveredProject) {
      // Projet survolé : afficher immédiatement
      setDisplayedProject(hoveredProject)
    } else {
      // Plus de projet survolé : attendre 300ms pour l'animation de sortie
      const timer = setTimeout(() => {
        setDisplayedProject(null)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [hoveredProject])

  // Fonction pour gérer le raycasting
  const performRaycasting = (projectStates, isProjectsArranged, groupRef) => {
    if (
      gridConfig.isMobile ||
      isProjectsArranged ||
      projectMeshesRef.current.length === 0 ||
      !groupRef.current
    ) {
      return
    }

    // Créer un raycaster temporaire pour éviter les conflits
    const tempRaycaster = new THREE.Raycaster()
    tempRaycaster.setFromCamera(pointer, camera)

    // Obtenir tous les meshes valides avec leurs index de projet
    const allMeshes = []

    projectMeshesRef.current.forEach((projectGroup, projectIndex) => {
      if (projectGroup && projectGroup.children) {
        // Parcourir les enfants du groupe principal pour trouver les meshes
        projectGroup.children.forEach((child) => {
          if (child.isMesh && child.geometry && child.material) {
            child.updateMatrixWorld(true)
            allMeshes.push({ mesh: child, projectIndex })
          }
        })
      }
    })

    if (allMeshes.length > 0) {
      const intersects = tempRaycaster.intersectObjects(
        allMeshes.map((item) => item.mesh),
        false,
      )

      if (intersects.length > 0) {
        // Trouver l'index du projet du mesh intersecté
        const intersectedMesh = intersects[0].object
        const meshData = allMeshes.find((item) => item.mesh === intersectedMesh)

        if (meshData && projectStates[meshData.projectIndex]) {
          const project = projectStates[meshData.projectIndex].project
          if (!hoveredProject || hoveredProject.id !== project.id) {
            setHoveredProject(project)
          }
        }
      } else {
        // Aucun projet sous le curseur
        if (hoveredProject) {
          setHoveredProject(null)
        }
      }
    } else if (hoveredProject) {
      // Si aucun mesh n'est disponible, nettoyer le hover
      setHoveredProject(null)
    }
  }

  return {
    hoveredProject,
    displayedProject,
    projectMeshesRef,
    isMobileDevice: gridConfig.isMobile,
    performRaycasting,
  }
} 