import { Html } from '@react-three/drei'
import styles from './Project.module.scss'
import { useStore } from '@/stores/store'

const ProjectOverlay = ({
  condition,
  children,
  projectSize,
  page,
}) => {
  if (!condition) return null

  const currentPage = useStore((state) => state.currentPage)
  const overlayPage = page ?? currentPage
  const shouldFlipOverlay = overlayPage % 2 === 1

  return (
    <Html
      occlude
      transform
      pointerEvents="none"
      position={shouldFlipOverlay ? [0, 0, -0.01] : [0, 0, 0.01]}
      rotation={shouldFlipOverlay ? [Math.PI, 0, 0] : [0, 0, 0]}
      className={styles.project}
      style={{
        width: `${projectSize.width * 40}px`,
        height: `${projectSize.height * 40}px`,
      }}
    >
      <div
        className={styles.container}
        style={{ pointerEvents: 'none' }}
      >
        {children}
      </div>
    </Html>
  )
}

export default ProjectOverlay
