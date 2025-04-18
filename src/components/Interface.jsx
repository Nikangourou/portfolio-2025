import { useStore } from '../stores/store';

export default function Interface()
{
    const setProjectsArranged = useStore((state) => state.setProjectsArranged);

    return (
        <div className="cross" onClick={() => setProjectsArranged(false)}>
            <div className="cross-line horizontal"></div>
            <div className="cross-line vertical"></div>
        </div>
    )
}
