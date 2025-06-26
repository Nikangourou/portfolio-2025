import { useStore } from '../../stores/store'
import styles from './Interface.module.scss'

export function Cross() {
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

export function ArrowUp() {
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

export function ArrowDown() {
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
