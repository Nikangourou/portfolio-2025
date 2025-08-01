import React from 'react'
import * as THREE from 'three'

const ProjectBorders = ({
  isProjectsArranged,
  borderStates,
  projectSize,
  currentTheme,
  distance
}) => {
  if (!isProjectsArranged) return null

  return (
    <group position={[0, 0, distance]}>
      {borderStates.map((state, index) => (
        <mesh
          key={`square-${index}`}
          position={state.position}
          rotation={state.rotation}
        >
          <planeGeometry args={[projectSize.width, projectSize.height]} />
          <meshBasicMaterial
            side={THREE.BackSide}
            color={currentTheme.background}
            opacity={1}
            transparent={true}
          />
        </mesh>
      ))}
    </group>
  )
}

export default ProjectBorders 