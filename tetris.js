// ── Constants ──────────────────────────────────────────────
const COLS = 10, ROWS = 20, CELL = 30, NEXT_CELL = 25;
const DROP_INTERVAL = 1000;

const COLORS = [
  null,
  '#00e5ff', // 1 I — cyan
  '#ffee00', // 2 O — yellow
  '#aa00ff', // 3 T — purple
  '#00c853', // 4 S — green
  '#ff1744', // 5 Z — red
  '#2979ff', // 6 J — blue
  '#ff6d00', // 7 L — orange
];

const PIECES = [
  null,
  [[1, 1, 1, 1]],           // I
  [[2, 2], [2, 2]],         // O
  [[0, 3, 0], [3, 3, 3]],   // T
  [[0, 4, 4], [4, 4, 0]],   // S
  [[5, 5, 0], [0, 5, 5]],   // Z
  [[6, 0, 0], [6, 6, 6]],   // J
  [[0, 0, 7], [7, 7, 7]],   // L
];

const SCORE_TABLE = [0, 100, 300, 500, 800];

// ── Audio (Web Audio API — Tetris Theme A / Korobeiniki) ───
const NOTE_FREQ = {
  A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25,
  F5: 698.46, G5: 783.99, A5: 880.00,
};

const BPM = 150;
const BEAT = 60 / BPM; // quarter-note duration in seconds

// [note, beats]  1=quarter  0.5=eighth  1.5=dotted-quarter  2=half
const MELODY = [
  // Phrase 1
  ['E5', 1], ['B4', .5], ['C5', .5], ['D5', 1], ['C5', .5], ['B4', .5],
  ['A4', 1], ['A4', .5], ['C5', .5], ['E5', 1], ['D5', .5], ['C5', .5],
  ['B4', 1.5], ['C5', .5], ['D5', 1], ['E5', 1],
  ['C5', 1], ['A4', 1], ['A4', 2],
  // Phrase 2
  ['D5', 1.5], ['F5', .5], ['A5', 1], ['G5', .5], ['F5', .5],
  ['E5', 1.5], ['C5', .5], ['E5', 1], ['D5', .5], ['C5', .5],
  ['B4', 1], ['B4', .5], ['C5', .5], ['D5', 1], ['E5', 1],
  ['C5', 1], ['A4', 1], ['A4', 2],
];

const TOTAL_DURATION = MELODY.reduce((s, [, b]) => s + b, 0) * BEAT;

let audioCtx = null, masterGain = null, loopFilter = null;
let bgmMuted = false, bgmTimer = null, nextLoopAt = 0;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.28;
  loopFilter = audioCtx.createBiquadFilter();
  loopFilter.type = 'lowpass';
  loopFilter.frequency.value = 1800; // soften harsh square-wave harmonics
  masterGain.connect(loopFilter);
  loopFilter.connect(audioCtx.destination);
  scheduleBgmLoop();
}

function playNote(freq, startTime, duration) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.22, startTime);
  gain.gain.setValueAtTime(0.001, startTime + duration * 0.82);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function scheduleBgmLoop() {
  if (bgmMuted || !audioCtx) return;
  // align next loop start so there is no gap/overlap
  const start = Math.max(audioCtx.currentTime + 0.05, nextLoopAt);
  nextLoopAt = start + TOTAL_DURATION;
  let t = start;
  MELODY.forEach(([note, beats]) => {
    const dur = beats * BEAT;
    if (NOTE_FREQ[note]) playNote(NOTE_FREQ[note], t, dur);
    t += dur;
  });
  // re-schedule ~0.1 s before this loop ends for seamless looping
  bgmTimer = setTimeout(scheduleBgmLoop, (nextLoopAt - audioCtx.currentTime - 0.1) * 1000);
}

function toggleMute() {
  bgmMuted = !bgmMuted;
  muteBtn.textContent = bgmMuted ? '🔇' : '🔊';
  if (bgmMuted) {
    if (bgmTimer) clearTimeout(bgmTimer);
    if (masterGain) masterGain.gain.value = 0;
  } else {
    if (masterGain) {
      masterGain.gain.value = 0.28;
      nextLoopAt = 0; // restart from top of melody
      scheduleBgmLoop();
    }
  }
}

// ── DOM ────────────────────────────────────────────────────
const canvas   = document.getElementById('board');
const ctx      = canvas.getContext('2d');
const nextCvs  = document.getElementById('next-canvas');
const nCtx     = nextCvs.getContext('2d');
const scoreEl  = document.getElementById('score-val');
const startBtn = document.getElementById('start-btn');
const muteBtn  = document.getElementById('mute-btn');

// ── State ──────────────────────────────────────────────────
let board, piece, nextPiece, score;
let running = false, animId = null;
let dropCounter = 0, lastTime = 0;

// ── Board ──────────────────────────────────────────────────
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// ── Piece ──────────────────────────────────────────────────
function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const matrix = PIECES[type].map(r => [...r]);
  return {
    matrix,
    pos: { x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2), y: 0 },
  };
}

function rotate(matrix) {
  const R = matrix.length, C = matrix[0].length;
  const result = Array.from({ length: C }, () => Array(R).fill(0));
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      result[c][R - 1 - r] = matrix[r][c];
  return result;
}

