import { useSprings, animated } from '@react-spring/three'
import * as THREE from 'three'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { useStore } from '@/stores/store'
import { useMemo, useRef, useCallback, useEffect, useState } from 'react'
import { getSpringConfig } from '@/utils/springConfig'
import { getCachedGeometry, AnimatedMesh } from './OptimizedGeometry'
import { useGlobalRipple } from '@/hooks/useGlobalRipple'
import { applyBorderRippleShader as applySharedBorderRippleShader } from '@/utils/rippleShader'

const BorderTile = ({ spring, state, index, currentTheme, projectSize, isDoubleSided }) => {
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