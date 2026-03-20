import { supabase } from './supabase.js'

// ─── Room Operations ────────────────────────────────

export async function createRoom(roomId, hostName, config) {
  const { error } = await supabase.from('rooms').insert({
    id: roomId,
    host_name: hostName,
    topic: config.topic,
    language: config.lang,
    level: config.level,
    question_count: config.count,
    time_limit: config.time,
    status: 'waiting',
  })
  if (error) throw new Error(error.message)
}

export async function getRoom(roomId) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single()
  if (error) return null
  return data
}

export async function updateRoom(roomId, updates) {
  const { error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', roomId)
  if (error) throw new Error(error.message)
}

// ─── Player Operations ──────────────────────────────

export async function addPlayer(roomId, name) {
  // Check if player already exists in room
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('room_id', roomId)
    .eq('name', name)
    .single()

  if (existing) return existing.id

  const { data, error } = await supabase
    .from('players')
    .insert({ room_id: roomId, name, score: 0 })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function getPlayers(roomId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

export async function updatePlayer(playerId, updates) {
  const { error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', playerId)
  if (error) throw new Error(error.message)
}

export async function resetPlayersForNewQuestion(roomId) {
  const { error } = await supabase
    .from('players')
    .update({ current_answer: null })
    .eq('room_id', roomId)
  if (error) throw new Error(error.message)
}

// ─── Realtime Subscriptions ─────────────────────────

export function subscribeToRoom(roomId, onRoomChange) {
  return supabase
    .channel(`room-${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => onRoomChange(payload.new)
    )
    .subscribe()
}

export function subscribeToPlayers(roomId, onPlayersChange) {
  return supabase
    .channel(`players-${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
      async () => {
        // Re-fetch all players on any change
        const players = await getPlayers(roomId)
        onPlayersChange(players)
      }
    )
    .subscribe()
}

export function unsubscribe(channel) {
  if (channel) supabase.removeChannel(channel)
}
