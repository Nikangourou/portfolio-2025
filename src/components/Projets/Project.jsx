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
const FLUTTER_RESPONSE = 6.8
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

  const flutterUniforms = useMemo(() => ({
    uFlutterCursor: { value: new THREE.Vector2(999, 999) },
    uTrailCursor: { value: new THREE.Vector2(999, 999) },
    uFlutterStrength: { value: 0 },
    uTrailStrength: { value: 0 },
    uEdgeTint: { value: new THREE.Color('#f3f6fb') },
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

  const applyEdgeFlutterShader = useCallback((material) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFlutterCursor = flutterUniforms.uFlutterCursor
      shader.uniforms.uTrailCursor = flutterUniforms.uTrailCursor
      shader.uniforms.uFlutterStrength = flutterUniforms.uFlutterStrength
      shader.uniforms.uTrailStrength = flutterUniforms.uTrailStrength
      shader.uniforms.uEdgeTint = flutterUniforms.uEdgeTint
      shader.uniforms.uTime = flutterUniforms.uTime

      shader.vertexShader = `
        uniform vec2 uFlutterCursor;
        uniform vec2 uTrailCursor;
        uniform float uFlutterStrength;
        uniform float uTrailStrength;
        uniform float uTime;
        varying vec2 vFlutterUv;
        varying float vFlutterMask;
      ` + shader.vertexShader

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>

          vFlutterUv = uv;

          float cursorDistance = distance(position.xy, uFlutterCursor);
          float trailDistance = distance(position.xy, uTrailCursor);
          float cursorField = smoothstep(1.3, 0.0, cursorDistance) * uFlutterStrength;
          float trailField = smoothstep(1.8, 0.0, trailDistance) * uTrailStrength;
          float flutterField = max(cursorField, trailField * 0.82);

          float topEdge = smoothstep(0.48, 1.0, uv.y);
          float bottomEdge = 1.0 - smoothstep(0.0, 0.18, uv.y);
          float sideDistance = abs(uv.x * 2.0 - 1.0);
          float sideEdge = smoothstep(0.46, 1.0, sideDistance);
          float cornerBias = smoothstep(0.52, 1.0, max(sideDistance, abs(uv.y * 2.0 - 1.0)));
          float edgeMask = max(topEdge * 1.1, sideEdge * 0.72 + bottomEdge * 0.22);
          edgeMask = mix(edgeMask, 1.0, cornerBias * 0.18);

          float flutterWave = sin(
            uTime * 7.0 +
            uv.y * 16.0 +
            uv.x * 9.0
          );
          float secondaryWave = sin(
            uTime * 11.0 +
            uv.y * 23.0 -
            uv.x * 6.0
          );
          float wave = flutterWave * 0.7 + secondaryWave * 0.3;
          float bend = flutterField * edgeMask;

          transformed.z += bend * (0.12 + wave * 0.09);
          transformed.x += bend * sideEdge * (uv.x - 0.5) * (0.1 + secondaryWave * 0.05);
          transformed.y += bend * topEdge * (0.04 + flutterWave * 0.035);

          vFlutterMask = bend;
        `,
      )

      shader.fragmentShader = `
        uniform vec3 uEdgeTint;
        uniform float uTime;
        varying vec2 vFlutterUv;
        varying float vFlutterMask;
      ` + shader.fragmentShader

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
          float edgeHighlight = smoothstep(0.28, 1.0, vFlutterMask);
          float shimmer = 0.5 + 0.5 * sin(uTime * 5.0 + vFlutterUv.y * 18.0 + vFlutterUv.x * 12.0);
          float sideGlow = smoothstep(0.34, 1.0, abs(vFlutterUv.x * 2.0 - 1.0));
          vec3 flutterTint = mix(gl_FragColor.rgb, uEdgeTint, edgeHighlight * (0.12 + shimmer * 0.08));

          gl_FragColor.rgb = mix(gl_FragColor.rgb, flutterTint, edgeHighlight * (0.45 + sideGlow * 0.18));

          #include <dithering_fragment>
        `,
      )
    }

    material.customProgramCacheKey = () => 'edge-flutter-v1'
    material.needsUpdate = true
  }, [flutterUniforms])

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
      applyEdgeFlutterShader(frontMaterialRef.current)
    }

    if (backMaterialRef.current) {
      applyEdgeFlutterShader(backMaterialRef.current)
    }
  }, [applyEdgeFlutterShader])

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
      screenInfluence * 0.68,
    )
    const cursorBlend = 1 - Math.exp(-delta * CURSOR_RESPONSE)
    const strengthBlend = 1 - Math.exp(-delta * FLUTTER_RESPONSE)
    const trailBlend = 1 - Math.exp(-delta * TRAIL_RESPONSE)
    const residualTrailStrength = Math.max(
      targetStrength * 0.95,
      flutterUniforms.uTrailStrength.value * Math.exp(-delta * TRAIL_DECAY),
    )

    if (flutterUniforms.uFlutterCursor.value.x > 900) {
      flutterUniforms.uFlutterCursor.value.set(localCursorRef.current.x, localCursorRef.current.y)
      flutterUniforms.uTrailCursor.value.set(localCursorRef.current.x, localCursorRef.current.y)
    } else {
      flutterUniforms.uFlutterCursor.value.lerp(localCursorRef.current, cursorBlend)
      flutterUniforms.uTrailCursor.value.lerp(localCursorRef.current, trailBlend)
    }

    flutterUniforms.uFlutterStrength.value = THREE.MathUtils.lerp(
      flutterUniforms.uFlutterStrength.value,
      targetStrength,
      strengthBlend,
    )
    flutterUniforms.uTrailStrength.value = THREE.MathUtils.lerp(
      flutterUniforms.uTrailStrength.value,
      residualTrailStrength,
      trailBlend,
    )
    flutterUniforms.uTime.value = state.clock.elapsedTime
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