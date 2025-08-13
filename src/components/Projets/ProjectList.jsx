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
            if (el?.frontMeshRef?.current && el?.backMeshRef?.current && el?.overlayGroupRef?.current) {
              // S'assurer que l'objet existe
              if (!projectMeshesRef.current[i]) {
                projectMeshesRef.current[i] = { front: null, back: null, overlayGroupRef: null }
              }
              // Assigner les deux meshes et le groupe d'overlays
              projectMeshesRef.current[i].front = el.frontMeshRef.current
              projectMeshesRef.current[i].back = el.backMeshRef.current
              projectMeshesRef.current[i].overlayGroupRef = el.overlayGroupRef.current
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