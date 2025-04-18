import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

const Projet = forwardRef(function Projet({ position, rotation, title, description, technologies, link, color, isDynamic, onAnyClick, camera, image }, ref) {
  const meshRef = useRef(null);
  const rigidBodyRef = useRef(null);
  const texture = useTexture(image || '');

  useEffect(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
    }
  }, [texture, image]);

  useImperativeHandle(ref, () => ({
    setDynamic: () => {
      if (rigidBodyRef.current) {
        rigidBodyRef.current.setBodyType('dynamic');
        const direction = new THREE.Vector3();
        direction.subVectors(rigidBodyRef.current.translation(), camera.position).normalize();
        rigidBodyRef.current.applyImpulse({ x: direction.x * 1, y: direction.y * 1, z: direction.z * 1 }, true);
      }
    }
  }));

  // Utiliser la taille calculée ou une taille par défaut
  const projectSize = window.projectSize || { width: 1, height: 1 };

  return (
    <group position={position} rotation={rotation}>
      <RigidBody
        ref={rigidBodyRef}
        type={isDynamic ? 'dynamic' : 'kinematicPosition'}
        colliders="cuboid"
        gravityScale={0}
        restitution={0.4}
        friction={0.8}
      >
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
      </RigidBody>
    </group>
  );
});

export default Projet; 