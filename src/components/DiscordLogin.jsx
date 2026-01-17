import { useState } from "react";
import { supabase } from "../lib/supabase";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { useTheme } from "../lib/ThemeContext";
import { ClientRateLimiter } from "../lib/rateLimiter";

export default function DiscordLogin({ user, onLogout }) {
  const { theme } = useTheme();
  const [authError, setAuthError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  async function login() {
    // Rate limiting check for auth attempts
    const authLimiter = new ClientRateLimiter('discord-auth', 'auth');
    const limitStatus = authLimiter.checkLimit();

    if (!limitStatus.allowed) {
      const errorMsg = limitStatus.reason === 'cooldown' 
        ? `Please wait ${limitStatus.resetTime} second${limitStatus.resetTime !== 1 ? 's' : ''} before trying again`
        : `Too many login attempts. Please try again in ${Math.ceil(limitStatus.resetTime / 60)} minutes`;
      setAuthError(errorMsg);
      setTimeout(() => setAuthError(null), 5000);
      return;
    }

    setIsLoading(true);
    setAuthError(null);

    try {
      // Record the auth attempt
      authLimiter.recordAttempt();

      await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: "https://edcfmaofcobqzmsylcfv.supabase.co/auth/v1/callback",
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      setAuthError("Failed to initiate login. Please try again.");
      setTimeout(() => setAuthError(null), 5000);
    } finally {
      setIsLoading(false);
    }
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
            backgroundColor: "#991b1b"
          }}
          className="px-4 py-2 hover:opacity-70 hover:scale-105 text-white rounded-lg font-semibold transition"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={login}
        disabled={isLoading}
        style={{
          backgroundColor: isLoading ? `${theme.colors.buttonBgAlt}80` : theme.colors.buttonBgAlt,
          color: theme.colors.buttonText,
        }}
        className="px-4 py-2 rounded-lg shadow-lg font-semibold transition hover:shadow-xl hover:scale-105 hover:opacity-70 disabled:cursor-not-allowed"
      >
        {isLoading ? "Logging in..." : "Login with Discord"}
      </button>
      {authError && (
        <div style={{ color: '#ef4444' }} className="text-xs text-center max-w-xs">
          {authError}
        </div>
      )}
    </div>
  );
}
