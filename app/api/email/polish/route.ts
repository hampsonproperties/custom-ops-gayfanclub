import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { validateBody } from '@/lib/api/validate'
import { polishEmailBody } from '@/lib/api/schemas'
import { logger } from '@/lib/logger'
import { serverError } from '@/lib/api/errors'

const log = logger('email-polish')

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const BRAND_VOICE_PROMPT = `You are a copywriter for Gay Fan Club, a custom merchandise company specializing in hand fans, banners, and promotional items for Pride events, drag shows, and celebrations.

YOUR JOB: Rewrite the user's rough draft email in the Gay Fan Club brand voice. Keep the same meaning and information — just make it sound like us.

BRAND VOICE:
- Playful. Powerful. Pride-forward.
- Confident chaos, handled professionally.
- Bold, inclusive, fast and friendly — like a cool founder texting you, not a help desk.
- Short paragraphs. Occasional emoji. Zero corporate fluff.
- Never snarky or mean. Always warm and enthusiastic.
- Use "we" and "us" naturally. Sign off warmly but not formally.

RULES:
1. Return ONLY the polished email text — no commentary, no "Here's the rewritten version"
2. Keep it the same length or shorter than the original
3. Preserve all specific details (names, dates, numbers, order info)
4. Don't add information that wasn't in the original
5. Don't use "Dear" or "To Whom It May Concern"
6. Keep it in plain text (no HTML formatting)`

export async function POST(request: NextRequest) {
  try {
    const bodyResult = validateBody(await request.json(), polishEmailBody)
    if (bodyResult.error) return bodyResult.error
    const { text } = bodyResult.data

    const openai = getOpenAIClient()

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        { role: 'system', content: BRAND_VOICE_PROMPT },
        { role: 'user', content: text },
      ],
    })

    const polished = completion.choices[0]?.message?.content || text

    return NextResponse.json({ success: true, polished })
  } catch (error) {
    log.error('Email polish error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to polish email')
  }
}
