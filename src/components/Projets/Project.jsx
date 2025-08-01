import React, { useRef, forwardRef, useEffect, useState, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useStore } from '@/stores/store'
import styles from './Project.module.scss'
import { Navigation } from '@/components/Interface/Interface'
import ProjectOverlay from './ProjectOverlay'
import { useContentTexture, useContentText } from '@/utils/contentLoader'
import projectsData from '@/data/projects.json'
import { isMobile } from '@/utils/deviceUtils'

const Project = forwardRef(function Project(
  { gridPosition, position, rotation, camera, image, project, onProjectHover, onProjectUnhover },
  ref,
) {
  const frontMeshRef = useRef(null)
  const backMeshRef = useRef(null)
  const backMaterialRef = useRef(null)
  const frontMaterialRef = useRef(null)

  // Exposer les refs pour le raycasting
  useImperativeHandle(ref, () => ({
    frontMeshRef,
    backMeshRef
  }))

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

  // Utiliser la taille calculée ou une taille par défaut
  const projectSize = window.projectSize || { width: 1, height: 1 }

  // Utiliser les hooks personnalisés
  const { contentTexture, targetFace } = useContentTexture(gridPosition)
  const { contentText } = useContentText(gridPosition)

  // Fonction pour gérer le clic et arrêter la propagation
  const handleMeshClick = (event) => {
    event.stopPropagation()
    // Logique de sélection du projet
    if (!isProjectsArranged) {
      setProjectsArranged(true)
      setSelectedProject(projectsData.projects[gridPosition])
    }
  }

  // Fonction pour gérer le hover et arrêter la propagation
  const handlePointerOver = (event) => {
    // Désactiver le hover sur mobile
    if (isMobile()) return
    
    event.stopPropagation()
    onProjectHover()
  }

  // Fonction pour gérer le unhover et arrêter la propagation
  const handlePointerOut = (event) => {
    // Désactiver le hover sur mobile
    if (isMobile()) return
    
    event.stopPropagation()
    onProjectUnhover()
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
    <group position={position} rotation={rotation}>
      <mesh
        ref={frontMeshRef}
        onClick={handleMeshClick}
        {...(!isMobile() && {
          onPointerOver: handlePointerOver,
          onPointerOut: handlePointerOut
        })}
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
        {...(!isMobile() && {
          onPointerOver: handlePointerOver,
          onPointerOut: handlePointerOut
        })}
        rotation-y={Math.PI}
      >
        <planeGeometry args={[projectSize.width, projectSize.height]} />
        <meshBasicMaterial
          ref={backMaterialRef}
          side={THREE.FrontSide}
          toneMapped={true}
        />
      </mesh>
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
  )
})

export default Project
