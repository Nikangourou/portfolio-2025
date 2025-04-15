import { useControls } from 'leva';
import { useThree } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';

export default function Debug() {
  
  // Vérifier si on est en mode debug
  if (!window.location.hash.includes('debug')) return null;
  
  const { camera } = useThree();
  const [isOrbitControlsEnabled, setIsOrbitControlsEnabled] = useState(false);
  const orbitControlsRef = useRef();
  const [isGenerationZoneEnabled, setIsGenerationZoneEnabled] = useState(true);
  const generationZoneRef = useRef();

  // Calculs pour le cube de debug (repris de Projets.jsx)
  const fov = camera.fov * (Math.PI / 180); // Convertir en radians
  const aspect = window.innerWidth / window.innerHeight;
  const distance = -5;
  const height = 2 * Math.tan(fov / 2) * Math.abs(distance);
  const width = height * aspect;

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

  const generationZone = useControls('GenerationZone', {
    enabled: {
      value: isGenerationZoneEnabled,
      onChange: (value) => {
        setIsGenerationZoneEnabled(value);
      }
    }
  });
  return (
    <>
      <OrbitControls 
        ref={orbitControlsRef}
        enabled={isOrbitControlsEnabled}
        enableDamping={true}
        dampingFactor={0.05}
        rotateSpeed={0.5}
        minDistance={2}
        maxDistance={20}
        target={[0, 0, -5]}
      />
      {isGenerationZoneEnabled && (
        <mesh ref={generationZoneRef} position={[0, 0, distance]}>
          <boxGeometry args={[width/3 * 2, height/3 * 2, 4]} />
          <meshBasicMaterial 
          color="red" 
          wireframe={true} 
          transparent={true} 
          opacity={0.3}
          />
        </mesh>
      )}
    </>
  );
} 