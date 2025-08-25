import React, { useEffect } from 'react';
import { Html } from '@react-three/drei';
import { useSpring, animated, config } from '@react-spring/web';
import styles from './ProjectInfoFloating.module.scss';

export default function ProjectInfoFloating({ project, isVisible = true, displaySpring, displayApi }) {
  // Animation pour l'opacité et la position
  const [springs, api] = useSpring(() => ({
    opacity: 0,
    y: 20,
    scale: 0.95,
    config: config.gentle
  }));

  // Animation pour le contenu (fade in du texte)
  const [contentSprings, contentApi] = useSpring(() => ({
    opacity: 0,
    y: 10,
    config: config.slow
  }));

  // Utiliser les valeurs d'animation du hook si disponibles
  const finalSprings = displaySpring && displaySpring.opacity !== undefined ? displaySpring : springs;
  const finalApi = displayApi || api;

  useEffect(() => {
    if (project && isVisible) {
      // Animation d'entrée - tout en même temps
      finalApi.start({
        opacity: 1,
        y: 0,
        scale: 1
      });
      
      // Animation du contenu immédiatement
      contentApi.start({
        opacity: 1,
        y: 0
      });
    } else {
      // Animation de sortie
      contentApi.start({
        opacity: 0,
        y: 10
      });
      
      finalApi.start({
        opacity: 0,
        y: 20,
        scale: 0.95
      });
    }
  }, [project, isVisible, finalApi, contentApi]);

  // Ne pas rendre si pas de projet
  if (!project) return null;

  return (
    <Html
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        bottom: '20px',
        left: '10px',
        zIndex: 100,
      }}
    >
      <animated.div 
        className={styles.floatingInfo}
        style={{
          opacity: finalSprings.opacity,
          transform: finalSprings.y && finalSprings.y.to ? 
            finalSprings.y.to(y => `translateY(${y}px) scale(${finalSprings.scale && finalSprings.scale.get ? finalSprings.scale.get() : 1})`) :
            `translateY(0px) scale(1)`
        }}
      >
        <animated.h2 
          className={styles.title}
          style={{
            opacity: contentSprings.opacity,
            transform: contentSprings.y.to(y => `translateY(${y}px)`)
          }}
        >
          {project.title}
        </animated.h2>
        
        <animated.p 
          className={styles.meta}
          style={{
            opacity: contentSprings.opacity,
            transform: contentSprings.y.to(y => `translateY(${y}px)`)
          }}
        >
          {project.year} — {project.context}
        </animated.p>
        
        <animated.p 
          className={styles.description}
          style={{
            opacity: contentSprings.opacity,
            transform: contentSprings.y.to(y => `translateY(${y}px)`)
          }}
        >
          {project.description}
        </animated.p>
        
        <animated.div 
          className={styles.techList}
          style={{
            opacity: contentSprings.opacity,
            transform: contentSprings.y.to(y => `translateY(${y}px)`)
          }}
        >
          {project.technologies?.map(tech => (
            <span key={tech} className={styles.tech}>
              {tech}
            </span>
          ))}
        </animated.div>
      </animated.div>
    </Html>
  );
} 