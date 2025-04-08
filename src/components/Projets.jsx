import React, { useMemo, useRef } from 'react';
import { useScroll, ScrollControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import Projet from './Projet';
import projectsData from '../data/projects.json';

export default function Projets() {
  return (
    <ScrollControls pages={projectsData.projects.length} damping={0.25} children={<ProjetsContent />} />
  );
}

function ProjetsContent() {
  const data = useScroll();
  const groupRef = useRef(null);
  
  const projectPositions = useMemo(() => {
    const radius = 1;
    const totalProjects = projectsData.projects.length;
    
    return projectsData.projects.map((project, index) => {
      const angle = (index / totalProjects) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const rotationY = -angle;
      
      return {
        position: [x, 0, z],
        rotation: [0, rotationY, 0],
        project
      };
    });
  }, []);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = data.offset * Math.PI * 2;
    }
  });

  return (
    <group position={[2, 0, 0]} rotation={[0, 0, .25]}>
      <group ref={groupRef}>
        {projectPositions.map(({ position, rotation, project }) => (
          <Projet
            key={project.id}
            position={position}
            rotation={rotation}
            title={project.title}
            description={project.description}
            technologies={project.technologies}
            link={project.link}
          />
        ))}
      </group>
    </group>
  );
} 