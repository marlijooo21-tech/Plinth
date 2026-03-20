import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createRoom, getRoom, updateRoom,
  addPlayer, getPlayers, updatePlayer, resetPlayersForNewQuestion,
  subscribeToRoom, subscribeToPlayers, unsubscribe,
} from './db.js'
import { fetchQuestions } from './questions.js'
import './styles.css'

const TOPIC_SUGGESTIONS = [
  'General Knowledge', 'Science', 'History', 'Geography', 'Movies & TV',
  'Music', 'Sports', 'Technology', 'Literature', 'Art', 'Food & Drink',
  'Nature', 'Space', 'Mathematics', 'Pop Culture', 'Animals',
  'World Cultures', 'Mythology', 'Video Games', 'Architecture',
]
const LANGUAGE_SUGGESTIONS = [
  'English', 'Spanish', 'French', 'German', 'Italian',
  'Portuguese', 'Arabic', 'Persian', 'Japanese', 'Chinese',
  'Korean', 'Turkish', 'Hindi', 'Russian', 'Swedish',
]
const LEVELS = ['Easy', 'Medium', 'Hard', 'Expert']
const TIME_OPTIONS = [10, 15, 20, 30]
const COUNT_OPTIONS = [5, 10, 15, 20]
const MAX_PTS = 1000

function uid() { return Math.random().toString(36).slice(2, 8).toUpperCase() }

function calcScore(timeLeft, timeLimit) {
  if (timeLimit <= 0) return 0
  return Math.round(MAX_PTS * (0.3 + 0.7 * (timeLeft / timeLimit)))
}

/* ════════════════════════════════════════════════════
   UI PRIMITIVES
   ════════════════════════════════════════════════════ */
function GridBG() {
  return <div className="grid-bg">
    <svg width="100%" height="100%">
      <defs>
        <pattern id="sm" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        </pattern>
        <pattern id="lg" width="200" height="200" patternUnits="userSpaceOnUse">
          <rect width="200" height="200" fill="url(#sm)" />
          <path d="M 200 0 L 0 0 0 200" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#lg)" />
    </svg>
    <div className="corner-mark tl" /><div className="corner-mark tr" />
    <div className="corner-mark bl" /><div className="corner-mark br" />
  </div>
}

const Panel = ({ children, className = '', style }) =>
  <div className={`panel ${className}`} style={style}>{children}</div>

