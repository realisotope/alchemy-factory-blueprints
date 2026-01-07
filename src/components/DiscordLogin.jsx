import { supabase } from "../lib/supabase";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { useTheme } from "../lib/ThemeContext";

export default function DiscordLogin({ user, onLogout }) {
  const { theme } = useTheme();

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: "https://edcfmaofcobqzmsylcfv.supabase.co/auth/v1/callback",
      },
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    onLogout?.();
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={logout}
          style={{
            backgroundColor: theme.name === "dark" ? "#dc2626" : "#991b1b",
          }}
          className="px-4 py-2 hover:opacity-90 text-white rounded-lg font-semibold transition"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      style={{
        backgroundColor: theme.colors.buttonBg,
        color: theme.colors.buttonText,
      }}
      className="px-4 py-2 rounded-lg shadow-lg font-semibold transition hover:shadow-xl hover:opacity-90"
    >
      Login with Discord
    </button>
  );
}
