import React, { useRef, forwardRef, useEffect } from 'react';
import * as THREE from 'three';
import { useTexture, Html } from '@react-three/drei';

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

  // Convertir les coordonnées 3D en coordonnées 2D pour le positionnement CSS
  const get2DPosition = () => {
    if (!camera) return { x: 0, y: 0 };
    
    const vector = new THREE.Vector3(position[0], position[1], position[2]);
    vector.project(camera);
    
    return {
      x: (vector.x * 0.5 + 0.5) * window.innerWidth,
      y: (vector.y * -0.5 + 0.5) * window.innerHeight
    };
  };

  const pos2D = get2DPosition();

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
      {/* <Html
        transform
        occlude
        style={{
          width: `${projectSize.width * 40}px`,
          height: `${projectSize.height * 40}px`,
          pointerEvents: 'none',
          backgroundColor: 'rgba(255, 0, 0, 0.284)'
        }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          pointerEvents: 'none',
        }} />
      </Html> */}
    </group>
  );
});

export default Projet; 