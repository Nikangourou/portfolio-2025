import { Physics } from '@react-three/rapier'
import Lights from './Lights.jsx'
import Projets from './components/Projets.jsx'
import Debug from './components/Debug.jsx'
import CameraController from './components/CameraController.jsx'


export default function Experience() {
  return (
    <>
      <CameraController />
      <Debug />
      <Physics debug={false}>
        <Lights />
        <group rotation={[0, 0, 0]}>
          <Projets />
        </group>
      </Physics>
    </>
  )
}
