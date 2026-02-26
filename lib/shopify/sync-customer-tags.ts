/**
 * Shopify Customer Tags Sync Service
 *
 * Syncs customer tags from Shopify to work items using flexible pattern matching.
 * Supports exact match, contains, and regex pattern matching.
 */

import { SupabaseClient } from '@supabase/supabase-js'

interface TagMapping {
  id: string
  shopify_tag_pattern: string
  internal_tag_id: string
  match_type: 'exact' | 'contains' | 'regex'
}

interface SyncResult {
  linked: number
  created: number
  errors: string[]
}

/**
 * Syncs Shopify customer tags to a work item
 *
 * Process:
 * 1. Fetch active tag mappings from shopify_tag_mappings
 * 2. Match Shopify tags against patterns (exact, contains, regex)
 * 3. Auto-create unmapped tags (normalized to lowercase)
 * 4. Link matched/created tags to work_item_tags (upsert to avoid duplicates)
 *
 * @param supabase - Supabase client instance
 * @param workItemId - Target work item ID
 * @param shopifyTags - Array of Shopify customer tags (e.g., ["VIP", "wholesale", "Rush Order"])
 * @returns Sync result with counts and errors
 */
export async function syncCustomerTags(
  supabase: SupabaseClient,
  workItemId: string,
  shopifyTags: string[]
): Promise<SyncResult> {
  const result: SyncResult = {
    linked: 0,
    created: 0,
    errors: [],
  }

  if (!shopifyTags || shopifyTags.length === 0) {
    return result
  }

  try {
    // 1. Fetch active tag mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('shopify_tag_mappings')
      .select('id, shopify_tag_pattern, internal_tag_id, match_type')
      .eq('is_active', true)

    if (mappingsError) {
      result.errors.push(`Failed to fetch tag mappings: ${mappingsError.message}`)
      return result
    }

    const tagMappings = (mappings || []) as TagMapping[]
    const matchedTagIds = new Set<string>()
    const unmatchedTags: string[] = []

    // 2. Match Shopify tags against patterns
    for (const shopifyTag of shopifyTags) {
      const trimmedTag = shopifyTag.trim()
      if (!trimmedTag) continue

      let matched = false

      for (const mapping of tagMappings) {
        const isMatch = matchTag(trimmedTag, mapping.shopify_tag_pattern, mapping.match_type)

        if (isMatch) {
          matchedTagIds.add(mapping.internal_tag_id)
          matched = true
          break // Use first match
        }
      }

      if (!matched) {
        unmatchedTags.push(trimmedTag)
      }
    }

    // 3. Auto-create unmapped tags
    for (const unmatchedTag of unmatchedTags) {
      // Normalize tag name: lowercase, trim
      const normalizedName = unmatchedTag.toLowerCase().trim()

      // Check if tag already exists (case-insensitive)
      const { data: existingTag } = await supabase
        .from('tags')
        .select('id')
        .ilike('name', normalizedName)
        .single()

      if (existingTag) {
        matchedTagIds.add(existingTag.id)
      } else {
        // Create new tag with original case for display
        const { data: newTag, error: createError } = await supabase
          .from('tags')
          .insert({ name: unmatchedTag, color: '#6B7280' }) // Default gray color
          .select('id')
          .single()

        if (createError) {
          // Tag might already exist due to race condition, try to fetch it
          const { data: raceTag } = await supabase
            .from('tags')
            .select('id')
            .ilike('name', normalizedName)
            .single()

          if (raceTag) {
            matchedTagIds.add(raceTag.id)
          } else {
            result.errors.push(`Failed to create tag "${unmatchedTag}": ${createError.message}`)
          }
        } else if (newTag) {
          matchedTagIds.add(newTag.id)
          result.created++
        }
      }
    }

    // 4. Link tags to work item (upsert to avoid duplicates)
    for (const tagId of matchedTagIds) {
      const { error: linkError } = await supabase
        .from('work_item_tags')
        .upsert(
          {
            work_item_id: workItemId,
            tag_id: tagId,
          },
          {
            onConflict: 'work_item_id,tag_id',
            ignoreDuplicates: true,
          }
        )

      if (linkError) {
        result.errors.push(`Failed to link tag ${tagId}: ${linkError.message}`)
      } else {
        result.linked++
      }
    }

    return result
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error during tag sync')
    return result
  }
}

/**
 * Matches a Shopify tag against a pattern based on match type
 *
 * @param tag - The Shopify tag to match (e.g., "VIP Customer")
 * @param pattern - The pattern to match against (e.g., "vip")
 * @param matchType - How to match: exact, contains, or regex
 * @returns true if tag matches pattern
 */
function matchTag(tag: string, pattern: string, matchType: 'exact' | 'contains' | 'regex'): boolean {
  const normalizedTag = tag.toLowerCase()
  const normalizedPattern = pattern.toLowerCase()

  switch (matchType) {
    case 'exact':
      return normalizedTag === normalizedPattern

    case 'contains':
      return normalizedTag.includes(normalizedPattern)

    case 'regex':
      try {
        const regex = new RegExp(pattern, 'i') // Case-insensitive
        return regex.test(tag)
      } catch (error) {
        console.error(`Invalid regex pattern: ${pattern}`, error)
        return false
      }

    default:
      return false
  }
}
