import { useSprings, animated, config } from '@react-spring/three'
import * as THREE from 'three'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { useStore } from '@/stores/store'
import { useMemo } from 'react'
import { getSpringConfig } from '@/utils/springConfig'

const ProjectBorders = ({
  isProjectsArranged,
  projectSize,
  currentTheme,
  distance
}) => {

  // Récupérer les positions des bordures depuis le store
  const { borderPositions } = useProjectPositionsStore()
  
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

  // Utiliser useSprings avec des délais individuels pour chaque bordure
  const springs = useSprings(
    borderStates?.length || 0,
    borderStates?.map((_, index) => ({
      rotation: isArrangementAnimationComplete ? [Math.PI, 0, 0] : [0, 0, 0],
      delay: isArrangementAnimationComplete ? Math.random() * 1000 : 0, // Délai aléatoire jusqu'à 1s
      config: getSpringConfig('projectRotation')
    })) || []
  )

  if (!isProjectsArranged || !borderStates || borderStates.length === 0) return null

  return (
    <group position={[0, 0, distance]}>
      {springs.map((spring, index) => {
        const state = borderStates[index]

        return (
          <animated.mesh
            key={`border-${index}`}
            position={state.position}
            rotation={spring.rotation}
          >
            <planeGeometry args={[projectSize.width, projectSize.height]} />
            <meshBasicMaterial
              side={THREE.BackSide}
              color={currentTheme.background}
              opacity={1}
              transparent={true}
            />
          </animated.mesh>
        )
      })}
    </group>
  )
}

export default ProjectBorders 