import React from 'react'
import Project from './Project'

const ProjectList = ({
  projectStates,
  projectMeshesRef,
  groupRef,
  distance
}) => {
  return (
    <group ref={groupRef} position={[0, 0, distance]}>
      {projectStates.map((state, i) => (
        <Project
          key={state.project.id}
          ref={(el) => {
            if (el?.projectRef?.current) {
              if (!projectMeshesRef.current[i]) {
                projectMeshesRef.current[i] = { projectRef: null }
              }
              projectMeshesRef.current[i].projectRef = el.projectRef.current
            }
          }}
          gridPosition={i}
          initialPosition={state.position}
          initialRotation={[
            state.rotation[0] + (state.pageRotationX || 0),
            state.rotation[1],
            state.rotation[2],
          ]}
          image={state.project.cover}
        />
      ))}
    </group>
  )
}

export default ProjectList 