import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Search, Download, Trash2, Loader, Heart } from "lucide-react";
import BlueprintDetail from "./BlueprintDetail";

export default function BlueprintGallery({ user, refreshTrigger }) {
  const [blueprints, setBlueprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [deleting, setDeleting] = useState(null);
  const [selectedBlueprint, setSelectedBlueprint] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    fetchBlueprints();
    if (user) {
      fetchUserLikes();
    }
  }, [refreshTrigger, user]);

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
      setBlueprints(data || []);
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

      // Refresh blueprints to get updated like count
      fetchBlueprints();
    } catch (err) {
      console.error("Error updating like:", err);
      alert("Failed to update like");
    }
  };

  const handleDownload = async (blueprint) => {
    setDownloadingId(blueprint.id);
    try {
      // Increment download count
      const { error } = await supabase
        .from("blueprints")
        .update({ downloads: (blueprint.downloads || 0) + 1 })
        .eq("id", blueprint.id);

      if (error) throw error;

      // Update local state
      setBlueprints(
        blueprints.map((bp) =>
          bp.id === blueprint.id
            ? { ...bp, downloads: (bp.downloads || 0) + 1 }
            : bp
        )
      );

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

    // Security: Verify user owns this blueprint
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
      (bp.tags && bp.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    )
    .sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.created_at) - new Date(b.created_at);
      } else if (sortBy === "alphabetical") {
        return a.title.localeCompare(b.title);
      } else if (sortBy === "popular") {
        return (b.likes || 0) - (a.likes || 0);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-cyan-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-800/50 text-gray-100 placeholder-gray-500"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border border-cyan-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-800/50 text-gray-300"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="popular">Most Liked</option>
        </select>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBlueprints.map((blueprint) => {
          const isLiked = userLikes.has(blueprint.id);
          return (
            <div
              key={blueprint.id}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-lg overflow-hidden border border-cyan-700/50 hover:shadow-2xl hover:border-cyan-600/80 transition cursor-pointer flex flex-col h-full"
              onClick={() => setSelectedBlueprint(blueprint)}
            >
              {/* Image */}
              {blueprint.image_url ? (
                <img
                  src={blueprint.image_url}
                  alt={blueprint.title}
                  className="w-full h-48 object-cover bg-gray-700 flex-shrink-0"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-blue-900 to-cyan-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-4xl">⚗️</span>
                </div>
              )}

              {/* Content - Grows to fill space */}
              <div className="p-4 space-y-3 flex-grow flex flex-col">
                <div className="flex-grow">
                  <h3 className="text-lg font-bold text-amber-300 truncate">
                    {blueprint.title}
                  </h3>

                  <p className="text-sm text-gray-400 line-clamp-2 mt-2">
                    {blueprint.description || "No description provided"}
                  </p>

                  {/* Tags */}
                  {blueprint.tags && blueprint.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {blueprint.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-cyan-700/40 text-cyan-300 px-2 py-1 rounded border border-cyan-600/30"
                        >
                          #{tag}
                        </span>
                      ))}
                      {blueprint.tags.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{blueprint.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 mt-2">
                    <p className="font-semibold text-gray-400">
                      by {blueprint.creator_name}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-sm text-gray-400 border-t border-gray-700 pt-3">
                  <div className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    <span>{blueprint.downloads || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    <span>{blueprint.likes || 0}</span>
                  </div>
                </div>

                {/* Actions - Always at bottom */}
                <div className="flex gap-2 pt-2 mt-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(blueprint);
                    }}
                    disabled={downloadingId === blueprint.id}
                    className="flex-1 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 disabled:from-gray-700 disabled:to-gray-800 text-black font-semibold py-2 rounded-lg transition flex items-center justify-center text-sm"
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

      {/* Blueprint Detail Modal */}
      <BlueprintDetail
        blueprint={selectedBlueprint}
        isOpen={!!selectedBlueprint}
        onClose={() => setSelectedBlueprint(null)}
        user={user}
        onLikeChange={(liked) => {
          if (selectedBlueprint) {
            handleLike(selectedBlueprint.id, liked);
          }
        }}
      />
    </>
  );
}
