import React, { useRef, forwardRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useStore } from '../../stores/store'
import styles from './Project.module.scss'
import { Cross, ArrowUp, ArrowDown } from '../Interface/Interface'
import ProjectOverlay from './ProjectOverlay'
import { useContentTexture } from '../../utils/textureLoader'

const Project = forwardRef(function Project(
  { gridPosition, position, rotation, onAnyClick, camera, image },
  ref,
) {
  const frontMeshRef = useRef(null)
  const backMeshRef = useRef(null)
  const backMaterialRef = useRef(null)
  const frontMaterialRef = useRef(null)

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

  // Utiliser la taille calculée ou une taille par défaut
  const projectSize = window.projectSize || { width: 1, height: 1 }

  // Utiliser le hook personnalisé
  const { contentTexture, targetFace } = useContentTexture(gridPosition)

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
      <mesh ref={frontMeshRef} onClick={onAnyClick}>
        <planeGeometry args={[projectSize.width, projectSize.height]} />
        <meshBasicMaterial
          ref={frontMaterialRef}
          side={THREE.FrontSide}
          toneMapped={true}
          transparent={true}
          opacity={1}
        />
      </mesh>
      <mesh ref={backMeshRef} onClick={onAnyClick} rotation-y={Math.PI}>
        <planeGeometry args={[projectSize.width, projectSize.height]} />
        <meshBasicMaterial
          ref={backMaterialRef}
          side={THREE.FrontSide}
          toneMapped={true}
          transparent={true}
          opacity={1}
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
            </>
          )}
          {selectedProject.contents?.length > 2 && (
            <>
              <ProjectOverlay
                condition={selectedProject && gridPosition === 4}
                projectSize={projectSize}
                reverse={true}
              >
                <ArrowUp />
              </ProjectOverlay>
              <ProjectOverlay
                condition={selectedProject && gridPosition === 14}
                projectSize={projectSize}
                reverse={true}
              >
                <ArrowDown />
              </ProjectOverlay>
            </>
          )}
          <ProjectOverlay
            condition={selectedProject && gridPosition === 9}
            projectSize={projectSize}
          >
            <Cross />
          </ProjectOverlay>
          {/* {selectedProject?.contents?.[0]?.text && gridPosition === 5 && (
            <ProjectOverlay
              condition={selectedProject}
              projectSize={projectSize}
              reverse={true}
            >
              <p className={styles.contentText}>{selectedProject.contents[0].text}</p>
            </ProjectOverlay>
          )} */}
        </>
      )}
    </group>
  )
})

export default Project
