import { useRef, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { animated, useSpring } from '@react-spring/three'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '@/stores/store'
import styles from './Project.module.scss'
import { Navigation } from '@/components/Interface/Interface'
import ProjectOverlay from './ProjectOverlay'
import { useContentTexture, useContentText } from '@/utils/contentLoader'
import projectsData from '@/data/projects.json'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { getCachedGeometry, AnimatedMesh } from './OptimizedGeometry'
import { getSpringConfig } from '@/utils/springConfig'
import { useGridConfig } from '@/hooks/useGridConfig'

const MAX_WIND_SPEED = 1.1
const WIND_RESPONSE = 4.6
const DIRECTION_RESPONSE = 6.5
const STRENGTH_RESPONSE = 6.2
const TRAIL_RESPONSE = 1.7
const TRAIL_DECAY = 0.78

const Project = forwardRef(function Project(
  { gridPosition, image, initialPosition, initialRotation },
  ref,
) {
  const backMaterialRef = useRef(null)
  const frontMaterialRef = useRef(null)
  const projectRef = useRef(null)
  const pageGroupRef = useRef(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const worldPlaneRef = useRef(new THREE.Plane())
  const planeOriginRef = useRef(new THREE.Vector3())
  const planeNormalRef = useRef(new THREE.Vector3())
  const planeQuaternionRef = useRef(new THREE.Quaternion())
  const hitPointRef = useRef(new THREE.Vector3())
  const localCursorRef = useRef(new THREE.Vector3())
  const projectedCenterRef = useRef(new THREE.Vector3())
  const previousPointerRef = useRef(new THREE.Vector2())
  const smoothedWindRef = useRef(new THREE.Vector2())
  const targetWindRef = useRef(new THREE.Vector2())
  const stableDirectionRef = useRef(new THREE.Vector2(0, 1))
  const hasPointerSampleRef = useRef(false)
  const { camera, pointer } = useThree()

  const windUniforms = useMemo(() => ({
    uWindCursor: { value: new THREE.Vector3(999, 999, 0) },
    uTrailCursor: { value: new THREE.Vector3(999, 999, 0) },
    uWindDirection: { value: new THREE.Vector2(0, 1) },
    uWindStrength: { value: 0 },
    uTrailStrength: { value: 0 },
    uTime: { value: 0 },
  }), [])

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

  // Position cible pour l'arrangement (memoized)
  const targetArrangedPosition = useMemo(() => {
    return predefinedPositions[gridPosition] || [0, 0, 0]
  }, [predefinedPositions, gridPosition])

  const applyWindShader = useCallback((material, directionSign) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWindCursor = windUniforms.uWindCursor
      shader.uniforms.uTrailCursor = windUniforms.uTrailCursor
      shader.uniforms.uWindDirection = windUniforms.uWindDirection
      shader.uniforms.uWindStrength = windUniforms.uWindStrength
      shader.uniforms.uTrailStrength = windUniforms.uTrailStrength
      shader.uniforms.uTime = windUniforms.uTime

      shader.vertexShader = `
        uniform vec3 uWindCursor;
        uniform vec3 uTrailCursor;
        uniform vec2 uWindDirection;
        uniform float uWindStrength;
        uniform float uTrailStrength;
        uniform float uTime;
      ` + shader.vertexShader

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>

          vec2 windDirection = length(uWindDirection) > 0.0001
            ? normalize(uWindDirection)
            : vec2(0.0, 1.0);
          float cursorDistance = distance(position.xy, uWindCursor.xy);
          float trailDistance = distance(position.xy, uTrailCursor.xy);
          float localFalloff = smoothstep(1.1, 0.0, cursorDistance);
          float trailFalloff = smoothstep(1.6, 0.0, trailDistance);
          float pageLift = smoothstep(-0.15, 1.0, uv.y);
          float gust = 0.55 + 0.45 * sin(
            position.y * 10.0 +
            uTime * 3.2 +
            dot(position.xy, windDirection * 6.0)
          );
          float influence = pageLift * (
            localFalloff * uWindStrength +
            trailFalloff * uTrailStrength * 0.8
          );

          transformed.x += windDirection.x * influence * 0.26 * gust;
          transformed.y += windDirection.y * influence * 0.11 * gust;
          transformed.z += ${directionSign.toFixed(1)} * influence * (0.22 + 0.16 * gust);
        `,
      )
    }

    material.customProgramCacheKey = () => `wind-bend-${directionSign}`
    material.needsUpdate = true
  }, [windUniforms])

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
    pageRotationX: isProjectsArranged ? currentPage * Math.PI : 0,
    delay: isProjectsArranged ? animationDelays.pageRotation : 0,
    immediate: !isProjectsArranged,
    config: getSpringConfig('projectRotation')
  })

  // Utiliser les hooks personnalisés
  const { contentTexture } = useContentTexture(gridPosition)
  const { contentText } = useContentText(gridPosition)

  // Fonctions de navigation
  const resetProjectState = useStore((state) => state.resetProjectState)
  const setCurrentPage = useStore((state) => state.setCurrentPage)
  const maxPage = selectedProject?.contents?.length
  const gridConfig = useGridConfig()

  useEffect(() => {
    if (frontMaterialRef.current) {
      applyWindShader(frontMaterialRef.current, 1)
    }

    if (backMaterialRef.current) {
      applyWindShader(backMaterialRef.current, -1)
    }
  }, [applyWindShader])

  useFrame((state, delta) => {
    if (!pageGroupRef.current) {
      return
    }

    const previousPointer = previousPointerRef.current
    const smoothedWind = smoothedWindRef.current
    const targetWind = targetWindRef.current
    const stableDirection = stableDirectionRef.current

    if (!hasPointerSampleRef.current) {
      previousPointer.set(pointer.x, pointer.y)
      targetWind.set(0, 0)
      smoothedWind.set(0, 0)
      hasPointerSampleRef.current = true
    }

    const pointerDeltaX = pointer.x - previousPointer.x
    const pointerDeltaY = pointer.y - previousPointer.y
    previousPointer.set(pointer.x, pointer.y)

    const windBlend = 1 - Math.exp(-delta * WIND_RESPONSE)
    const directionBlend = 1 - Math.exp(-delta * DIRECTION_RESPONSE)
    targetWind.set(pointerDeltaX * 28, -pointerDeltaY * 28)
    if (targetWind.lengthSq() > MAX_WIND_SPEED * MAX_WIND_SPEED) {
      targetWind.setLength(MAX_WIND_SPEED)
    }
    smoothedWind.lerp(targetWind, windBlend)

    if (smoothedWind.lengthSq() > 0.0004) {
      stableDirection.copy(smoothedWind).normalize()
    }

    pageGroupRef.current.getWorldPosition(planeOriginRef.current)
    pageGroupRef.current.getWorldQuaternion(planeQuaternionRef.current)
    planeNormalRef.current.set(0, 0, 1)
      .applyQuaternion(planeQuaternionRef.current)
      .normalize()

    worldPlaneRef.current.setFromNormalAndCoplanarPoint(
      planeNormalRef.current,
      planeOriginRef.current,
    )

    raycasterRef.current.setFromCamera(pointer, camera)
    raycasterRef.current.ray.intersectPlane(
      worldPlaneRef.current,
      hitPointRef.current,
    )

    localCursorRef.current.copy(hitPointRef.current)
    pageGroupRef.current.worldToLocal(localCursorRef.current)

    const halfWidth = projectSize.width * 0.5
    const halfHeight = projectSize.height * 0.5
    const normalizedX = localCursorRef.current.x / (halfWidth * 1.35)
    const normalizedY = localCursorRef.current.y / (halfHeight * 1.35)
    const radialDistance = Math.sqrt(
      normalizedX * normalizedX + normalizedY * normalizedY,
    )
    const cursorInfluence = THREE.MathUtils.clamp(1 - radialDistance, 0, 1)
    projectedCenterRef.current.copy(planeOriginRef.current).project(camera)

    const pointerToProjectX = pointer.x - projectedCenterRef.current.x
    const pointerToProjectY = pointer.y - projectedCenterRef.current.y
    const screenDistance = Math.sqrt(
      pointerToProjectX * pointerToProjectX +
      pointerToProjectY * pointerToProjectY,
    )
    const screenInfluence = THREE.MathUtils.clamp(1 - screenDistance / 0.65, 0, 1)
    const windMagnitude = THREE.MathUtils.clamp(smoothedWind.length(), 0, 1)
    const targetStrength = Math.max(
      cursorInfluence * (0.34 + windMagnitude * 1.1),
      screenInfluence * (0.16 + windMagnitude * 0.55),
    )
    const strengthBlend = 1 - Math.exp(-delta * STRENGTH_RESPONSE)
    const trailBlend = 1 - Math.exp(-delta * TRAIL_RESPONSE)
    const residualTrailStrength = Math.max(
      targetStrength * 0.95,
      windUniforms.uTrailStrength.value * Math.exp(-delta * TRAIL_DECAY),
    )

    if (windUniforms.uWindCursor.value.x > 900) {
      windUniforms.uWindCursor.value.copy(localCursorRef.current)
      windUniforms.uTrailCursor.value.copy(localCursorRef.current)
    } else {
      windUniforms.uWindCursor.value.lerp(localCursorRef.current, strengthBlend)
      windUniforms.uTrailCursor.value.lerp(localCursorRef.current, trailBlend)
    }

    windUniforms.uWindDirection.value.lerp(stableDirection, directionBlend)
    windUniforms.uWindStrength.value = THREE.MathUtils.lerp(
      windUniforms.uWindStrength.value,
      targetStrength,
      strengthBlend,
    )
    windUniforms.uTrailStrength.value = THREE.MathUtils.lerp(
      windUniforms.uTrailStrength.value,
      residualTrailStrength,
      trailBlend,
    )
    windUniforms.uTime.value = state.clock.elapsedTime
  })

  // Fonction pour gérer le clic et arrêter la propagation
  const handleMeshClick = (event) => {

    // Navigation - Cross
    if (gridPosition === gridConfig.crossPosition && selectedProject) {
      resetProjectState()
      return
    }

    // Navigation - Arrow Up
    if (gridPosition === gridConfig.arrowUpPosition && selectedProject && currentPage > 1) {
      setCurrentPage(currentPage - 1)
      return
    }

    // Navigation - Arrow Down
    if (gridPosition === 14 && selectedProject && currentPage < maxPage) {
      setCurrentPage(currentPage + 1)
      return
    }

    // Logique de sélection du projet (pour toutes les autres positions)
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
      backMaterial.color.getHexString() !== newColor.replace('#', '')
    )

    const frontNeedsUpdate = (
      frontMaterial.map !== newMap ||
      frontMaterial.color.getHexString() !== newColor.replace('#', '')
    )

    if (evenPage || currentPage === 0) {
      if (backNeedsUpdate) {
        backMaterial.map = newMap
        backMaterial.color.set(newColor)
        backMaterial.needsUpdate = true
      }
    }

    if (!evenPage || currentPage === 0) {
      if (frontNeedsUpdate) {
        frontMaterial.map = newMap
        frontMaterial.color.set(newColor)
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
        ref={pageGroupRef}
        rotation-x={pageRotationX}
      >
        <AnimatedMesh
          projectId={gridPosition}
          onClick={handleMeshClick}
        >
          <mesh>
            <primitive object={getCachedGeometry().clone()} />
            <meshBasicMaterial
              ref={frontMaterialRef}
              side={THREE.FrontSide}
              toneMapped={true}
            />
          </mesh>
          <mesh rotation-y={Math.PI}>
            <primitive object={getCachedGeometry().clone()} />
            <meshBasicMaterial
              ref={backMaterialRef}
              side={THREE.FrontSide}
              toneMapped={true}
            />
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
        </AnimatedMesh>
      </animated.group>
    </animated.group>
  )
})

export default Project