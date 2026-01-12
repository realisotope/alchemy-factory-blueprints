import { useTheme } from "../lib/ThemeContext";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { themeName, toggleTheme, theme } = useTheme();
  const isLightTheme = themeName === "darknight";

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition flex items-center justify-center hover:opacity-70 hover:scale-105 border-2"
      style={{
        backgroundColor: `${theme.colors.tertiary}80`,
        borderColor: theme.colors.headerBorder,
        color: theme.colors.textPrimary,
      }}
    >
      {isLightTheme ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
