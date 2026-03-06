import { createClient } from '@/lib/supabase/server'

const DEFAULT_BRAND_TONE = `Playful. Powerful. Pride-forward.
Confident chaos, handled professionally.
Bold, inclusive, fast and friendly — like a cool founder texting you, not a help desk.
Short paragraphs. Occasional emoji. Zero corporate fluff.
Never snarky or mean. Always warm and enthusiastic.
Use "we" and "us" naturally. Sign off warmly but not formally.`

export { DEFAULT_BRAND_TONE }

/**
 * Reads custom brand tone from the settings table.
 * Falls back to DEFAULT_BRAND_TONE if none is saved.
 */
export async function getBrandTone(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'brand_tone')
      .single()

    if (error || !data) return DEFAULT_BRAND_TONE
    return typeof data.value === 'string' ? data.value : DEFAULT_BRAND_TONE
  } catch {
    return DEFAULT_BRAND_TONE
  }
}
