import Project from './Project'
import { animated, useSpring } from '@react-spring/three'
import { useRotationControl } from '@/hooks/useRotationControl'
import { getSpringConfig } from '@/utils/springConfig'

const ProjectList = ({
  projectStates,
  projectGroupsRef,
  groupRef,
  distance
}) => {
  const { rotationY } = useRotationControl() // Rotation cible déjà calculée dans le hook
  
  const { rotationY: animatedRotationY } = useSpring({
    rotationY,
    config: getSpringConfig('globalRotation')
  })

  return (
    <animated.group 
      ref={groupRef} 
      position={[0, 0, distance]}
      rotation-y={animatedRotationY}
    >
      {projectStates.map((state, i) => {
        return (
          <Project
            key={state.project.id}
            ref={(el) => {
              projectGroupsRef.current[i] = el
            }}
            gridPosition={i}
            image={state.project.cover}
            initialPosition={state.initialPosition}
            initialRotation={state.initialRotation}
          />
        )
      })}
    </animated.group>
  )
}

export default ProjectList 