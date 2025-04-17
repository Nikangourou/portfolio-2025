import React, { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import Projet from './Projet';
import projectsData from '../data/projects.json';
import { RigidBody } from '@react-three/rapier';

const getRandomColor = () => {
  const hue = Math.random() * 360;
  const saturation = 70 + Math.random() * 30; // 70-100%
  const lightness = 40 + Math.random() * 20; // 40-60%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export default function Projets() {
  return <ProjetsContent />;
}

function ProjetsContent() {
  const groupRef = useRef(null);
  const { camera } = useThree();
  const projectRefs = useRef([]);
  const distance = -5; // Distance négative pour placer devant la caméra
  const fov = camera.fov * (Math.PI / 180); // Convertir en radians
  const aspect = window.innerWidth / window.innerHeight;
  const height = 2 * Math.tan(fov / 2) * Math.abs(distance);
  const width = height * aspect;

  const projectPositions = useMemo(() => {
    const totalProjects = projectsData.projects.length;
        
    // Définir les limites de la zone de placement (plus proche de la caméra)
    const xRange = [-width/4, width/4];
    const yRange = [-height/4, height/4];
    const zRange = [distance - 2, distance + 2];
    
    // Distance minimale entre les projets (réduite pour permettre plus de projets)
    let minDistance = 1.0;
    
    // Fonction pour vérifier si une position est valide (pas de collision)
    const isPositionValid = (newPos, existingPositions) => {
      return !existingPositions.some(existingPos => {
        const dx = newPos[0] - existingPos[0];
        const dy = newPos[1] - existingPos[1];
        const dz = newPos[2] - existingPos[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return distance < minDistance;
      });
    };
    
    // Générer les positions pour tous les projets
    const positions = [];
    const maxAttempts = 100;
    
    for (let i = 0; i < totalProjects; i++) {
      let attempts = 0;
      let position;
      
      do {
        position = [
          Math.random() * (xRange[1] - xRange[0]) + xRange[0],
          Math.random() * (yRange[1] - yRange[0]) + yRange[0],
          Math.random() * (zRange[1] - zRange[0]) + zRange[0]
        ];
        attempts++;
        
        if (attempts > maxAttempts) {
          // Réduire la distance minimale si on n'arrive pas à placer tous les projets
          minDistance *= 0.9;
          attempts = 0;
        }
      } while (!isPositionValid(position, positions));
      
      positions.push(position);
    }
    
    return projectsData.projects.map((project, index) => {
      const position = positions[index];
      
      // Générer des rotations aléatoires
      const rotationX = Math.random() * Math.PI * 2;
      const rotationY = Math.random() * Math.PI * 2;
      const rotationZ = Math.random() * Math.PI * 2;
      
      return {
        position,
        rotation: [rotationX, rotationY, rotationZ],
        project,
        color: getRandomColor()
      };
    });
  }, [camera]);

  // Handler pour 'puncher' uniquement le projet cliqué
  const handleProjectClick = (index) => {
    const ref = projectRefs.current[index];
    if (ref && ref.setDynamic) ref.setDynamic();
  };

  return (  
    <group position={[0, 0, 0]} rotation={[0, 0, 0]}>
      {/* Cube invisible pour faire rebondir les projets */}
      <RigidBody type="fixed" colliders="trimesh" restitution={0.4} friction={0.8}>
        <mesh position={[0, 0, distance]}>
          <boxGeometry args={[width/3 * 2, height/3 * 2, 4]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      </RigidBody>
      <group ref={groupRef}>  
        {projectPositions.map(({ position, rotation, project, color }, i) => (
          <Projet
            key={project.id}
            ref={el => projectRefs.current[i] = el}
            position={position}
            rotation={rotation}
            title={project.title}
            description={project.description}
            technologies={project.technologies}
            link={project.link}
            color={color}
            isDynamic={false}
            onAnyClick={() => handleProjectClick(i)}
            camera={camera}
          />
        ))}
      </group>
    </group>
  );
} 