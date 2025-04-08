import { Physics } from '@react-three/rapier'
import Lights from './Lights.jsx'
import Projets from './components/Projets.jsx'

export default function Experience()
{
 

    return <>

        <color args={ [ '#bdedfc' ] } attach="background" />

        <Physics debug={ false }>
            <Lights />
            <Projets />
        </Physics>

    </>
}