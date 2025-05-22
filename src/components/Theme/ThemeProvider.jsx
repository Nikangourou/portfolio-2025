import React from 'react'
import useThemeStore from '../../stores/themeStore'

const ThemeProvider = ({ children }) => {
  const currentTheme = useThemeStore((state) => state.currentTheme)

  return (
    <div
      style={{
        '--theme-background': currentTheme.background,
        '--theme-text': currentTheme.text,
        height: '100%',
        width: '100%',
      }}
    >
      {children}
    </div>
  )
}

export default ThemeProvider 