import { createContext, useContext, useState, useEffect } from "react";
import { THEMES, lightTheme } from "./themes";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("app-theme");
    return savedTheme && THEMES[savedTheme] ? THEMES[savedTheme] : lightTheme;
  });

  const [themeName, setThemeName] = useState(() => {
    const savedTheme = localStorage.getItem("app-theme");
    return savedTheme && THEMES[savedTheme] ? savedTheme : "light";
  });

  useEffect(() => {
    localStorage.setItem("app-theme", themeName);
    
    const root = document.documentElement;
    root.style.setProperty("--theme-primary", theme.colors.primary);
    root.style.setProperty("--theme-secondary", theme.colors.secondary);
    root.style.setProperty("--theme-text-primary", theme.colors.textPrimary);
  }, [theme, themeName]);

  const toggleTheme = () => {
    const newThemeName = 
      themeName === "light" ? "darker" :
      themeName === "darker" ? "dark" :
      themeName === "dark" ? "darknight" :
      "light";
      
    const newTheme = THEMES[newThemeName];
    setThemeName(newThemeName);
    setTheme(newTheme);
};

  const switchToTheme = (newThemeName) => {
    if (THEMES[newThemeName]) {
      setThemeName(newThemeName);
      setTheme(THEMES[newThemeName]);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, toggleTheme, switchToTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
