import { create } from 'zustand'
import useThemeStore from './themeStore'
import projectsData from '@/data/projects.json'

const firstProject =  projectsData.projects[0]

const useStore = create((set, get) => ({
  selectedProject: null,
  isProjectsArranged: false,
  isArrangementAnimationComplete: false, 
  currentPage: 0,

  
  setSelectedProject: (project) => {
    set({ selectedProject: project })
    // Mettre à jour le thème global quand un projet est sélectionné
    if (project?.color) {
      useThemeStore.getState().setTheme(project.color)
    } else {
      useThemeStore.getState().resetTheme()
    }
    set({ currentPage: 1 }) // Réinitialiser la page à 1 à chaque sélection
  },
  
  setProjectsArranged: (value) => {
    set({ isProjectsArranged: value })
    // Réinitialiser l'animation quand on désarrange les projets
    if (!value) {
      set({ isArrangementAnimationComplete: false })
    }
  },
  
  setArrangementAnimationComplete: (value) => set({ isArrangementAnimationComplete: value }),
  
  setCurrentPage: (page) => set({ currentPage: page }),
  
  // Méthode pour réinitialiser complètement l'état des projets
  resetProjectState: () => {
    set({
      selectedProject: null,
      isProjectsArranged: false,
      isArrangementAnimationComplete: false,
      currentPage: 0
    })
    useThemeStore.getState().resetTheme()
  },
  
  // Getter pour vérifier si on doit afficher la texture initiale
  shouldShowInitialTexture: () => {
    const { isProjectsArranged, isArrangementAnimationComplete } = get()
    return !isProjectsArranged || !isArrangementAnimationComplete
  }
}))

export { useStore } 