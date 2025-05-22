import { create } from 'zustand'
import useThemeStore from './themeStore'

const useStore = create((set) => ({
  selectedProject: null,
  isProjectsArranged: false,
  isArrangementAnimationComplete: false,
  setSelectedProject: (project) => {
    set({ selectedProject: project })
    // Mettre à jour le thème global quand un projet est sélectionné
    if (project?.color) {
      useThemeStore.getState().setTheme(project.color)
    } else {
      useThemeStore.getState().resetTheme()
    }
  },
  setProjectsArranged: (value) => set({ isProjectsArranged: value }),
  setArrangementAnimationComplete: (value) => set({ isArrangementAnimationComplete: value })
}))

export { useStore } 