import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'

const ProjectBorders = ({
  isProjectsArranged,
  borderStates,
  projectSize,
  currentTheme,
  distance,
  borderMeshesRef
}) => {
  // Nettoyer les refs quand le composant se démonte ou change
  useEffect(() => {
    if (!isProjectsArranged) {
      borderMeshesRef.current = []
    }
  }, [isProjectsArranged])

  if (!isProjectsArranged) return null

  return (
    <group position={[0, 0, distance]}>
      {borderStates.map((state, index) => (
        <mesh
          key={`square-${index}`}
          ref={(el) => {
            if (el && borderMeshesRef) {
              // Toujours assigner la ref, même si elle existe déjà
              borderMeshesRef.current[index] = el
              // Initialiser la position et rotation
              el.position.set(...state.position)
              el.rotation.set(...state.rotation)
            }
          }}
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