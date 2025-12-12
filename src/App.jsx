import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { Upload } from "lucide-react";
import DiscordLogin from "./components/DiscordLogin";
import UploadModal from "./components/UploadModal";
import BlueprintGallery from "./components/BlueprintGallery";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshGallery, setRefreshGallery] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(authUser);
      setLoading(false);
    };

    checkAuth();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleUploadSuccess = () => {
    setRefreshGallery((prev) => prev + 1);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">⚗️</div>
          <p className="text-2xl text-amber-900 font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 text-white shadow-2xl sticky top-0 z-50 border-b border-purple-700">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">⚗️</span>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-yellow-300 bg-clip-text text-transparent">
              Alchemy Factory Blueprints
            </h1>
          </div>
          <DiscordLogin user={user} onLogout={handleLogout} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12 space-y-12">
        {/* Upload Section */}
        {user ? (
          <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 rounded-lg shadow-xl p-8 border border-purple-700/50 backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-amber-300 mb-4">
              ✨ Ready to share your blueprint?
            </h2>
            <p className="text-gray-300 mb-6">
              Upload your factory blueprint along with an image and description.
            </p>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-black font-semibold py-3 px-8 rounded-lg transition shadow-lg"
            >
              <Upload className="w-5 h-5" />
              Upload Blueprint
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 rounded-lg shadow-xl p-8 border border-blue-700/50 backdrop-blur-sm text-center">
            <h2 className="text-2xl font-bold text-blue-300 mb-2">
              🔐 Login to Upload Blueprints
            </h2>
            <p className="text-gray-300 mb-4">
              Sign in with Discord to share your factory blueprints with the community.
            </p>
            <DiscordLogin user={user} onLogout={handleLogout} />
          </div>
        )}

        {/* Gallery Section */}
        <section>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-yellow-300 bg-clip-text text-transparent mb-8">
            📚 Blueprint Gallery
          </h2>
          <BlueprintGallery user={user} refreshTrigger={refreshGallery} />
        </section>
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        user={user}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Footer */}
      <footer className="bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-950 text-gray-300 text-center py-6 mt-12 border-t border-purple-700">
        <p>
          Built with React, Vite, and Supabase • Upload and share your Alchemy Factory blueprints
        </p>
      </footer>
    </div>
  );
}
