import { supabase } from "../lib/supabase";

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
        <span className="text-sm text-gray-700">
          Welcome, <strong>{user.user_metadata?.name}</strong>
        </span>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
    >
      Login with Discord
    </button>
  );
}
