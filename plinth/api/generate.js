export const config = { maxDuration: 60 }
        
     export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { topic, count, level, language } = req.body || {}
    const lang = (language || '').trim() || 'English'
    const t = (topic || '').trim() || 'General Knowledge'
    const n = parseInt(count) || 5

    const prompt = `Generate exactly ${n} trivia questions about "${t}" at ${level || 'medium'} difficulty.
Language: ${lang}. All questions AND all 4 answer options AND the fun fact must be in ${lang}.
Respond with ONLY a raw JSON array. No markdown fences, no explanation. Each element must be exactly:
{"question":"...","options":["A","B","C","D"],"correct":0,"fact":"..."}
where correct is the 0-based index of the right answer, and fact is a 1-sentence fun fact.`

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const responseText = await anthropicRes.text()

    if (!anthropicRes.ok) {
      console.error('Anthropic API error:', anthropicRes.status, responseText)
      return res.status(502).json({
        error: `Anthropic API error ${anthropicRes.status}`,
        details: responseText,
      })
    }

    const data = JSON.parse(responseText)
    const text = (data.content?.[0]?.text || '').replace(/```json\n?|```/g, '').trim()
    const parsed = JSON.parse(text)
    const arr = Array.isArray(parsed) ? parsed : parsed?.questions

    return res.status(200).json(arr)
  } catch (e) {
    console.error('Handler error:', e.message, e.stack)
    return res.status(500).json({ error: e.message })
  }
}
