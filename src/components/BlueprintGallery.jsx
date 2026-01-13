import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { Search, Download, Trash2, Loader, Heart, X, User } from "lucide-react";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { sanitizeCreatorName } from "../lib/sanitization";
import { getThumbnailUrl } from "../lib/imageOptimization";
import { transformParsedMaterials, transformParsedBuildings } from "../lib/blueprintMappings";
import { useTheme } from "../lib/ThemeContext";
import { deleteCloudinaryImage } from "../lib/cloudinaryDelete";
import BlueprintDetail from "./BlueprintDetail";
import BlueprintCard from "./BlueprintCard";
import CreatorCard from "./CreatorCard";

export default function BlueprintGallery({ user, refreshTrigger, initialBlueprintId }) {
  const { theme } = useTheme();
  const [blueprints, setBlueprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [selectedBlueprint, setSelectedBlueprint] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [downloadingId, setDownloadingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const initialBlueprintAppliedRef = useRef(false);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // Responsive items per page: 8 for desktop (4 cols, 2 rows), 12 for 4K (6 cols, 2 rows)
  const getItemsPerPage = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 3840 ? 12 : 8;
    }
    return 8;
  };
  
  const [itemsPerPage, setItemsPerPage] = useState(getItemsPerPage());

  // Update items per page on window resize
  useEffect(() => {
    const handleResize = () => {
      setItemsPerPage(getItemsPerPage());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchBlueprints();
    if (user) {
      fetchUserLikes();
    }
  }, [refreshTrigger, user]);

  // Handle initial blueprint ID from URL - only apply once
  useEffect(() => {
    if (initialBlueprintId && blueprints.length > 0 && !initialBlueprintAppliedRef.current) {
      // Try to find by ID first, then by slug
      const blueprint = blueprints.find((bp) => bp.id === initialBlueprintId || bp.slug === initialBlueprintId);
      if (blueprint) {
        setSelectedBlueprint(blueprint);
        initialBlueprintAppliedRef.current = true;
      }
    }
  }, [initialBlueprintId, blueprints]);

  const fetchUserLikes = async () => {
    try {
      const { data, error } = await supabase
        .from("blueprint_likes")
        .select("blueprint_id")
        .eq("user_id", user.id);

      if (error) throw error;
      setUserLikes(new Set(data?.map((like) => like.blueprint_id) || []));
    } catch (err) {
      console.error("Error fetching likes:", err);
    }
  };

  const fetchBlueprints = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("blueprints")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Process blueprints: ensure likes/downloads are set and transform parsed data
      const processedData = (data || []).map(bp => {
        // Transform materials and buildings from parsed data objects to arrays
        let materials = [];
        let buildings = [];
        
        try {
          if (bp.materials && typeof bp.materials === 'object' && !Array.isArray(bp.materials)) {
            materials = transformParsedMaterials(bp.materials);
          }
          
          if (bp.buildings && typeof bp.buildings === 'object' && !Array.isArray(bp.buildings)) {
            buildings = transformParsedBuildings(bp.buildings);
          }
        } catch (error) {
          console.error(`Error transforming parsed data for blueprint ${bp.id}:`, error);
          // Continue with empty arrays if transformation fails
        }
        
        return {
          ...bp,
          likes: bp.likes ?? 0,
          downloads: bp.downloads ?? 0,
          materials: materials,
          buildings: buildings,
          skills: bp.skills || []
        };
      });
      
      setBlueprints(processedData);
    } catch (err) {
      console.error("Error fetching blueprints:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (blueprintId, currentlyLiked) => {
    if (!user) {
      alert("Please login to like blueprints");
      return;
    }

    try {
      if (currentlyLiked) {
        // Remove like

        const { error } = await supabase
          .from("blueprint_likes")
          .delete()
          .eq("blueprint_id", blueprintId)
          .eq("user_id", user.id);

        if (error) throw error;
        setUserLikes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(blueprintId);
          return newSet;
        });
      } else {
        // Add like
        const { error } = await supabase.from("blueprint_likes").insert([
          {
            blueprint_id: blueprintId,
            user_id: user.id,
          },
        ]);

        if (error) throw error;
        setUserLikes((prev) => new Set(prev).add(blueprintId));
      }
      
      // Refetch the updated blueprint to ensure we have the latest like count
      const { data: updatedBlueprint, error: fetchError } = await supabase
        .from("blueprints")
        .select("*")
        .eq("id", blueprintId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Transform materials and buildings from database objects to arrays
      let materials = [];
      let buildings = [];
      
      if (updatedBlueprint.materials && typeof updatedBlueprint.materials === 'object') {
        materials = transformParsedMaterials(updatedBlueprint.materials);
      }
      
      if (updatedBlueprint.buildings && typeof updatedBlueprint.buildings === 'object') {
        buildings = transformParsedBuildings(updatedBlueprint.buildings);
      }
      
      // Normalize the data and preserve materials/buildings/skills from the existing blueprint
      const normalizedBp = {
        ...updatedBlueprint,
        likes: updatedBlueprint?.likes ?? 0,
        downloads: updatedBlueprint?.downloads ?? 0,
        materials: materials.length > 0 ? materials : (selectedBlueprint?.materials ?? []),
        buildings: buildings.length > 0 ? buildings : (selectedBlueprint?.buildings ?? []),
        skills: updatedBlueprint?.skills ?? selectedBlueprint?.skills ?? []
      };
      
      // Update blueprints array - preserve materials/buildings/skills from existing data
      setBlueprints((prev) =>
        prev.map((bp) =>
          bp.id === blueprintId ? {
            ...normalizedBp,
            materials: bp.materials ?? normalizedBp.materials ?? [],
            buildings: bp.buildings ?? normalizedBp.buildings ?? [],
            skills: bp.skills ?? normalizedBp.skills ?? []
          } : bp
        )
      );
      
      // Update selected blueprint
      if (selectedBlueprint?.id === blueprintId) {
        setSelectedBlueprint((prev) => 
          prev ? { ...prev, likes: normalizedBp.likes } : null
        );
      }
    } catch (err) {
      console.error("Error updating like:", err);
      alert("Failed to update like");
    }
  };

  const handleDownload = async (blueprint) => {
    setDownloadingId(blueprint.id);
    try {
      // Increment download count via secure function
      const { error } = await supabase.rpc('increment_blueprint_downloads', {
        blueprint_id: blueprint.id
      });

      if (error) throw error;
      
      // Refetch the updated blueprint to ensure we have the latest download count
      const { data: updatedBlueprint, error: fetchError } = await supabase
        .from("blueprints")
        .select("*")
        .eq("id", blueprint.id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Transform materials and buildings from database objects to arrays
      let materials = [];
      let buildings = [];
      
      if (updatedBlueprint.materials && typeof updatedBlueprint.materials === 'object') {
        materials = transformParsedMaterials(updatedBlueprint.materials);
      }
      
      if (updatedBlueprint.buildings && typeof updatedBlueprint.buildings === 'object') {
        buildings = transformParsedBuildings(updatedBlueprint.buildings);
      }
      
      // Normalize the data and preserve materials/buildings/skills from the existing blueprint
      const normalizedBp = {
        ...updatedBlueprint,
        likes: updatedBlueprint?.likes ?? 0,
        downloads: updatedBlueprint?.downloads ?? 0,
        materials: materials.length > 0 ? materials : (selectedBlueprint?.materials ?? []),
        buildings: buildings.length > 0 ? buildings : (selectedBlueprint?.buildings ?? []),
        skills: updatedBlueprint?.skills ?? selectedBlueprint?.skills ?? []
      };
      
      // Update blueprints array - preserve materials/buildings/skills from existing data
      setBlueprints((prev) =>
        prev.map((bp) =>
          bp.id === blueprint.id ? {
            ...normalizedBp,
            materials: bp.materials ?? normalizedBp.materials ?? [],
            buildings: bp.buildings ?? normalizedBp.buildings ?? [],
            skills: bp.skills ?? normalizedBp.skills ?? []
          } : bp
        )
      );
      
      // Update selected blueprint if it's the one being downloaded
      if (selectedBlueprint?.id === blueprint.id) {
        setSelectedBlueprint((prev) => 
          prev ? { ...prev, downloads: normalizedBp.downloads } : null
        );
      }

      // Trigger download
      const a = document.createElement("a");
      a.href = blueprint.file_url;
      a.download = blueprint.title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error downloading:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (blueprint) => {
    if (!user) {
      alert("You must be logged in to delete blueprints");
      return;
    }

    // Verify user owns this blueprint
    if (blueprint.user_id !== user.id) {
      alert("You can only delete your own blueprints");
      console.warn(`Unauthorized delete attempt: ${user.id} tried to delete blueprint by ${blueprint.user_id}`);
      return;
    }

    if (!window.confirm("Are you sure you want to delete this blueprint?")) {
      return;
    }

    setDeleting(blueprint.id);
    try {
      // Delete all Cloudinary images if they exist
      if (blueprint.image_url) {
        await deleteCloudinaryImage(blueprint.image_url);
      }
      if (blueprint.image_url_2) {
        await deleteCloudinaryImage(blueprint.image_url_2);
      }
      if (blueprint.image_url_3) {
        await deleteCloudinaryImage(blueprint.image_url_3);
      }

      // Delete from storage
      if (blueprint.file_url) {
        const filePath = blueprint.file_url.split("/").pop();
        await supabase.storage.from("blueprints").remove([filePath]);
      }

      // Delete from database - RLS policy will verify user_id
      const { error } = await supabase
        .from("blueprints")
        .delete()
        .eq("id", blueprint.id)
        .eq("user_id", user.id);

      if (error) throw error;

      setBlueprints(blueprints.filter((b) => b.id !== blueprint.id));
    } catch (err) {
      console.error("Error deleting blueprint:", err);
      alert("Failed to delete blueprint");
    } finally {
      setDeleting(null);
    }
  };

  const filteredBlueprints = blueprints
    .filter((bp) => {
      // Filter by favorites if active
      if (showFavoritesOnly && !userLikes.has(bp.id)) {
        return false;
      }
      // Filter by search term
      return bp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bp.description && bp.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (bp.tags && bp.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (bp.creator_name && bp.creator_name.toLowerCase().includes(searchTerm.toLowerCase()));
    })
    .sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.created_at) - new Date(b.created_at);
      } else if (sortBy === "alphabetical") {
        return a.title.localeCompare(b.title);
      } else if (sortBy === "popular") {
        return (b.likes || 0) - (a.likes || 0);
      } else if (sortBy === "updated") {
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      } else if (sortBy === "downloaded") {
        return (b.downloads || 0) - (a.downloads || 0);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

  // Pagination
  const totalPages = Math.ceil(filteredBlueprints.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBlueprints = filteredBlueprints.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Reset to page 1 when search changes
  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSort = (value) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const handleSearchByCreator = (creatorName) => {
    handleSearch(creatorName);
    setSelectedCreator(creatorName);
  };

  const toggleFavorites = () => {
    setShowFavoritesOnly(!showFavoritesOnly);
    setCurrentPage(1);
  };

  const showMyUploads = () => {
    if (user && user.user_metadata?.full_name) {
      handleSearch(user.user_metadata.full_name);
      setSelectedCreator(user.user_metadata.full_name);
    }
  };

  // Check if current search is a creator search
  const isCreatorSearch = selectedCreator && searchTerm.toLowerCase() === selectedCreator.toLowerCase();
  const creatorBlueprints = isCreatorSearch 
    ? blueprints.filter(bp => bp.creator_name && bp.creator_name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];
  
  // Calculate creator stats
  const totalCreatorDownloads = creatorBlueprints.reduce((sum, bp) => sum + (bp.downloads || 0), 0);
  const totalCreatorLikes = creatorBlueprints.reduce((sum, bp) => sum + (bp.likes || 0), 0);

  return (
    <>
      {/* Stats Dashboard */}
      <div style={{
        backgroundImage: `linear-gradient(to right, ${theme.colors.cardBg}99, ${theme.colors.elementBg}99)`,
        borderColor: theme.colors.cardBorder
      }} className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 p-3 rounded-lg border">
        <div className="text-center">
          <p style={{ color: theme.colors.accentYellow }} className="font-bold text-xl sm:text-2xl">{blueprints.length}</p>
          <p style={{ color: theme.colors.textPrimary }} className="text-xs sm:text-sm">Total Blueprints</p>
        </div>
        <div className="text-center">
          <p style={{ color: theme.colors.accentYellow }} className="font-bold text-xl sm:text-2xl">{filteredBlueprints.length}</p>
          <p style={{ color: theme.colors.textPrimary }} className="text-xs sm:text-sm">Matching Results</p>
        </div>
        <div className="text-center">
          <p style={{ color: theme.colors.accentYellow }} className="font-bold text-xl sm:text-2xl">{blueprints.reduce((sum, bp) => sum + (bp.downloads || 0), 0).toLocaleString()}</p>
          <p style={{ color: theme.colors.textPrimary }} className="text-xs sm:text-sm">Total Downloads</p>
        </div>
        <div className="text-center">
          <p style={{ color: theme.colors.accentYellow }} className="font-bold text-xl sm:text-2xl">{blueprints.reduce((sum, bp) => sum + (bp.likes || 0), 0).toLocaleString()}</p>
          <p style={{ color: theme.colors.textPrimary }} className="text-xs sm:text-sm">Total Likes</p>
        </div>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="flex-1 relative">
          <label htmlFor="blueprint-search" className="sr-only">Search blueprints</label>
          <Search style={{ color: theme.colors.textPrimary }} className="absolute left-3 top-3 w-5 h-5" />
          <input
            id="blueprint-search"
            name="blueprint-search"
            type="text"
            placeholder="Search for blueprints....."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              borderColor: theme.colors.cardBorder,
              backgroundColor: `${theme.colors.cardBg}66`,
              color: theme.colors.textPrimary
            }}
            className="w-full pl-10 pr-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 placeholder-opacity-50 transition-all shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => handleSearch("")}
              style={{ color: theme.colors.textPrimary }}
              className="absolute right-3 top-3 hover:opacity-70 transition"
              title="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
            style={{
              borderColor: theme.colors.cardBorder,
              backgroundColor: `${theme.colors.cardBg}33`,
              color: theme.colors.textPrimary
            }}
            className="w-full sm:w-auto px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 font-medium transition-all shadow-sm hover:opacity-80 flex items-center justify-between gap-2"
          >
            <span>
              {sortBy === "newest" ? "Newest First" : sortBy === "oldest" ? "Oldest First" : sortBy === "alphabetical" ? "Alphabetical" : sortBy === "updated" ? "Recently Updated" : sortBy === "downloaded" ? "Most Downloaded" : "Most Liked"}
            </span>
            <span className={`transition transform ${sortDropdownOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          
          {sortDropdownOpen && (
            <div style={{ borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.elementBg }} className="absolute top-full right-0 mt-1 border rounded-lg shadow-lg z-50 w-48">
              <button
                type="button"
                onClick={() => { handleSort("newest"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition first:rounded-t-lg border-b"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Newest First
              </button>
              <button
                type="button"
                onClick={() => { handleSort("oldest"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition border-b"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Oldest First
              </button>
              <button
                type="button"
                onClick={() => { handleSort("alphabetical"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition border-b"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Alphabetical
              </button>
              <button
                type="button"
                onClick={() => { handleSort("updated"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition border-b"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Recently Updated
              </button>
              <button
                type="button"
                onClick={() => { handleSort("downloaded"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition border-b"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Most Downloaded
              </button>
              <button
                type="button"
                onClick={() => { handleSort("popular"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition last:rounded-b-lg last:border-b-0"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Most Liked
              </button>
            </div>
          )}
        </div>
        {user && (
          <>
            <button
              type="button"
              onClick={toggleFavorites}
              style={{
                borderColor: theme.colors.cardBorder,
                backgroundColor: showFavoritesOnly ? theme.colors.accentYellow : `${theme.colors.cardBg}33`,
                color: showFavoritesOnly ? theme.colors.bgPrimary : theme.colors.textPrimary
              }}
              className="px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 font-medium transition-all shadow-sm hover:opacity-80 flex items-center gap-2"
              title={showFavoritesOnly ? "Show all blueprints" : "Show favorites only"}
            >
              <Heart className={`w-5 h-5 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">Liked</span>
            </button>
            <button
              type="button"
              onClick={showMyUploads}
              style={{
                borderColor: theme.colors.cardBorder,
                backgroundColor: `${theme.colors.cardBg}33`,
                color: theme.colors.textPrimary
              }}
              className="px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 font-medium transition-all shadow-sm hover:opacity-80 flex items-center gap-2"
              title="Show my uploaded blueprints"
            >
              <User className="w-5 h-5" />
              <span className="hidden sm:inline">My Uploads</span>
            </button>
          </>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader style={{ color: theme.colors.accentYellow }} className="w-8 h-8 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredBlueprints.length === 0 && (
        <div style={{
          backgroundImage: `linear-gradient(to bottom, ${theme.colors.cardBg}33, ${theme.colors.elementBg}33)`,
          borderColor: theme.colors.cardBorder
        }} className="text-center py-12 rounded-lg border">
          <p style={{ color: theme.colors.accentYellow }} className="text-lg">
            {blueprints.length === 0
              ? "✨ No blueprints yet. Be the first to upload one!"
              : "No blueprints match your search."}
          </p>
        </div>
      )}

      {/* Blueprint Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 4k:grid-cols-6 gap-4">
        {/* Creator Card */}
        {isCreatorSearch && creatorBlueprints.length > 0 && (
          <CreatorCard
            creatorName={selectedCreator}
            blueprintCount={creatorBlueprints.length}
            totalDownloads={totalCreatorDownloads}
            totalLikes={totalCreatorLikes}
          />
        )}
        
        {paginatedBlueprints.map((blueprint) => {
          const isLiked = userLikes.has(blueprint.id);
          return (
            <BlueprintCard
              key={blueprint.id}
              blueprint={blueprint}
              isLiked={isLiked}
              downloadingId={downloadingId}
              deleting={deleting}
              user={user}
              userLikes={userLikes}
              onSelect={setSelectedBlueprint}
              onDownload={handleDownload}
              onLike={handleLike}
              onDelete={handleDelete}
              onSearchByCreator={handleSearchByCreator}
            />
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12 flex-wrap">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              borderColor: theme.colors.cardBorder,
              backgroundColor: `${theme.colors.cardBg}33`,
              color: theme.colors.textPrimary
            }}
            className="px-4 py-2 rounded-lg border font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            ← Previous
          </button>

          <div className="flex gap-1 justify-center flex-nowrap overflow-x-auto">
            {(() => {
              const maxPagesToShow = 5;
              const pages = [];
              let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
              let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
              
              // Adjust start if we're near the end
              if (endPage - startPage + 1 < maxPagesToShow) {
                startPage = Math.max(1, endPage - maxPagesToShow + 1);
              }
              
              // Always show first page
              if (startPage > 1) {
                pages.push(1);
              }
              
              // Show range around current page
              for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
              }
              
              // Always show last page
              if (endPage < totalPages) {
                pages.push(totalPages);
              }
              
              return pages.map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    backgroundColor: page === currentPage ? theme.colors.buttonBg : `${theme.colors.cardBg}33`,
                    borderColor: page === currentPage ? theme.colors.accentYellow : theme.colors.cardBorder,
                    color: page === currentPage ? theme.colors.buttonText : theme.colors.textPrimary
                  }}
                  className="px-3 py-2 rounded-lg border font-medium hover:opacity-80 transition flex-shrink-0"
                >
                  {page}
                </button>
              ));
            })()}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              borderColor: theme.colors.cardBorder,
              backgroundColor: `${theme.colors.cardBg}33`,
              color: theme.colors.textPrimary
            }}
            className="px-4 py-2 rounded-lg border font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
        </div>
      )}

      {/* Blueprint Detail Modal */}
      <BlueprintDetail
        blueprint={selectedBlueprint}
        isOpen={!!selectedBlueprint}
        onClose={() => setSelectedBlueprint(null)}
        user={user}
        userLikes={userLikes}
        blueprints={blueprints}
        currentBlueprintIndex={blueprints.findIndex(b => b.id === selectedBlueprint?.id)}
        onNavigate={(newIndex) => {
          if (newIndex >= 0 && newIndex < blueprints.length) {
            setSelectedBlueprint(blueprints[newIndex]);
          }
        }}
        onLikeChange={(liked) => {
          if (selectedBlueprint) {
            handleLike(selectedBlueprint.id, !liked);
          }
        }}
        onDownload={handleDownload}
        onSearchByCreator={handleSearchByCreator}
        onBlueprintUpdate={() => {
          // Refresh the gallery to get updated blueprint data
          fetchBlueprints();
        }}
      />
    </>
  );
}
