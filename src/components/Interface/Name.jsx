import React from 'react';
import { useSpring, animated, config } from '@react-spring/web';
import useThemeStore from '../../stores/themeStore';
import { useStore } from '../../stores/store';

export default function Name() {
  const isProjectsArranged = useStore((state) => state.isProjectsArranged);

  // Animation pour faire disparaître le nom
  const [springs, api] = useSpring(() => ({
    opacity: 1,
    y: 0,
    config: config.gentle
  }));

  // Animation basée sur l'état des projets
  React.useEffect(() => {
    if (isProjectsArranged) {
      // Disparaître quand les projets sont arrangés
      api.start({
        opacity: 0,
        y: -20
      });
    } else {
      // Réapparaître quand les projets ne sont pas arrangés
      api.start({
        opacity: 1,
        y: 0
      });
    }
  }, [isProjectsArranged, api]);

  return (
    <animated.div 
      className="name"
      style={{
        position: 'fixed',
        top: '20px',
        left: '30px',
        zIndex: 1000,
        fontSize: '1.5em',
        pointerEvents: 'none',
        fontFamily: 'Allerta Stencil, sans-serif',
        opacity: springs.opacity,
        transform: springs.y.to(y => `translateY(${y}px)`)
      }}
    >
      Nicolas Neveu
    </animated.div>
  );
} 