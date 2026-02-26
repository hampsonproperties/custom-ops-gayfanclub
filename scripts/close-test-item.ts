import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function closeTestItem() {
  const { error } = await supabase
    .from('work_items')
    .update({
      closed_at: new Date().toISOString(),
      close_reason: 'Test data cleanup'
    })
    .eq('id', '17a4da73-2947-4ba2-8b9d-90779f6efd50')

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('✅ Closed test item')
  }
}

closeTestItem()
