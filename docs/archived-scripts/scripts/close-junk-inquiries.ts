import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const junkIds = [
  "3f3840b8-5eaa-4008-af33-6536fb82d9ab", // OpenAI
  "7044137e-2736-4e87-8143-a7e1090c236b", // Dammy Expert
]

async function closeJunk() {
  console.log('Closing 2 junk inquiries...\n')

  const { error } = await supabase
    .from('work_items')
    .update({
      closed_at: new Date().toISOString(),
      close_reason: 'Spam/junk inquiry'
    })
    .in('id', junkIds)

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('✅ Closed 2 junk items')
    console.log('   - OpenAI spam')
    console.log('   - Dammy Expert spam')
  }
}

closeJunk()
