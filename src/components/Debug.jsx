import { useControls } from 'leva';
import { useThree } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';

export default function Debug() {
  
  // Vérifier si on est en mode debug
  if (!window.location.hash.includes('debug')) return null;
  
  const { camera } = useThree();
  const [isOrbitControlsEnabled, setIsOrbitControlsEnabled] = useState(true);
  const orbitControlsRef = useRef();
  // Contrôles d'OrbitControls
  const orbitControls = useControls('OrbitControls', {
    enabled: {
      value: isOrbitControlsEnabled,
      onChange: (value) => {
        setIsOrbitControlsEnabled(value);
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = value;
        }
      }
    }
  });

  return (
    <OrbitControls 
      ref={orbitControlsRef}
      enabled={isOrbitControlsEnabled}
      enableDamping={true}
      dampingFactor={0.05}
      rotateSpeed={0.5}
      minDistance={2}
      maxDistance={20}
      target={[0, 0, -10]}
    />
  );
} 