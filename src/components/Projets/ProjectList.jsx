import { memo } from 'react'
import { useThree } from '@react-three/fiber'
import Project from './Project'
import ProjectBorders from './ProjectBorders'
import { animated, useSpring } from '@react-spring/three'
import { useRotationControl } from '@/hooks/useRotationControl'
import { getSpringConfig } from '@/utils/springConfig'
import { getDiagonalAxisAngle } from '@/utils/cloudLayout'

// Image 1x1 blanche des tuiles vides (pas de projet derrière : elles ne servent qu'à la page projet)
const FILLER_IMAGE = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, 1, 1)
  return canvas.toDataURL()
})()

const ProjectList = memo(({
  projectStates,
  projectGroupsRef,
  groupRef,
  distance
}) => {
  const { rotationY } = useRotationControl() // Rotation cible déjà calculée dans le hook
  const size = useThree((state) => state.size)
  const diagonalAngle = getDiagonalAxisAngle(size.width / size.height)
  
  const { rotationY: animatedRotationY } = useSpring({
    rotationY,
    config: getSpringConfig('globalRotation')
  })

  return (
    // Trois groupes imbriqués pour tourner autour de la diagonale de l'écran : le premier couche l'axe Y le long
    // de la diagonale, le deuxième porte la rotation de la molette, le troisième remet le contenu à l'endroit.
    <group position={[0, 0, distance]} rotation-z={diagonalAngle}>
    <animated.group ref={groupRef} rotation-y={animatedRotationY}>
    <group rotation-z={-diagonalAngle}>
      <ProjectBorders />
      {projectStates.map((state, i) => {
        return (
          <Project
            key={state.project?.id ?? `tile-${i}`}
            ref={(el) => {
              // Les tuiles vides ne doivent jamais être survolables sur l'accueil
              projectGroupsRef.current[i] = state.project ? el : null
            }}
            gridPosition={i}
            isFiller={!state.project}
            image={state.project?.cover ?? FILLER_IMAGE}
            initialPosition={state.initialPosition}
            initialRotation={state.initialRotation}
          />
        )
      })}
    </group>
    </animated.group>
    </group>
  )
})

export default ProjectList