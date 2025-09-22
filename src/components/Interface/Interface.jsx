import ProjectOverlay from '@/components/Projets/ProjectOverlay'
import styles from './Interface.module.scss'
import { useGridConfig } from '@/hooks/useGridConfig'

function Cross() {
  return (
    <div className={styles.cross}>
      <div className={`${styles.crossLine} ${styles.horizontal}`}></div>
      <div className={`${styles.crossLine} ${styles.vertical}`}></div>
    </div>
  )
}

function ArrowUp() {
  return (
    <div className={styles.arrow + ' ' + styles.arrowUp}></div>
  )
}

function ArrowDown() {
  return (
    <div className={styles.arrow + ' ' + styles.arrowDown}></div>
  )
}

export function Navigation({
  selectedProject,
  currentPage,
  gridPosition,
  projectSize,
}) {
  const gridConfig = useGridConfig()
  
  // Positions adaptatives selon le type d'appareil
  const arrowUpPosition = gridConfig.arrowUpPosition
  const crossPosition = gridConfig.crossPosition
  
  return (
    <>
      {selectedProject.contents?.length > 1 && (
        <>
          {currentPage > 1 && (
            <ProjectOverlay
              condition={selectedProject && gridPosition === arrowUpPosition}
              projectSize={projectSize}
              reverse={true}
            >
              <ArrowUp />
            </ProjectOverlay>
          )}
          {currentPage < selectedProject.contents?.length && (
            <ProjectOverlay
              condition={selectedProject && gridPosition === 14}
              projectSize={projectSize}
              reverse={true}
            >
              <ArrowDown />
            </ProjectOverlay>
          )}
        </>
      )}
      <ProjectOverlay
        condition={selectedProject && gridPosition === crossPosition}
        projectSize={projectSize}
      >
        <Cross />
      </ProjectOverlay>
    </>
  )
}
