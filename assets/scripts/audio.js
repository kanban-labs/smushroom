// ── Audio system ──
let audioCtx = null
let muted = false

// Live-adjustable sound parameters (written by the settings panel)
export const soundParams = {
  octaveShift: 0, // semitone multiplier offset: -2=low, -1=mid-low, 0=default, 1=higher
  filterHz: 800, // low-pass cutoff — warm default
  decayMult: 2.0, // multiplies each preset's decay
  volume: 0.6, // peak gain
}

// Base C major pentatonic at C5-E6
export const chimePresets = [
  { freq: 523.25, decay: 0.7 }, // C5
  { freq: 587.33, decay: 0.65 }, // D5
  { freq: 659.25, decay: 0.6 }, // E5
  { freq: 783.99, decay: 0.55 }, // G5
  { freq: 880.0, decay: 0.5 }, // A5
  { freq: 1046.5, decay: 0.65 }, // C6
  { freq: 1174.66, decay: 0.6 }, // D6
  { freq: 1318.51, decay: 0.55 }, // E6
]

export function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
}

export function isMuted() {
  return muted
}

export function toggleMute() {
  muted = !muted
  return muted
}

export function playChime(noteIndex, octaveOverride) {
  if (muted) return
  ensureAudio()
  const t = audioCtx.currentTime
  const preset = noteIndex !== undefined
    ? chimePresets[Math.min(Math.max(noteIndex, 0), chimePresets.length - 1)]
    : chimePresets[Math.floor(Math.random() * chimePresets.length)]

  // Apply octave shift: each step is one octave (factor of 2)
  const octave = octaveOverride !== undefined ? octaveOverride : soundParams.octaveShift
  const octaveFactor = Math.pow(2, octave)
  const baseFreq = preset.freq * octaveFactor
  const freq = baseFreq + (Math.random() - 0.5) * 12 * octaveFactor
  const decay = preset.decay * soundParams.decayMult

  const filter = audioCtx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = soundParams.filterHz
  filter.Q.value = 0.5

  const osc = audioCtx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq * 1.008, t)
  osc.frequency.linearRampToValueAtTime(freq, t + 0.02)

  const osc2 = audioCtx.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.value = freq * 2.005
  const harmGain = audioCtx.createGain()
  harmGain.gain.setValueAtTime(0.06, t)
  harmGain.gain.exponentialRampToValueAtTime(0.001, t + decay * 0.4)

  const gain = audioCtx.createGain()
  gain.gain.setValueAtTime(0.001, t)
  gain.gain.linearRampToValueAtTime(soundParams.volume, t + 0.004)
  gain.gain.exponentialRampToValueAtTime(soundParams.volume * 0.3, t + 0.06)
  gain.gain.exponentialRampToValueAtTime(0.001, t + decay)

  osc.connect(filter)
  osc2.connect(harmGain)
  harmGain.connect(filter)
  filter.connect(gain)
  gain.connect(audioCtx.destination)

  osc.start(t)
  osc2.start(t)
  osc.stop(t + decay)
  osc2.stop(t + decay)
}
