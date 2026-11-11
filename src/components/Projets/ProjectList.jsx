import { memo, useEffect, useMemo, useRef } from 'react'
import Project from './Project'
import ProjectBorders from './ProjectBorders'
import { SpringValue } from '@react-spring/three'
import { useFrame } from '@react-three/fiber'
import { useRotationControl } from '@/hooks/useRotationControl'
import { useStore } from '@/stores/store'
import { useGridConfig } from '@/hooks/useGridConfig'

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

// Vitesse (1/s) à laquelle la rotation affichée rejoint sa cible : une petite inertie, sans dépassement.
const SPIN_FOLLOW_RATE = 3.5
// Avance maximale (rad) de la cible sur la rotation affichée : un long geste (inertie du pavé tactile) ne crée pas
// un retard de plusieurs tours que les tuiles mettraient des secondes à rattraper.
const MAX_SPIN_LEAD = 2
const TWO_PI = 2 * Math.PI

const ProjectList = memo(({
  projectStates,
  projectGroupsRef,
  groupRef,
  distance
}) => {
  const { tileSlots } = useGridConfig()
  const { targetRef } = useRotationControl()
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)

  // Rotation affichée, partagée par toutes les tuiles. Elle est mise à jour à chaque image, sans passer par React.
  const spin = useMemo(() => new SpringValue(0), [])
  const currentRef = useRef(0)
  const isArrangedRef = useRef(isProjectsArranged)
  // Après la fermeture d'un projet, le retour à l'angle sauvegardé n'est pas borné (seul le geste l'est)
  const isReturningRef = useRef(false)

  // À l'ouverture d'un projet, l'angle courant et l'angle sauvegardé sont remplacés par leur équivalent entre -π et π
  // (visuellement identique) : au lieu de dérouler tous les tours cumulés, les tuiles font au plus un demi-tour,
  // à l'ouverture comme à la fermeture.
  useEffect(() => {
    if (isProjectsArranged && !isArrangedRef.current) {
      currentRef.current -= TWO_PI * Math.round(currentRef.current / TWO_PI)
      targetRef.current -= TWO_PI * Math.round(targetRef.current / TWO_PI)
    }
    if (!isProjectsArranged && isArrangedRef.current) isReturningRef.current = true
    isArrangedRef.current = isProjectsArranged
  }, [isProjectsArranged, targetRef])

  useFrame((_, delta) => {
    const goal = isArrangedRef.current ? 0 : targetRef.current
    if (!isArrangedRef.current) {
      const lead = goal - currentRef.current
      if (isReturningRef.current) {
        if (Math.abs(lead) <= MAX_SPIN_LEAD) isReturningRef.current = false
      } else if (Math.abs(lead) > MAX_SPIN_LEAD) {
        targetRef.current = currentRef.current + Math.sign(lead) * MAX_SPIN_LEAD
      }
    }

    const nextGoal = isArrangedRef.current ? 0 : targetRef.current
    const difference = nextGoal - currentRef.current
    if (Math.abs(difference) < 0.0001) {
      if (difference !== 0) {
        currentRef.current = nextGoal
        spin.set(nextGoal)
      }
      return
    }

    currentRef.current += difference * (1 - Math.exp(-Math.min(delta, 0.1) * SPIN_FOLLOW_RATE))
    spin.set(currentRef.current)
  })

  return (
    // Le groupe ne tourne pas : la molette fait tourner chaque tuile sur elle-même (valeur `spin`)
    <group ref={groupRef} position={[0, 0, distance]}>
      <ProjectBorders spin={spin} />
      {projectStates.map((state, i) => {
        return (
          <Project
            key={state.project?.id ?? `tile-${i}`}
            ref={(el) => {
              // Les tuiles vides ne doivent jamais être survolables sur l'accueil
              projectGroupsRef.current[i] = state.project ? el : null
            }}
            gridPosition={i}
            slot={tileSlots[i] ?? i}
            isFiller={!state.project}
            image={state.project?.cover ?? FILLER_IMAGE}
            initialPosition={state.initialPosition}
            initialRotation={state.initialRotation}
            spin={spin}
          />
        )
      })}
    </group>
  )
})

export default ProjectList