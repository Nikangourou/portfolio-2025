import { useSprings, animated } from '@react-spring/three'
import * as THREE from 'three'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { useStore } from '@/stores/store'
import { useMemo, useRef, useCallback, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { getSpringConfig } from '@/utils/springConfig'
import { getCachedGeometry, AnimatedMesh } from './OptimizedGeometry'
import { getGlobalCanvasPointerState, subscribeGlobalCanvasPointerState } from '@/utils/globalPointerTracker'

const CURSOR_RESPONSE = 9
const RIPPLE_RESPONSE = 7.2

const BorderTile = ({ spring, state, index, currentTheme, projectSize, isDoubleSided }) => {
  const meshRef = useRef(null)
  const materialRef = useRef(null)
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
  const canvasPointerStateRef = useRef(null)
  const { camera, pointer, gl } = useThree()

  const rippleUniforms = useMemo(() => ({
    uRippleCursor: { value: new THREE.Vector2(999, 999) },
    uRippleStrength: { value: 0 },
    uRippleTint: { value: new THREE.Color('#eef4ff') },
    uTime: { value: 0 },
  }), [])

  const applyBorderRippleShader = useCallback((material) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uRippleCursor = rippleUniforms.uRippleCursor
      shader.uniforms.uRippleStrength = rippleUniforms.uRippleStrength
      shader.uniforms.uRippleTint = rippleUniforms.uRippleTint
      shader.uniforms.uTime = rippleUniforms.uTime

      shader.vertexShader = `
        uniform vec2 uRippleCursor;
        uniform float uRippleStrength;
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
          float cursorField = smoothstep(1.45, 0.0, cursorDistance) * uRippleStrength;
          float rippleField = cursorField;

          vec2 cursorVector = position.xy - uRippleCursor;
          float cursorRadius = max(length(cursorVector), 0.0001);
          vec2 cursorDirection = cursorVector / cursorRadius;

          float cursorRipple = sin(cursorRadius * 20.0 - uTime * 9.0);
          float cursorEnvelope = exp(-cursorRadius * 2.8);
          float sheetBias = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * 2.0 - 1.0) * 0.55);
          float ripple = cursorRipple * cursorEnvelope * cursorField;
          float bend = ripple * (0.08 + sheetBias * 0.06);

          transformed.z += bend;
          transformed.x += cursorDirection.x * rippleField * 0.025 * cursorEnvelope;
          transformed.y += cursorDirection.y * rippleField * 0.025 * cursorEnvelope;

          vRippleMask = clamp(abs(ripple) * 2.2 + rippleField * 0.3, 0.0, 1.0);
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
          vec3 rippleTint = mix(gl_FragColor.rgb, uRippleTint, rippleHighlight * (0.14 + shimmer * 0.06));

          gl_FragColor.rgb = mix(gl_FragColor.rgb, rippleTint, rippleHighlight * 0.46);
          gl_FragColor.rgb += ringLine * rippleHighlight * 0.08;

          #include <dithering_fragment>
        `,
      )
    }

    material.customProgramCacheKey = () => 'border-pressure-ripple-v3'
    material.needsUpdate = true
  }, [rippleUniforms])

  useEffect(() => {
    const canvas = gl?.domElement
    canvasPointerStateRef.current = getGlobalCanvasPointerState(canvas)
    return subscribeGlobalCanvasPointerState(canvas)
  }, [gl])

  useFrame((frameState, delta) => {
    if (!meshRef.current) {
      return
    }

    const canvasPointerState = canvasPointerStateRef.current
    const activePointer = canvasPointerState?.hasPointer
      ? canvasPointerState.pointer
      : pointer
    const hasGlobalPointer = !!canvasPointerState?.hasPointer
    const isPointerInsideCanvas = hasGlobalPointer
      ? !!canvasPointerState?.isInsideCanvas
      : true

    const previousPointer = previousPointerRef.current

    if (!hasPointerSampleRef.current) {
      previousPointer.set(activePointer.x, activePointer.y)
      hasPointerSampleRef.current = true
    }

    previousPointer.set(activePointer.x, activePointer.y)

    meshRef.current.getWorldPosition(planeOriginRef.current)
    meshRef.current.getWorldQuaternion(planeQuaternionRef.current)
    planeNormalRef.current.set(0, 0, 1)
      .applyQuaternion(planeQuaternionRef.current)
      .normalize()

    worldPlaneRef.current.setFromNormalAndCoplanarPoint(
      planeNormalRef.current,
      planeOriginRef.current,
    )

    if (!isPointerInsideCanvas) {
      rippleUniforms.uRippleStrength.value = THREE.MathUtils.lerp(
        rippleUniforms.uRippleStrength.value,
        0,
        1 - Math.exp(-delta * RIPPLE_RESPONSE),
      )
      rippleUniforms.uTime.value = frameState.clock.elapsedTime
      return
    }

    raycasterRef.current.setFromCamera(activePointer, camera)
    const hasIntersection = raycasterRef.current.ray.intersectPlane(
      worldPlaneRef.current,
      hitPointRef.current,
    )

    if (!hasIntersection) {
      rippleUniforms.uRippleStrength.value = THREE.MathUtils.lerp(
        rippleUniforms.uRippleStrength.value,
        0,
        1 - Math.exp(-delta * RIPPLE_RESPONSE),
      )
      rippleUniforms.uTime.value = frameState.clock.elapsedTime
      return
    }

    localCursorRef.current.copy(hitPointRef.current)
    meshRef.current.worldToLocal(localCursorRef.current)

    const halfWidth = projectSize.width * 0.5
    const halfHeight = projectSize.height * 0.5
    const normalizedX = localCursorRef.current.x / halfWidth
    const normalizedY = localCursorRef.current.y / halfHeight
    const isCursorInsideSheet = Math.abs(normalizedX) <= 1 && Math.abs(normalizedY) <= 1

    if (!isCursorInsideSheet) {
      rippleUniforms.uRippleStrength.value = THREE.MathUtils.lerp(
        rippleUniforms.uRippleStrength.value,
        0,
        1 - Math.exp(-delta * RIPPLE_RESPONSE),
      )
      rippleUniforms.uTime.value = frameState.clock.elapsedTime
      return
    }

    const radialDistance = Math.sqrt(
      normalizedX * normalizedX + normalizedY * normalizedY,
    )
    const cursorInfluence = THREE.MathUtils.clamp(1 - radialDistance, 0, 1)
    projectedCenterRef.current.copy(planeOriginRef.current).project(camera)

    const pointerToProjectX = activePointer.x - projectedCenterRef.current.x
    const pointerToProjectY = activePointer.y - projectedCenterRef.current.y
    const screenDistance = Math.sqrt(
      pointerToProjectX * pointerToProjectX +
      pointerToProjectY * pointerToProjectY,
    )
    const screenInfluence = THREE.MathUtils.clamp(1 - screenDistance / 0.72, 0, 1)
    const targetStrength = Math.max(cursorInfluence, screenInfluence * 0.62)
    const cursorBlend = 1 - Math.exp(-delta * CURSOR_RESPONSE)
    const strengthBlend = 1 - Math.exp(-delta * RIPPLE_RESPONSE)

    if (rippleUniforms.uRippleCursor.value.x > 900) {
      rippleUniforms.uRippleCursor.value.set(localCursorRef.current.x, localCursorRef.current.y)
    } else {
      rippleUniforms.uRippleCursor.value.lerp(localCursorRef.current, cursorBlend)
    }

    rippleUniforms.uRippleStrength.value = THREE.MathUtils.lerp(
      rippleUniforms.uRippleStrength.value,
      targetStrength,
      strengthBlend,
    )
    rippleUniforms.uTime.value = frameState.clock.elapsedTime
  })

  useEffect(() => {
    if (materialRef.current) {
      applyBorderRippleShader(materialRef.current)
    }
  }, [applyBorderRippleShader])

  return (
    <animated.group
      key={`border-${index}`}
      position={state.position}
      rotation={spring.rotation}
    >
      <AnimatedMesh
        projectId={`border-${index}`}
      >
        <mesh ref={meshRef}>
          <primitive object={getCachedGeometry().clone()} />
          <meshBasicMaterial
            ref={materialRef}
            side={isDoubleSided ? THREE.DoubleSide : THREE.BackSide}
            color={currentTheme.background}
            onUpdate={(material) => {
              if (!material.userData.shaderSetup) {
                applyBorderRippleShader(material)
                material.userData.shaderSetup = true
              }
            }}
          />
        </mesh>
      </AnimatedMesh>
    </animated.group>
  )
}

