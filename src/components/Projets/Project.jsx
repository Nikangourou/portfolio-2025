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

const ARRANGED_BACK_FACE_FLIP = { x: 0.0, y: 0.0 }
const FREE_BACK_FACE_FLIP = { x: 1.0, y: 1.0 }

const getBackFaceFlip = (isProjectsArranged) => ({
  // Keep arranged/non-arranged orientation stable across shader/UV changes.
  x: isProjectsArranged ? ARRANGED_BACK_FACE_FLIP.x : FREE_BACK_FACE_FLIP.x,
  y: isProjectsArranged ? ARRANGED_BACK_FACE_FLIP.y : FREE_BACK_FACE_FLIP.y,
})

const Project = forwardRef(function Project(
  { gridPosition, image, initialPosition, initialRotation },
  ref,
) {
  const pageMaterialRef = useRef(null)
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

  const emptyTexture = useMemo(() => {
    const data = new Uint8Array([255, 255, 255, 255])
    const placeholder = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
    placeholder.colorSpace = THREE.SRGBColorSpace
    placeholder.needsUpdate = true
    return placeholder
  }, [])

  const rippleUniforms = useMemo(() => ({
    uRippleCursor: { value: new THREE.Vector2(999, 999) },
    uTrailCursor: { value: new THREE.Vector2(999, 999) },
    uRippleStrength: { value: 0 },
    uTrailStrength: { value: 0 },
    uRippleTint: { value: new THREE.Color('#eef4ff') },
    uFrontMap: { value: emptyTexture },
    uBackMap: { value: emptyTexture },
    uBackFlipX: { value: 1.0 },
    uBackFlipY: { value: 0.0 },
    uFrontMapTransform: { value: new THREE.Matrix3() },
    uBackMapTransform: { value: new THREE.Matrix3() },
    uTime: { value: 0 },
  }), [emptyTexture])

  // Exposer la ref du groupe principal pour le raycasting
  useImperativeHandle(ref, () => projectRef.current, [])

  const texture = useTexture(image || '', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
  })

  const selectedProject = useStore((state) => state.selectedProject)
  const currentPage = useStore((state) => state.currentPage)
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
      shader.uniforms.uFrontMap = rippleUniforms.uFrontMap
      shader.uniforms.uBackMap = rippleUniforms.uBackMap
      shader.uniforms.uBackFlipX = rippleUniforms.uBackFlipX
      shader.uniforms.uBackFlipY = rippleUniforms.uBackFlipY
      shader.uniforms.uFrontMapTransform = rippleUniforms.uFrontMapTransform
      shader.uniforms.uBackMapTransform = rippleUniforms.uBackMapTransform
      shader.uniforms.uTime = rippleUniforms.uTime

      material.userData.shader = shader

      shader.vertexShader = `
        uniform vec2 uRippleCursor;
        uniform vec2 uTrailCursor;
        uniform float uRippleStrength;
        uniform float uTrailStrength;
        uniform float uTime;
        uniform mat3 uFrontMapTransform;
        uniform mat3 uBackMapTransform;
        varying vec2 vFrontUv;
        varying vec2 vBackUv;
        varying vec2 vRippleUv;
        varying float vRippleMask;
        varying float vRipplePhase;
      ` + shader.vertexShader

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>

          vFrontUv = (uFrontMapTransform * vec3(uv, 1.0)).xy;
          vec2 backFaceUv = vec2(uv.x, 1.0 - uv.y);
          vBackUv = (uBackMapTransform * vec3(backFaceUv, 1.0)).xy;
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
        uniform sampler2D uFrontMap;
        uniform sampler2D uBackMap;
        uniform float uBackFlipX;
        uniform float uBackFlipY;
        uniform vec3 uRippleTint;
        uniform float uTime;
        varying vec2 vFrontUv;
        varying vec2 vBackUv;
        varying vec2 vRippleUv;
        varying float vRippleMask;
        varying float vRipplePhase;
      ` + shader.fragmentShader

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
          float sampledBackX = mix(vBackUv.x, 1.0 - vBackUv.x, uBackFlipX);
          float sampledBackY = mix(vBackUv.y, 1.0 - vBackUv.y, uBackFlipY);
          vec2 backSampleUv = vec2(sampledBackX, sampledBackY);
          vec4 sampledDiffuseColor = gl_FrontFacing
            ? texture2D(uFrontMap, vFrontUv)
            : texture2D(uBackMap, backSampleUv);

          diffuseColor *= sampledDiffuseColor;
        `,
      )

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
  const {
    contentTexture: currentPageTexture,
    targetFace,
  } = useContentTexture(
    gridPosition,
    currentPage || null,
  )
  const previousPage = currentPage > 1 ? currentPage - 1 : null
  const previousFace = targetFace === 'front' ? 'back' : 'front'
  const { contentTexture: previousPageTexture } = useContentTexture(
    gridPosition,
    previousPage,
    previousFace,
  )
  const { contentText } = useContentText(gridPosition)

  // Fonctions de navigation
  const resetProjectState = useStore((state) => state.resetProjectState)
  const setCurrentPage = useStore((state) => state.setCurrentPage)
  const maxPage = selectedProject?.contents?.length || 0
  const gridConfig = useGridConfig()

  useEffect(() => {
    if (pageMaterialRef.current) {
      applyPressureRippleShader(pageMaterialRef.current)
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
    if (!pageMaterialRef.current) return

    const material = pageMaterialRef.current
    const backFaceFlip = getBackFaceFlip(isProjectsArranged)
    const shouldUseContentMaps = (
      isProjectsArranged &&
      isArrangementAnimationComplete &&
      currentPage > 0
    )
    const visibleSideHasTexture = shouldUseContentMaps && !!currentPageTexture

    const nextColor = visibleSideHasTexture
      ? 'white'
      : (selectedProject?.color?.background || 'white')
    const baseMap = texture || emptyTexture
    let nextFrontMap = baseMap
    let nextBackMap = baseMap

    if (shouldUseContentMaps) {
      const currentMap = currentPageTexture || emptyTexture
      const previousMap = previousPage
        ? (previousPageTexture || emptyTexture)
        : baseMap

      if (targetFace === 'front') {
        nextFrontMap = currentMap
        nextBackMap = previousMap
      } else {
        nextFrontMap = previousMap
        nextBackMap = currentMap
      }
    }

    nextFrontMap.updateMatrix()
    nextBackMap.updateMatrix()

    material.userData.frontMap = nextFrontMap
    material.userData.backMap = nextBackMap
    rippleUniforms.uFrontMap.value = nextFrontMap
    rippleUniforms.uBackMap.value = nextBackMap
    rippleUniforms.uBackFlipX.value = backFaceFlip.x
    rippleUniforms.uBackFlipY.value = backFaceFlip.y
    rippleUniforms.uFrontMapTransform.value.copy(nextFrontMap.matrix)
    rippleUniforms.uBackMapTransform.value.copy(nextBackMap.matrix)

    if (material.userData.shader) {
      material.userData.shader.uniforms.uFrontMap.value = nextFrontMap
      material.userData.shader.uniforms.uBackMap.value = nextBackMap
      material.userData.shader.uniforms.uBackFlipX.value = backFaceFlip.x
      material.userData.shader.uniforms.uBackFlipY.value = backFaceFlip.y
      material.userData.shader.uniforms.uFrontMapTransform.value.copy(nextFrontMap.matrix)
      material.userData.shader.uniforms.uBackMapTransform.value.copy(nextBackMap.matrix)
    }

    material.color.set(nextColor)
  }, [
    isArrangementAnimationComplete,
    isProjectsArranged,
    texture,
    currentPageTexture,
    previousPageTexture,
    previousPage,
    targetFace,
    selectedProject?.color?.background,
    currentPage,
    emptyTexture,
    rippleUniforms,
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
              ref={pageMaterialRef}
              map={emptyTexture}
              side={THREE.DoubleSide}
              toneMapped={true}
              onUpdate={(material) => {
                if (!material.userData.shaderSetup) {
                  applyPressureRippleShader(material)
                  material.userData.shaderSetup = true
                }
              }}
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