import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "./lib/supabase";
import { isValidUUID } from "./lib/sanitization";
import { isUUID } from "./lib/slugUtils";
import { Upload, X, BookOpen, Info, ChevronDown } from "lucide-react";
import { useTheme } from "./lib/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import DiscordLogin from "./components/DiscordLogin";
import BlueprintGallery from "./components/BlueprintGallery";
import ThemeToggle from "./components/ThemeToggle";

// Lazy load heavy components
const UploadModal = lazy(() => import("./components/UploadModal"));
const BlueprintFolderSync = lazy(() => import("./components/BlueprintFolderSync"));
const SavegameSync = lazy(() => import("./components/SavegameSync"));

// Simple loading fallback for lazy components
function LazyComponentFallback() {
  const { theme } = useTheme();
  return (
    <div style={{ color: theme.colors.textSecondary }}>
      <span className="text-sm">Loading...</span>
    </div>
  );
}

// Changelog component
function ChangelogAccordion({ theme }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const changelog = [
    {
      version: "v0.9.5",
      date: "Jan 26, 2026",
      month: "January 2026",
      changes: [
        {
          text: "Added Blueprint 'Watermark/Branding' Feature",
          sub: [
            "Blueprints will now include a <1kb thumbnail image embedded (Added upon upload)",
            "This makes it a lot easier to identify blueprints in your downloads folder and such",
            "The image contains in clear text: Alchemy Factory Blueprint File",
          ]
        },
        {
          text: "Refactor and performance improvements",
          sub: [
            "Removed old dependencies and code",
            "Removed support for uploading .af blueprints (can better support pngs)",
            "Removed zip compression for large blueprints (not needed anymore with pngs)",
            "Improved caching and load times across the site (Redis caching)",
            "Improved error handling and reporting",
          ]
        },
        "Added check to prevent users from uploading blueprints to the preview image slots.",
      ]
    },
    {
      version: "v0.9.1",
      date: "Jan 17, 2026",
      month: "January 2026",
      changes: [
        {
          text: "Added grouped/multi blueprint support (2-4 parts per blueprint)",
          sub: [
            "Individual and combined parsed blueprint materials/buildings/stats",
            "Extract and auto display custom image from multi part .png blueprints as the preview images",
            "Multi download all parts, or download individually by selecting a part tab",
          ]
        },
        {
          text: "Implemented save game sync/compatibility checker",
          sub: [
            "Load your SaveGame.sav from the header button to parse and sync it's data",
            "Blueprints will be updated to show which items you may not have unlocked yet in red text.",
          ]
        },
        "Minor site design tweaks and refactor",
      ]
    },
    {
      version: "v0.9.0",
      date: "Jan 12, 2026",
      month: "January 2026",
      changes: [
        {
          text: "Add support for uploading/parsing new .png blueprints",
          sub: [
            "Strip large image data from .png blueprints before uploading and parsing",
            "Extract and auto display custom image from .png blueprints as the preview image",
          ]
        },
        "Added extra breakdown tab/stats for materials/buildings with grid/compact view.",
        "Added blueprint folder sync to check local installation/version status of blueprints",
        "Reworked sharing urls to use titled slugs (backwards compat with ids)",
        "Added blueprint navigation buttons for next/previous blueprint",
        "Fixed re-parsing of blueprint when new updated file is provided."
      ]
    },
    {
      version: "v0.8.0",
      date: "Jan 8, 2026",
      month: "January 2026",
      changes: [
        {
          text: "Implement blueprint parser",
          sub: [
            "Added materials and buildings display on blueprint detail view.",
            "Moved all icons into optimized spritesheets for performance",
            "Added themed tooltips for icons",
          ]
        },
        "Improved cache control",
        "Added themes with support across all components",
        "Added creator/author cards that will appear in search results that match their name",
        "Added my uploads and liked button filters next to search",
        "Multi image support with navigation",
      ]
    },
    {
      version: "v0.4.0",
      date: "Dec 14, 2025",
      month: "December 2025",
      changes: [
        "Share blueprints via url",
        "Compression improvements",
        "Sanitization/Validation improvements",
        "Drag and drop upload support",
        "Restyle/Responsiveness/Lightbox",
      ]
    },
    {
      version: "v0.2.0",
      date: "Dec 1, 2025",
      month: "December 2025",
      changes: [
        "Initial release of Alchemy Factory Blueprints site",
        "Blueprint upload and sharing functionality",
        "Blueprint gallery with search and filtering",
        "Discord authentication",
      ]
    },
  ];

  // Group changelog by month
  const groupedByMonth = changelog.reduce((acc, item) => {
    if (!acc[item.month]) {
      acc[item.month] = [];
    }
    acc[item.month].push(item);
    return acc;
  }, {});

  // Sort months in descending order (newest first)
  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => {
    return new Date(b) - new Date(a);
  });

  return (
    <div style={{ borderColor: theme.colors.elementBorder }} className="border rounded-lg overflow-hidden">
      {/* Single Changelog Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between transition font-semibold"
        style={{
          backgroundColor: `${theme.colors.elementBgDark}80`,
          color: theme.colors.accentYellow
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${theme.colors.elementBgDark}B3`}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${theme.colors.elementBgDark}80`}
      >
        <span>📋 Changelog</span>
        <ChevronDown 
          className="w-5 h-5 transition-transform"
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Changelog Content */}
      {isExpanded && (
        <div style={{ backgroundColor: `${theme.colors.elementBgDark}40` }} className="p-4 space-y-4">
          {sortedMonths.map((month) => (
            <div key={month}>
              {/* Month Header */}
              <h3 style={{ color: theme.colors.accentYellow, borderColor: `${theme.colors.elementBorder}60` }} className="text-sm font-bold mb-3 pb-2 border-b">
                {month}
              </h3>

              {/* Versions in Month */}
              <div className="space-y-3 ml-2">
                {groupedByMonth[month].map((item, idx) => (
                  <div key={item.version}>
                    {/* Version Header */}
                    <div className="flex items-baseline gap-3 mb-2">
                      <span style={{ color: theme.colors.accentYellow }} className="font-bold text-sm">{item.version}</span>
                      <span className="text-xs opacity-60" style={{ color: theme.colors.textSecondary }}>{item.date}</span>
                    </div>

                    {/* Version Changes */}
                    <ul className="space-y-1 text-xs ml-3 pb-3" style={{ color: theme.colors.textSecondary }}>
                      {item.changes.map((change, changeIdx) => {
                        const isNested = typeof change === 'object';
                        const content = isNested ? change.text : change;

                        return (
                          <li key={changeIdx} className="flex flex-col">
                            {/* Main Change Item */}
                            <div className="flex gap-2">
                              <span className="flex-shrink-0 opacity-50">→</span>
                              <span>{content}</span>
                            </div>

                            {/* Sub-items */}
                            {isNested && change.sub && (
                              <ul className="mt-1 ml-5 space-y-1 border-l pl-3" style={{ borderColor: `${theme.colors.elementBorder}40` }}>
                                {change.sub.map((subItem, subIdx) => (
                                  <li key={subIdx} className="flex gap-2 opacity-90">
                                    <span className="flex-shrink-0 text-[10px] mt-0.5">•</span>
                                    <span>{subItem}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {/* Separator between versions (except last) */}
                    {idx < groupedByMonth[month].length - 1 && (
                      <div style={{ borderColor: `${theme.colors.elementBorder}30` }} className="border-b my-2" />
                    )}
                  </div>
                ))}
              </div>

              {/* Separator between months (except last) */}
              {sortedMonths.indexOf(month) < sortedMonths.length - 1 && (
                <div style={{ borderColor: `${theme.colors.elementBorder}50` }} className="border-b my-4" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { theme } = useTheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshGallery, setRefreshGallery] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isHowToOpen, setIsHowToOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [initialBlueprintId, setInitialBlueprintId] = useState(null);
  const [galleryMessage, setGalleryMessage] = useState(null);

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

  const handleUploadSuccess = (message) => {
    setRefreshGallery((prev) => prev + 1);
    if (message) {
      setGalleryMessage(message);
    }
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
        <header className="text-white shadow-2x1 top-0 z-50" >
          <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
            </div>
            <div className="hidden sm:flex flex-col sm:flex-row gap-2 sm:gap-3 items-end sm:items-center sm:justify-end flex-shrink-0 ml-4">
              <ThemeToggle />
              <Suspense fallback={null}>
                <SavegameSync />
              </Suspense>
              <Suspense fallback={null}>
                <BlueprintFolderSync />
              </Suspense>
              <button
                onClick={() => setIsInfoModalOpen(true)}
                style={{
                  backgroundColor: `${theme.colors.tertiary}80`,
                  borderColor: theme.colors.headerBorder,
                  color: theme.colors.textPrimary,
                }}
                className="flex items-center gap-2 text-sm sm:text-base border-2 font-semibold py-2 px-3 sm:px-4 rounded-lg transition shadow-lg hover:shadow-xl hover:scale-105 hover:opacity-70 whitespace-nowrap"
              >
                <Info className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline" data-tooltip="More Information & Changelog" data-tooltip-position="bottom">Info</span>
                <span className="sm:hidden">More Information</span>
              </button>
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
        <main className="max-w-7xl 4k:max-w-[120rem] mx-auto px-4 py-4 flex-grow w-full min-w-0 relative">
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
              <h2
                style={{
                  backgroundColor: theme.colors.elementBg,
                  color: theme.colors.accentYellow,
                }}
                className="flex items-center justify-center text-5xl font-bold bg-clip-text text-transparent mb-3"
              >
                <span className="mr-3">⚗️</span>
                Alchemy Factory Blueprints
                <span className="ml-3 transform scale-x-[-1]">⚗️</span>
              </h2>
              <ErrorBoundary name="BlueprintGalleryWrapper">
                <BlueprintGallery user={user} refreshTrigger={refreshGallery} initialBlueprintId={initialBlueprintId} initialMessage={galleryMessage} onMessageShown={() => setGalleryMessage(null)} />
              </ErrorBoundary>
            </section>
          </div>
        </main>

        {/* Upload Modal */}
        <ErrorBoundary name="UploadModalWrapper">
          <Suspense fallback={<LazyComponentFallback />}>
            <UploadModal
              isOpen={isUploadModalOpen}
              onClose={() => setIsUploadModalOpen(false)}
              user={user}
              onUploadSuccess={handleUploadSuccess}
            />
          </Suspense>
        </ErrorBoundary>

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
                  <p className="mb-2">Blueprint files are typically stored in your local appdata.</p>
                  <p className="mb-2">You can copy and paste the below text into the Windows File Explorer address bar to quickly navigate to the folder.</p>
                  <code style={{
                    backgroundColor: `${theme.colors.elementBgDark}`,
                  }} className="p-3 rounded-lg block text-sm overflow-x-auto">
                    %localappdata%\AlchemyFactory\Saved\Blueprints
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
              </div>
            </div>
          </div>
        )}

        {/* Info Modal */}
        {isInfoModalOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsInfoModalOpen(false)}>
            <div style={{
              backgroundColor: theme.colors.elementBg,
              borderColor: theme.colors.elementBorder,
            }} className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div style={{
                background: `linear-gradient(to right, ${theme.colors.headerGradientFrom}, ${theme.colors.headerGradientVia}, ${theme.colors.headerGradientTo})`,
              }} className="sticky top-0 z-10 text-white p-6 flex items-center justify-between">
                <h2 style={{ color: theme.colors.accentYellow }} className="text-2xl font-bold flex-1">Information</h2>
                <button
                  onClick={() => setIsInfoModalOpen(false)}
                  className="ml-4 p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              {/* Content */}
              <div className="p-6 space-y-6" style={{ color: theme.colors.textPrimary }}>
                <h3 style={{ color: theme.colors.accentYellow }} className="text-xl font-bold mb-2">Welcome to Alchemy Factory Blueprints!</h3>
                This website allows you to upload, share, and explore blueprints created by the Alchemy Factory community. Whether you're looking for efficient factory designs or want to showcase your own creations, you've come to the right place!
                <p className="font-bold">We do not run ads, utilize tracking pixels, sell user data, or collect any personal data beyond what is necessary for authentication, blueprint management and performance metrics.</p>
                <section>
                  <h3 style={{ color: theme.colors.accentYellow }} className="text-xl font-bold mb-3">💾 Save Game Sync</h3>
                  <p className="mb-2 font-bold">Check blueprint compatibility against your current game save!</p>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>Click the <b>Save</b> button in the header.</li>
                    <li>Select your SaveGame.sav file from your Alchemy Factory Saved folder.</li>
                    <li>Your unlocked materials and buildings will be automatically parsed and stored.</li>
                    <li>When viewing blueprints, any materials/recipes/buildings you have not unlocked will be highlighted in red and displayed in the breakdown.</li>
                  </ol>
                  <code style={{
                    backgroundColor: `${theme.colors.elementBgDark}`,
                  }} className="p-3 rounded-lg block text-sm overflow-x-auto my-2">
                    %localappdata%\AlchemyFactory\Saved\SaveGames
                  </code>
                </section>

                <section>
                  <h3 style={{ color: theme.colors.accentYellow }} className="text-xl font-bold mb-3">📂 Blueprint Folder Sync</h3>
                  <p className="mb-2 font-bold">Sync your local blueprints with the site to see installation status!</p>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>Click the <b>Sync</b> folder button in the header.</li>
                    <li>Go into your Alchemy Factory Blueprints folder and click upload.</li>
                    <li>The site will match your local blueprints by filenames/timestamp.</li>
                    <li>The site will now display if a blueprint is installed or has an available update.</li>
                  </ol>
                  <code style={{
                    backgroundColor: `${theme.colors.elementBgDark}`,
                  }} className="p-3 rounded-lg block text-sm overflow-x-auto my-2">
                    %localappdata%\AlchemyFactory\Saved\Blueprints
                  </code>
                </section>

                <section>
                  <h3 style={{ color: theme.colors.accentYellow }} className="text-xl font-bold mb-3">🔗 Links & Resources</h3>
                  <div className="grid grid-cols-2 gap-3 ml-2">
                    <a href="https://github.com/realisotope/alchemy-factory-blueprints/issues" target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.accentYellow }} className="hover:opacity-70 transition">
                      → Report Issue/Suggestion
                    </a>
                    <a href="https://discord.gg/JcvCKzJ9kS" target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.accentYellow }} className="hover:opacity-70 transition">
                      → Official Alchemy Factory Discord
                    </a>
                    <a href="https://alchemy-save-parser.faulty.ws/saveParser" target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.accentYellow }} className="hover:opacity-70 transition">
                      → Blueprint/Save Parser (faulty)
                    </a>
                    <a href="https://alchemy-factory-codex.com/" target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.accentYellow }} className="hover:opacity-70 transition">
                      → Game Wiki/Codex
                    </a>
                    <a href="https://joejoesgit.github.io/AlchemyFactoryCalculator " target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.accentYellow }} className="hover:opacity-70 transition">
                      → Planner/Calculator
                    </a>
                    <a href="https://alchemyfactorytools.com" target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.accentYellow }} className="hover:opacity-70 transition">
                      → Planner
                    </a>
                  </div>
                  <p className="font-bold text-center my-4">This is a fan-made site and is not affiliated with or endorsed by the creators of Alchemy Factory.</p>
                </section>
                <section>
                  <ChangelogAccordion theme={theme} />
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
          <p>by <b>realisotope</b> - <b><a href="https://github.com/realisotope/alchemy-factory-blueprints" style={{ color: theme.colors.accentYellow }}>GitHub Source Code</a> | Privacy & Terms</b></p>
        </footer>
      </div>
    </div>
  );
}
