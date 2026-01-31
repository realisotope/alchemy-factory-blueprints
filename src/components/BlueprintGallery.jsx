import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { Search, Download, Trash2, Loader, Heart, X, User, Tag, ListFilter, Clock, History, SortAsc, RefreshCw, TrendingUp, ArrowUp, ArrowDown, Bookmark, Check, AlertCircle, Save } from "lucide-react";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { sanitizeCreatorName } from "../lib/sanitization";
import { getThumbnailUrl, prefetchImage } from "../lib/imageOptimization";
import { transformParsedMaterials, transformParsedBuildings } from "../lib/blueprintMappings";
import { validateParsedData } from "../lib/parsedDataValidator";
import { getParsedData } from "../lib/blueprintUtils";
import { useTheme } from "../lib/ThemeContext";
import { deleteCloudinaryImage } from "../lib/cloudinaryDelete";
import { AVAILABLE_TAGS, getTagDisplay } from "../lib/tags";
import { ClientRateLimiter } from "../lib/rateLimiter";
import { hasSaveData, checkBlueprintCompatibility } from "../lib/saveManager";
import { useBlueprintFolder } from "../lib/BlueprintFolderContext";
import { fetchAllBlueprints, fetchUserLikes as fetchUserLikesService, fetchUserRatings, rateBlueprint, unlikeBlueprint, deleteBlueprint as deleteBlueprintService } from "../lib/blueprintService";
import { handleError } from "../lib/errorHandler";
import { ErrorAlert, SuccessAlert } from "./Alerts";
import ErrorBoundary from "./ErrorBoundary";
import BlueprintDetail from "./BlueprintDetail";
import BlueprintCard from "./BlueprintCard";
import CreatorCard from "./CreatorCard";

