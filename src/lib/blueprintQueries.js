/**
 * Blueprint fetching utilities
 * Handles queries by UUID or slug
 */

import { isUUID } from './slugUtils';

export async function fetchBlueprintByIdentifier(supabase, identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return { data: null, error: 'Invalid identifier' };
  }

  try {
    // If it's a UUID, query by ID
    if (isUUID(identifier)) {
      const { data, error } = await supabase
        .from('blueprints')
        .select('*')
        .eq('id', identifier)
        .single();

      return { data, error };
    }

    // Otherwise, treat as slug
    const { data, error } = await supabase
      .from('blueprints')
      .select('*')
      .eq('slug', identifier)
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function fetchBlueprints(supabase, options = {}) {
  const {
    page = 1,
    pageSize = 12,
    searchTerm = '',
    sortBy = 'newest',
    filterByUser = null,
  } = options;

  try {
    let query = supabase
      .from('blueprints')
      .select('*', { count: 'exact' });

    if (searchTerm) {
      query = query.or(
        `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,tags.cs.{${searchTerm}}`
      );
    }

    if (filterByUser) {
      query = query.eq('user_id', filterByUser);
    }

    if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (sortBy === 'popular') {
      query = query.order('likes', { ascending: false });
    } else if (sortBy === 'downloaded') {
      query = query.order('downloads', { ascending: false });
    }

    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    return { data, error, count };
  } catch (error) {
    return { data: null, error };
  }
}
