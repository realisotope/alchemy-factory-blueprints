import { useTheme } from "../lib/ThemeContext";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { themeName, toggleTheme } = useTheme();
  const isDark = themeName === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition flex items-center justify-center hover:opacity-70 hover:scale-105"
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      style={{
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.5)" : "rgba(91, 74, 57, 0.5)",
        border: `2px solid ${isDark ? "#0ea5e9" : "#bba664"}`,
        color: isDark ? "#fbbf24" : "#fcd34d",
      }}
    >
      {isDark ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
