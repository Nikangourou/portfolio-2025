import React from 'react'
import Project from './Project'

const ProjectList = ({
  projectStates,
  projectMeshesRef,
  camera,
  handleProjectHover,
  setHoveredProject,
  groupRef,
  distance
}) => {
  return (
    <group ref={groupRef} position={[0, 0, distance]}>
      {projectStates.map((state, i) => (
        <Project
          key={state.project.id}
          ref={(el) => {
            if (el?.frontMeshRef?.current && el?.backMeshRef?.current) {
              // S'assurer que l'objet existe
              if (!projectMeshesRef.current[i]) {
                projectMeshesRef.current[i] = { front: null, back: null }
              }
              // Assigner les deux meshes
              projectMeshesRef.current[i].front = el.frontMeshRef.current
              projectMeshesRef.current[i].back = el.backMeshRef.current
            }
          }}
          gridPosition={i}
          position={state.position}
          rotation={[
            state.rotation[0] + (state.pageRotationX || 0),
            state.rotation[1],
            state.rotation[2],
          ]}
          camera={camera}
          image={state.project.cover}
          project={state.project}
          onProjectHover={() => handleProjectHover(state.project)}
          onProjectUnhover={() => setHoveredProject(null)}
        />
      ))}
    </group>
  )
}

export default ProjectList 