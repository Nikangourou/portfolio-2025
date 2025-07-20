import React from 'react';
import useThemeStore from '../../stores/themeStore';

export default function Name() {
  const currentTheme = useThemeStore((state) => state.currentTheme);


  return (
    <div 
      className="name"
      style={{
        position: 'fixed',
        top: '20px',
        left: '30px',
        zIndex: 1000,
        color: currentTheme.text,
        fontSize: '1.5em',
        pointerEvents: 'none',
        transition: 'color 1s ease',
        fontFamily: 'Allerta Stencil, sans-serif',
      }}
    >
      Nicolas Neveu
    </div>
  );
} 