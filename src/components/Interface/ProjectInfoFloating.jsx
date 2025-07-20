import React, { useState, useEffect } from 'react';
import { Html } from '@react-three/drei';
import styles from './ProjectInfoFloating.module.scss';

export default function ProjectInfoFloating({ project, isVisible = true }) {
  const [internalVisible, setInternalVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (project && isVisible) {
      if (currentProject && currentProject.id !== project.id) {
        // Transition entre projets : animation de sortie puis d'entrée
        setIsTransitioning(true);
        setInternalVisible(false);
        
        setTimeout(() => {
          setCurrentProject(project);
          setInternalVisible(true);
          setIsTransitioning(false);
        }, 300); // Délai correspondant à la durée de l'animation CSS
      } else {
        // Premier affichage ou même projet
        setShouldRender(true);
        setCurrentProject(project);
        const timer = setTimeout(() => setInternalVisible(true), 10);
        return () => clearTimeout(timer);
      }
    } else {
      setInternalVisible(false);
      setIsTransitioning(false);
      // Attendre la fin de l'animation de sortie avant de retirer du DOM
      const timer = setTimeout(() => {
        setShouldRender(false);
        setCurrentProject(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [project, isVisible]);

  // S'assurer que le composant reste affiché pendant les transitions
  useEffect(() => {
    if (currentProject) {
      setShouldRender(true);
    }
  }, [currentProject]);

  if (!shouldRender) return null;

  return (
    <Html
      className={`${styles.floatingInfo} ${internalVisible ? styles.visible : styles.hidden}`}
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        bottom: '20px',
        left: '10px',
        zIndex: 100,
      }}
    >
      <h2 className={styles.title}>{currentProject?.title}</h2>
      <p className={styles.meta}>{currentProject?.year} — {currentProject?.context}</p>
      <p className={styles.description}>{currentProject?.description}</p>
      <div className={styles.techList}>
        {currentProject?.technologies?.map(tech => (
          <span key={tech} className={styles.tech}>{tech}</span>
        ))}
      </div>
    </Html>
  );
} 