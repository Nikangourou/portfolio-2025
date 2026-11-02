import { memo, useEffect, useRef } from 'react'
import Project from './Project'
import ProjectBorders from './ProjectBorders'
import { useSpring } from '@react-spring/three'
import { useRotationControl } from '@/hooks/useRotationControl'
import { getSpringConfig } from '@/utils/springConfig'
import { useStore } from '@/stores/store'

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
  
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
  const [{ rotationY: animatedRotationY }, spinApi] = useSpring(() => ({
    rotationY: 0,
    config: getSpringConfig('globalRotation')
  }))

  // La molette cumule l'angle (parfois plusieurs tours). À l'ouverture d'un projet, on remplace l'angle courant par
  // son équivalent entre -π et π (visuellement identique) avant de revenir à 0 : au lieu de dérouler tous les tours,
  // les tuiles font au plus un demi-tour. Même chose à la fermeture, où l'angle sauvegardé est déjà ramené court.
  const wasArrangedRef = useRef(false)
  useEffect(() => {
    if (isProjectsArranged && !wasArrangedRef.current) {
      const current = animatedRotationY.get()
      spinApi.set({ rotationY: current - 2 * Math.PI * Math.round(current / (2 * Math.PI)) })
    }
    wasArrangedRef.current = isProjectsArranged
    spinApi.start({ rotationY: isProjectsArranged ? 0 : rotationY })
  }, [rotationY, isProjectsArranged, spinApi, animatedRotationY])

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