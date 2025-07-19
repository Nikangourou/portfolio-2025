import React, { useState, useEffect } from 'react';
import { Html } from '@react-three/drei';
import styles from './ProjectInfoFloating.module.scss';

export default function ProjectInfoFloating({ project }) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (project) {
      setShouldRender(true);
      // Petit délai pour permettre au DOM de se mettre à jour
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // Attendre la fin de l'animation de sortie avant de retirer du DOM
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [project]);

  if (!shouldRender) return null;

  return (
    <Html
      className={`${styles.floatingInfo} ${isVisible ? styles.visible : styles.hidden}`}
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        top: '20px',
        left: '20px',
        zIndex: 100,
      }}
    >
      <h2 className={styles.title}>{project.title}</h2>
      <p className={styles.meta}>{project.year} — {project.context}</p>
      <p className={styles.description}>{project.description}</p>
      <div className={styles.techList}>
        {project.technologies?.map(tech => (
          <span key={tech} className={styles.tech}>{tech}</span>
        ))}
      </div>
    </Html>
  );
} 