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
          image={state.project.cover}
        />
      ))}
    </group>
  )
}

export default ProjectList 