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

const CURSOR_RESPONSE = 10
const REVEAL_RESPONSE = 7.5
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

  const revealUniforms = useMemo(() => ({
    uRevealCursor: { value: new THREE.Vector2(999, 999) },
    uTrailCursor: { value: new THREE.Vector2(999, 999) },
    uRevealStrength: { value: 0 },
    uTrailStrength: { value: 0 },
    uInkColor: { value: new THREE.Color('#cfd8e6') },
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

  const applyInkRevealShader = useCallback((material) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uRevealCursor = revealUniforms.uRevealCursor
      shader.uniforms.uTrailCursor = revealUniforms.uTrailCursor
      shader.uniforms.uRevealStrength = revealUniforms.uRevealStrength
      shader.uniforms.uTrailStrength = revealUniforms.uTrailStrength
      shader.uniforms.uInkColor = revealUniforms.uInkColor
      shader.uniforms.uTime = revealUniforms.uTime

      shader.vertexShader = `
        varying vec2 vRevealUv;
        varying vec2 vRevealPosition;
      ` + shader.vertexShader

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>
          vRevealUv = uv;
          vRevealPosition = position.xy;
        `,
      )

      shader.fragmentShader = `
        uniform vec2 uRevealCursor;
        uniform vec2 uTrailCursor;
        uniform float uRevealStrength;
        uniform float uTrailStrength;
        uniform vec3 uInkColor;
        uniform float uTime;
        varying vec2 vRevealUv;
        varying vec2 vRevealPosition;

        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        float noise21(vec2 p) {
          vec2 cell = floor(p);
          vec2 local = fract(p);
          local = local * local * (3.0 - 2.0 * local);

          float a = hash21(cell);
          float b = hash21(cell + vec2(1.0, 0.0));
          float c = hash21(cell + vec2(0.0, 1.0));
          float d = hash21(cell + vec2(1.0, 1.0));

          return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
        }

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;

          value += amplitude * noise21(p);
          p *= 2.03;
          amplitude *= 0.5;
          value += amplitude * noise21(p);
          p *= 2.01;
          amplitude *= 0.5;
          value += amplitude * noise21(p);
          p *= 2.02;
          amplitude *= 0.5;
          value += amplitude * noise21(p);

          return value;
        }

        float fiberPattern(vec2 uv) {
          float vertical = fbm(vec2(uv.x * 3.0, uv.y * 24.0));
          float diagonal = fbm(vec2(uv.x * 14.0 + uv.y * 4.0, uv.y * 18.0));
          return smoothstep(0.48, 0.8, vertical * 0.65 + diagonal * 0.35);
        }
      ` + shader.fragmentShader

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
          float cursorDistance = distance(vRevealPosition, uRevealCursor);
          float trailDistance = distance(vRevealPosition, uTrailCursor);
          float revealMask = smoothstep(1.25, 0.0, cursorDistance) * uRevealStrength;
          float trailMask = smoothstep(1.7, 0.0, trailDistance) * uTrailStrength;
          float revealField = max(revealMask, trailMask * 0.85);

          vec2 flowUv = vRevealUv * vec2(1.15, 1.45);
          float wave = 0.5 + 0.5 * sin((flowUv.y * 10.0 + flowUv.x * 2.2) + uTime * 0.45);
          float bloomNoise = fbm(flowUv * 5.0 + vec2(0.0, uTime * 0.03));
          float edgeNoise = fbm(flowUv * 9.0 + vec2(1.7, -2.3));
          float fibers = fiberPattern(flowUv + vec2(0.15, -0.08));
          float grain = noise21(vRevealUv * 280.0 + uTime * 0.03);
          float edge = smoothstep(0.0, 0.2, vRevealUv.x) * smoothstep(0.0, 0.2, 1.0 - vRevealUv.x);
          edge *= smoothstep(0.0, 0.16, vRevealUv.y) * smoothstep(0.0, 0.16, 1.0 - vRevealUv.y);

          float organicMask = smoothstep(0.28, 0.8, bloomNoise * 0.72 + edgeNoise * 0.28 + wave * 0.22);
          float feather = smoothstep(0.12, 0.95, revealField + edgeNoise * 0.26);
          float glossMask = revealField * mix(0.5, 1.0, organicMask) * feather * edge;
          float streak = smoothstep(0.38, 0.96, wave) * (0.42 + fibers * 0.58);
          float sheen = smoothstep(0.08, 0.96, 1.0 - abs(vRevealUv.x * 2.0 - 1.0));
          float printBands = smoothstep(0.35, 0.78, sin(vRevealUv.y * 54.0 + bloomNoise * 4.5) * 0.5 + 0.5);
          vec3 baseColor = gl_FragColor.rgb;
          vec3 paperLift = mix(baseColor, vec3(1.0), glossMask * 0.08);
          vec3 varnishTint = mix(vec3(0.98, 0.98, 1.0), uInkColor, 0.55 + grain * 0.12);
          vec3 varnishLayer = paperLift + varnishTint * glossMask * streak * sheen * (0.2 + printBands * 0.16);
          float specularLine = pow(smoothstep(0.46, 1.0, wave), 2.4) * glossMask * 0.34;
          float softBloom = glossMask * (0.06 + fibers * 0.045 + printBands * 0.03);
          float contrastDip = glossMask * (0.08 + printBands * 0.05);

          gl_FragColor.rgb = mix(baseColor * (1.0 - contrastDip), varnishLayer, glossMask * 0.88);
          gl_FragColor.rgb += specularLine + softBloom;

          #include <dithering_fragment>
        `,
      )
    }

    material.customProgramCacheKey = () => 'ink-reveal-v2-gloss'
    material.needsUpdate = true
  }, [revealUniforms])

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
      applyInkRevealShader(frontMaterialRef.current)
    }

    if (backMaterialRef.current) {
      applyInkRevealShader(backMaterialRef.current)
    }
  }, [applyInkRevealShader])

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
      screenInfluence * 0.72,
    )
    const cursorBlend = 1 - Math.exp(-delta * CURSOR_RESPONSE)
    const strengthBlend = 1 - Math.exp(-delta * REVEAL_RESPONSE)
    const trailBlend = 1 - Math.exp(-delta * TRAIL_RESPONSE)
    const residualTrailStrength = Math.max(
      targetStrength * 0.95,
      revealUniforms.uTrailStrength.value * Math.exp(-delta * TRAIL_DECAY),
    )

    if (revealUniforms.uRevealCursor.value.x > 900) {
      revealUniforms.uRevealCursor.value.set(localCursorRef.current.x, localCursorRef.current.y)
      revealUniforms.uTrailCursor.value.set(localCursorRef.current.x, localCursorRef.current.y)
    } else {
      revealUniforms.uRevealCursor.value.lerp(localCursorRef.current, cursorBlend)
      revealUniforms.uTrailCursor.value.lerp(localCursorRef.current, trailBlend)
    }

    revealUniforms.uRevealStrength.value = THREE.MathUtils.lerp(
      revealUniforms.uRevealStrength.value,
      targetStrength,
      strengthBlend,
    )
    revealUniforms.uTrailStrength.value = THREE.MathUtils.lerp(
      revealUniforms.uTrailStrength.value,
      residualTrailStrength,
      trailBlend,
    )
    revealUniforms.uTime.value = state.clock.elapsedTime
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