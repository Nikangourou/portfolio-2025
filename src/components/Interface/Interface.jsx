import { useStore } from '@/stores/store'
import ProjectOverlay from '@/components/Projets/ProjectOverlay'
import styles from './Interface.module.scss'

function Cross() {
  const resetProjectState = useStore((state) => state.resetProjectState)

  const handleClick = () => {
    resetProjectState()
  }

  return (
    <div className={styles.cross} onClick={handleClick}>
      <div className={`${styles.crossLine} ${styles.horizontal}`}></div>
      <div className={`${styles.crossLine} ${styles.vertical}`}></div>
    </div>
  )
}

function ArrowUp() {
  const setCurrentPage = useStore((state) => state.setCurrentPage)
  const currentPage = useStore((state) => state.currentPage)

  const handleClick = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  return (
    <div
      className={styles.arrow + ' ' + styles.arrowUp}
      onClick={handleClick}
    ></div>
  )
}

function ArrowDown() {
  const setCurrentPage = useStore((state) => state.setCurrentPage)
  const maxPage = useStore((state) => state.selectedProject?.contents?.length)
  const currentPage = useStore((state) => state.currentPage)

  const handleClick = () => {
    if (currentPage < maxPage) {
      setCurrentPage(currentPage + 1)
    }
  }

  return (
    <div
      className={styles.arrow + ' ' + styles.arrowDown}
      onClick={handleClick}
    ></div>
  )
}

export function Navigation({
  selectedProject,
  currentPage,
  gridPosition,
  projectSize,
}) {
  return (
    <>
      {selectedProject.contents?.length > 1 && (
        <>
          {currentPage > 1 && (
            <ProjectOverlay
              condition={selectedProject && gridPosition === 4}
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
        condition={selectedProject && gridPosition === 9}
        projectSize={projectSize}
      >
        <Cross />
      </ProjectOverlay>
    </>
  )
}
