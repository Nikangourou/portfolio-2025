import React, { useMemo, useRef } from 'react';
import { useScroll, ScrollControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import Projet from './Projet';
import projectsData from '../data/projects.json';

const getRandomColor = () => {
  const hue = Math.random() * 360;
  const saturation = 70 + Math.random() * 30; // 70-100%
  const lightness = 40 + Math.random() * 20; // 40-60%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export default function Projets() {
  return (
    <ScrollControls pages={projectsData.projects.length} damping={0.25} children={<ProjetsContent />} />
  );
}

function ProjetsContent() {
  const data = useScroll();
  const groupRef = useRef(null);
  
  const projectPositions = useMemo(() => {
    const radius = 1.5;
    const totalProjects = projectsData.projects.length;
    
    return projectsData.projects.map((project, index) => {
      const angle = (index / totalProjects) * Math.PI * 2;

      const x = 0;
      const y = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const rotationX = -angle;
      
      return {
        position: [x, y, z],
        rotation: [rotationX, 0.8, 1],
        project,
        color: getRandomColor()
      };
    });
  }, []);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.x = data.offset * Math.PI * 2;
    }
  });

  return (
    <group position={[0, 0, 0]} rotation={[0, -1.5, -0.5]}>
      <group ref={groupRef}>
        {projectPositions.map(({ position, rotation, project, color }) => (
          <Projet
            key={project.id}
            position={position}
            rotation={rotation}
            title={project.title}
            description={project.description}
            technologies={project.technologies}
            link={project.link}
            color={color}
          />
        ))}
      </group>
    </group>
  );
} 