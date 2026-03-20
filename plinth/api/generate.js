// This file goes at: api/generate.js in your project root
// It runs as a Vercel Edge Function — your API key stays on the server

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { topic, count, level, language } = await req.json()

    const lang = (language || '').trim() || 'English'
    const t = (topic || '').trim() || 'General Knowledge'

    const prompt = `Generate exactly ${count} trivia questions about "${t}" at ${level} difficulty.
Language: ${lang}. All questions AND all 4 answer options AND the fun fact must be in ${lang}.

Respond with ONLY a raw JSON array. No markdown fences, no explanation. Each element must be exactly:
{"question":"...","options":["A","B","C","D"],"correct":0,"fact":"..."}
where correct is the 0-based index of the right answer, and fact is a 1-sentence fun fact.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, // Set in Vercel dashboard
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `API error ${res.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    const text = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(text)
    const arr = Array.isArray(parsed) ? parsed : parsed?.questions

    return new Response(JSON.stringify(arr), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
