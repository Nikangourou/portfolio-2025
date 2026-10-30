import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { useStore } from '@/stores/store'
import useThemeStore from '@/stores/themeStore'
import { useMemo, useRef, useCallback, useEffect, useState } from 'react'
import { getSpringConfig } from '@/utils/springConfig'
import { getCachedGeometry, AnimatedMesh } from './OptimizedGeometry'
import { useGlobalRipple } from '@/hooks/useGlobalRipple'
import { useGridConfig } from '@/hooks/useGridConfig'
import { applyBorderRippleShader as applySharedBorderRippleShader } from '@/utils/rippleShader'

// Délai d'arrivée maximal : les projets arrivent avec 50 ms d'écart, soit ~700 ms pour 15 tuiles
const MAX_ARRIVAL_DELAY_MS = 700
// Contour d'une bordure sur l'accueil : un trait fin et discret, sans remplissage
const OUTLINE_COLOR = '#000000'
const OUTLINE_OPACITY = 0.2

// Départ côté transparent (x proche de 0) : la tuile se retourne en x jusqu'à π pour montrer sa face pleine.
// Les autres axes restent modérés pour que le retournement se lise bien.
const randomCloudRotation = () => [
  (Math.random() - 0.5) * 0.6,
  (Math.random() - 0.5) * 1.6,
  (Math.random() - 0.5) * 0.6,
]

// Rotation d'arrivée : retournée, la face pleine est face à la caméra
const FLIPPED_ROTATION = [Math.PI, 0, 0]

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

  // La tuile a deux côtés : transparent (on ne voit que son contour) et plein. Elle part côté transparent,
  // se retourne en rejoignant sa place, et le côté plein apparaît quand le retournement passe la moitié.
  const [isFlipped, setIsFlipped] = useState(false)

  // Comme un projet : la bordure vit dans le nuage de l'accueil, rejoint sa place à l'ouverture
  // d'un projet avec le même ressort, et retourne dans le nuage à la fermeture.
  const { position, rotation } = useSpring({
    from: { position: state.initialPosition, rotation: state.initialRotation },
    to: {
      position: isProjectsArranged ? state.position : state.initialPosition,
      rotation: isProjectsArranged ? FLIPPED_ROTATION : state.initialRotation,
    },
    delay: isProjectsArranged ? state.arrivalDelay : 0,
    config: (key) => {
      // Le retournement a le même ressort que celui des pages des projets
      if (key === 'rotation') return getSpringConfig('projectRotation')
      return isProjectsArranged ? getSpringConfig('arrangement') : getSpringConfig('smooth')
    },
    onChange: (values) => {
      const flipped = values.value.rotation[0] > Math.PI / 2
      setIsFlipped((previous) => (previous === flipped ? previous : flipped))
    },
  })

  const isTileShown = isProjectsArranged && isFlipped

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
      {!isTileShown && (
        <lineLoop geometry={outlineGeometry} material={outlineMaterial} />
      )}
      <AnimatedMesh
        projectId={`border-${index}`}
      >
        <mesh ref={meshRef} geometry={getCachedGeometry()} dispose={null} visible={isTileShown}>
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
  const { borderPositions, projectSize, cloudPositions } = useProjectPositionsStore()
  const { tileCount } = useGridConfig()

  // Positions de départ dans le nuage : après celles des tuiles des projets, dans la même répartition
  const borderStates = useMemo(() => {
    return borderPositions.map((pos, index) => ({
      position: pos,
      initialPosition: cloudPositions[tileCount + index] || [0, 0, 0],
      initialRotation: randomCloudRotation(),
      arrivalDelay: Math.random() * MAX_ARRIVAL_DELAY_MS,
    }))
  }, [borderPositions, cloudPositions, tileCount])

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
