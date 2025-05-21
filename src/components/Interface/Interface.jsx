import { useStore } from '../../stores/store';
import styles from './Interface.module.scss'

export function Cross() {
    const setProjectsArranged = useStore((state) => state.setProjectsArranged);

    return (
        <div className={styles.cross} onClick={() => setProjectsArranged(false)}>
            <div className={`${styles.crossLine} ${styles.horizontal}`}></div>
            <div className={`${styles.crossLine} ${styles.vertical}`}></div>
        </div>
    );
}

export function ArrowUp() {
    return (
        <div className={styles.arrow + ' ' + styles.arrowUp}>

        </div>
    );
}

export function ArrowDown() {
    return (
        <div className={styles.arrow + ' ' + styles.arrowDown}>

        </div>
    );
}


