// ── Input handling: tap, drag, mute, fullscreen ──
import { playChime, toggleMute, isMuted, chimePresets } from './audio.js'
import { Blob, blobs } from './blob.js'

let _state // { W, H, hint, hintVisible }

let lastSpawn = 0
const DEBOUNCE_MS = 120 // minimum ms between new blobs

// ── Spawn blob (tap / keydown) ──

function spawnBlob(x, y) {
  const now = performance.now()
  if (now - lastSpawn < DEBOUNCE_MS) return
  lastSpawn = now

  if (_state.hintVisible) {
    _state.hint.classList.add('hidden')
    _state.hintVisible = false
  }

  // fade out oldest blob if getting crowded
  let liveCount = 0
  let oldest = null
  for (let i = 0; i < blobs.length; i++) {
    if (!blobs[i].dead && !blobs[i].fadeIn) {
      liveCount++
      if (!oldest) oldest = blobs[i]
    }
  }
  if (liveCount > 6) oldest.startFadeOut()

  const b = new Blob()
  if (x !== undefined) {
    b.x = x
    b.y = y
  }
  blobs.push(b)
  playChime()
}

// ── Drag gesture for pitch control ──

const DRAG_THRESHOLD = 10
const TRAIL_SPACING = 30 // min px between trail blobs
const dragState = { active: false, isDrag: false, startX: 0, startY: 0, currentX: 0, currentY: 0, blob: null, pointerId: null, lastTrailX: 0, lastTrailY: 0 }

function isUIControl(target) {
  const fsBtn = document.getElementById('fs-btn')
  const muteBtn = document.getElementById('mute-btn')
  return (fsBtn && fsBtn.contains(target)) || (muteBtn && muteBtn.contains(target)) ||
    document.getElementById('settings-btn')?.contains(target) ||
    document.getElementById('settings-panel')?.contains(target)
}

function mapYDeltaToNoteIndex(dy) {
  // Negative dy = dragged up = higher note
  const range = Math.min(_state.H * 0.5, 300)
  const clamped = Math.max(-range, Math.min(range, dy))
  // Map from [-range, range] to [chimePresets.length-1, 0] (up = high index)
  const normalized = (-clamped + range) / (2 * range) // 0..1, 1 = up
  return Math.round(normalized * (chimePresets.length - 1))
}

function mapXDistanceToOctave(dx) {
  const range = Math.min(_state.W * 0.4, 300)
  const clamped = Math.max(-range, Math.min(range, dx))
  return clamped / range // -1..+1
}

function spawnTrailBlob(x, y) {
  const b = new Blob()
  b.x = x
  b.y = y
  b.r = Math.min(_state.W, _state.H) * (0.03 + Math.random() * 0.02)
  b.fadeIn = true
  b.alpha = 0
  b.maxAlpha = 0.7 + Math.random() * 0.2
  b.fadeSpeed = 0.006 + Math.random() * 0.003 // fade quicker than normal blobs
  b.vx = (Math.random() - 0.5) * 0.15 // slower drift
  b.vy = (Math.random() - 0.5) * 0.15
  blobs.push(b)
  return b
}

function finishGesture(x, y) {
  if (!dragState.isDrag) {
    // Tap — unchanged behavior
    spawnBlob(x, y)
    // Remove the drag blob if one was created
    if (dragState.blob) {
      dragState.blob.dead = true
    }
  } else {
    // Drag — compute note + octave from deltas
    const dy = dragState.currentY - dragState.startY
    const dx = dragState.currentX - dragState.startX
    const noteIndex = mapYDeltaToNoteIndex(dy)
    const octave = mapXDistanceToOctave(dx)

    const now = performance.now()
    if (now - lastSpawn < DEBOUNCE_MS) {
      dragState.blob = null
      dragState.active = false
      return
    }
    lastSpawn = now

    if (_state.hintVisible) {
      _state.hint.classList.add('hidden')
      _state.hintVisible = false
    }

    // Crowd-thinning (same logic as spawnBlob)
    let liveCount = 0
    let oldest = null
    for (let i = 0; i < blobs.length; i++) {
      if (!blobs[i].dead && !blobs[i].fadeIn) {
        liveCount++
        if (!oldest) oldest = blobs[i]
      }
    }
    if (liveCount > 6 && oldest) oldest.startFadeOut()

    playChime(noteIndex, octave)
  }
  dragState.blob = null
  dragState.active = false
}

