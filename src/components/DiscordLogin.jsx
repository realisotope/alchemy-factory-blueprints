import { supabase } from "../lib/supabase";
import { stripDiscordDiscriminator } from "../lib/discordUtils";

export default function DiscordLogin({ user, onLogout }) {
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
          className="px-4 py-2 bg-red-600/70 hover:bg-red-700 text-white rounded-lg font-semibold transition"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="px-4 py-2 bg-blue-600/70 hover:bg-blue-700 text-white rounded-lg shadow-lg font-semibold transition hover:shadow-xl"
    >
      Login with Discord
    </button>
  );
}
