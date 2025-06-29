import React from 'react'
import { Html } from '@react-three/drei'
import styles from './Project.module.scss'
import { useStore } from '../../stores/store'


const ProjectOverlay = ({ condition, children, projectSize }) => {
  if (!condition) return null

  const currentPage = useStore((state) => state.currentPage)
  const evenPage = currentPage % 2


  return (
    <Html
      occlude
      transform
      prepend
      position={evenPage ? [0, 0, -0.01] : [0, 0, 0.01]}
      rotation={evenPage ? [Math.PI, 0, 0] : [0, 0, 0]}
      className={styles.project}
      style={{
        width: `${projectSize.width * 40}px`,
        height: `${projectSize.height * 40}px`,
      }}
    >
      <div className={styles.container}>{children}</div>
    </Html>
  )
}

export default ProjectOverlay