function BlueprintGalleryContent({ user, refreshTrigger, initialBlueprintId, initialMessage, onMessageShown }) {
  const { theme } = useTheme();
  const { getInstallStatus } = useBlueprintFolder();
  const [blueprints, setBlueprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagsDropdownOpen, setTagsDropdownOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [selectedBlueprint, setSelectedBlueprint] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userRatings, setUserRatings] = useState(new Map()); // Map of blueprintId -> rating (1-5)
  const [userBookmarks, setUserBookmarks] = useState(new Set());
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const initialBlueprintAppliedRef = useRef(false);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [compatibilityFilter, setCompatibilityFilter] = useState("all");
  const [installFilter, setInstallFilter] = useState("all"); // "all", "installed", "update-available"
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Refs for click-outside detection
  const sortDropdownRef = useRef(null);
  const tagsDropdownRef = useRef(null);

  // Auto-dismiss alerts after 10 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Handle initial message from parent (upload success)
  useEffect(() => {
    if (initialMessage) {
      setSuccess(initialMessage);
      onMessageShown?.();
    }
  }, [initialMessage, onMessageShown]);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setSortDropdownOpen(false);
      }
      if (tagsDropdownRef.current && !tagsDropdownRef.current.contains(event.target)) {
        setTagsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
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
      fetchUserRatingsData();
      fetchUserBookmarksData();
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

  const fetchUserLikes = useCallback(async () => {
    if (!user) return;
    try {
      const result = await fetchUserLikesService(user.id);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch likes');
      }

      const newLikeIds = result.data || [];
      
      setUserLikes((prevLikes) => {
        const prevArray = Array.from(prevLikes).sort();
        const newArray = newLikeIds.sort();
        
        if (prevArray.length === newArray.length && prevArray.every((id, i) => id === newArray[i])) {
          return prevLikes;
        }
        
        return new Set(newLikeIds);
      });
    } catch (err) {
      const errorResponse = handleError(err, 'FETCH_USER_LIKES', { userId: user?.id });
      console.error("Error fetching likes:", errorResponse);
    }
  }, [user]);

  const fetchUserRatingsData = useCallback(async () => {
    if (!user) return;
    try {
      const result = await fetchUserRatings(user.id);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch ratings');
      }

      setUserRatings(result.data || new Map());
    } catch (err) {
      const errorResponse = handleError(err, 'FETCH_USER_RATINGS', { userId: user?.id });
      console.error("Error fetching ratings:", errorResponse);
    }
  }, [user]);

  const fetchUserBookmarksData = useCallback(() => {
    if (!user) return;
    try {
      const stored = localStorage.getItem(`bookmarks_${user.id}`);
      if (stored) {
        const bookmarkIds = JSON.parse(stored);
        setUserBookmarks(new Set(bookmarkIds));
      }
    } catch (err) {
      console.error("Error loading bookmarks from localStorage:", err);
    }
  }, [user]);

  const fetchBlueprints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllBlueprints();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch blueprints');
      }

      const data = result.data || [];
      
      const processedData = (data || []).map(bp => {
        let materials = [];
        let buildings = [];
        let validatedParsed = null;
        
        try {
          const parsedData = getParsedData(bp);
          validatedParsed = validateParsedData(parsedData);
          
          if (validatedParsed.Materials && typeof validatedParsed.Materials === 'object' && !Array.isArray(validatedParsed.Materials)) {
            materials = transformParsedMaterials(validatedParsed.Materials);
          }
          
          if (validatedParsed.Buildings && typeof validatedParsed.Buildings === 'object' && !Array.isArray(validatedParsed.Buildings)) {
            buildings = transformParsedBuildings(validatedParsed.Buildings);
          }
        } catch (error) {
          const errorResponse = handleError(error, 'TRANSFORM_BLUEPRINT_DATA', { blueprintId: bp.id });
          console.error(errorResponse);
        }
        
        return {
          ...bp,
          likes: bp.likes ?? 0,
          downloads: bp.downloads ?? 0,
          materials: materials,
          buildings: buildings,
          skills: validatedParsed?.SupplyItems || {}
        };
      });
      
      setBlueprints(processedData);
    } catch (err) {
      console.error("Error fetching blueprints:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLike = useCallback(async (blueprintId, currentlyLiked) => {
    if (!user) {
      setError({ message: "Please login to like blueprints" });
      return;
    }

    try {
      let result;
      if (currentlyLiked) {
        result = await unlikeBlueprint(blueprintId, user.id);
        
        if (!result.success) {
          throw new Error(result.error?.message || 'Failed to unlike blueprint');
        }
        
        setUserLikes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(blueprintId);
          return newSet;
        });
        setSuccess('Blueprint unliked');
      } else {
        result = await likeBlueprint(blueprintId, user.id);
        
        if (!result.success) {
          throw new Error(result.error?.message || 'Failed to like blueprint');
        }
        
        setUserLikes((prev) => new Set(prev).add(blueprintId));
        setSuccess('Blueprint liked');
      }
      
      setBlueprints((prev) =>
        prev.map((bp) =>
          bp.id === blueprintId 
            ? { ...bp, likes: (bp.likes ?? 0) + (currentlyLiked ? -1 : 1) }
            : bp
        )
      );

      if (selectedBlueprint?.id === blueprintId) {
        setSelectedBlueprint((prev) => 
          prev ? { ...prev, likes: (prev.likes ?? 0) + (currentlyLiked ? -1 : 1) } : null
        );
      }
    } catch (err) {
      const errorResponse = handleError(err, 'LIKE_BLUEPRINT', { blueprintId });
      setError(errorResponse.error);
    }
  }, [user, selectedBlueprint?.id]);

  const handleRating = useCallback(async (blueprintId, rating, oldRating = 0) => {
    if (!user) {
      setError({ message: "Please login to rate blueprints" });
      return;
    }

    try {
      if (rating === 0) {
        await unlikeBlueprint(blueprintId, user.id);
        setUserRatings((prev) => {
          const newMap = new Map(prev);
          newMap.delete(blueprintId);
          return newMap;
        });
        setSuccess('Rating removed');
      } else {
        const result = await rateBlueprint(blueprintId, user.id, rating);
        
        if (!result.success) {
          throw new Error(result.error?.message || 'Failed to rate blueprint');
        }
        
        setUserRatings((prev) => new Map(prev).set(blueprintId, rating));
        setSuccess(`Rated ${rating} heart${rating !== 1 ? 's' : ''}`);
      }
      
      // Opt update the blueprint's rating
      setBlueprints((prev) =>
        prev.map((bp) => {
          if (bp.id === blueprintId) {
            const oldCount = bp.rating_count || 0;
            const oldAvg = bp.rating_average || 0;
            
            let newCount, newAvg;
            if (oldRating === 0 && rating > 0) {
              newCount = oldCount + 1;
              newAvg = ((oldAvg * oldCount) + rating) / newCount;
            } else if (oldRating > 0 && rating === 0) {
              newCount = Math.max(0, oldCount - 1);
              newAvg = newCount > 0 ? ((oldAvg * oldCount) - oldRating) / newCount : 0;
            } else {
              newCount = oldCount;
              newAvg = oldCount > 0 ? ((oldAvg * oldCount) - oldRating + rating) / oldCount : rating;
            }
            
            return { ...bp, rating_average: newAvg, rating_count: newCount };
          }
          return bp;
        })
      );

      if (selectedBlueprint?.id === blueprintId) {
        setSelectedBlueprint((prev) => {
          if (!prev) return null;
          const oldCount = prev.rating_count || 0;
          const oldAvg = prev.rating_average || 0;
          
          let newCount, newAvg;
          if (oldRating === 0 && rating > 0) {
            newCount = oldCount + 1;
            newAvg = ((oldAvg * oldCount) + rating) / newCount;
          } else if (oldRating > 0 && rating === 0) {
            newCount = Math.max(0, oldCount - 1);
            newAvg = newCount > 0 ? ((oldAvg * oldCount) - oldRating) / newCount : 0;
          } else {
            newCount = oldCount;
            newAvg = oldCount > 0 ? ((oldAvg * oldCount) - oldRating + rating) / oldCount : rating;
          }
          
          return { ...prev, rating_average: newAvg, rating_count: newCount };
        });
      }
    } catch (err) {
      const errorResponse = handleError(err, 'RATE_BLUEPRINT', { blueprintId, rating });
      setError(errorResponse.error);
    }
  }, [user, selectedBlueprint?.id]);

  const handleBookmark = useCallback((blueprintId, currentlyBookmarked) => {
    if (!user) {
      setError({ message: "Please login to bookmark blueprints" });
      return;
    }

    try {
      let newBookmarks;
      if (currentlyBookmarked) {
        setUserBookmarks((prev) => {
          newBookmarks = new Set(prev);
          newBookmarks.delete(blueprintId);
          return newBookmarks;
        });
      } else {
        setUserBookmarks((prev) => {
          newBookmarks = new Set(prev).add(blueprintId);
          return newBookmarks;
        });
      }
      
      // Save to localStorage
      setTimeout(() => {
        const bookmarkArray = Array.from(newBookmarks || userBookmarks);
        localStorage.setItem(`bookmarks_${user.id}`, JSON.stringify(bookmarkArray));
      }, 0);
    } catch (err) {
      console.error('Error toggling bookmark:', err);
      setError({ message: 'Failed to update bookmark' });
    }
  }, [user, userBookmarks]);

  const handleDownload = useCallback(async (blueprint, selectedPartNumber = null) => {
    // Rate limiting check for downloads
    const downloadLimiter = new ClientRateLimiter(user?.id || 'anonymous', 'downloads');
    const limitStatus = downloadLimiter.checkLimit();

    if (!limitStatus.allowed) {
      const errorMsg = limitStatus.reason === 'cooldown' 
        ? `Please wait ${limitStatus.resetTime} second${limitStatus.resetTime !== 1 ? 's' : ''} before downloading again`
        : `You've exceeded your download limit (${limitStatus.maxAttempts} per hour). Try again in ${Math.ceil(limitStatus.resetTime / 60)} minutes`;
      setDownloadError(errorMsg);
      setTimeout(() => setDownloadError(null), 5000);
      return;
    }

    setDownloadingId(blueprint.id);
    setDownloadError(null);
    
    try {
      // Record the download attempt for rate limiting
      downloadLimiter.recordAttempt();

      // Increment download count via secure function
      const { error } = await supabase.rpc('increment_blueprint_downloads', {
        blueprint_id: blueprint.id
      });

      if (error) throw error;
      
      // Optimistically update download count without refetching
      setBlueprints((prev) =>
        prev.map((bp) =>
          bp.id === blueprint.id 
            ? { ...bp, downloads: (bp.downloads ?? 0) + 1 }
            : bp
        )
      );

      // Update selected blueprint if it's the one being downloaded
      if (selectedBlueprint?.id === blueprint.id) {
        setSelectedBlueprint((prev) => 
          prev ? { ...prev, downloads: (prev.downloads ?? 0) + 1 } : null
        );
      }

      // Handle multi-part downloads
      if (blueprint.is_multi_part && blueprint.parts && Array.isArray(blueprint.parts)) {
        if (selectedPartNumber !== null) {
          // Download specific part
          const part = blueprint.parts.find(p => p.part_number === selectedPartNumber);
          if (!part) {
            throw new Error("Part not found");
          }

          const publicUrl = supabase.storage
            .from("blueprints")
            .getPublicUrl(`${blueprint.user_id}/${part.filename}`).data.publicUrl;

          try {
            const response = await fetch(publicUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = part.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
          } catch (fetchError) {
            console.error("Error fetching part for download:", fetchError);
            const a = document.createElement("a");
            a.href = publicUrl;
            a.download = part.filename;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        } else {
          // Download all parts in sequence
          for (const part of blueprint.parts) {
            const publicUrl = supabase.storage
              .from("blueprints")
              .getPublicUrl(`${blueprint.user_id}/${part.filename}`).data.publicUrl;

            try {
              const response = await fetch(publicUrl);
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              
              const a = document.createElement("a");
              a.href = blobUrl;
              a.download = part.filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              
              setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
              
              // Small delay between downloads
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (fetchError) {
              console.error(`Error fetching part ${part.part_number} for download:`, fetchError);
              const a = document.createElement("a");
              a.href = publicUrl;
              a.download = part.filename;
              a.target = "_blank";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
          }
        }
      } else {
        // Single-part download
        if (!blueprint.file_url) {
          setDownloadError("Blueprint file is not available for download");
          return;
        }

        const urlParts = blueprint.file_url.split('/');
        const filename = urlParts[urlParts.length - 1];
        
        try {
          const response = await fetch(blueprint.file_url);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        } catch (fetchError) {
          console.error("Error fetching file for download:", fetchError);
          const a = document.createElement("a");
          a.href = blueprint.file_url;
          a.download = filename;
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
    } catch (err) {
      console.error("Error downloading:", err);
      setDownloadError("Failed to download blueprint");
    } finally {
      setDownloadingId(null);
    }
  }, [user?.id]);

  const handleDelete = async (blueprint) => {
    if (!user) {
      setError({ message: "You must be logged in to delete blueprints" });
      return;
    }

    if (blueprint.user_id !== user.id) {
      setError({ message: "You can only delete your own blueprints" });
      console.warn(`Unauthorized delete attempt: ${user.id} tried to delete blueprint by ${blueprint.user_id}`);
      return;
    }

    if (!window.confirm("Are you sure you want to delete this blueprint?")) {
      return;
    }

    setDeleting(blueprint.id);
    setError(null);
    try {
      // Delete all Cloudinary images
      if (blueprint.image_url) {
        await deleteCloudinaryImage(blueprint.image_url);
      }
      if (blueprint.image_url_2) {
        await deleteCloudinaryImage(blueprint.image_url_2);
      }
      if (blueprint.image_url_3) {
        await deleteCloudinaryImage(blueprint.image_url_3);
      }
      if (blueprint.image_url_4) {
        await deleteCloudinaryImage(blueprint.image_url_4);
      }

      // Delete blueprint files from Supabase storage
      const filesToDelete = [];

      if (blueprint.is_multi_part && blueprint.parts && Array.isArray(blueprint.parts)) {
        // For multi-part blueprints, delete all part files
        for (const part of blueprint.parts) {
          if (part.filename) {
            filesToDelete.push(`${blueprint.user_id}/${part.filename}`);
          }
        }
      } else if (blueprint.file_url) {
        // For single-part blueprints, extract path from URL
        // URL format: https://...supabase.../storage/v1/object/public/blueprints/USER_ID/filename
        try {
          const urlParts = blueprint.file_url.split('/storage/v1/object/public/blueprints/');
          if (urlParts.length > 1) {
            filesToDelete.push(urlParts[1]); // Gets USER_ID/filename
          }
        } catch (e) {
          console.warn('Could not parse file URL:', blueprint.file_url);
        }
      }

      // Delete all files from storage
      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("blueprints")
          .remove(filesToDelete);
        if (storageError) {
          console.warn('Storage deletion warning:', storageError);
        }
      }

      const result = await deleteBlueprintService(blueprint.id);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete blueprint');
      }

      setBlueprints(blueprints.filter((b) => b.id !== blueprint.id));
      setSuccess("Blueprint deleted successfully");
    } catch (err) {
      const errorResponse = handleError(err, 'DELETE_BLUEPRINT', { blueprintId: blueprint.id });
      setError(errorResponse.error);
    } finally {
      setDeleting(null);
    }
  };

  // Memoize tag comparison to avoid reference changes
  const selectedTagsKey = useMemo(() => selectedTags.join(','), [selectedTags]);
  
  // Memoize userLikes size and its entries to avoid Set reference changes
  const userLikesKey = useMemo(() => Array.from(userLikes).sort().join(','), [userLikes]);
  
  // Memoize userBookmarks to avoid Set reference changes
  const userBookmarksKey = useMemo(() => Array.from(userBookmarks).sort().join(','), [userBookmarks]);

  const filteredBlueprints = useMemo(() => {
    return blueprints
      .filter((bp) => {
        // Filter by bookmarks if active
        if (showBookmarksOnly && !userBookmarks.has(bp.id)) {
          return false;
        }
        // Filter by selected tags (all selected tags must be present)
        if (selectedTags.length > 0) {
          const bpTags = bp.tags || [];
          const hasAllSelectedTags = selectedTags.every((tag) =>
            bpTags.some((bpTag) => bpTag.toLowerCase() === tag.toLowerCase())
          );
          if (!hasAllSelectedTags) {
            return false;
          }
        }
        // Filter by compatibility if save is loaded
        if (hasSaveData() && compatibilityFilter !== "all") {
          const compatibility = checkBlueprintCompatibility(bp);
          const isCompatible = Object.keys(compatibility.missingMaterials).length === 0;
          
          if (compatibilityFilter === "compatible" && !isCompatible) {
            return false;
          } else if (compatibilityFilter === "incompatible" && isCompatible) {
            return false;
          }
        }
        // Filter by install status
        if (installFilter !== "all") {
          const installStatus = getInstallStatus(bp);
          if (installFilter === "installed" && installStatus !== "installed") {
            return false;
          } else if (installFilter === "update-available" && installStatus !== "update-available") {
            return false;
          }
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
          // Sort by average rating, then by number of ratings
          const aRating = a.rating_average || 0;
          const bRating = b.rating_average || 0;
          if (Math.abs(aRating - bRating) > 0.01) {
            return bRating - aRating;
          }
          // If ratings are similar, prefer more ratings
          return (b.rating_count || 0) - (a.rating_count || 0);
        } else if (sortBy === "trending") {
          // Trending = engagement score (likes * 2 + downloads) for blueprints from last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          const aIsRecent = new Date(a.created_at) > sevenDaysAgo;
          const bIsRecent = new Date(b.created_at) > sevenDaysAgo;
          
          // Prioritize recent blueprints
          if (aIsRecent && !bIsRecent) return -1;
          if (!aIsRecent && bIsRecent) return 1;
          
          // Calculate engagement score (likes * 2 + downloads)
          const aScore = ((a.likes || 0) * 2) + (a.downloads || 0);
          const bScore = ((b.likes || 0) * 2) + (b.downloads || 0);
          return bScore - aScore;
        } else if (sortBy === "updated") {
          return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
        } else if (sortBy === "downloaded") {
          return (b.downloads || 0) - (a.downloads || 0);
        } else if (sortBy === "ipm-high") {
          return (b.production_rate || 0) - (a.production_rate || 0);
        } else if (sortBy === "ipm-low") {
          return (a.production_rate || 0) - (b.production_rate || 0);
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [blueprints, showBookmarksOnly, userBookmarksKey, selectedTagsKey, searchTerm, sortBy, compatibilityFilter, installFilter, getInstallStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredBlueprints.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBlueprints = filteredBlueprints.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Prefetch next page images for faster page transitions
  useEffect(() => {
    if (currentPage < totalPages) {
      const nextPageStart = currentPage * itemsPerPage;
      const nextPageBlueprints = filteredBlueprints.slice(
        nextPageStart,
        nextPageStart + itemsPerPage
      );
      
      // Prefetch first 4 images of next page
      nextPageBlueprints.slice(0, 4).forEach((bp) => {
        if (bp.image_url) {
          prefetchImage(getThumbnailUrl(bp.image_url));
        }
      });
    }
  }, [currentPage, totalPages, filteredBlueprints, itemsPerPage]);

  // Reset to page 1 when search changes
  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSort = (value) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const handleTagToggle = (tag) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
    setCurrentPage(1);
  };

  const handleSearchByCreator = (creatorName) => {
    handleSearch(creatorName);
    setSelectedCreator(creatorName);
  };

  const toggleBookmarks = () => {
    setShowBookmarksOnly(!showBookmarksOnly);
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
      {/* Error and Success Alerts */}
      <ErrorAlert error={error} onDismiss={() => setError(null)} />
      <SuccessAlert message={success} onDismiss={() => setSuccess(null)} />

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div 
          style={{
            background: `linear-gradient(135deg, ${theme.colors.cardBg}CC, ${theme.colors.elementBg}CC)`,
            borderColor: theme.colors.cardBorder,
            boxShadow: `0 4px 12px ${theme.colors.cardShadow}40`
          }} 
          className="text-center p-3 rounded-xl border-2 hover:scale-105 transition-all duration-200"
        >
          <p style={{ color: theme.colors.accentYellow }} className="font-bold text-2xl sm:text-2xl mb-0.5">{blueprints.length}</p>
          <p style={{ color: theme.colors.textSecondary }} className="text-xs font-medium">Total Blueprints</p>
        </div>
        <div 
          style={{
            background: `linear-gradient(135deg, ${theme.colors.cardBg}CC, ${theme.colors.elementBg}CC)`,
            borderColor: theme.colors.cardBorder,
            boxShadow: `0 4px 12px ${theme.colors.cardShadow}40`
          }} 
          className="text-center p-3 rounded-xl border-2 hover:scale-105 transition-all duration-200"
        >
          <p style={{ color: theme.colors.accentYellow }} className="font-bold text-2xl sm:text-2xl mb-0.5">
            {new Set(blueprints.map(bp => bp.creator_name).filter(Boolean)).size}
          </p>
          <p style={{ color: theme.colors.textSecondary }} className="text-xs font-medium">Total Creators</p>
        </div>
        <div 
          style={{
            background: `linear-gradient(135deg, ${theme.colors.cardBg}CC, ${theme.colors.elementBg}CC)`,
            borderColor: theme.colors.cardBorder,
            boxShadow: `0 4px 12px ${theme.colors.cardShadow}40`
          }} 
          className="text-center p-3 rounded-xl border-2 hover:scale-105 transition-all duration-200"
        >
          <p style={{ color: theme.colors.accentYellow }} className="font-bold text-2xl sm:text-2xl mb-0.5">{blueprints.reduce((sum, bp) => sum + (bp.downloads || 0), 0).toLocaleString()}</p>
          <p style={{ color: theme.colors.textSecondary }} className="text-xs font-medium">Total Downloads</p>
        </div>
        <div 
          style={{
            background: `linear-gradient(135deg, ${theme.colors.cardBg}CC, ${theme.colors.elementBg}CC)`,
            borderColor: theme.colors.cardBorder,
            boxShadow: `0 4px 12px ${theme.colors.cardShadow}40`
          }} 
          className="text-center p-3 rounded-xl border-2 hover:scale-105 transition-all duration-200"
        >
          <p style={{ color: theme.colors.accentYellow }} className="font-bold text-2xl sm:text-2xl mb-0.5">
            {(() => {
              const totalRatings = blueprints.reduce((sum, bp) => sum + (bp.rating_count || 0), 0);
              const totalRatingSum = blueprints.reduce((sum, bp) => sum + ((bp.rating_average || 0) * (bp.rating_count || 0)), 0);
              const avgRating = totalRatings > 0 ? (totalRatingSum / totalRatings).toFixed(1) : '0.0';
              return `${avgRating}`;
            })()}
          </p>
          <p style={{ color: theme.colors.textSecondary }} className="text-xs font-medium">Average Rating</p>
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
        <div className="relative" ref={sortDropdownRef}>
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
            <span className="flex items-center gap-2">
              <ListFilter className="w-6 h-6" />
              {sortBy === "newest" ? "Newest First" : sortBy === "oldest" ? "Oldest First" : sortBy === "alphabetical" ? "Alphabetical" : sortBy === "updated" ? "Recently Updated" : sortBy === "downloaded" ? "Most Downloaded" : sortBy === "popular" ? "Highest Rated" : sortBy === "trending" ? "Trending" : sortBy === "ipm-high" ? "Highest IPM" : installFilter === "installed" ? "Installed" : installFilter === "update-available" ? "Update Available" : "Lowest IPM"}
            </span>
            <span className={`transition transform ${sortDropdownOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          
          {sortDropdownOpen && (
            <div style={{ borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.elementBg }} className="absolute top-full right-0 mt-1 border rounded-lg shadow-lg z-50 w-48">
              <button
                type="button"
                onClick={() => { handleSort("newest"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition first:rounded-t-lg border-b flex items-center gap-2"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <Clock className="w-4 h-4" />
                Newest First
              </button>
              <button
                type="button"
                onClick={() => { handleSort("oldest"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition border-b flex items-center gap-2"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <History className="w-4 h-4" />
                Oldest First
              </button>
              <button
                type="button"
                onClick={() => { handleSort("alphabetical"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition border-b flex items-center gap-2"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <SortAsc className="w-4 h-4" />
                Alphabetical
              </button>
              <button
                type="button"
                onClick={() => { handleSort("updated"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition border-b flex items-center gap-2"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <RefreshCw className="w-4 h-4" />
                Recently Updated
              </button>
              <button
                type="button"
                onClick={() => { handleSort("downloaded"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition border-b flex items-center gap-2"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <Download className="w-4 h-4" />
                Most Downloaded
              </button>
              <button
                type="button"
                onClick={() => { handleSort("popular"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition border-b flex items-center gap-2"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <Heart className="w-4 h-4" />
                Highest Rated
              </button>
              <button
                type="button"
                onClick={() => { handleSort("trending"); setSortDropdownOpen(false); }}
                style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                className="w-full text-left px-4 py-2.5 transition border-b flex items-center gap-2"
                onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <TrendingUp className="w-4 h-4" />
                Trending
              </button>

              {/* Compatibility Filter - Only show if save is loaded */}
              {hasSaveData() && (
                <>
                  <button
                    type="button"
                    onClick={() => { setCompatibilityFilter("all"); setSortDropdownOpen(false); setCurrentPage(1); }}
                    style={{ 
                      color: compatibilityFilter === "all" ? theme.colors.accentYellow : theme.colors.textPrimary,
                      borderColor: `${theme.colors.cardBorder}33`
                    }}
                    className="w-full text-left px-4 py-2.5 transition border-b"
                    onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    --- All Blueprints --- 
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCompatibilityFilter("compatible"); setSortDropdownOpen(false); setCurrentPage(1); }}
                    style={{ 
                      color: compatibilityFilter === "compatible" ? theme.colors.accentYellow : theme.colors.textPrimary,
                      borderColor: `${theme.colors.cardBorder}33`
                    }}
                    className="w-full text-left px-4 py-2.5 transition border-b flex items-center gap-2"
                    onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <Save className="w-4 h-4" />
                    Compatible
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCompatibilityFilter("incompatible"); setSortDropdownOpen(false); setCurrentPage(1); }}
                    style={{ 
                      color: compatibilityFilter === "incompatible" ? theme.colors.accentYellow : theme.colors.textPrimary,
                      borderColor: `${theme.colors.cardBorder}33`
                    }}
                    className="w-full text-left px-4 py-2.5 transition border-b flex items-center gap-2"
                    onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <Save className="w-4 h-4" />
                    Not Compatible
                  </button>
                  <button
                    type="button"
                    onClick={() => { 
                      setInstallFilter(installFilter === "installed" ? "all" : "installed"); 
                      setSortDropdownOpen(false); 
                      setCurrentPage(1); 
                    }}
                    style={{ 
                      color: installFilter === "installed" ? theme.colors.accentYellow : theme.colors.textPrimary,
                      borderColor: `${theme.colors.cardBorder}33`
                    }}
                    className="w-full text-left px-4 py-2.5 transition border-b flex items-center gap-2"
                    onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <Check className="w-4 h-4" />
                    Installed
                  </button>
                  <button
                    type="button"
                    onClick={() => { 
                      setInstallFilter(installFilter === "update-available" ? "all" : "update-available"); 
                      setSortDropdownOpen(false); 
                      setCurrentPage(1); 
                    }}
                    style={{ 
                      color: installFilter === "update-available" ? theme.colors.accentYellow : theme.colors.textPrimary,
                      borderColor: `${theme.colors.cardBorder}33`
                    }}
                    className="w-full text-left px-4 py-2.5 transition last:rounded-b-lg flex items-center gap-2"
                    onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <AlertCircle className="w-4 h-4" />
                    Update Available
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tags Filter */}
        <div className="relative" ref={tagsDropdownRef}>
          <button
            type="button"
            onClick={() => setTagsDropdownOpen(!tagsDropdownOpen)}
            style={{
              borderColor: theme.colors.cardBorder,
              backgroundColor: selectedTags.length > 0 ? `${theme.colors.accentYellow}33` : `${theme.colors.cardBg}33`,
              color: theme.colors.textPrimary
            }}
            className="w-full sm:w-auto px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 font-medium transition-all shadow-sm hover:opacity-80 flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Tags {selectedTags.length > 0 && <span style={{ color: theme.colors.accentYellow }} className="font-bold">({selectedTags.length})</span>}
            </span>
            <span className={`transition transform ${tagsDropdownOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          
          {tagsDropdownOpen && (
            <div style={{ borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.elementBg }} className="absolute top-full right-0 mt-1 border rounded-lg shadow-lg z-50 w-56 max-h-80 overflow-y-auto">
              {AVAILABLE_TAGS.map((tag, index) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  style={{ 
                    color: selectedTags.includes(tag) ? theme.colors.accentYellow : theme.colors.textPrimary,
                    borderColor: `${theme.colors.cardBorder}33`,
                    backgroundColor: selectedTags.includes(tag) ? `${theme.colors.accentYellow}33` : 'transparent'
                  }}
                  className={`w-full text-left px-4 py-2.5 transition ${index === 0 ? 'first:rounded-t-lg' : ''} ${index === AVAILABLE_TAGS.length - 1 ? 'last:rounded-b-lg last:border-b-0' : 'border-b'}`}
                  onMouseEnter={(e) => {
                    if (!selectedTags.includes(tag)) {
                      e.target.style.backgroundColor = `${theme.colors.cardBorder}33`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = selectedTags.includes(tag) ? `${theme.colors.accentYellow}33` : 'transparent';
                  }}
                >
                  {getTagDisplay(tag)}
                </button>
              ))}
              {selectedTags.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTags([]);
                      setCurrentPage(1);
                    }}
                    style={{ color: theme.colors.accentYellow, borderColor: `${theme.colors.cardBorder}33` }}
                    className="w-full text-left px-4 py-2.5 transition border-t"
                    onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    Clear All Tags
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        
        {user && (
          <>
            <button
              type="button"
              onClick={toggleBookmarks}
              style={{
                borderColor: theme.colors.cardBorder,
                backgroundColor: showBookmarksOnly ? theme.colors.accentYellow : `${theme.colors.cardBg}33`,
                color: showBookmarksOnly ? theme.colors.bgPrimary : theme.colors.textPrimary
              }}
              className="px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 font-medium transition-all shadow-sm hover:opacity-80 flex items-center gap-2"
              data-tooltip={showBookmarksOnly ? "Show all blueprints" : "Show bookmarked blueprints only"}
            >
              <Bookmark className={`w-5 h-5 ${showBookmarksOnly ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">Bookmarks</span>
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
              data-tooltip="Show my uploaded blueprints"
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
              ? "✨ No blueprints found or could not be loaded."
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
        
        {paginatedBlueprints.map((blueprint, index) => {
          const isLiked = userLikes.has(blueprint.id);
          const isBookmarked = userBookmarks.has(blueprint.id);
          return (
            <BlueprintCard
              key={blueprint.id}
              blueprint={blueprint}
              isLiked={isLiked}
              isBookmarked={isBookmarked}
              downloadingId={downloadingId}
              deleting={deleting}
              user={user}
              userLikes={userLikes}
              onSelect={setSelectedBlueprint}
              onDownload={handleDownload}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onDelete={handleDelete}
              onSearchByCreator={handleSearchByCreator}
              isFirstPage={currentPage === 1}
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
        userRating={selectedBlueprint ? (userRatings.get(selectedBlueprint.id) || 0) : 0}
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
        onRatingChange={(rating, oldRating) => {
          if (selectedBlueprint) {
            handleRating(selectedBlueprint.id, rating, oldRating);
          }
        }}
        onDownload={handleDownload}
        onSearchByCreator={handleSearchByCreator}
        onBlueprintUpdate={(message) => {
          // Refresh the gallery to get updated blueprint data
          fetchBlueprints();
          // Show success message if provided
          if (message) {
            setSuccess(message);
          }
        }}
      />
    </>
  );
}

// Error boundary wrapperr
function BlueprintGallery({ user, refreshTrigger, initialBlueprintId, initialMessage, onMessageShown }) {
  return (
    <ErrorBoundary name="BlueprintGallery">
      <BlueprintGalleryContent user={user} refreshTrigger={refreshTrigger} initialBlueprintId={initialBlueprintId} initialMessage={initialMessage} onMessageShown={onMessageShown} />
    </ErrorBoundary>
  );
}

export default BlueprintGallery;
