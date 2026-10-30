import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { useMemo, useRef, useCallback, useEffect } from 'react'
import { getSpringConfig } from '@/utils/springConfig'
import { getCachedGeometry, AnimatedMesh } from './OptimizedGeometry'
import { useGlobalRipple } from '@/hooks/useGlobalRipple'
import { applyBorderRippleShader as applySharedBorderRippleShader } from '@/utils/rippleShader'

// Même nuage que celui des projets sur l'accueil (cf. Projects.jsx)
const CLOUD_RANGE = 2
// Délai d'arrivée maximal : les projets arrivent avec 50 ms d'écart, soit ~700 ms pour 15 tuiles
const MAX_ARRIVAL_DELAY_MS = 700

const randomCloudPosition = () => [
  (Math.random() * 2 - 1) * CLOUD_RANGE,
  (Math.random() * 2 - 1) * CLOUD_RANGE,
  (Math.random() * 2 - 1) * CLOUD_RANGE,
]

const randomCloudRotation = () => [
  (Math.random() - 0.5) * Math.PI * 0.4,
  Math.random() * Math.PI * 2,
  (Math.random() - 0.5) * Math.PI * 0.4,
]

const BorderTile = ({ state, index, currentTheme, projectSize }) => {
  const meshRef = useRef(null)
  const materialRef = useRef(null)

  const rippleUniforms = useMemo(() => ({
    uRippleCursor: { value: new THREE.Vector2(999, 999) },
    uRippleStrength: { value: 0 },
    uRippleTint: { value: new THREE.Color('#eef4ff') },
    uTime: { value: 0 },
  }), [])

  const applyBorderRippleShader = useCallback((material) => {
    applySharedBorderRippleShader(material, rippleUniforms)
  }, [rippleUniforms])

  // Comme un projet : la bordure part d'une position et d'une rotation aléatoires du nuage
  // et rejoint sa place avec le même ressort.
  const [{ position, rotation }] = useSpring(() => ({
    from: { position: state.initialPosition, rotation: state.initialRotation },
    to: { position: state.position, rotation: [0, 0, 0] },
    delay: state.arrivalDelay,
    config: getSpringConfig('arrangement'),
  }))

  useGlobalRipple({
    targetRef: meshRef,
    projectSize,
    rippleUniforms,
  })

  useEffect(() => {
    if (materialRef.current) {
      applyBorderRippleShader(materialRef.current)
    }
  }, [applyBorderRippleShader])

  return (
    <animated.group
      key={`border-${index}`}
      position={position}
      rotation={rotation}
    >
      <AnimatedMesh
        projectId={`border-${index}`}
      >
        <mesh ref={meshRef} geometry={getCachedGeometry()} dispose={null}>
          <meshBasicMaterial
            ref={materialRef}
            side={THREE.DoubleSide}
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
  // Récupérer les positions des bordures depuis le store
  const { borderPositions, projectSize } = useProjectPositionsStore()

  // Positions de départ tirées à chaque ouverture d'un projet (le nuage change, comme celui de l'accueil)
  const borderStates = useMemo(() => {
    return borderPositions.map((pos) => ({
      position: pos,
      initialPosition: randomCloudPosition(),
      initialRotation: randomCloudRotation(),
      arrivalDelay: Math.random() * MAX_ARRIVAL_DELAY_MS,
    }))
    // isProjectsArranged : nouveau tirage à chaque ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borderPositions, isProjectsArranged])

  if (!isProjectsArranged || borderStates.length === 0) return null

  return (
    <group position={[0, 0, distance]}>
      {borderStates.map((state, index) => (
        <BorderTile
          key={`border-${index}`}
          index={index}
          state={state}
          currentTheme={currentTheme}
          projectSize={projectSize}
        />
      ))}
    </group>
  )
}

export default ProjectBorders
