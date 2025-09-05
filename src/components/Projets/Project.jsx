import { useRef, forwardRef, useEffect, useState, useImperativeHandle, useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { animated, useSpring, config } from '@react-spring/three'
import { useStore } from '@/stores/store'
import styles from './Project.module.scss'
import { Navigation } from '@/components/Interface/Interface'
import ProjectOverlay from './ProjectOverlay'
import { useContentTexture, useContentText } from '@/utils/contentLoader'
import projectsData from '@/data/projects.json'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { useCachedPlaneGeometry } from './OptimizedGeometry'
import { getSpringConfig } from '@/utils/springConfig'
import { RotationShaderMaterial } from '@/shaders/rotationShader'

const Project = forwardRef(function Project(
  { gridPosition, image, initialPosition, initialRotation, globalRotation },
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

  // Obtenir les positions d'arrangement directement depuis le store
  const { predefinedPositions, projectSize } = useProjectPositionsStore()

  // Géométrie cachée pour éviter la recreation
  const cachedGeometry = useCachedPlaneGeometry(projectSize.width, projectSize.height)

  // Position cible pour l'arrangement (memoized)
  const targetArrangedPosition = useMemo(() => {
    return predefinedPositions[gridPosition] || [0, 0, 0]
  }, [predefinedPositions, gridPosition])

  // Delays précalculés pour éviter les recalculs
  const animationDelays = useMemo(() => ({
    arrangement: isProjectsArranged ? gridPosition * 50 : Math.random() * 500,
    pageRotation: gridPosition * 100
  }), [gridPosition, isProjectsArranged])

  // Gestion des positions et rotations avec springs - OPTIMISÉE
  const { position, rotation } = useSpring({
    from: { position: [0, 0, 20], rotation: [0, 0, 0] }, // Commencer à l'origine pour tous les projets
    to: {
      position: isProjectsArranged ? targetArrangedPosition : (initialPosition || [0, 0, 0]),
      rotation: isProjectsArranged ? [0, 0, 0] : (initialRotation || [0, 0, 0])
    },
    delay: animationDelays.arrangement,
    config: isProjectsArranged ? getSpringConfig('arrangement') : getSpringConfig('smooth'),
    onChange: (values) => {
      // Marquer l'animation comme terminée à la moitié pour le dernier projet - OPTIMISÉ
      if (isProjectsArranged && gridPosition === projectsData.projects.length - 1 && targetArrangedPosition[0] !== 0) {
        const progress = Math.abs(values.value.position[0] / targetArrangedPosition[0]);
        if (progress >= 0.7 && !isArrangementAnimationComplete) {
          setArrangementAnimationComplete(true);
        }
      }
    }
  })

  // Spring pour la rotation de page individuelle - OPTIMISÉE
  const { pageRotationX } = useSpring({
    pageRotationX: (currentPage) * Math.PI,
    delay: animationDelays.pageRotation,
    config: getSpringConfig('projectRotation')
  })


  // Utiliser les hooks personnalisés
  const { contentTexture, targetFace } = useContentTexture(gridPosition)
  const { contentText } = useContentText(gridPosition)

  // Créer les matériaux shader une seule fois
  const shaderMaterials = useMemo(() => {
    const frontMaterial = new RotationShaderMaterial({
      side: THREE.DoubleSide,
      projectIndex: gridPosition,
      toneMapped: true,
      isFrontFace: true
    })
    
    const backMaterial = new RotationShaderMaterial({
      side: THREE.DoubleSide,
      projectIndex: gridPosition,
      toneMapped: true,
      isFrontFace: false
    })

    return { frontMaterial, backMaterial }
  }, [gridPosition])

  // Assigner les références après création
  useEffect(() => {
    frontMaterialRef.current = shaderMaterials.frontMaterial
    backMaterialRef.current = shaderMaterials.backMaterial
  }, [shaderMaterials])

  // État pour calculer la vitesse de rotation
  const previousRotationRef = useRef(globalRotation || 0)
  const smoothedVelocityRef = useRef(0)

  // Mettre à jour la rotation et calculer la vitesse dans le shader
  useFrame((state, delta) => {
    if (frontMaterialRef.current && backMaterialRef.current) {
      const currentRotation = globalRotation || 0
      
      // Calculer la différence de rotation en gérant les transitions 2π -> 0
      let rotationDelta = currentRotation - previousRotationRef.current
      
      // Normaliser la différence pour éviter les sauts
      if (rotationDelta > Math.PI) {
        rotationDelta -= 2 * Math.PI
      } else if (rotationDelta < -Math.PI) {
        rotationDelta += 2 * Math.PI
      }
      
      // Calculer la vitesse angulaire (radians par seconde)
      const currentVelocity = Math.abs(rotationDelta) / Math.max(delta, 0.016)
      
      // Lissage exponentiel de la vitesse pour éviter les sauts
      const smoothingFactor = 0.05 // Plus lent pour plus de douceur
      smoothedVelocityRef.current = smoothedVelocityRef.current * (1 - smoothingFactor) + 
                                    currentVelocity * smoothingFactor
      
      // Convertir la vitesse en intensité pour le shader avec courbe plus douce
      const intensity = Math.min(smoothedVelocityRef.current * 0.5, 1.0)
      
      frontMaterialRef.current.updateRotation(currentRotation, intensity)
      backMaterialRef.current.updateRotation(currentRotation, intensity)
      
      // Stocker la rotation précédente
      previousRotationRef.current = currentRotation
    }
  })

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

    // Optimisation : vérifier si les valeurs ont vraiment changé avant de mettre à jour
    const backMaterial = backMaterialRef.current
    const frontMaterial = frontMaterialRef.current
    
    const backNeedsUpdate = (
      backMaterial.map !== newMap || 
      !backMaterial.color.equals(new THREE.Color(newColor))
    )
    
    const frontNeedsUpdate = (
      frontMaterial.map !== newMap || 
      !frontMaterial.color.equals(new THREE.Color(newColor))
    )

    if (evenPage || currentPage === 0) {
      if (backNeedsUpdate) {
        backMaterial.map = newMap
        backMaterial.color = newColor
        backMaterial.needsUpdate = true
      }
    }

    if (!evenPage || currentPage === 0) {
      if (frontNeedsUpdate) {
        frontMaterial.map = newMap
        frontMaterial.color = newColor
        frontMaterial.needsUpdate = true
      }
    }
  }, [
    isArrangementAnimationComplete,
    isProjectsArranged,
    texture,
    contentTexture,
    selectedProject?.color?.background,
    currentPage,
    evenPage
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
          material={frontMaterialRef.current}
        >
        <primitive object={cachedGeometry} />
      </mesh>
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