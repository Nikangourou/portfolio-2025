import { useStore } from '../../stores/store';
import styles from './Interface.module.scss'

export default function Interface()
{
    const setProjectsArranged = useStore((state) => state.setProjectsArranged);

    return ( 
        <>
        <div className={styles.cross} onClick={() => setProjectsArranged(false)}>
            <div className={`${styles.crossLine} ${styles.horizontal}`}></div>
            <div className={`${styles.crossLine} ${styles.vertical}`}></div>
        </div>
        {/* <div className={styles.grid}>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
            <div className={styles.cell}></div>
        </div> */}
        </>
    )
}
