import { createContext, useContext, useEffect, useState, useMemo } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('eliteArrowsTheme') || 'light'
    } catch (e) {
      return 'light'
    }
  })
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('eliteArrowsLanguage') || 'en'
    } catch (e) {
      return 'en'
    }
  })
  const [chatSettings, setChatSettings] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('eliteArrowsChatSettings') ||
        '{"soundEnabled": true, "notificationsEnabled": true}'
      )
    } catch (e) {
      return { soundEnabled: true, notificationsEnabled: true }
    }
  })
  const [navMode, setNavMode] = useState(() => {
    try {
      return localStorage.getItem('eliteArrowsNavMode') || 'sidebar'
    } catch (e) {
      return 'sidebar'
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('eliteArrowsTheme', theme)
    } catch (e) {}
  }, [theme])

  useEffect(() => {
    try {
      const savedColors = localStorage.getItem('eliteArrowsColors')
      if (!savedColors) return

      const colors = JSON.parse(savedColors)
      if (colors.primary) {
        document.documentElement.style.setProperty('--accent-primary', colors.primary)
      }
      if (colors.background) {
        document.documentElement.style.setProperty('--bg-primary', colors.background)
      }
      if (colors.button) {
        document.documentElement.style.setProperty('--button-color', colors.button)
      }
    } catch (error) {
      console.log('Error applying saved colors:', error)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('eliteArrowsLanguage', language)
    } catch (e) {}
  }, [language])

  useEffect(() => {
    try {
      localStorage.setItem('eliteArrowsChatSettings', JSON.stringify(chatSettings))
    } catch (e) {}
  }, [chatSettings])

  useEffect(() => {
    try {
      localStorage.setItem('eliteArrowsNavMode', navMode)
    } catch (e) {}
  }, [navMode])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  const updateNavMode = (mode) => {
    setNavMode(mode)
  }

  const value = useMemo(() => ({
    theme,
    toggleTheme,
    language,
    setLanguage,
    chatSettings,
    setChatSettings,
    navMode,
    updateNavMode
  }), [theme, language, chatSettings, navMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
