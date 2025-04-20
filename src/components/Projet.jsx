import React, { useRef, forwardRef, useEffect } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';


const Projet = forwardRef(function Projet({ position, rotation, title, description, technologies, link, color, isDynamic, onAnyClick, camera, image }, ref) {
  const meshRef = useRef(null);
  const texture = useTexture(image || '');

  useEffect(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
    }
  }, [texture, image]);

  // Utiliser la taille calculée ou une taille par défaut
  const projectSize = window.projectSize || { width: 1, height: 1 };

  return (
    <group position={position} rotation={rotation}>
        <mesh ref={meshRef} onClick={onAnyClick}>
          <planeGeometry args={[projectSize.width, projectSize.height]} />
          {texture ? (
            <meshBasicMaterial 
              map={texture} 
              side={THREE.DoubleSide}
              toneMapped={true}
              transparent={true}
              opacity={1}
            />
          ) : (
            <meshBasicMaterial color={color} />
          )}
        </mesh>
    </group>
  );
});

export default Projet; 