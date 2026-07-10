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

const CURSOR_RESPONSE = 9
const RIPPLE_RESPONSE = 7.2
const TRAIL_RESPONSE = 2.2
const TRAIL_DECAY = 0.92

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
  const hasPointerSampleRef = useRef(false)
  const { camera, pointer } = useThree()

  const rippleUniforms = useMemo(() => ({
    uRippleCursor: { value: new THREE.Vector2(999, 999) },
    uTrailCursor: { value: new THREE.Vector2(999, 999) },
    uRippleStrength: { value: 0 },
    uTrailStrength: { value: 0 },
    uRippleTint: { value: new THREE.Color('#eef4ff') },
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

  const applyPressureRippleShader = useCallback((material) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uRippleCursor = rippleUniforms.uRippleCursor
      shader.uniforms.uTrailCursor = rippleUniforms.uTrailCursor
      shader.uniforms.uRippleStrength = rippleUniforms.uRippleStrength
      shader.uniforms.uTrailStrength = rippleUniforms.uTrailStrength
      shader.uniforms.uRippleTint = rippleUniforms.uRippleTint
      shader.uniforms.uTime = rippleUniforms.uTime

      shader.vertexShader = `
        uniform vec2 uRippleCursor;
        uniform vec2 uTrailCursor;
        uniform float uRippleStrength;
        uniform float uTrailStrength;
        uniform float uTime;
        varying vec2 vRippleUv;
        varying float vRippleMask;
        varying float vRipplePhase;
      ` + shader.vertexShader

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>

          vRippleUv = uv;

          float cursorDistance = distance(position.xy, uRippleCursor);
          float trailDistance = distance(position.xy, uTrailCursor);
          float cursorField = smoothstep(1.45, 0.0, cursorDistance) * uRippleStrength;
          float trailField = smoothstep(1.8, 0.0, trailDistance) * uTrailStrength;
          float rippleField = max(cursorField, trailField * 0.8);

          vec2 cursorVector = position.xy - uRippleCursor;
          float cursorRadius = max(length(cursorVector), 0.0001);
          vec2 cursorDirection = cursorVector / cursorRadius;
          vec2 trailVector = position.xy - uTrailCursor;
          float trailRadius = max(length(trailVector), 0.0001);

          float cursorRipple = sin(cursorRadius * 20.0 - uTime * 9.0);
          float trailRipple = sin(trailRadius * 16.0 - uTime * 6.5);
          float cursorEnvelope = exp(-cursorRadius * 2.8);
          float trailEnvelope = exp(-trailRadius * 2.1);
          float sheetBias = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * 2.0 - 1.0) * 0.55);
          float ripple = cursorRipple * cursorEnvelope * cursorField + trailRipple * trailEnvelope * trailField * 0.75;
          float bend = ripple * (0.12 + sheetBias * 0.08);

          transformed.z += bend;
          transformed.x += cursorDirection.x * rippleField * 0.035 * cursorEnvelope;
          transformed.y += cursorDirection.y * rippleField * 0.035 * cursorEnvelope;

          vRippleMask = clamp(abs(ripple) * 2.4 + rippleField * 0.35, 0.0, 1.0);
          vRipplePhase = ripple;
        `,
      )

      shader.fragmentShader = `
        uniform vec3 uRippleTint;
        uniform float uTime;
        varying vec2 vRippleUv;
        varying float vRippleMask;
        varying float vRipplePhase;
      ` + shader.fragmentShader

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
          float rippleHighlight = smoothstep(0.12, 1.0, vRippleMask);
          float shimmer = 0.5 + 0.5 * sin(uTime * 4.5 + vRippleUv.y * 22.0 + vRippleUv.x * 10.0);
          float ringLine = smoothstep(0.35, 0.95, 0.5 + 0.5 * vRipplePhase);
          float centerBias = smoothstep(0.08, 0.92, 1.0 - distance(vRippleUv, vec2(0.5)) * 1.2);
          vec3 rippleTint = mix(gl_FragColor.rgb, uRippleTint, rippleHighlight * (0.16 + shimmer * 0.08));

          gl_FragColor.rgb = mix(gl_FragColor.rgb, rippleTint, rippleHighlight * 0.52);
          gl_FragColor.rgb += ringLine * rippleHighlight * 0.12 * (0.65 + centerBias * 0.35);

          #include <dithering_fragment>
        `,
      )
    }

    material.customProgramCacheKey = () => 'pressure-ripple-v1'
    material.needsUpdate = true
  }, [rippleUniforms])

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
      applyPressureRippleShader(frontMaterialRef.current)
    }

    if (backMaterialRef.current) {
      applyPressureRippleShader(backMaterialRef.current)
    }
  }, [applyPressureRippleShader])

  useFrame((state, delta) => {
    if (!pageGroupRef.current) {
      return
    }

    const previousPointer = previousPointerRef.current

    if (!hasPointerSampleRef.current) {
      previousPointer.set(pointer.x, pointer.y)
      hasPointerSampleRef.current = true
    }

    previousPointer.set(pointer.x, pointer.y)

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
    const screenInfluence = THREE.MathUtils.clamp(1 - screenDistance / 0.72, 0, 1)
    const targetStrength = Math.max(
      cursorInfluence,
      screenInfluence * 0.62,
    )
    const cursorBlend = 1 - Math.exp(-delta * CURSOR_RESPONSE)
    const strengthBlend = 1 - Math.exp(-delta * RIPPLE_RESPONSE)
    const trailBlend = 1 - Math.exp(-delta * TRAIL_RESPONSE)
    const residualTrailStrength = Math.max(
      targetStrength * 0.95,
      rippleUniforms.uTrailStrength.value * Math.exp(-delta * TRAIL_DECAY),
    )

    if (rippleUniforms.uRippleCursor.value.x > 900) {
      rippleUniforms.uRippleCursor.value.set(localCursorRef.current.x, localCursorRef.current.y)
      rippleUniforms.uTrailCursor.value.set(localCursorRef.current.x, localCursorRef.current.y)
    } else {
      rippleUniforms.uRippleCursor.value.lerp(localCursorRef.current, cursorBlend)
      rippleUniforms.uTrailCursor.value.lerp(localCursorRef.current, trailBlend)
    }

    rippleUniforms.uRippleStrength.value = THREE.MathUtils.lerp(
      rippleUniforms.uRippleStrength.value,
      targetStrength,
      strengthBlend,
    )
    rippleUniforms.uTrailStrength.value = THREE.MathUtils.lerp(
      rippleUniforms.uTrailStrength.value,
      residualTrailStrength,
      trailBlend,
    )
    rippleUniforms.uTime.value = state.clock.elapsedTime
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