// ── Collision ──────────────────────────────────────────────
function collides(p) {
  for (let r = 0; r < p.matrix.length; r++)
    for (let c = 0; c < p.matrix[r].length; c++)
      if (p.matrix[r][c]) {
        const nr = p.pos.y + r, nc = p.pos.x + c;
        if (nr >= ROWS || nc < 0 || nc >= COLS) return true;
        if (nr >= 0 && board[nr][nc]) return true;
      }
  return false;
}

// ── Actions ────────────────────────────────────────────────
function merge() {
  piece.matrix.forEach((row, r) =>
    row.forEach((val, c) => {
      if (val) board[piece.pos.y + r][piece.pos.x + c] = val;
    })
  );
}

function clearLines() {
  let count = 0;
  for (let r = ROWS - 1; r >= 0;) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(0));
      count++;
    } else {
      r--;
    }
  }
  return count;
}

function spawnPiece() {
  piece = nextPiece;
  nextPiece = randomPiece();
  if (collides(piece)) {
    running = false;
    drawBoard();
    drawOverlay();
    startBtn.textContent = 'RESTART';
  }
}

function drop() {
  piece.pos.y++;
  if (collides(piece)) {
    piece.pos.y--;
    merge();
    const lines = clearLines();
    score += SCORE_TABLE[Math.min(lines, 4)];
    scoreEl.textContent = score;
    spawnPiece();
  }
  dropCounter = 0;
}

function moveLeft()  { piece.pos.x--; if (collides(piece)) piece.pos.x++; }
function moveRight() { piece.pos.x++; if (collides(piece)) piece.pos.x--; }

function hardDrop() {
  while (true) {
    piece.pos.y++;
    if (collides(piece)) { piece.pos.y--; break; }
  }
  merge();
  const lines = clearLines();
  score += SCORE_TABLE[Math.min(lines, 4)];
  scoreEl.textContent = score;
  dropCounter = 0;
  spawnPiece();
}

function rotatePiece() {
  const orig = piece.matrix;
  piece.matrix = rotate(piece.matrix);
  if (!collides(piece)) return;
  for (const offset of [-1, 1, -2, 2]) {
    piece.pos.x += offset;
    if (!collides(piece)) return;
    piece.pos.x -= offset;
  }
  piece.matrix = orig;
}

// ── Draw ───────────────────────────────────────────────────
function drawCell(c, x, y, color, size) {
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  c.fillStyle = color;
  c.fillRect(px, py, s, s);
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(px, py, s, 4);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(px, py + s - 4, s, 4);
}

function drawBoard() {
  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#111122';
  ctx.lineWidth = 1;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);

  board.forEach((row, r) =>
    row.forEach((val, c) => {
      if (val) drawCell(ctx, c, r, COLORS[val], CELL);
    })
  );

  if (piece) {
    piece.matrix.forEach((row, r) =>
      row.forEach((val, c) => {
        if (val) drawCell(ctx, piece.pos.x + c, piece.pos.y + r, COLORS[val], CELL);
      })
    );
  }
}

function drawNext() {
  nCtx.fillStyle = '#080810';
  nCtx.fillRect(0, 0, nextCvs.width, nextCvs.height);
  if (!nextPiece) return;
  const m = nextPiece.matrix;
  const ox = Math.floor((4 - m[0].length) / 2);
  const oy = Math.floor((4 - m.length) / 2);
  m.forEach((row, r) =>
    row.forEach((val, c) => {
      if (val) drawCell(nCtx, ox + c, oy + r, COLORS[val], NEXT_CELL);
    })
  );
}

function drawOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px Segoe UI';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 18);
  ctx.font = '15px Segoe UI';
  ctx.fillStyle = '#aaa';
  ctx.fillText('Score: ' + score, canvas.width / 2, canvas.height / 2 + 16);
}

function drawWelcome() {
  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#111122';
  ctx.lineWidth = 1;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7c3aed';
  ctx.font = 'bold 36px Segoe UI';
  ctx.fillText('TETRIS', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '14px Segoe UI';
  ctx.fillStyle = '#555';
  ctx.fillText('START 버튼을 누르세요', canvas.width / 2, canvas.height / 2 + 18);
}

// ── Game Loop ──────────────────────────────────────────────
function gameLoop(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter >= DROP_INTERVAL) drop();
  if (running) {
    drawBoard();
    drawNext();
    animId = requestAnimationFrame(gameLoop);
  }
}

// ── Start ──────────────────────────────────────────────────
function startGame() {
  if (animId) cancelAnimationFrame(animId);
  initAudio(); // requires user gesture — safe to call here
  board = createBoard();
  score = 0;
  scoreEl.textContent = '0';
  running = true;
  dropCounter = 0;
  lastTime = 0;
  piece = randomPiece();
  nextPiece = randomPiece();
  startBtn.textContent = 'RESTART';
  animId = requestAnimationFrame(gameLoop);
}

// ── Input ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!running) return;
  switch (e.key) {
    case 'ArrowLeft':  moveLeft();    break;
    case 'ArrowRight': moveRight();   break;
    case 'ArrowDown':  drop();        break;
    case 'ArrowUp':    rotatePiece(); break;
    case ' ':          hardDrop();    break;
    default: return;
  }
  e.preventDefault();
});

startBtn.addEventListener('click', startGame);
muteBtn.addEventListener('click', toggleMute);

// ── Init ───────────────────────────────────────────────────
board = createBoard();
drawWelcome();
nCtx.fillStyle = '#080810';
nCtx.fillRect(0, 0, nextCvs.width, nextCvs.height);
