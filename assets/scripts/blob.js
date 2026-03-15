// ── Blob rendering ──
let _state // { W, H, bCtx }

export function initBlob(state) {
  _state = state
}

// Palette sets — each keypress picks a random harmony
export const palettes = [
  ['#ff9de2', '#ffb347', '#ffe066'], // warm peach-pink-gold
  ['#a0e4ff', '#b8f0c8', '#e0d4ff'], // cool mint-sky-lavender
  ['#ff6eb0', '#ff9a3c', '#ffde59'], // vivid sunset
  ['#7de8e8', '#a8b4ff', '#f9a8d4'], // pastel sea
  ['#fff07c', '#90f5b0', '#87d4ff'], // lemon-lime-sky
  ['#ff8fab', '#ffb347', '#c5f2c7'], // rose-amber-sage
  ['#d4a5ff', '#a5d4ff', '#ffd4a5'], // soft triadic
  ['#ffe5ec', '#ffc8a2', '#d4f1f4'], // milky pastels
]

export const blobs = []

export class Blob {
  constructor() {
    const palette = palettes[Math.floor(Math.random() * palettes.length)]
    const c1 = palette[Math.floor(Math.random() * palette.length)]
    const c2 = palette[Math.floor(Math.random() * palette.length)]

    // spawn slightly off-centre for variety
    this.x = _state.W * (0.2 + Math.random() * 0.6)
    this.y = _state.H * (0.2 + Math.random() * 0.6)

    this.r = Math.min(_state.W, _state.H) * (0.08 + Math.random() * 0.15)
    this.c1 = c1
    this.c2 = c2

    // gentle drift
    this.vx = (Math.random() - 0.5) * 0.35
    this.vy = (Math.random() - 0.5) * 0.35

    // blob shape: 6-8 control point radii offsets
    this.pts = 7
    this.offsets = Array.from({ length: this.pts }, () => 0.7 + Math.random() * 0.6)
    this.offsetSpeeds = Array.from({ length: this.pts }, () => (Math.random() - 0.5) * 0.008)
    this.phase = Math.random() * Math.PI * 2
    this.phaseSpeed = 0.004 + Math.random() * 0.006

    // lifecycle
    this.alpha = 0
    this.fadeIn = true
    this.maxAlpha = 0.55 + Math.random() * 0.3
    this.fadeSpeed = 0.004 + Math.random() * 0.004
    this.dead = false

    // pre-allocated geometry arrays for draw()
    this._angles = new Float64Array(this.pts)
    this._radii = new Float64Array(this.pts)
    this._px = new Float64Array(this.pts)
    this._py = new Float64Array(this.pts)
  }

  update() {
    // wiggle shape
    this.phase += this.phaseSpeed
    for (let i = 0; i < this.pts; i++) {
      this.offsets[i] += this.offsetSpeeds[i]
      if (this.offsets[i] > 1.3 || this.offsets[i] < 0.5) this.offsetSpeeds[i] *= -1
    }

    // drift
    this.x += this.vx
    this.y += this.vy

    // soft bounce
    if (this.x < -this.r) this.x = _state.W + this.r
    if (this.x > _state.W + this.r) this.x = -this.r
    if (this.y < -this.r) this.y = _state.H + this.r
    if (this.y > _state.H + this.r) this.y = -this.r

    // fade
    if (this.fadeIn) {
      this.alpha += this.fadeSpeed
      if (this.alpha >= this.maxAlpha) {
        this.alpha = this.maxAlpha
        this.fadeIn = false
      }
    } else {
      this.alpha -= this.fadeSpeed * 0.5
      if (this.alpha <= 0) this.dead = true
    }
  }

  startFadeOut() {
    this.fadeIn = false
    this.fadeSpeed = 0.003 + Math.random() * 0.003
  }

  draw() {
    const bCtx = _state.bCtx
    const pts = this.pts
    const step = (Math.PI * 2) / pts
    const { _angles: angles, _radii: radii, _px: px, _py: py } = this
    for (let i = 0; i < pts; i++) {
      angles[i] = step * i + this.phase
      radii[i] = this.r * this.offsets[i]
      px[i] = this.x + Math.cos(angles[i]) * radii[i]
      py[i] = this.y + Math.sin(angles[i]) * radii[i]
    }

    bCtx.save()
    bCtx.globalAlpha = Math.max(0, this.alpha)
    bCtx.beginPath()
    bCtx.moveTo((px[pts - 1] + px[0]) / 2, (py[pts - 1] + py[0]) / 2)
    for (let i = 0; i < pts; i++) {
      const next = (i + 1) % pts
      const mx = (px[i] + px[next]) / 2
      const my = (py[i] + py[next]) / 2
      bCtx.quadraticCurveTo(px[i], py[i], mx, my)
    }
    bCtx.closePath()

    const grad = bCtx.createRadialGradient(this.x - this.r * 0.2, this.y - this.r * 0.2, this.r * 0.05, this.x, this.y, this.r * 1.2)
    grad.addColorStop(0, this.c1 + 'ff')
    grad.addColorStop(1, this.c2 + '00')
    bCtx.fillStyle = grad
    bCtx.fill()
    bCtx.restore()
  }
}
