import { Physics } from '@react-three/rapier'
import Lights from './Lights.jsx'
import Projets from './components/Projets.jsx'
export default function Experience() {
  return (
    <>
      <Physics debug={false}>
        <Lights />
        <group rotation={[0, 0, 0]}>
          <Projets />
        </group>
      </Physics>
    </>
  )
}
