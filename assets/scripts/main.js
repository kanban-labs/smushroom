// ── Entry point: canvas setup, render loop ──
import { initBlob, blobs } from './blob.js'
import { initInput } from './input.js'

const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')
const blobCanvas = document.getElementById('blobs')
const bCtx = blobCanvas.getContext('2d')
const hint = document.getElementById('hint')

// CSS blur on the blob canvas — works on iOS Safari unlike ctx.filter
const BLUR_PX = 30
blobCanvas.style.filter = `blur(${BLUR_PX}px)`

// Shared state object — mutated in place so all modules see updates
const state = { W: 0, H: 0, ctx, bCtx, hint, hintVisible: true }

function resize() {
  state.W = canvas.width = blobCanvas.width = window.innerWidth
  state.H = canvas.height = blobCanvas.height = window.innerHeight
}
resize()
window.addEventListener('resize', resize)

// Initialize modules
initBlob(state)
initInput(state)

// Render loop
function loop() {
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, state.W, state.H)
  bCtx.clearRect(0, 0, state.W, state.H)

  for (let i = blobs.length - 1; i >= 0; i--) {
    blobs[i].update()
    blobs[i].draw()
    if (blobs[i].dead) {
      blobs[i] = blobs[blobs.length - 1]
      blobs.pop()
    }
  }

  requestAnimationFrame(loop)
}
loop()
