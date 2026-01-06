import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { isValidUUID } from "./lib/sanitization";
import { Upload, X, BookOpen } from "lucide-react";
import DiscordLogin from "./components/DiscordLogin";
import UploadModal from "./components/UploadModal";
import BlueprintGallery from "./components/BlueprintGallery";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshGallery, setRefreshGallery] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isHowToOpen, setIsHowToOpen] = useState(false);
  const [initialBlueprintId, setInitialBlueprintId] = useState(null);

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

  useEffect(() => {
    // Check for blueprint ID in URL params
    const params = new URLSearchParams(window.location.search);
    const blueprintId = params.get("blueprintId");

    // Validate UUID format to prevent injection attacks
    if (blueprintId && isValidUUID(blueprintId)) {
      setInitialBlueprintId(blueprintId);
      // Remove the query param from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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
    <div
      className="min-h-screen w-full relative flex flex-col"
      style={{
        background: "#876e54",
        backgroundImage: `
        radial-gradient(circle, rgb(252, 211, 77) 1px, transparent 1px),
        radial-gradient(circle, rgba(159, 133, 105, 0.4) 1px, transparent 1px),
        radial-gradient(circle, rgba(135, 114, 90, 0.5) 1px, transparent 1px)
      `,
        backgroundSize: "72px 72px, 72px 72px, 100% 100%",
      }}
    >
      <div className="relative z-10 flex flex-col flex-grow">
        {/* Header */}
        <header className="bg-gradient-to-r from-[#a78158] via-[#9f7f5a] to-[#9b7956] text-white shadow-2x1 sticky top-0 z-50 border-b border-[#bba664]/50">
          <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">⚗️</span>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#fcd34d] to-[#fde047] bg-clip-text text-transparent">
                Alchemy Factory Blueprints
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <DiscordLogin user={user} onLogout={handleLogout} />
              <button
                onClick={() => setIsHowToOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-[#5b4a39]/50 to-[#59452e]/50 hover:from-[#dbb84a] hover:to-[#fbcd32] font-semibold py-2 px-4 rounded-lg transition shadow-lg hover:shadow-xl"
                title="How to use blueprints"
              >
                <BookOpen className="w-4 h-4" />
                How to Use Blueprints
              </button>
              {user ? (
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#dbb84a]/80 to-[#fbcd32]/70 hover:from-[#dbb84a] hover:to-[#fbcd32] hover:text-[#654e35] font-semibold py-2 px-8 rounded-lg transition shadow-lg hover:shadow-xl hover:shadow-[#fbcd32]/30"
                >
                  <Upload className="w-5 h-5" />
                  Upload Blueprint
                </button>
              ) : (
                <></>)}

            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-12 space-y-12 flex-grow w-full min-w-0">

          {/* Gallery Section */}
          <section>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-[#fcd34d] to-[#fde047] bg-clip-text text-transparent mb-2">
              Blueprint Gallery
            </h2>
            <BlueprintGallery user={user} refreshTrigger={refreshGallery} initialBlueprintId={initialBlueprintId} />
          </section>
        </main>

        {/* Upload Modal */}
        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          user={user}
          onUploadSuccess={handleUploadSuccess}
        />

        {/* How to Use Modal */}
        {isHowToOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsHowToOpen(false)}>
            <div className="bg-gradient-to-b from-[#b99a77] to-[#876e54] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#cfb153]" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-[#a78158] via-[#9f7f5a] to-[#9b7956] text-white p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-amber-300 flex-1">How to Use Blueprints</h2>
                <button
                  onClick={() => setIsHowToOpen(false)}
                  className="ml-4 p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                <section>
                  <h3 className="text-xl font-bold text-amber-300 mb-3">🔧 What are Blueprints?</h3>
                  <p>
                    Blueprints are saved factory designs that allow you to share complex production setups with other players. They contain information about machine placement, connections, and configurations.
                  </p>
                </section>

                <section>
                  <h3 className="text-xl font-bold text-amber-300 mb-3">📥 Importing Blueprints</h3>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>Download the blueprint file (.af) from this site.</li>
                    <i>(Some larger blueprints may be compressed into a zip file.)</i>
                    <li>Drag and drop the .af from the zip into the games blueprints directory.</li>
                    <li>Your newly downloaded blueprint will appear in-game without any restarts.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-xl font-bold text-amber-300 mb-3">💾 File Storage</h3>
                  <p className="mb-2">Blueprint files are typically stored in:</p>
                  <code className="bg-[#6f5d45]/50 p-3 rounded-lg block text-sm overflow-x-auto">
                    C:\Users\YOURUSERNAME\AppData\Local\AlchemyFactory\Saved\Blueprints\
                  </code>
                </section>

                <section>
                  <h3 className="text-xl font-bold text-amber-300 mb-3">📤 Exporting Your Blueprints</h3>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>In Alchemy Factory, select all the components you want to include in your blueprint.</li>
                    <li>Press <b>F</b> to confirm your selection and <b>H</b> to save your blueprint.</li>
                    <li>Click your new blueprint in the menu and hit the Export button.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-xl font-bold text-amber-300 mb-3">❓ Tips & Tricks</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>Name your blueprints clearly for easy identification.</li>
                    <li>Take a screenshot to use as a preview image.</li>
                    <li>Write descriptions explaining what your blueprint produces.</li>
                    <li>Include information about production rates and efficiency.</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="bg-gradient-to-r from-[#a78158] via-[#9f7f5a] to-[#9b7956] text-[#ffdca7] text-center py-4 border-t border-[#bba664]/50 mt-auto">
          <p>
            Upload and share your Alchemy Factory Blueprints - Not affiliated with Alchemy Factory.
          </p>
          <p>
            created with React, Vite, Vercel and Supabase
          </p>
          <p>by <b>realisotope</b> - <b><a href="https://github.com/realisotope/alchemy-factory-blueprints">GitHub Source Code</a></b></p>
        </footer>
      </div>
    </div>
  );
}