const Btn = ({ children, onClick, outline, disabled, accent, style, className = '' }) =>
  <button disabled={disabled} onClick={disabled ? undefined : onClick}
    className={`btn ${accent ? 'btn-accent' : outline ? 'btn-outline' : 'btn-solid'} ${className}`}
    style={{ ...style, opacity: disabled ? 0.3 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
    {children}
  </button>

const Lbl = ({ children }) => <div className="lbl">{children}</div>

function Combo({ label, value, onChange, placeholder, items }) {
  const [open, setOpen] = useState(false)
  const vis = open ? items.filter(x => !value || x.toLowerCase().includes(value.toLowerCase())).slice(0, 8) : []
  return <div className="field">
    <Lbl>{label}</Lbl>
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className="input"
      onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} />
    {vis.length > 0 && <div className="chips">
      {vis.map(x => <button key={x} className="chip" onMouseDown={() => { onChange(x); setOpen(false) }}>{x}</button>)}
    </div>}
  </div>
}

function Sel({ label, value, onChange, opts }) {
  return <div className="field">
    <Lbl>{label}</Lbl>
    <select value={value} onChange={e => onChange(e.target.value)} className="input select">
      {opts.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
    </select>
  </div>
}

function Logo() {
  return <div className="logo">
    <div className="logo-title">Plinth</div>
    <div className="logo-sub">Prove Your Foundation</div>
    <div className="logo-line" />
  </div>
}

function TimerRing({ left, limit }) {
  const pct = limit > 0 ? left / limit : 0
  const r = 30, c = 2 * Math.PI * r
  const urgent = pct <= 0.25
  return <svg width="72" height="72" viewBox="0 0 72 72" className="timer-ring">
    {Array.from({ length: 12 }).map((_, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2
      return <line key={i}
        x1={36 + Math.cos(a) * 27} y1={36 + Math.sin(a) * 27}
        x2={36 + Math.cos(a) * 30} y2={36 + Math.sin(a) * 30}
        stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
    })}
    <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
    <circle cx="36" cy="36" r={r} fill="none"
      stroke={urgent ? 'var(--red)' : 'var(--fg)'} strokeWidth="1.5"
      strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="butt"
      transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset 0.3s linear' }} />
    <text x="36" y="39" textAnchor="middle"
      fill={urgent ? 'var(--red)' : 'var(--fg)'}
      className="timer-text">{left}</text>
  </svg>
}

function ErrorBanner({ msg, onDismiss }) {
  if (!msg) return null
  return <div className="error-banner" onClick={onDismiss}>{msg}</div>
}

/* ════════════════════════════════════════════════════
   SCREEN: HOME — Create or Join
   ════════════════════════════════════════════════════ */
function ScreenHome({ onGo }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState(null)
  const [code, setCode] = useState('')

  return <div className="screen narrow slide-up">
    <Logo />
    <Panel>
      <div className="section-num">§01</div>
      <div className="field">
        <Lbl>Your Name</Lbl>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Enter your name..." maxLength={20} className="input" />
      </div>

      {!mode && <div className="btn-row">
        <Btn accent onClick={() => setMode('create')} disabled={!name.trim()}>Create Room</Btn>
        <Btn outline onClick={() => setMode('join')} disabled={!name.trim()}>Join Room</Btn>
      </div>}

      {mode === 'create' && <div className="btn-row" style={{ marginTop: 12 }}>
        <Btn outline onClick={() => setMode(null)}>Back</Btn>
        <Btn accent onClick={() => onGo('create', name.trim(), '')}>Next</Btn>
      </div>}

      {mode === 'join' && <div style={{ marginTop: 12 }}>
        <div className="field">
          <Lbl>Room Code</Lbl>
          <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB3F9K" maxLength={8} className="input" />
        </div>
        <div className="btn-row">
          <Btn outline onClick={() => setMode(null)}>Back</Btn>
          <Btn accent onClick={() => onGo('join', name.trim(), code.trim())} disabled={!code.trim()}>Join</Btn>
        </div>
      </div>}
    </Panel>
  </div>
}

/* ════════════════════════════════════════════════════
   SCREEN: SETUP — Configure room
   ════════════════════════════════════════════════════ */
function ScreenSetup({ roomCode, onBack, onDone }) {
  const [topic, setTopic] = useState('')
  const [lang, setLang] = useState('English')
  const [level, setLevel] = useState('Medium')
  const [count, setCount] = useState(10)
  const [time, setTime] = useState(15)

  return <div className="screen mid slide-up">
    <Logo />
    <Panel>
      <div className="setup-header">
        <div className="section-num" style={{ marginBottom: 0 }}>§02</div>
        <div className="room-badge">{roomCode}</div>
      </div>
      <div className="share-hint">Share this room code — players can join from any device</div>

      <Combo label="Topic" value={topic} onChange={setTopic}
        placeholder="Type any topic... e.g. Persian Poetry" items={TOPIC_SUGGESTIONS} />
      <Combo label="Language" value={lang} onChange={setLang}
        placeholder="Type any language..." items={LANGUAGE_SUGGESTIONS} />

      <div className="config-grid">
        <div className="config-cell"><Sel label="Questions" value={count} onChange={v => setCount(+v)}
          opts={COUNT_OPTIONS.map(n => ({ v: n, l: `${n}` }))} /></div>
        <div className="config-cell"><Sel label="Level" value={level} onChange={setLevel}
          opts={LEVELS.map(l => ({ v: l, l }))} /></div>
        <div className="config-cell"><Sel label="Timer" value={time} onChange={v => setTime(+v)}
          opts={TIME_OPTIONS.map(t => ({ v: t, l: `${t}s` }))} /></div>
      </div>

      <div className="btn-row">
        <Btn outline onClick={onBack}>Back</Btn>
        <Btn accent onClick={() => onDone({
          topic: topic.trim() || 'General Knowledge',
          lang: lang.trim() || 'English', level, count, time,
        })}>Create</Btn>
      </div>
    </Panel>
  </div>
}

/* ════════════════════════════════════════════════════
   SCREEN: LOBBY — Waiting for players
   ════════════════════════════════════════════════════ */
function ScreenLobby({ roomCode, players, isHost, generating, onStart }) {
  return <div className="screen mid slide-up">
    <Logo />
    <Panel>
      <div className="lobby-code-wrap">
        <div className="lbl" style={{ marginBottom: 4 }}>Room Code</div>
        <div className="lobby-code">{roomCode}</div>
        <div className="lobby-url">Share this code to invite players</div>
      </div>

      <div className="lbl" style={{ marginTop: 20 }}>Players — {players.length}</div>
      <div className="player-grid">
        {players.map((p, i) => <div key={p.id} className="player-row">
          <div className="player-num">{String(i + 1).padStart(2, '0')}</div>
          <div className="player-name">{p.name}</div>
          {i === 0 && <div className="player-host">HOST</div>}
        </div>)}
      </div>

      {generating ? <div className="loading-wrap">
        <div className="spinner" />
        <div className="loading-text">Generating questions</div>
      </div> : isHost
        ? <Btn accent onClick={onStart} style={{ width: '100%', marginTop: 16 }}>Start Game</Btn>
        : <div className="waiting-text">Waiting for host to start...</div>
      }
    </Panel>
  </div>
}

/* ════════════════════════════════════════════════════
   SCREEN: PLAY — The game
   ════════════════════════════════════════════════════ */
function ScreenPlay({ question, qi, total, timeLeft, timeLimit, onAnswer, myAnswer, players, myId }) {
  const labels = ['A', 'B', 'C', 'D']
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const answered = myAnswer !== null && myAnswer !== undefined
  const showResult = answered

  // Count how many have answered
  const answeredCount = players.filter(p => p.current_answer !== null && p.current_answer !== undefined).length

  return <div className="screen wide fade-in">
    {/* Scoreboard */}
    <div className="score-grid" style={{ gridTemplateColumns: `repeat(${Math.min(players.length, 4)}, 1fr)` }}>
      {sorted.map((p, i) => <div key={p.id}
        className={`score-cell ${p.id === myId ? 'score-cell-me' : ''}`}>
        <div className="score-name">{p.name}{p.id === myId ? ' ▸' : ''}</div>
        <div className="score-val">{p.score}</div>
      </div>)}
    </div>

    {/* Progress + Timer */}
    <div className="play-header">
      <div>
        <div className="q-label">Question {String(qi + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
        <div className="q-progress"><div className="q-progress-bar" style={{ width: `${((qi + 1) / total) * 100}%` }} /></div>
        <div className="q-answered">{answeredCount}/{players.length} answered</div>
      </div>
      <TimerRing left={timeLeft} limit={timeLimit} />
    </div>

    {/* Question */}
    <Panel className="q-panel">
      <div className="q-text">{question.question}</div>
    </Panel>

    {/* Options */}
    <div className="opt-grid">
      {question.options.map((opt, i) => {
        const isCorrect = showResult && i === question.correct
        const isWrong = showResult && myAnswer === i && i !== question.correct
        let cls = 'opt'
        if (isCorrect) cls += ' opt-correct'
        if (isWrong) cls += ' opt-wrong'
        if (answered && !isCorrect && !isWrong) cls += ' opt-dim'

        return <button key={i} onClick={() => !answered && onAnswer(i)}
          disabled={answered} className={cls}>
          <div className="opt-label">{labels[i]}</div>
          <div className="opt-text">{opt}</div>
        </button>
      })}
    </div>

    {/* Feedback */}
    {showResult && <div className="feedback slide-up">
      <div className={`feedback-result ${myAnswer === question.correct ? 'fb-correct' : myAnswer === -1 ? 'fb-timeout' : 'fb-wrong'}`}>
        {myAnswer === question.correct ? `+${calcScore(timeLeft, timeLimit)}` : myAnswer === -1 ? 'TIME' : 'WRONG'}
      </div>
      {question.fact && <div className="feedback-fact">{question.fact}</div>}
    </div>}
  </div>
}

/* ════════════════════════════════════════════════════
   SCREEN: RESULTS
   ════════════════════════════════════════════════════ */
function ScreenResults({ players, isHost, onAgain, onHome }) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const medals = ['👑', '02', '03']
  return <div className="screen mid slide-up">
    <div className="results-title">Results</div>
    <div className="results-line" />
    <Panel style={{ marginBottom: 24 }}>
      <div className="results-header">
        <div className="rh-rank">RK</div>
        <div className="rh-name">PLAYER</div>
        <div className="rh-score">SCORE</div>
      </div>
      {sorted.map((p, i) => <div key={p.id}
        className={`results-row ${i === 0 ? 'results-row-first' : ''}`}
        style={{ animationDelay: `${i * 0.08}s` }}>
        <div className={`rr-rank ${i === 0 ? 'rr-rank-first' : ''}`}>
          {i === 0 ? '👑' : String(i + 1).padStart(2, '0')}
        </div>
        <div className={`rr-name ${i === 0 ? 'rr-name-first' : ''}`}>{p.name}</div>
        <div className={`rr-score ${i === 0 ? 'rr-score-first' : ''}`}>{p.score}</div>
      </div>)}
    </Panel>
    <div className="btn-row center">
      <Btn outline onClick={onHome}>Home</Btn>
      {isHost && <Btn accent onClick={onAgain}>Play Again</Btn>}
    </div>
  </div>
}

/* ════════════════════════════════════════════════════
   MAIN APP — Game State Machine
   ════════════════════════════════════════════════════ */
export default function App() {
  const [view, setView] = useState('home')
  const [myName, setMyName] = useState('')
  const [myId, setMyId] = useState(null)
  const [isHost, setIsHost] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [config, setConfig] = useState(null)
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [questions, setQuestions] = useState([])
  const [qi, setQi] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [myAnswer, setMyAnswer] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState('')

  const timerRef = useRef(null)
  const roomSubRef = useRef(null)
  const playerSubRef = useRef(null)
  const qiRef = useRef(0)
  const questionsRef = useRef([])
  const myIdRef = useRef(null)
  const isHostRef = useRef(false)

  useEffect(() => { qiRef.current = qi }, [qi])
  useEffect(() => { questionsRef.current = questions }, [questions])
  useEffect(() => { myIdRef.current = myId }, [myId])
  useEffect(() => { isHostRef.current = isHost }, [isHost])

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current)
    unsubscribe(roomSubRef.current)
    unsubscribe(playerSubRef.current)
    roomSubRef.current = null
    playerSubRef.current = null
  }, [])

  // ── Subscribe to room changes ──
  const setupSubscriptions = useCallback((code) => {
    // Room changes
    roomSubRef.current = subscribeToRoom(code, (newRoom) => {
      setRoom(newRoom)

      if (newRoom.status === 'playing' && newRoom.questions) {
        const qs = typeof newRoom.questions === 'string'
          ? JSON.parse(newRoom.questions)
          : newRoom.questions
        setQuestions(qs)
        setQi(newRoom.current_question || 0)
        setMyAnswer(null)

        if (newRoom.question_start_time) {
          const elapsed = Math.floor((Date.now() - newRoom.question_start_time) / 1000)
          setTimeLeft(Math.max(0, newRoom.time_limit - elapsed))
        } else {
          setTimeLeft(newRoom.time_limit)
        }
        setView('play')
      }

      if (newRoom.status === 'finished') {
        setView('results')
        clearInterval(timerRef.current)
      }
    })

    // Player changes
    playerSubRef.current = subscribeToPlayers(code, (newPlayers) => {
      setPlayers(newPlayers)
    })
  }, [])

  // ── Timer ──
  useEffect(() => {
    if (view !== 'play' || !questions.length) return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-answer as timeout
          setMyAnswer(a => {
            if (a === null || a === undefined) {
              // Submit timeout to DB
              if (myIdRef.current) {
                updatePlayer(myIdRef.current, { current_answer: -1 }).catch(() => {})
              }
              return -1
            }
            return a
          })
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [view, qi, questions.length])

  // ── Host: auto-advance when all answered ──
  useEffect(() => {
    if (!isHost || view !== 'play' || !players.length) return
    const allAnswered = players.every(p => p.current_answer !== null && p.current_answer !== undefined)
    if (!allAnswered) return

    const timeout = setTimeout(async () => {
      try {
        const nextQ = qiRef.current + 1
        if (nextQ >= questionsRef.current.length) {
          await updateRoom(roomCode, { status: 'finished' })
        } else {
          await resetPlayersForNewQuestion(roomCode)
          await updateRoom(roomCode, {
            current_question: nextQ,
            question_start_time: Date.now(),
          })
        }
      } catch (e) { setErr('Advance error: ' + e.message) }
    }, 2000)
    return () => clearTimeout(timeout)
  }, [players, isHost, view, roomCode])

  // ── Handlers ──
  const goHome = async (action, name, code) => {
    setMyName(name)
    if (action === 'create') {
      setIsHost(true)
      const rc = uid()
      setRoomCode(rc)
      setView('setup')
    } else {
      // Join existing room
      try {
        const r = await getRoom(code)
        if (!r) { setErr('Room not found!'); return }
        if (r.status === 'finished') { setErr('Game already ended.'); return }
        const pid = await addPlayer(code, name)
        setMyId(pid)
        setIsHost(false)
        setRoomCode(code)
        setRoom(r)
        const pl = await getPlayers(code)
        setPlayers(pl)
        setupSubscriptions(code)

        if (r.status === 'playing') {
          // Late join — game already started
          const qs = typeof r.questions === 'string' ? JSON.parse(r.questions) : r.questions
          setQuestions(qs)
          setQi(r.current_question || 0)
          setTimeLeft(Math.max(0, r.time_limit - Math.floor((Date.now() - r.question_start_time) / 1000)))
          setView('play')
        } else {
          setView('lobby')
        }
      } catch (e) { setErr('Join failed: ' + e.message) }
    }
  }

  const goSetup = async (cfg) => {
    setConfig(cfg)
    try {
      await createRoom(roomCode, myName, cfg)
      const pid = await addPlayer(roomCode, myName)
      setMyId(pid)
      const pl = await getPlayers(roomCode)
      setPlayers(pl)
      setupSubscriptions(roomCode)
      setView('lobby')
    } catch (e) { setErr('Create failed: ' + e.message) }
  }

  const goStart = async () => {
    setGenerating(true)
    setErr('')
    try {
      const r = await getRoom(roomCode)
      const c = config || r
      const qs = await fetchQuestions(c.topic, c.count || c.question_count, c.level, c.lang || c.language)
      if (!qs?.length) throw new Error('No questions generated')

      await resetPlayersForNewQuestion(roomCode)
      await updateRoom(roomCode, {
        questions: qs,
        status: 'playing',
        current_question: 0,
        question_start_time: Date.now(),
      })
      setGenerating(false)
      // Room subscription will handle the transition to 'play'
    } catch (e) {
      setErr('Start failed: ' + e.message)
      setGenerating(false)
    }
  }

  const doAnswer = async (idx) => {
    if (myAnswer !== null) return
    setMyAnswer(idx)
    const q = questions[qi]
    const pts = idx === q?.correct ? calcScore(timeLeft, room?.time_limit || 15) : 0
    try {
      const me = players.find(p => p.id === myId)
      await updatePlayer(myId, {
        current_answer: idx,
        score: (me?.score || 0) + pts,
      })
    } catch (e) { console.error('Answer error:', e) }
  }

  const reset = () => {
    cleanup()
    setView('home'); setMyName(''); setMyId(null); setIsHost(false)
    setRoomCode(''); setConfig(null); setRoom(null); setPlayers([])
    setQuestions([]); setQi(0); setTimeLeft(0); setMyAnswer(null)
    setGenerating(false); setErr('')
  }

  const playAgain = async () => {
    try {
      await resetPlayersForNewQuestion(roomCode)
      // Reset all player scores
      for (const p of players) {
        await updatePlayer(p.id, { score: 0, current_answer: null })
      }
      await updateRoom(roomCode, {
        status: 'waiting', questions: null, current_question: 0, question_start_time: null,
      })
      setQuestions([]); setQi(0); setMyAnswer(null); setView('lobby')
    } catch (e) { setErr('Reset failed: ' + e.message) }
  }

  return <>
    <div className="app">
      <GridBG />
      <ErrorBanner msg={err} onDismiss={() => setErr('')} />
      <div className="app-inner">
        {view === 'home' && <ScreenHome onGo={goHome} />}
        {view === 'setup' && <ScreenSetup roomCode={roomCode} onBack={reset} onDone={goSetup} />}
        {view === 'lobby' && <ScreenLobby roomCode={roomCode} players={players}
          isHost={isHost} generating={generating} onStart={goStart} />}
        {view === 'play' && questions[qi] && <ScreenPlay
          question={questions[qi]} qi={qi} total={questions.length}
          timeLeft={timeLeft} timeLimit={room?.time_limit || 15}
          onAnswer={doAnswer} myAnswer={myAnswer}
          players={players} myId={myId}
        />}
        {view === 'results' && <ScreenResults players={players} isHost={isHost}
          onAgain={playAgain} onHome={reset} />}
      </div>
    </div>
  </>
}