function startGesture(x, y, id, target) {
  if (isUIControl(target)) return
  dragState.active = true
  dragState.isDrag = false
  dragState.startX = x
  dragState.startY = y
  dragState.currentX = x
  dragState.currentY = y
  dragState.pointerId = id
  dragState.lastTrailX = x
  dragState.lastTrailY = y
  dragState.blob = spawnTrailBlob(x, y)
}

function moveGesture(x, y) {
  if (!dragState.active) return
  dragState.currentX = x
  dragState.currentY = y
  const dx = x - dragState.startX
  const dy = y - dragState.startY
  if (!dragState.isDrag && Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
    dragState.isDrag = true
  }
  if (dragState.isDrag) {
    const tdx = x - dragState.lastTrailX
    const tdy = y - dragState.lastTrailY
    if (tdx * tdx + tdy * tdy >= TRAIL_SPACING * TRAIL_SPACING) {
      spawnTrailBlob(x, y)
      dragState.lastTrailX = x
      dragState.lastTrailY = y
    }
  }
}

function endGesture() {
  if (!dragState.active) return
  finishGesture(dragState.startX, dragState.startY)
}

// ── Wire everything up ──

export function initInput(state) {
  _state = state

  // Mute toggle
  const muteBtn = document.getElementById('mute-btn')
  const muteIcon = document.getElementById('mute-icon')
  const soundOn = muteIcon.querySelectorAll('.sound-on')
  const soundOff = muteIcon.querySelectorAll('.sound-off')
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    const nowMuted = toggleMute()
    soundOn.forEach((el) => (el.style.display = nowMuted ? 'none' : ''))
    soundOff.forEach((el) => (el.style.display = nowMuted ? '' : 'none'))
  })

  // Fullscreen toggle — hide on platforms without support (iOS Safari)
  const fsBtn = document.getElementById('fs-btn')
  if (!document.fullscreenEnabled) {
    fsBtn.style.display = 'none'
  } else {
    fsBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
      } else {
        document.exitFullscreen()
      }
    })
    document.addEventListener('fullscreenchange', () => {
      fsBtn.classList.toggle('hidden', !!document.fullscreenElement)
    })
  }

  // Keyboard
  document.addEventListener('keydown', (e) => {
    e.preventDefault()
    spawnBlob()
  })

  // Mouse events
  document.addEventListener('mousedown', (e) => {
    startGesture(e.clientX, e.clientY, 'mouse', e.target)
  })
  document.addEventListener('mousemove', (e) => {
    if (dragState.pointerId !== 'mouse' || !dragState.active) return
    moveGesture(e.clientX, e.clientY)
  })
  document.addEventListener('mouseup', (e) => {
    if (dragState.pointerId !== 'mouse') return
    endGesture()
  })

  // Touch events
  document.addEventListener('touchstart', (e) => {
    if (isUIControl(e.target)) return
    e.preventDefault()
    const t = e.changedTouches[0]
    startGesture(t.clientX, t.clientY, t.identifier, e.target)
  }, { passive: false })
  document.addEventListener('touchmove', (e) => {
    if (!dragState.active) return
    const t = Array.from(e.changedTouches).find(t => t.identifier === dragState.pointerId)
    if (!t) return
    e.preventDefault()
    moveGesture(t.clientX, t.clientY)
  }, { passive: false })
  document.addEventListener('touchend', (e) => {
    const t = Array.from(e.changedTouches).find(t => t.identifier === dragState.pointerId)
    if (!t) return
    e.preventDefault()
    endGesture()
  }, { passive: false })
  document.addEventListener('touchcancel', (e) => {
    if (dragState.active) {
      if (dragState.blob) dragState.blob.dead = true
      dragState.blob = null
      dragState.active = false
    }
  })
}
