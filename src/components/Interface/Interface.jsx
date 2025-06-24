import { useStore } from '../../stores/store';
import styles from './Interface.module.scss'

export function Cross() {
    const resetProjectState = useStore((state) => state.resetProjectState);

    return (
        <div className={styles.cross} onClick={() => resetProjectState()}>
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