const ProjectBorders = ({
  isProjectsArranged,
  currentTheme,
  distance
}) => {
  const [areBordersDoubleSided, setAreBordersDoubleSided] = useState(false)

  // Récupérer les positions des bordures depuis le store
  const { borderPositions, projectSize } = useProjectPositionsStore()

  // Créer les borderStates avec rotation à partir des positions
  const borderStates = useMemo(() => {
    return borderPositions.map((pos) => ({
      position: pos,
      rotation: [0, 0, 0],
    }))
  }, [borderPositions])

  // États du store
  const isArrangementAnimationComplete = useStore(
    (state) => state.isArrangementAnimationComplete
  )

  useEffect(() => {
    if (!isProjectsArranged || !isArrangementAnimationComplete) {
      setAreBordersDoubleSided(false)
      return
    }

    // Delai global: max delay (~1000ms) + marge d'animation.
    const timer = setTimeout(() => {
      setAreBordersDoubleSided(true)
    }, 1300)

    return () => clearTimeout(timer)
  }, [isProjectsArranged, isArrangementAnimationComplete])


  // Utiliser useSprings avec des délais individuels pour chaque bordure
  const springs = useSprings(
    borderStates?.length || 0,
    borderStates?.map((_, index) => ({
      rotation: isArrangementAnimationComplete ? [Math.PI, 0, 0] : [0, 0, 0],
      delay: isArrangementAnimationComplete ? Math.random() * 1000 : 0, // Délai aléatoire jusqu'à 1s
      config: getSpringConfig('projectRotation'),
    })) || []
  )

  if (!isProjectsArranged || !borderStates || borderStates.length === 0) return null

  return (
    <group position={[0, 0, distance]}>
      {springs.map((spring, index) => {
        const state = borderStates[index]

        return (
          <BorderTile
            key={`border-${index}`}
            index={index}
            spring={spring}
            state={state}
            currentTheme={currentTheme}
            projectSize={projectSize}
            isDoubleSided={areBordersDoubleSided}
          />
        )
      })}
    </group>
  )
}

export default ProjectBorders 