import { Html } from '@react-three/drei'
import styles from './Project.module.scss'
import { useStore } from '@/stores/store'

const OVERLAY_RENDER_SCALE = 4

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
  const overlayWidth = projectSize.width * 40
  const overlayHeight = projectSize.height * 40

  return (
    <Html
      occlude
      transform
      pointerEvents="none"
      position={shouldFlipOverlay ? [0, 0, -0.01] : [0, 0, 0.01]}
      rotation={shouldFlipOverlay ? [Math.PI, 0, 0] : [0, 0, 0]}
      className={styles.project}
      style={{
        width: `${overlayWidth}px`,
        height: `${overlayHeight}px`,
      }}
    >
      <div
        className={styles.container}
        style={{
          pointerEvents: 'none',
          width: `${overlayWidth * OVERLAY_RENDER_SCALE}px`,
          height: `${overlayHeight * OVERLAY_RENDER_SCALE}px`,
          transform: `scale(${1 / OVERLAY_RENDER_SCALE})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </Html>
  )
}

export default ProjectOverlay
