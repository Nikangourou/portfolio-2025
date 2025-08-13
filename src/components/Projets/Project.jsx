import React, { useRef, forwardRef, useEffect, useState, useImperativeHandle, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useStore } from '@/stores/store'
import styles from './Project.module.scss'
import { Navigation } from '@/components/Interface/Interface'
import ProjectOverlay from './ProjectOverlay'
import { useContentTexture, useContentText } from '@/utils/contentLoader'
import projectsData from '@/data/projects.json'
import { useGridConfig } from '@/hooks/useGridConfig'

// Fonction de comparaison personnalisée pour React.memo
const arePropsEqual = (prevProps, nextProps) => {
  // Comparer uniquement les props importantes, ignorer les positions/rotations qui changent constamment
  return (
    prevProps.gridPosition === nextProps.gridPosition &&
    prevProps.image === nextProps.image
  )
}

const Project = React.memo(forwardRef(function Project(
  { gridPosition, initialPosition, initialRotation, image },
  ref,
) {
  const frontMeshRef = useRef(null)
  const backMeshRef = useRef(null)
  const backMaterialRef = useRef(null)
  const frontMaterialRef = useRef(null)
  const overlayGroupRef = useRef(null)

  // Variables du store
  const selectedProject = useStore((state) => state.selectedProject)
  const currentPage = useStore((state) => state.currentPage)
  const evenPage = currentPage % 2
  const isArrangementAnimationComplete = useStore(
    (state) => state.isArrangementAnimationComplete,
  )
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
  const setProjectsArranged = useStore((state) => state.setProjectsArranged)
  const setSelectedProject = useStore((state) => state.setSelectedProject)

  // Utiliser les hooks personnalisés avec mémorisation
  const { contentTexture, targetFace } = useContentTexture(gridPosition)
  const { contentText } = useContentText(gridPosition)
  const gridConfig = useGridConfig()
  
  // Mémoriser la taille du projet pour éviter les re-renders
  const projectSize = useMemo(() => ({ 
    width: gridConfig.projectSize, 
    height: gridConfig.projectSize 
  }), [gridConfig.projectSize])

  // Mémoriser la configuration du grid pour éviter les changements de référence
  const memoizedGridConfig = useMemo(() => gridConfig, [
    gridConfig.projectSize,
    gridConfig.cols,
    gridConfig.rows,
    gridConfig.gap,
    gridConfig.isMobile
  ])

  // Charger la texture avant de l'utiliser dans les logs
  const texture = useTexture(image || '', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
  })

  // Log de debug amélioré pour identifier les changements
  const prevRender = useRef({})
  if(gridPosition === 1) {
    const currentRender = {
      selectedProjectId: selectedProject?.id,
      currentPage,
      isProjectsArranged,
      isArrangementAnimationComplete,
      hasContentTexture: !!contentTexture,
      hasTexture: !!texture,
      gridConfigRef: memoizedGridConfig === prevRender.current.gridConfig,
      contentTextureRef: contentTexture === prevRender.current.contentTexture,
      textureRef: texture === prevRender.current.texture,
      projectSizeRef: projectSize === prevRender.current.projectSize
    }
    
    console.log('Project rendered - causes possibles:', currentRender)
    console.log('Changes detected:', {
      gridConfig: memoizedGridConfig !== prevRender.current.gridConfig,
      contentTexture: contentTexture !== prevRender.current.contentTexture,
      texture: texture !== prevRender.current.texture,
      projectSize: projectSize !== prevRender.current.projectSize,
      contentText: contentText !== prevRender.current.contentText
    })
    
    prevRender.current = {
      ...currentRender,
      gridConfig: memoizedGridConfig,
      contentTexture,
      texture,
      projectSize,
      contentText
    }
  }

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

  // Mémoriser la fonction de clic pour éviter les re-renders
  const handleMeshClick = useCallback((event) => {
    event.stopPropagation()
    // Logique de sélection du projet
    if (!isProjectsArranged) {
      setProjectsArranged(true)
      setSelectedProject(projectsData.projects[gridPosition])
    }
  }, [isProjectsArranged, setProjectsArranged, setSelectedProject, gridPosition])

  // Optimiser le useEffect avec mémorisation des dépendances
  const memoizedEffectDeps = useMemo(() => ({
    isArrangementAnimationComplete,
    isProjectsArranged,
    hasTexture: !!texture,
    hasContentTexture: !!contentTexture,
    selectedProjectId: selectedProject?.id,
    selectedProjectColor: selectedProject?.color?.background,
    currentPage,
    evenPage
  }), [
    isArrangementAnimationComplete,
    isProjectsArranged,
    texture,
    contentTexture,
    selectedProject?.id,
    selectedProject?.color?.background,
    currentPage,
    evenPage
  ])

  useEffect(() => {
    if (!backMaterialRef.current || !frontMaterialRef.current) return

    let newMap = null
    let newColor = 'white'

    if (contentTexture && memoizedEffectDeps.isArrangementAnimationComplete) {
      newMap = contentTexture
    } else if (
      texture &&
      (!memoizedEffectDeps.isArrangementAnimationComplete || !memoizedEffectDeps.isProjectsArranged)
    ) {
      newMap = texture
    } else {
      newColor = memoizedEffectDeps.selectedProjectColor || 'white'
    }

    if (memoizedEffectDeps.evenPage || memoizedEffectDeps.currentPage === 0) {
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
    
    if (!memoizedEffectDeps.evenPage || memoizedEffectDeps.currentPage === 0) {
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
  }, [memoizedEffectDeps, texture, contentTexture])

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
}), arePropsEqual)

export default Project
