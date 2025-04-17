import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

const Projet = forwardRef(function Projet({ position, rotation, title, description, technologies, link, color, isDynamic, onAnyClick, camera }, ref) {
  const meshRef = useRef(null);
  const rigidBodyRef = useRef(null);

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
        <mesh ref={meshRef} onClick={onAnyClick} castShadow receiveShadow>
          <boxGeometry args={[projectSize.width, projectSize.height, 0.05]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </RigidBody>
    </group>
  );
});

export default Projet; 