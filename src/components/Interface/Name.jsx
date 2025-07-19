import React from 'react';
import useThemeStore from '../../stores/themeStore';

export default function Name() {
  const currentTheme = useThemeStore((state) => state.currentTheme);

  let color = currentTheme.background
  if(color === "white"){
    color = "#181818"
  }


  return (
    <div 
      className="name"
      style={{
        position: 'fixed',
        top: '20px',
        left: '30px',
        zIndex: 1000,
        color: color,
        fontSize: '2em',
        pointerEvents: 'none',
        transition: 'color 1s ease',
        // fontFamily: 'Michroma, sans-serif',
      }}
    >
      Nicolas Neveu
    </div>
  );
} 