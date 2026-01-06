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
  };

  return (
    <>
      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 p-3 bg-gradient-to-r from-[#a3805a]/60 to-[#9f8364]/60 rounded-lg border border-[#bba664]/30">
        <div className="text-center">
          <p className="text-[#f5d84b] font-bold text-xl sm:text-2xl">{blueprints.length}</p>
          <p className="text-[#ffdca7] text-xs sm:text-sm">Total Blueprints</p>
        </div>
        <div className="text-center">
          <p className="text-[#f5d84b] font-bold text-xl sm:text-2xl">{filteredBlueprints.length}</p>
          <p className="text-[#ffdca7] text-xs sm:text-sm">Matching Results</p>
        </div>
        <div className="text-center">
          <p className="text-[#f5d84b] font-bold text-xl sm:text-2xl">{blueprints.reduce((sum, bp) => sum + (bp.downloads || 0), 0).toLocaleString()}</p>
          <p className="text-[#ffdca7] text-xs sm:text-sm">Total Downloads</p>
        </div>
        <div className="text-center">
          <p className="text-[#f5d84b] font-bold text-xl sm:text-2xl">{blueprints.reduce((sum, bp) => sum + (bp.likes || 0), 0).toLocaleString()}</p>
          <p className="text-[#ffdca7] text-xs sm:text-sm">Total Likes</p>
        </div>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-[#ffdca7]" />
          <input
            name="input-search"
            type="text"
            placeholder="Search for blueprints....."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 border border-[#fff0a6]/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f5d84b] focus:border-[#f5d84b] bg-[#8b7256]/90 text-[#ffdca7] placeholder-[#ffdca7] transition-all shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-3 text-[#ffdca7] hover:text-[#f5d84b] transition"
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
            className="w-full sm:w-auto px-4 py-2.5 border border-[#fff0a6]/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f5d84b] focus:border-[#f5d84b] bg-[#8b7256]/70 text-[#ffdca7] font-medium transition-all shadow-sm hover:border-[#9f8569]/80 flex items-center justify-between gap-2"
          >
            <span>
              {sortBy === "newest" ? "Newest First" : sortBy === "oldest" ? "Oldest First" : sortBy === "alphabetical" ? "Alphabetical" : sortBy === "updated" ? "Recently Updated" : sortBy === "downloaded" ? "Most Downloaded" : "Most Liked"}
            </span>
            <span className={`transition transform ${sortDropdownOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          
          {sortDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 bg-[#8b7256] border border-[#fff0a6]/50 rounded-lg shadow-lg z-50 w-48">
              <button
                type="button"
                onClick={() => { handleSort("newest"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#67523c]/40 text-[#ffdca7] transition first:rounded-t-lg border-b border-[#fff0a6]/20"
              >
                Newest First
              </button>
              <button
                type="button"
                onClick={() => { handleSort("oldest"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#67523c]/40 text-[#ffdca7] transition border-b border-[#fff0a6]/20"
              >
                Oldest First
              </button>
              <button
                type="button"
                onClick={() => { handleSort("alphabetical"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#67523c]/40 text-[#ffdca7] transition border-b border-[#fff0a6]/20"
              >
                Alphabetical
              </button>
              <button
                type="button"
                onClick={() => { handleSort("updated"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#67523c]/40 text-[#ffdca7] transition border-b border-[#fff0a6]/20"
              >
                Recently Updated
              </button>
              <button
                type="button"
                onClick={() => { handleSort("downloaded"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#67523c]/40 text-[#ffdca7] transition border-b border-[#fff0a6]/20"
              >
                Most Downloaded
              </button>
              <button
                type="button"
                onClick={() => { handleSort("popular"); setSortDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#67523c]/40 text-[#ffdca7] transition last:rounded-b-lg last:border-b-0"
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
          <Loader className="w-8 h-8 animate-spin text-[#ffeb9d]" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredBlueprints.length === 0 && (
        <div className="text-center py-12 bg-gradient-to-b from-[#977958]/30 to-[#9f8569]/30 rounded-lg border border-[#87725a]/50">
          <p className="text-[#ffeb9d] text-lg">
            {blueprints.length === 0
              ? "✨ No blueprints yet. Be the first to upload one!"
              : "No blueprints match your search."}
          </p>
        </div>
      )}

      {/* Blueprint Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 4k:grid-cols-6 gap-4">
        {paginatedBlueprints.map((blueprint) => {
          const isLiked = userLikes.has(blueprint.id);
          return (
            <div
              key={blueprint.id}
              className="fade-in-card bg-gradient-to-br from-[#9f8569] to-[#87725a] rounded-xl shadow-lg overflow-hidden hover:shadow-2xl hover:shadow-[#fcd34d]/20 transition-all duration-150 cursor-pointer flex flex-col h-full group"
              onClick={() => setSelectedBlueprint(blueprint)}
            >
              {/* Image */}
              {blueprint.image_url ? (
                <img
                  src={getThumbnailUrl(blueprint.image_url)}
                  alt={blueprint.title}
                  className="w-full h-48 object-cover bg-[#ffdca7] flex-shrink-0 transition-opacity duration-150 group-hover:opacity-90 opacity-80"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-[#ffdca7] to-[#87725a] flex items-center justify-center flex-shrink-0">
                  <span className="text-4xl">⚗️</span>
                </div>
              )}

              {/* Gallery Content*/}
              <div className="p-4 space-y-2 flex-grow flex flex-col bg-gradient-to-b from-[#9f8569]/80 to-[#af9170]/90">
                {/* Title and Description */}
                <div>
                  <h3 className="text-lg font-bold text-[#fcd34d] truncate group-hover:text-[#ffe797]/90 transition">
                    {blueprint.title}
                  </h3>

                  <p className="text-sm text-[#ffeed3] line-clamp-3 mt-1">
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
                        className="text-xs bg-[#87725a]/50 text-[#ffeed3] px-2.5 py-1 rounded-full border border-[#6b5d45]/30 font-medium hover:bg-[#87725a]/70 transition"
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
                <div className="flex gap-4 text-sm text-[#ffeed3] border-t border-[#dbb87c]/60 pt-3 flex-wrap items-center">
                  <div className="flex items-center gap-1 hover:text-[#ffdca7] transition">
                    <Download className="w-4 h-4" />
                    <span>{blueprint.downloads || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 hover:text-rose-400 transition ">
                    <Heart className="w-4 h-4" />
                    <span>{blueprint.likes || 0}</span>
                  </div>
                  <div className="text-xs text-gray-500 ml-auto">
                    <p className="font-semibold text-amber-200 hover:text-amber-100 transition">
                      by{" "}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSearchByCreator(blueprint.creator_name);
                        }}
                        className="text-[#fcd34d] hover:text-[#ffdca7]/80 hover:underline transition cursor-pointer"
                      >
                        {sanitizeCreatorName(stripDiscordDiscriminator(blueprint.creator_name))}
                      </button>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(blueprint);
                    }}
                    disabled={downloadingId === blueprint.id}
                    className="flex-1 bg-gradient-to-r from-[#5b4a39]/50 to-[#59452e]/50 hover:from-[#dbb84a] hover:to-[#fbcd32] disabled:from-amber-600 disabled:to-yellow-600 font-semibold py-2 rounded-lg transition shadow-md hover:shadow-lg hover:shadow-[#bba664]/30 hover:text-[#654e35] flex items-center justify-center text-sm"
                  >
                    {downloadingId === blueprint.id ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1 " />
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
                        ? "bg-[#59452e]/50 hover:bg-rose-600 text-white"
                        : "bg-[#59452e]/60 hover:bg-amber-300 text-[#ffdca7] hover:text-red-600"
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
                      className="bg-red-700 hover:bg-red-600 disabled:bg-[#6b5d45] text-white font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center"
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
            className="px-4 py-2 rounded-lg border border-[#87725a]/60 bg-[#3a3227]/70 text-[#ffdca7] font-medium hover:bg-[#4a4033] disabled:opacity-50 disabled:cursor-not-allowed transition"
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
                      ? "bg-[#a2876a] text-amber-300 border border-[#cfb493]"
                      : page === '...'
                      ? "border border-transparent text-[#6b5d45] cursor-default"
                      : "border border-[#87725a]/60 bg-[#67543d]/70 text-[#ffdca7] hover:bg-[#4a4033]"
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
            className="px-4 py-2 rounded-lg border border-[#87725a]/60 bg-[#4b3d2c]/70 text-[#ffdca7] font-medium hover:bg-[#4a4033] disabled:opacity-50 disabled:cursor-not-allowed transition"
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
