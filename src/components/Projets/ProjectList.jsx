import Project from './Project'
import { animated, useSpring, config } from '@react-spring/three'
import { useRotationControl } from '@/hooks/useRotationControl'

const ProjectList = ({
  projectStates,
  projectMeshesRef,
  groupRef,
  distance
}) => {
  const { rotationY } = useRotationControl() // Rotation cible déjà calculée dans le hook
  
  const { rotationY: animatedRotationY } = useSpring({
    rotationY,
    config: config.molasses
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
              if (el?.projectRef?.current) {
                projectMeshesRef.current[i] = el.projectRef.current
              } else {
                projectMeshesRef.current[i] = null
              }
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