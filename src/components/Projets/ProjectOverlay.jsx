import React from 'react'
import { Html } from '@react-three/drei'
import styles from './Project.module.scss'

const ProjectOverlay = ({ condition, children, projectSize, reverse }) => {
  if (!condition) return null

  return (
    <Html
      // occlude
      transform
      prepend
      position={[0, 0, -0.01]}
      rotation={reverse ? [Math.PI, 0, 0] : [0, 0, 0]}
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
