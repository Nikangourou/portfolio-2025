import React, { useRef, forwardRef, useEffect } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useStore } from '../../stores/store'
import styles from './Project.module.scss'
import { Cross, ArrowUp, ArrowDown } from '../Interface/Interface'
import ProjectOverlay from './ProjectOverlay'

const Project = forwardRef(function Project(
  { gridPosition, position, rotation, onAnyClick, camera, image },
  ref,
) {
  const frontMeshRef = useRef(null)
  const backMeshRef = useRef(null)
  const backMaterialRef = useRef(null)

  const texture = useTexture(image || '', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
  })

  const selectedProject = useStore((state) => state.selectedProject)
  const isArrangementAnimationComplete = useStore(
    (state) => state.isArrangementAnimationComplete,
  )

  useEffect(() => {
    if (backMaterialRef.current) {
      if (texture && !isArrangementAnimationComplete) {
        backMaterialRef.current.map = texture
        backMaterialRef.current.color.set('white')
        backMaterialRef.current.needsUpdate = true
      } else {
        backMaterialRef.current.map = null
        backMaterialRef.current.color.set(selectedProject.color.background)
        backMaterialRef.current.needsUpdate = true
      }
    }
  }, [isArrangementAnimationComplete, texture])

  // Utiliser la taille calculée ou une taille par défaut
  const projectSize = window.projectSize || { width: 1, height: 1 }

  // Convertir les coordonnées 3D en coordonnées 2D pour le positionnement CSS
  const get2DPosition = () => {
    if (!camera) return { x: 0, y: 0 }

    const vector = new THREE.Vector3(position[0], position[1], position[2])
    vector.project(camera)

    return {
      x: (vector.x * 0.5 + 0.5) * window.innerWidth,
      y: (vector.y * -0.5 + 0.5) * window.innerHeight,
    }
  }

  const pos2D = get2DPosition()

  return (
    <group position={position} rotation={rotation}>
      <mesh ref={frontMeshRef} onClick={onAnyClick}>
        <planeGeometry args={[projectSize.width, projectSize.height]} />
        {texture ? (
          <meshBasicMaterial
            map={texture}
            side={THREE.FrontSide}
            toneMapped={true}
            transparent={true}
            opacity={1}
            color="white"
          />
        ) : (
          <meshBasicMaterial color="white" />
        )}
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
          <ProjectOverlay
            condition={
              selectedProject && gridPosition === 0 && selectedProject.title
            }
            projectSize={projectSize}
            reverse={true}
          >
            <p className={styles.title}>{selectedProject?.title}</p>
          </ProjectOverlay>
          <ProjectOverlay
            condition={
              selectedProject && gridPosition === 1 && selectedProject.context
            }
            projectSize={projectSize}
            reverse={true}
          >
            <p className={styles.title}>{selectedProject?.context}</p>
          </ProjectOverlay>
          <ProjectOverlay
            condition={
              selectedProject && gridPosition === 2 && selectedProject.year
            }
            projectSize={projectSize}
            reverse={true}
          >
            <p className={styles.title}>{selectedProject?.year}</p>
          </ProjectOverlay>
         
          <ProjectOverlay
            condition={
              selectedProject && gridPosition === 3 && selectedProject.technologies
            }
            projectSize={projectSize}
            reverse={true}
          >
            <div className={styles.technoContainer}>
              {selectedProject?.technologies.map((techno) => (
                <p className={styles.techno}>{techno}</p>
              ))}
            </div>
          </ProjectOverlay>
          <ProjectOverlay
            condition={selectedProject && gridPosition === 4}
            projectSize={projectSize}
            reverse={true}
          >
            <ArrowUp />
          </ProjectOverlay>
          <ProjectOverlay
            condition={selectedProject && gridPosition === 9}
            projectSize={projectSize}
          >
            <Cross />
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
    </group>
  )
})

export default Project
