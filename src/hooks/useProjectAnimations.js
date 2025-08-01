import * as THREE from 'three'
import { useStore } from '../stores/store'

export function useProjectAnimations() {
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)

  const animateProjects = (
    projectStates,
    setProjectStates,
    targetStates,
    rotatingProjects,
    animatingProjects,
    baseSpeed = 3,
    delta = 0.016
  ) => {
    if (projectStates.length === 0 || targetStates.length === 0) return

    // Calculer la vitesse adaptée au delta time
    const adaptiveSpeed = Math.min(baseSpeed * delta, 0.1) // Limiter à 0.1 pour éviter les sauts

    setProjectStates((prevStates) => {
      return prevStates.map((state, index) => {
        const target = targetStates[index]

        // Si le projet n'est pas encore en cours d'animation, garder sa position actuelle
        if (isProjectsArranged && !animatingProjects.has(index)) {
          return state
        }

        // Interpolation linéaire pour la position avec une vitesse adaptée
        const newX = THREE.MathUtils.lerp(
          state.position[0],
          target.position[0],
          adaptiveSpeed,
        )
        const newY = THREE.MathUtils.lerp(
          state.position[1],
          target.position[1],
          adaptiveSpeed,
        )
        const newZ = THREE.MathUtils.lerp(
          state.position[2],
          target.position[2],
          adaptiveSpeed,
        )

        // Rotation cible basée sur si le projet doit tourner
        const targetRotation = rotatingProjects.has(index)
          ? [Math.PI, 0, 0]
          : target.rotation

        // Interpolation avec chemin le plus court pour chaque axe
        const getShortestRotationPath = (current, target) => {
          const normalizedCurrent = ((current + Math.PI) % (2 * Math.PI)) - Math.PI
          const normalizedTarget = ((target + Math.PI) % (2 * Math.PI)) - Math.PI
          
          let shortestPath = normalizedTarget - normalizedCurrent
          if (Math.abs(shortestPath) > Math.PI) {
            shortestPath = shortestPath > 0 
              ? shortestPath - 2 * Math.PI 
              : shortestPath + 2 * Math.PI
          }
          return current + shortestPath * adaptiveSpeed
        }

        const newRotX = getShortestRotationPath(state.rotation[0], targetRotation[0])
        const newRotY = getShortestRotationPath(state.rotation[1], targetRotation[1])
        const newRotZ = getShortestRotationPath(state.rotation[2], targetRotation[2])

        // Interpolation pour la rotation X de page
        let newPageRotationX = state.pageRotationX
        if (
          typeof state.targetPageRotationX === 'number' &&
          Math.abs(state.pageRotationX - state.targetPageRotationX) > 0.01
        ) {
          newPageRotationX = THREE.MathUtils.lerp(
            state.pageRotationX,
            state.targetPageRotationX,
            adaptiveSpeed,
          )
        } else if (typeof state.targetPageRotationX === 'number') {
          newPageRotationX = state.targetPageRotationX
        }

        return {
          ...state,
          position: [newX, newY, newZ],
          rotation: [newRotX, newRotY, newRotZ],
          pageRotationX: newPageRotationX,
          targetPageRotationX: state.targetPageRotationX,
        }
      })
    })
  }

  const animateBorders = (
    borderStates,
    setBorderStates,
    rotatingBorders,
    baseSpeed = 3,
    delta = 0.016
  ) => {
    const adaptiveSpeed = Math.min(baseSpeed * delta, 0.1)

    setBorderStates((prevStates) => {
      return prevStates.map((state, index) => {
        const targetRotation = rotatingBorders.has(index)
          ? [Math.PI, 0, 0]
          : [0, 0, 0]

        // Interpolation linéaire pour la rotation
        const newRotX = THREE.MathUtils.lerp(
          state.rotation[0],
          targetRotation[0],
          adaptiveSpeed,
        )
        const newRotY = THREE.MathUtils.lerp(
          state.rotation[1],
          targetRotation[1],
          adaptiveSpeed,
        )
        const newRotZ = THREE.MathUtils.lerp(
          state.rotation[2],
          targetRotation[2],
          adaptiveSpeed,
        )

        return {
          ...state,
          rotation: [newRotX, newRotY, newRotZ],
        }
      })
    })
  }

  const animateGroupRotation = (
    groupRef,
    rotationY,
    isProjectsArranged,
    baseSpeed = 3,
    delta = 0.016
  ) => {
    if (!groupRef.current) return

    const currentRotation = groupRef.current.rotation.y
    const targetRotation = isProjectsArranged ? 0 : rotationY

    // Normaliser les rotations entre -π et π
    const normalizedCurrent =
      ((currentRotation + Math.PI) % (2 * Math.PI)) - Math.PI
    const normalizedTarget =
      ((targetRotation + Math.PI) % (2 * Math.PI)) - Math.PI

    // Trouver le chemin le plus court vers la rotation cible
    let shortestPath = normalizedTarget - normalizedCurrent
    if (Math.abs(shortestPath) > Math.PI) {
      shortestPath =
        shortestPath > 0
          ? shortestPath - 2 * Math.PI
          : shortestPath + 2 * Math.PI
    }

    const adaptiveSpeed = Math.min(baseSpeed * delta, 0.1)
    groupRef.current.rotation.y =
      currentRotation + shortestPath * adaptiveSpeed
  }

  return {
    animateProjects,
    animateBorders,
    animateGroupRotation,
  }
} 