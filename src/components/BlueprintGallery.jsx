import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Search, Download, Trash2, Loader, Heart, X } from "lucide-react";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { sanitizeCreatorName } from "../lib/sanitization";
import { getThumbnailUrl } from "../lib/imageOptimization";
import { addSampleDataToBlueprints } from "../lib/sampleData";
import BlueprintDetail from "./BlueprintDetail";

export default function BlueprintGallery({ user, refreshTrigger, initialBlueprintId }) {
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
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    fetchBlueprints();
    if (user) {
      fetchUserLikes();
    }
  }, [refreshTrigger, user]);

  // Handle initial blueprint ID from URL - only apply once
  useEffect(() => {
    if (initialBlueprintId && blueprints.length > 0 && !initialBlueprintAppliedRef.current) {
      const blueprint = blueprints.find((bp) => bp.id === initialBlueprintId);
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
        .select("id,title,description,user_id,creator_name,file_url,image_url,downloads,likes,tags,created_at,updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Ensure likes and downloads are properly set (default to 0 if NULL)
      const processedData = (data || []).map(bp => ({
        ...bp,
        likes: bp.likes ?? 0,
        downloads: bp.downloads ?? 0
      }));
      
      // Add sample materials and buildings data for testing
      const dataWithSamples = addSampleDataToBlueprints(processedData);
      
      console.log("Fetched blueprints:", dataWithSamples);
      setBlueprints(dataWithSamples);
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
        console.log(`Removing like for ${blueprintId}`);
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
        console.log(`Adding like for ${blueprintId}`);
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
      
      // Normalize the data
      const normalizedBp = {
        ...updatedBlueprint,
        likes: updatedBlueprint?.likes ?? 0,
        downloads: updatedBlueprint?.downloads ?? 0
      };
      
      console.log(`Refetched blueprint ${blueprintId}: likes=${normalizedBp.likes}`);
      
      // Update blueprints array
      setBlueprints((prev) =>
        prev.map((bp) =>
          bp.id === blueprintId ? normalizedBp : bp
        )
      );
      
      // Update selected blueprint
      if (selectedBlueprint?.id === blueprintId) {
        console.log(`Updated selected blueprint with refetched data: likes=${normalizedBp.likes}`);
        setSelectedBlueprint(normalizedBp);
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
      
      // Normalize the data
      const normalizedBp = {
        ...updatedBlueprint,
        likes: updatedBlueprint?.likes ?? 0,
        downloads: updatedBlueprint?.downloads ?? 0
      };
      
      console.log(`Refetched blueprint ${blueprint.id}: downloads=${normalizedBp.downloads}`);
      
      // Update blueprints array
      setBlueprints(
        blueprints.map((bp) =>
          bp.id === blueprint.id ? normalizedBp : bp
        )
      );
      
      // Update selected blueprint if it's the one being downloaded
      if (selectedBlueprint?.id === blueprint.id) {
        console.log(`Updated selected blueprint with refetched data: downloads=${normalizedBp.downloads}`);
        setSelectedBlueprint(normalizedBp);
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
      // Delete from storage
      if (blueprint.file_url) {
        const filePath = blueprint.file_url.split("/").pop();
        await supabase.storage.from("blueprints").remove([filePath]);
      }
      if (blueprint.image_url) {
        const imagePath = blueprint.image_url.split("/").pop();
        await supabase.storage.from("blueprint-images").remove([imagePath]);
      }

      // Delete from database - RLS policy will verify user_id
      const { error } = await supabase
        .from("blueprints")
        .delete()
        .eq("id", blueprint.id)
        .eq("user_id", user.id); // Double-check: Only delete if user_id matches

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
    .filter((bp) =>
      bp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (bp.description && bp.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (bp.tags && bp.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))) ||
      (bp.creator_name && bp.creator_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
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
  const totalPages = Math.ceil(filteredBlueprints.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBlueprints = filteredBlueprints.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
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
  };

  return (
    <>
      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search blueprints or tags..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 border-2 border-cyan-700/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-gray-800/70 text-gray-100 placeholder-gray-500 transition-all shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-3 text-gray-500 hover:text-gray-300 transition"
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
            className="w-full sm:w-auto px-4 py-2.5 border-2 border-cyan-700/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-gray-800/70 text-gray-200 font-medium transition-all shadow-sm hover:border-cyan-600/80 flex items-center justify-between gap-2"
          >
            <span>
              {sortBy === "newest" ? "Newest First" : sortBy === "oldest" ? "Oldest First" : sortBy === "alphabetical" ? "Alphabetical" : sortBy === "updated" ? "Recently Updated" : sortBy === "downloaded" ? "Most Downloaded" : "Most Liked"}
            </span>
            <span className={`transition transform ${sortDropdownOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          
          {sortDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-cyan-700/50 rounded-lg shadow-lg z-50 w-48">
              <button
                type="button"
                onClick={() => { handleSort("newest"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-cyan-900/40 text-gray-100 transition first:rounded-t-lg border-b border-cyan-700/20"
              >
                Newest First
              </button>
              <button
                type="button"
                onClick={() => { handleSort("oldest"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-cyan-900/40 text-gray-100 transition border-b border-cyan-700/20"
              >
                Oldest First
              </button>
              <button
                type="button"
                onClick={() => { handleSort("alphabetical"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-cyan-900/40 text-gray-100 transition border-b border-cyan-700/20"
              >
                Alphabetical
              </button>
              <button
                type="button"
                onClick={() => { handleSort("updated"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-cyan-900/40 text-gray-100 transition border-b border-cyan-700/20"
              >
                Recently Updated
              </button>
              <button
                type="button"
                onClick={() => { handleSort("downloaded"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-cyan-900/40 text-gray-100 transition border-b border-cyan-700/20"
              >
                Most Downloaded
              </button>
              <button
                type="button"
                onClick={() => { handleSort("popular"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-cyan-900/40 text-gray-100 transition last:rounded-b-lg last:border-b-0"
              >
                Most Liked
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredBlueprints.length === 0 && (
        <div className="text-center py-12 bg-gradient-to-b from-cyan-900/30 to-blue-900/30 rounded-lg border border-cyan-700/50">
          <p className="text-gray-300 text-lg">
            {blueprints.length === 0
              ? "✨ No blueprints yet. Be the first to upload one!"
              : "No blueprints match your search."}
          </p>
        </div>
      )}

      {/* Blueprint Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {paginatedBlueprints.map((blueprint) => {
          const isLiked = userLikes.has(blueprint.id);
          return (
            <div
              key={blueprint.id}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg overflow-hidden border-2 border-cyan-700/50 hover:border-cyan-500/70 hover:shadow-2xl hover:shadow-cyan-900/30 transition-all duration-300 cursor-pointer flex flex-col h-full group"
              onClick={() => setSelectedBlueprint(blueprint)}
            >
              {/* Image */}
              {blueprint.image_url ? (
                <img
                  src={getThumbnailUrl(blueprint.image_url)}
                  alt={blueprint.title}
                  className="w-full h-48 object-cover bg-gray-700 flex-shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-blue-900 to-cyan-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-4xl">⚗️</span>
                </div>
              )}

              {/* Gallery Content*/}
              <div className="p-5 space-y-3 flex-grow flex flex-col bg-gradient-to-b from-gray-800/80 to-gray-900/90">
                {/* Title and Description */}
                <div>
                  <h3 className="text-lg font-bold text-amber-300 truncate group-hover:text-amber-200 transition">
                    {blueprint.title}
                  </h3>

                  <p className="text-sm text-gray-400 line-clamp-3 mt-1">
                    {blueprint.description || "No description provided."}
                  </p>
                </div>

                <div className="flex-grow"></div>

                {/* Tags */}
                {blueprint.tags && blueprint.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {blueprint.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-cyan-700/50 text-cyan-200 px-2.5 py-1 rounded-full border border-cyan-500/30 font-medium hover:bg-cyan-700/70 transition"
                      >
                        {tag}
                      </span>
                    ))}
                    {blueprint.tags.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{blueprint.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="flex gap-4 text-sm text-gray-400 border-t border-gray-700/60 pt-3 flex-wrap items-center">
                  <div className="flex items-center gap-1 hover:text-cyan-300 transition">
                    <Download className="w-4 h-4" />
                    <span>{blueprint.downloads || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 hover:text-rose-400 transition">
                    <Heart className="w-4 h-4" />
                    <span>{blueprint.likes || 0}</span>
                  </div>
                  <div className="text-xs text-gray-500 ml-auto">
                    <p className="font-semibold text-gray-400 hover:text-gray-300 transition">
                      by{" "}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSearchByCreator(blueprint.creator_name);
                        }}
                        className="text-cyan-400 hover:text-cyan-300 hover:underline transition cursor-pointer"
                      >
                        {sanitizeCreatorName(stripDiscordDiscriminator(blueprint.creator_name))}
                      </button>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 mt-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(blueprint);
                    }}
                    disabled={downloadingId === blueprint.id}
                    className="flex-1 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 disabled:from-gray-700 disabled:to-gray-800 text-black font-semibold py-2 rounded-lg transition shadow-md hover:shadow-lg hover:shadow-amber-500/30 flex items-center justify-center text-sm"
                  >
                    {downloadingId === blueprint.id ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </>
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(blueprint.id, isLiked);
                    }}
                    className={`px-3 py-2 rounded-lg transition font-semibold flex items-center justify-center ${
                      isLiked
                        ? "bg-rose-700 hover:bg-rose-600 text-white"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
                  </button>

                  {user && blueprint.user_id === user.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(blueprint);
                      }}
                      disabled={deleting === blueprint.id}
                      className="bg-red-700 hover:bg-red-600 disabled:bg-gray-700 text-white font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center"
                    >
                      {deleting === blueprint.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12 flex-wrap">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-lg border border-cyan-700/60 bg-gray-800/70 text-gray-200 font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            ← Previous
          </button>

          <div className="flex gap-1 flex-wrap justify-center">
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
                if (startPage > 2) {
                  pages.push('...');
                }
              }
              
              // Show range around current page
              for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
              }
              
              // Always show last page
              if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                  pages.push('...');
                }
                pages.push(totalPages);
              }
              
              return pages.map((page) => (
                <button
                  key={page}
                  onClick={() => typeof page === 'number' && setCurrentPage(page)}
                  disabled={page === '...'}
                  className={`px-3 py-2 rounded-lg font-medium transition ${
                    page === currentPage
                      ? "bg-cyan-700 text-white border border-cyan-600"
                      : page === '...'
                      ? "border border-transparent text-gray-400 cursor-default"
                      : "border border-cyan-700/60 bg-gray-800/70 text-gray-200 hover:bg-gray-700"
                  }`}
                >
                  {page}
                </button>
              ));
            })()}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-lg border border-cyan-700/60 bg-gray-800/70 text-gray-200 font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
