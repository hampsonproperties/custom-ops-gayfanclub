import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Lazy initialize OpenAI client to avoid build-time errors
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, projectId, customerId, customerEmail } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing required field: prompt' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Gather context about the project and customer
    let context = ''

    if (projectId) {
      const { data: project } = await supabase
        .from('work_items')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', projectId)
        .single()

      if (project) {
        context += `Project: ${project.title || 'Untitled'}\n`
        context += `Status: ${project.status}\n`
        if (project.event_date) {
          context += `Event Date: ${project.event_date}\n`
        }
        if (project.estimated_value) {
          context += `Estimated Value: $${project.estimated_value}\n`
        }
        if (project.customer) {
          context += `Customer: ${project.customer.display_name || project.customer.email}\n`
        }
      }

      // Get recent communications
      const { data: recentComms } = await supabase
        .from('communications')
        .select('subject, body_text, created_at, direction')
        .eq('work_item_id', projectId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (recentComms && recentComms.length > 0) {
        context += '\nRecent Communications:\n'
        recentComms.forEach((comm, i) => {
          context += `${i + 1}. [${comm.direction}] ${comm.subject}\n`
          if (comm.body_text) {
            context += `   ${comm.body_text.substring(0, 150)}...\n`
          }
        })
      }

      // Get recent notes
      const { data: recentNotes } = await supabase
        .from('work_item_notes')
        .select('content, created_at')
        .eq('work_item_id', projectId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (recentNotes && recentNotes.length > 0) {
        context += '\nRecent Internal Notes:\n'
        recentNotes.forEach((note, i) => {
          context += `${i + 1}. ${note.content.substring(0, 150)}...\n`
        })
      }
    } else if (customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (customer) {
        context += `Customer: ${customer.display_name || customer.email}\n`
        if (customer.phone) {
          context += `Phone: ${customer.phone}\n`
        }
      }
    }

    // Build system prompt for email generation
    const systemPrompt = `You are an AI email assistant for Gay Fan Club, a custom merchandise company specializing in custom hand fans, banners, and promotional items for events.

Your role is to draft professional, friendly, and helpful emails to customers based on user prompts.

CONTEXT:
${context || 'No specific project context available.'}

BRAND VOICE:
- Friendly but professional
- LGBTQ+ inclusive and celebratory
- Helpful and solution-oriented
- Enthusiastic about custom fan designs and events

GUIDELINES:
1. Generate ONLY the email body content (no subject line)
2. Use HTML formatting for better presentation
3. Keep emails concise but complete
4. Always end with a warm sign-off
5. Include specific details from the context when relevant
6. Use the customer's name if available
7. Be proactive about next steps

AVOID:
- Being overly formal or stuffy
- Using "Dear Sir/Madam"
- Long-winded explanations
- Apologizing excessively
- Making promises about timing unless specified`

    // Generate email using OpenAI
    const openai = getOpenAIClient()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const emailBody = completion.choices[0]?.message?.content || ''

    // Generate a subject line
    const subjectCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      max_tokens: 50,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `Based on this email content, generate a concise, professional subject line (no quotes, just the subject line text):

${emailBody}`,
        },
      ],
    })

    const subject = subjectCompletion.choices[0]?.message?.content?.replace(/^["']|["']$/g, '').trim() || 'Message from Gay Fan Club'

    return NextResponse.json({
      success: true,
      subject,
      body: emailBody,
    })
  } catch (error) {
    console.error('Email generation error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate email',
      },
      { status: 500 }
    )
  }
}
