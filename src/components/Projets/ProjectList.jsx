import { memo } from 'react'
import Project from './Project'
import ProjectBorders from './ProjectBorders'
import { useSpring } from '@react-spring/three'
import { useRotationControl } from '@/hooks/useRotationControl'
import { getSpringConfig } from '@/utils/springConfig'

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
  
  const { rotationY: animatedRotationY } = useSpring({
    rotationY,
    config: getSpringConfig('globalRotation')
  })

  return (
    // Le groupe ne tourne pas : la molette fait tourner chaque tuile sur elle-même (valeur `spin`)
    <group ref={groupRef} position={[0, 0, distance]}>
      <ProjectBorders spin={animatedRotationY} />
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
            spin={animatedRotationY}
          />
        )
      })}
    </group>
  )
})

export default ProjectList