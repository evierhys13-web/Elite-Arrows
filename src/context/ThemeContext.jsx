import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('eliteArrowsTheme') || 'dark';
  });

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('eliteArrowsLanguage') || 'en';
  });

  const [chatSettings, setChatSettings] = useState(() => {
    return JSON.parse(localStorage.getItem('eliteArrowsChatSettings') || '{"soundEnabled": true, "notificationsEnabled": true}');
  });

  useEffect(() => {
    localStorage.setItem('eliteArrowsTheme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('eliteArrowsLanguage', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('eliteArrowsChatSettings', JSON.stringify(chatSettings));
  }, [chatSettings]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme, 
      language, 
      setLanguage,
      chatSettings,
      setChatSettings
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}