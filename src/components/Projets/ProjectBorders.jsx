import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { useStore } from '@/stores/store'
import useThemeStore from '@/stores/themeStore'
import { useMemo, useRef, useCallback, useEffect } from 'react'
import { getSpringConfig } from '@/utils/springConfig'
import { getCachedGeometry, AnimatedMesh } from './OptimizedGeometry'
import { useGlobalRipple } from '@/hooks/useGlobalRipple'
import { applyBorderRippleShader as applySharedBorderRippleShader } from '@/utils/rippleShader'

// Même nuage que celui des projets sur l'accueil (cf. Projects.jsx)
const CLOUD_RANGE = 2
// Délai d'arrivée maximal : les projets arrivent avec 50 ms d'écart, soit ~700 ms pour 15 tuiles
const MAX_ARRIVAL_DELAY_MS = 700
// Contour d'une bordure sur l'accueil : un trait fin et discret, sans remplissage
const OUTLINE_COLOR = '#000000'
const OUTLINE_OPACITY = 0.2

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

const BorderTile = ({
  state,
  index,
  currentTheme,
  projectSize,
  isProjectsArranged,
  outlineGeometry,
  outlineMaterial,
}) => {
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

  // Comme un projet : la bordure vit dans le nuage de l'accueil, rejoint sa place à l'ouverture
  // d'un projet avec le même ressort, et retourne dans le nuage à la fermeture.
  const { position, rotation } = useSpring({
    from: { position: state.initialPosition, rotation: state.initialRotation },
    to: {
      position: isProjectsArranged ? state.position : state.initialPosition,
      rotation: isProjectsArranged ? [0, 0, 0] : state.initialRotation,
    },
    delay: isProjectsArranged ? state.arrivalDelay : 0,
    config: isProjectsArranged ? getSpringConfig('arrangement') : getSpringConfig('smooth'),
  })

  useGlobalRipple({
    targetRef: meshRef,
    projectSize,
    rippleUniforms,
    enabled: isProjectsArranged,
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
      {/* Sur l'accueil : un simple contour (une tuile pleine masquerait les cartes derrière) */}
      {!isProjectsArranged && (
        <lineLoop geometry={outlineGeometry} material={outlineMaterial} />
      )}
      <AnimatedMesh
        projectId={`border-${index}`}
      >
        <mesh ref={meshRef} geometry={getCachedGeometry()} dispose={null} visible={isProjectsArranged}>
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

// Rendu dans le groupe des projets (ProjectList), pour tourner avec le nuage de l'accueil
const ProjectBorders = () => {
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
  const currentTheme = useThemeStore((state) => state.currentTheme)

  // Récupérer les positions des bordures depuis le store
  const { borderPositions, projectSize } = useProjectPositionsStore()

  // Positions de départ dans le nuage : tirées une fois, comme celles des projets
  const borderStates = useMemo(() => {
    return borderPositions.map((pos) => ({
      position: pos,
      initialPosition: randomCloudPosition(),
      initialRotation: randomCloudRotation(),
      arrivalDelay: Math.random() * MAX_ARRIVAL_DELAY_MS,
    }))
  }, [borderPositions])

  // Contour et matériau partagés par toutes les bordures
  const outlineGeometry = useMemo(() => {
    const halfWidth = projectSize.width / 2
    const halfHeight = projectSize.height / 2
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, halfHeight, 0),
      new THREE.Vector3(-halfWidth, halfHeight, 0),
    ])
  }, [projectSize.width, projectSize.height])

  const outlineMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: OUTLINE_COLOR,
    transparent: true,
    opacity: OUTLINE_OPACITY,
    depthWrite: false,
  }), [])

  useEffect(() => () => outlineGeometry.dispose(), [outlineGeometry])
  useEffect(() => () => outlineMaterial.dispose(), [outlineMaterial])

  return (
    <group>
      {borderStates.map((state, index) => (
        <BorderTile
          key={`border-${index}`}
          index={index}
          state={state}
          currentTheme={currentTheme}
          projectSize={projectSize}
          isProjectsArranged={isProjectsArranged}
          outlineGeometry={outlineGeometry}
          outlineMaterial={outlineMaterial}
        />
      ))}
    </group>
  )
}

export default ProjectBorders
