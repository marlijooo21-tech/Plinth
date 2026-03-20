export async function fetchQuestions(topic, count, level, language) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: (topic || '').trim() || 'General Knowledge',
      count,
      level,
      language: (language || '').trim() || 'English',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Server error ${res.status}`)
  }

  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No questions returned')
  }
  return data
}
