import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { isValidUUID } from "./lib/sanitization";
import { isUUID } from "./lib/slugUtils";
import { Upload, X, BookOpen } from "lucide-react";
import { useTheme } from "./lib/ThemeContext";
import DiscordLogin from "./components/DiscordLogin";
import UploadModal from "./components/UploadModal";
import BlueprintGallery from "./components/BlueprintGallery";
import BlueprintFolderSync from "./components/BlueprintFolderSync";
import ThemeToggle from "./components/ThemeToggle";

export default function App() {
  const { theme } = useTheme();
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
    // Check for blueprint ID in URL params (legacy format)
    const params = new URLSearchParams(window.location.search);
    const blueprintIdParam = params.get("blueprintId");

    // Check for blueprint ID or slug in path
    const pathMatch = window.location.pathname.match(/^\/blueprint\/([a-z0-9-]+)$/i);
    const blueprintIdentifier = pathMatch ? pathMatch[1] : null;

    const identifier = blueprintIdentifier || blueprintIdParam;

    // Accept both UUID format and slug format
    if (identifier && (isValidUUID(identifier) || identifier.includes('-'))) {
      setInitialBlueprintId(identifier);
      window.history.replaceState({}, document.title, '/');
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.colors.secondary }}>
        <div className="text-center">
          <div className="text-5xl mb-4">⚗️</div>
          <p className="text-2xl font-bold" style={{ color: theme.colors.accentYellow }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full relative flex flex-col"
      style={{
        backgroundColor: theme.colors.primary,
      }}
    >
      {/* Global Styles */}
      <style>{`
        input::placeholder,
        textarea::placeholder {
          color: ${theme.colors.textPrimary};
          opacity: 0.5;
        }

        /* Global tooltip styling using data-tooltip attribute */
        [data-tooltip] {
          position: relative;
        }

        /* Default: tooltip above the element */
        [data-tooltip]::before {
          content: attr(data-tooltip);
          position: absolute;
          bottom: 100%;
          left: 50%;
          margin-bottom: 0.75rem;
          padding: 6px 12px;
          background-color: ${theme.colors.cardBg};
          color: ${theme.colors.textPrimary};
          border: 1px solid ${theme.colors.cardBorder};
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 500;
          white-space: nowrap;
          pointer-events: none;
          z-index: 999999;
          opacity: 0;
          visibility: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          transition: opacity 0.2s, visibility 0.2s;
          transform: translateX(-50%);
        }

        /* Tooltip below the element when data-tooltip-position="bottom" */
        [data-tooltip-position="bottom"]::before {
          bottom: auto;
          top: 100%;
          margin-bottom: 0;
          margin-top: 0.75rem;
        }

        [data-tooltip]:hover::before,
        [data-tooltip]:focus::before {
          opacity: 1;
          visibility: visible;
        }

        /* Scale content to 90% for 1080p monitors - looks better for now */
        @media (min-height: 900px) and (max-height: 1050px) and (min-width: 1800px) {
          html {
            zoom: 0.9;
          }
          
          /* Increase blueprint detail container height for 1080p */
          .blueprint-detail-1080p {
            max-height: calc(100vh + 6vh) !important;
          }
        }
      `}</style>

      <div className="relative z-10 flex flex-col flex-grow">
        {/* Header */}
        <header style={{
          background: `linear-gradient(to right, ${theme.colors.headerGradientFrom}, ${theme.colors.headerGradientVia}, ${theme.colors.headerGradientTo})`,
          borderBottomColor: theme.colors.headerBorder,
        }} className="text-white shadow-2x1 sticky top-0 z-50 border-b" >
          <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-4xl flex-shrink-0">⚗️</span>
              <h1 style={{
                backgroundImage: `linear-gradient(to right, ${theme.colors.accentYellow}, ${theme.colors.accentLighter})`,
              }} className="text-3xl font-bold bg-clip-text text-transparent truncate">
                Alchemy Factory Blueprints
              </h1>
            </div>
            <div className="hidden sm:flex flex-col sm:flex-row gap-2 sm:gap-3 items-end sm:items-center sm:justify-end flex-shrink-0 ml-4">
              <ThemeToggle />
              <BlueprintFolderSync />
              <button
                onClick={() => setIsHowToOpen(true)}
                style={{
                  backgroundColor: `${theme.colors.tertiary}80`,
                  borderColor: theme.colors.headerBorder,
                  color: theme.colors.textPrimary,
                }}
                className="flex items-center gap-2 text-sm sm:text-base border-2 font-semibold py-2 px-3 sm:px-4 rounded-lg transition shadow-lg hover:shadow-xl hover:scale-105 hover:opacity-70 whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline" data-tooltip="How to Use Blueprints" data-tooltip-position="bottom">How to Use Blueprints</span>
                <span className="sm:hidden">How to Use</span>
              </button>
              {user ? (
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  style={{
                    backgroundColor: `${theme.colors.tertiary}80`,
                    borderColor: theme.colors.headerBorder,
                    color: theme.colors.textPrimary,
                  }}
                  className="inline-flex items-center gap-2 border-2 text-sm sm:text-base font-semibold py-2 px-4 sm:px-4 rounded-lg transition shadow-lg hover:shadow-xl hover:scale-105 hover:opacity-70 whitespace-nowrap"
                >
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="hidden sm:inline" data-tooltip="Upload a Blueprint" data-tooltip-position="bottom">Upload</span>
                  <span className="sm:hidden">Upload</span>
                </button>
              ) : (
                <></>)}
              <DiscordLogin user={user} onLogout={handleLogout} />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl 4k:max-w-[120rem] mx-auto px-4 py-6 space-y-4 flex-grow w-full min-w-0 relative">
          {/* Background Pattern */}
          <div className="fixed inset-0 pointer-events-none -z-10">
            <div className="relative h-full w-full [&>div]:absolute [&>div]:h-full [&>div]:w-full [&>div]:[background-size:36px_36px] [&>div]:[mask-image:radial-gradient(circle_at_50%_50%,#000_0%,transparent_90%)]"
              style={{
                opacity: 0.6,
                '--dot-color': theme.colors.accentYellow
              }}>
              <div style={{
                backgroundImage: `linear-gradient(0deg, ${theme.colors.gridTo} 1px, transparent 1px), linear-gradient(90deg, ${theme.colors.gridFrom} 1px, transparent 1px)`
              }}></div>
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10">

            {/* Gallery Section */}
            <section>
              <h2 style={{
                backgroundColor: theme.colors.elementBg,
                color: theme.colors.accentYellow,
              }} className="text-3xl font-bold bg-clip-text text-transparent mb-3">
                Blueprint Gallery
              </h2>
              <BlueprintGallery user={user} refreshTrigger={refreshGallery} initialBlueprintId={initialBlueprintId} />
            </section>
          </div>
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
            <div style={{
              backgroundColor: theme.colors.elementBg,
              borderColor: theme.colors.elementBorder,
            }} className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div style={{
                background: `linear-gradient(to right, ${theme.colors.headerGradientFrom}, ${theme.colors.headerGradientVia}, ${theme.colors.headerGradientTo})`,
              }} className="sticky top-0 z-10 text-white p-6 flex items-center justify-between">
                <h2 style={{ color: theme.colors.accentYellow }} className="text-2xl font-bold flex-1">How to Use Blueprints</h2>
                <button
                  onClick={() => setIsHowToOpen(false)}
                  className="ml-4 p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6" style={{ color: theme.colors.textPrimary }}>
                <section>
                  <h3 style={{ color: theme.colors.accentYellow }} className="text-xl font-bold mb-3">🔧 What are Blueprints?</h3>
                  <p>
                    Blueprints are saved factory designs that allow you to share complex production setups with other players. They contain information about machine placement, connections, and configurations.
                  </p>
                </section>

                <section>
                  <h3 style={{ color: theme.colors.accentYellow }} className="text-xl font-bold mb-3">📥 Importing Blueprints</h3>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>Download the blueprint file (.af) from this site.</li>
                    <i>(Some larger blueprints may be compressed into a zip file.)</i>
                    <li>Drag and drop the .af from the zip into the games blueprints directory.</li>
                    <li>Your newly downloaded blueprint will appear in-game without any restarts.</li>
                  </ol>
                </section>

                <section>
                  <h3 style={{ color: theme.colors.accentYellow }} className="text-xl font-bold mb-3">💾 File Storage</h3>
                  <p className="mb-2">Blueprint files are typically stored in:</p>
                  <code style={{
                    backgroundColor: `${theme.colors.elementBgDark}`,
                  }} className="p-3 rounded-lg block text-sm overflow-x-auto">
                    C:\Users\YOURUSERNAME\AppData\Local\AlchemyFactory\Saved\Blueprints\
                  </code>
                </section>

                <section>
                  <h3 style={{ color: theme.colors.accentYellow }} className="text-xl font-bold mb-3">📤 Exporting Your Blueprints</h3>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>In Alchemy Factory, select all the components you want to include in your blueprint.</li>
                    <li>Press <b>F</b> to confirm your selection and <b>H</b> to save your blueprint.</li>
                    <li>Click your new blueprint in the menu and hit the Export button.</li>
                  </ol>
                </section>

                <section>
                  <h3 style={{ color: theme.colors.accentYellow }} className="text-xl font-bold mb-3">❓ Tips & Tricks</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>Name your blueprints clearly for easy identification.</li>
                    <li>Take a screenshot to use as a preview image.</li>
                    <li>Write descriptions explaining what your blueprint produces.</li>
                    <li>Include information about production rates and efficiency.</li>
                  </ul>
                </section>

                <section>
                  <h3 style={{ color: theme.colors.accentYellow }} className="text-xl font-bold mb-3">📰 Other Game Tools/Resources</h3>
                  <p>Check out some other non-affiliated community resources for Alchemy Factory.</p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><a href="https://alchemy-factory-codex.com/" style={{ color: theme.colors.accentYellow }}>https://alchemy-factory-codex.com</a> (Wiki/Guide/Planner/Calculator)</li>
                    <li><a href="https://joejoesgit.github.io/AlchemyFactoryCalculator/" style={{ color: theme.colors.accentYellow }}>https://joejoesgit.github.io/AlchemyFactoryCalculator</a> (Planner)</li>
                    <li><a href="https://alchemyfactorytools.com/" style={{ color: theme.colors.accentYellow }}>https://alchemyfactorytools.com</a> (Planner)</li>
                    <ul><li><a href="https://alchemy-save-parser.faulty.ws/saveParser" style={{ color: theme.colors.accentYellow }}>https://alchemy-save-parser.faulty.ws/saveParser</a> (Save/BP Parser)</li>
                      <li>We currently uses this for parsing your blueprint/save data.</li></ul>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={{
          background: `linear-gradient(to right, ${theme.colors.headerGradientFrom}, ${theme.colors.headerGradientVia}, ${theme.colors.headerGradientTo})`,
          color: theme.colors.textPrimary,
          borderTopColor: theme.colors.headerBorder,
        }} className="text-center py-4 border-t mt-auto">
          <p>
            Upload and share your Alchemy Factory Blueprints - Not affiliated with Alchemy Factory.
          </p>
          <p>
            created with React, Vite, Vercel and Supabase
          </p>
          <p>by <b>realisotope</b> - <b><a href="https://github.com/realisotope/alchemy-factory-blueprints" style={{ color: theme.colors.accentYellow }}>GitHub Source Code</a></b></p>
        </footer>
      </div>
    </div>
  );
}
