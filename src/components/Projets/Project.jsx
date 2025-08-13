import React, { useRef, forwardRef, useEffect, useState, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useStore } from '@/stores/store'
import styles from './Project.module.scss'
import { Navigation } from '@/components/Interface/Interface'
import ProjectOverlay from './ProjectOverlay'
import { useContentTexture, useContentText } from '@/utils/contentLoader'
import projectsData from '@/data/projects.json'
import { useGridConfig } from '@/hooks/useGridConfig'

const Project = forwardRef(function Project(
  { gridPosition, initialPosition, initialRotation, camera, image, project },
  ref,
) {
  const frontMeshRef = useRef(null)
  const backMeshRef = useRef(null)
  const backMaterialRef = useRef(null)
  const frontMaterialRef = useRef(null)
  const overlayGroupRef = useRef(null)

  if(gridPosition == 1)
  console.log('Project rendered')

  // Exposer les refs pour le raycasting
  useImperativeHandle(ref, () => ({
    frontMeshRef,
    backMeshRef,
    overlayGroupRef
  }))

  // Initialiser les positions et rotations des meshes une seule fois
  useEffect(() => {
    if (frontMeshRef.current && backMeshRef.current && overlayGroupRef.current && initialPosition && initialRotation) {
      // Définir les positions et rotations initiales seulement si ce n'est pas déjà fait
      if (frontMeshRef.current.userData.initialized !== true) {
        frontMeshRef.current.position.set(...initialPosition)
        backMeshRef.current.position.set(...initialPosition)
        overlayGroupRef.current.position.set(...initialPosition)
        
        frontMeshRef.current.rotation.set(...initialRotation)
        backMeshRef.current.rotation.set(initialRotation[0], initialRotation[1] + Math.PI, initialRotation[2])
        overlayGroupRef.current.rotation.set(...initialRotation)
        
        // Marquer comme initialisé pour éviter les réinitialisations
        frontMeshRef.current.userData.initialized = true
        backMeshRef.current.userData.initialized = true
        overlayGroupRef.current.userData.initialized = true
      }
    }
  }, [initialPosition, initialRotation]) // Garder les dépendances pour l'initialisation

  const texture = useTexture(image || '', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
  })

  const selectedProject = useStore((state) => state.selectedProject)
  const currentPage = useStore((state) => state.currentPage)
  const evenPage = currentPage % 2
  const isArrangementAnimationComplete = useStore(
    (state) => state.isArrangementAnimationComplete,
  )
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
  const setProjectsArranged = useStore((state) => state.setProjectsArranged)
  const setSelectedProject = useStore((state) => state.setSelectedProject)

  // Utiliser les hooks personnalisés
  const { contentTexture, targetFace } = useContentTexture(gridPosition)
  const { contentText } = useContentText(gridPosition)
  const gridConfig = useGridConfig()
  
  // Utiliser la taille du projet depuis la configuration centralisée
  const projectSize = { width: gridConfig.projectSize, height: gridConfig.projectSize }

  // Fonction pour gérer le clic et arrêter la propagation
  const handleMeshClick = (event) => {
    event.stopPropagation()
    // Logique de sélection du projet
    if (!isProjectsArranged) {
      setProjectsArranged(true)
      setSelectedProject(projectsData.projects[gridPosition])
    }
  }

  // Optimiser le useEffect pour éviter les re-renders inutiles
  useEffect(() => {
    if (!backMaterialRef.current || !frontMaterialRef.current) return

    let newMap = null
    let newColor = 'white'

    if (contentTexture && isArrangementAnimationComplete) {
      newMap = contentTexture
    } else if (
      texture &&
      (!isArrangementAnimationComplete || !isProjectsArranged)
    ) {
      newMap = texture
    } else {
      newColor = selectedProject?.color?.background || 'white'
    }


    if (evenPage || currentPage === 0) {
      if (backMaterialRef.current.map !== newMap) {
        backMaterialRef.current.map = newMap
      }

      if (
        backMaterialRef.current.color.getHexString() !==
        newColor.replace('#', '')
      ) {
        backMaterialRef.current.color.set(newColor)
      }

      backMaterialRef.current.needsUpdate = true
    }
    
    if (!evenPage || currentPage === 0) {
      if (frontMaterialRef.current.map !== newMap) {
        frontMaterialRef.current.map = newMap
      }

      if (
        frontMaterialRef.current.color.getHexString() !==
        newColor.replace('#', '')
      ) {
        frontMaterialRef.current.color.set(newColor)
      }
      frontMaterialRef.current.needsUpdate = true
    }    
  }, [
    isArrangementAnimationComplete,
    isProjectsArranged,
    texture,
    contentTexture,
    targetFace,
    selectedProject,
    gridPosition,
  ])

  return (
    <group>
      <mesh
        ref={frontMeshRef}
        onClick={handleMeshClick}
      >
        <planeGeometry args={[projectSize.width, projectSize.height]} />
        <meshBasicMaterial
          ref={frontMaterialRef}
          side={THREE.FrontSide}
          toneMapped={true}
        />
      </mesh>
      <mesh
        ref={backMeshRef}
        onClick={handleMeshClick}
        rotation-y={Math.PI}
      >
        <planeGeometry args={[projectSize.width, projectSize.height]} />
        <meshBasicMaterial
          ref={backMaterialRef}
          side={THREE.FrontSide}
          toneMapped={true}
        />
      </mesh>
      
      {/* Groupe séparé pour les overlays qui suivra les animations */}
      <group ref={overlayGroupRef}>
        {isArrangementAnimationComplete && (
          <>
            {currentPage === 1 && (
              <>
                <ProjectOverlay
                  condition={
                    selectedProject && gridPosition === 0 && selectedProject.title
                  }
                  projectSize={projectSize}
                >
                  <p className={styles.title}>{selectedProject?.title}</p>
                </ProjectOverlay>
                <ProjectOverlay
                  condition={
                    selectedProject &&
                    gridPosition === 1 &&
                    selectedProject.context
                  }
                  projectSize={projectSize}
                >
                  <p className={styles.title}>{selectedProject?.context}</p>
                </ProjectOverlay>
                <ProjectOverlay
                  condition={
                    selectedProject && gridPosition === 2 && selectedProject.year
                  }
                  projectSize={projectSize}
                >
                  <p className={styles.title}>{selectedProject?.year}</p>
                </ProjectOverlay>
                <ProjectOverlay
                  condition={
                    selectedProject &&
                    gridPosition === 3 &&
                    selectedProject.technologies
                  }
                  projectSize={projectSize}
                >
                  <div className={styles.technoContainer}>
                    {selectedProject?.technologies.map((techno) => (
                      <p key={techno} className={styles.techno}>
                        {techno}
                      </p>
                    ))}
                  </div>
                </ProjectOverlay>
                <ProjectOverlay
                  condition={
                    selectedProject && gridPosition === 4 && selectedProject.link
                  }
                  projectSize={projectSize}
                >
                  <a 
                    href={selectedProject?.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.linkButton}
                  >
                    Link
                  </a>
                </ProjectOverlay>
              </>
            )}
            <Navigation 
              selectedProject={selectedProject}
              currentPage={currentPage}
              gridPosition={gridPosition}
              projectSize={projectSize}
            />
            {contentText && (
              <ProjectOverlay
                condition={selectedProject}
                projectSize={projectSize}
                reverse={true}
              >
                <p className={styles.contentText}>{contentText.text}</p>
              </ProjectOverlay>
            )}
          </>
        )}
      </group>
    </group>
  )
})

export default Project