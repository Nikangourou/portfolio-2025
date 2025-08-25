import { useState, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGridConfig } from './useGridConfig'

export function useProjectInteraction() {
  const { camera, pointer } = useThree()
  const [hoveredProject, setHoveredProject] = useState(null)
  const [displayedProject, setDisplayedProject] = useState(null)
  const projectGroupsRef = useRef([])
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

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(pointer, camera)

    // Collecter tous les meshes des projets
    const allMeshes = []
    
    projectGroupsRef.current.forEach((projectGroup, projectIndex) => {
      if (projectGroup && projectGroup.children) {
        // Parcourir récursivement tous les enfants pour trouver les meshes
        const collectMeshes = (object) => {
          if (object.isMesh && object.geometry && object.material) {
            allMeshes.push({ 
              mesh: object, 
              projectIndex 
            })
          }
          // Parcourir récursivement les enfants
          if (object.children) {
            object.children.forEach(collectMeshes)
          }
        }
        
        collectMeshes(projectGroup)
      }
    })

    if (allMeshes.length > 0) {
      // Vrai raycasting sur les meshes
      const intersects = raycaster.intersectObjects(
        allMeshes.map(item => item.mesh),
        false
      )

      if (intersects.length > 0) {
        // Trouver le projet du mesh intersecté
        const intersectedMesh = intersects[0].object
        const meshData = allMeshes.find(item => item.mesh === intersectedMesh)
        
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
      setHoveredProject(null)
    }
  }

  return {
    hoveredProject,
    displayedProject,
    projectGroupsRef,
    isMobileDevice: gridConfig.isMobile,
    performRaycasting,
  }
} 