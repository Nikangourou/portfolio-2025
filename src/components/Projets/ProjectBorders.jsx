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

// Départ côté transparent, de travers comme les projets du nuage
const randomCloudRotation = () => [
  (Math.random() - 0.5) * 0.6,
  (Math.random() - 0.5) * 1.6,
  (Math.random() - 0.5) * 0.6,
]

// La bordure rejoint d'abord sa place à plat, puis se retourne sur place (comme les projets) :
// ce délai court après son arrivée laisse le temps au ressort de se poser.
const FLIP_AFTER_ARRIVAL_MS = 650
const FLIP_JITTER_MS = 250
const noRaycast = () => null

const BorderTile = ({
  state,
  index,
  currentTheme,
  projectSize,
  isProjectsArranged,
  outlineGeometry,
  outlineMaterial,
  spin,
}) => {
  const spinAngle = spin

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

  // La bordure vit dans le nuage de l'accueil et rejoint sa place à l'ouverture d'un projet avec le même ressort
  // que les projets (position et inclinaison), puis se retourne sur place (`flip` de 0 à π).
  const { position, tilt } = useSpring({
    position: isProjectsArranged ? state.position : state.initialPosition,
    tilt: isProjectsArranged ? [0, 0, 0] : state.initialRotation,
    delay: isProjectsArranged ? state.arrivalDelay : 0,
    config: isProjectsArranged ? getSpringConfig('arrangement') : getSpringConfig('smooth'),
  })

  const { flip } = useSpring({
    flip: isProjectsArranged ? Math.PI : 0,
    delay: isProjectsArranged ? state.arrivalDelay + FLIP_AFTER_ARRIVAL_MS + state.flipJitter : 0,
    config: getSpringConfig('projectRotation'),
    onChange: (values) => {
      const flipped = values.value.flip > Math.PI / 2
      setIsFlipped((previous) => (previous === flipped ? previous : flipped))
    },
  })

  // À la fermeture, la bordure repart de son côté transparent : l'état « retourné » ne doit pas rester d'une
  // ouverture à la suivante, sinon la tuile pleine s'afficherait dès le clic.
  useEffect(() => {
    if (!isProjectsArranged) setIsFlipped(false)
  }, [isProjectsArranged])

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
      rotation-y={spinAngle}
    >
    <animated.group rotation={tilt}>
    <animated.group rotation-x={flip}>
      {/* Sur l'accueil : un simple contour (une tuile pleine masquerait les cartes derrière) */}
      {!isTileShown && (
        <lineLoop geometry={outlineGeometry} material={outlineMaterial} />
      )}
      <AnimatedMesh
        projectId={`border-${index}`}
      >
        {/* Reste dans la scène mais n'écrit rien tant que la tuile n'est pas retournée : le shader est déjà compilé
            au moment du flip. */}
        <mesh
          ref={meshRef}
          geometry={getCachedGeometry()}
          dispose={null}
          raycast={isTileShown ? THREE.Mesh.prototype.raycast : noRaycast}
        >
          <meshBasicMaterial
            ref={materialRef}
            colorWrite={isTileShown}
            depthWrite={isTileShown}
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
    </animated.group>
    </animated.group>
  )
}

// Rendu dans le groupe des projets (ProjectList), pour tourner avec le nuage de l'accueil
const ProjectBorders = ({ spin }) => {
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
  const currentTheme = useThemeStore((state) => state.currentTheme)

  // Récupérer les positions des bordures depuis le store
  const { borderPositions, projectSize, cloudPositions } = useProjectPositionsStore()
  const { tileCount } = useGridConfig()

  // Tirages aléatoires des bordures (inclinaison, délais) : gardés tant que leur nombre ne change pas
  const randomBorderData = useMemo(() => {
    return borderPositions.map(() => ({
      initialRotation: randomCloudRotation(),
      arrivalDelay: Math.random() * MAX_ARRIVAL_DELAY_MS,
      flipJitter: Math.random() * FLIP_JITTER_MS,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borderPositions.length])

  // Positions de départ dans le nuage : après celles des tuiles des projets, dans la même répartition
  const borderStates = useMemo(() => {
    return borderPositions.map((pos, index) => ({
      position: pos,
      initialPosition: cloudPositions[tileCount + index] || [0, 0, 0],
      ...randomBorderData[index],
    }))
  }, [borderPositions, cloudPositions, tileCount, randomBorderData])

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
          spin={spin}
        />
      ))}
    </group>
  )
}

export default ProjectBorders
