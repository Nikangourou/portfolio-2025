import { create } from 'zustand'

const useThemeStore = create((set) => ({
  currentTheme: {
    background: 'white',
    text: 'black'
  },
  setTheme: (theme) => set({ currentTheme: theme }),
  resetTheme: () => set({ currentTheme: { background: 'white', text: 'black' } })
}))

export default useThemeStore 