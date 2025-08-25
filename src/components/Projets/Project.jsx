import { useRef, forwardRef, useEffect, useState, useImperativeHandle, useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { animated, useSpring, config } from '@react-spring/three'
import { useStore } from '@/stores/store'
import styles from './Project.module.scss'
import { Navigation } from '@/components/Interface/Interface'
import ProjectOverlay from './ProjectOverlay'
import { useContentTexture, useContentText } from '@/utils/contentLoader'
import projectsData from '@/data/projects.json'
import { useProjectPositions } from '@/hooks/useProjectPositions'

const Project = forwardRef(function Project(
  { gridPosition, image, initialPosition, initialRotation },
  ref,
) {

  
  const backMaterialRef = useRef(null)
  const frontMaterialRef = useRef(null)
  const projectRef = useRef(null)

  // Exposer la ref du groupe principal pour le raycasting
  useImperativeHandle(ref, () => projectRef.current, [])

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
  const setArrangementAnimationComplete = useStore(
    (state) => state.setArrangementAnimationComplete,
  )

  // Obtenir les positions d'arrangement depuis le hook
  const { predefinedPositions, projectSize } = useProjectPositions()

  // Position cible pour l'arrangement
  const targetArrangedPosition = useMemo(() => {
    return predefinedPositions[gridPosition] || [0, 0, 0]
  }, [predefinedPositions, gridPosition])

  // Gestion des positions et rotations avec springs
  const { position, rotation } = useSpring({
    position: isProjectsArranged ? targetArrangedPosition : (initialPosition || [0, 0, 0]),
    rotation: isProjectsArranged ? [0, 0, 0] : (initialRotation || [0, 0, 0]),
    delay: isProjectsArranged ? gridPosition * 100 : gridPosition * 50,
    config: isProjectsArranged ? config.slow : config.gentle,
    // onRest: () => {
    //   // Marquer l'animation comme terminée pour le dernier projet
    //   if (isProjectsArranged && gridPosition === projectsData.projects.length - 1) {
    //       setArrangementAnimationComplete(true)
    //   }
    // },
    onChange: (values) => {
      // Marquer l'animation comme terminée à la moitié pour le dernier projet
      if (isProjectsArranged && gridPosition === projectsData.projects.length - 1 && targetArrangedPosition) {
        const progress = values.value.position[0] / targetArrangedPosition[0];
        if (progress >= 0.3) {
          setArrangementAnimationComplete(true);
        }
      }
    }
  })

  // Spring pour la rotation de page individuelle
  const { pageRotationX } = useSpring({
    pageRotationX: (currentPage) * Math.PI,
    delay: gridPosition * 100, // Délai basé sur la position de la grille
    config: config.slow
  })


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
    <animated.group 
      ref={projectRef} 
      position={position}
      rotation={rotation}
    >
      <animated.group
        rotation-x={pageRotationX}
      >
        <mesh
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
        onClick={handleMeshClick}
        rotation-y={Math.PI}
      >
        <planeGeometry args={[projectSize.width, projectSize.height]} />
        <meshBasicMaterial
          ref={backMaterialRef}
          side={THREE.FrontSide}
          toneMapped={true}
        />
      </mesh>      {/* Groupe séparé pour les overlays qui suivra les animations */}
      <group>
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
      </animated.group>
    </animated.group>
  )
})

export default Project