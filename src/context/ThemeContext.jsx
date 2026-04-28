import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('eliteArrowsTheme') || 'dark')
  const [language, setLanguage] = useState(() => localStorage.getItem('eliteArrowsLanguage') || 'en')
  const [chatSettings, setChatSettings] = useState(() => {
    return JSON.parse(
      localStorage.getItem('eliteArrowsChatSettings') ||
      '{"soundEnabled": true, "notificationsEnabled": true}'
    )
  })
  const [navMode, setNavMode] = useState(() => localStorage.getItem('eliteArrowsNavMode') || 'sidebar')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('eliteArrowsTheme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('eliteArrowsLanguage', language)
  }, [language])

  useEffect(() => {
    localStorage.setItem('eliteArrowsChatSettings', JSON.stringify(chatSettings))
  }, [chatSettings])

  useEffect(() => {
    localStorage.setItem('eliteArrowsNavMode', navMode)
  }, [navMode])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  const updateNavMode = (mode) => {
    setNavMode(mode)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        language,
        setLanguage,
        chatSettings,
        setChatSettings,
        navMode,
        updateNavMode
      }}
    >
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
