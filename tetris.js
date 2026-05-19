// ── Constants ──────────────────────────────────────────────
const COLS = 10, ROWS = 20, CELL = 30, NEXT_CELL = 25;
const DROP_INTERVAL      = 1000;
const SOFT_DROP_INTERVAL = 50;
const DAS_DELAY          = 150;
const ARR                = 50;

const COLORS = [
  null,
  '#00e5ff', '#ffee00', '#aa00ff', '#00c853',
  '#ff1744', '#2979ff', '#ff6d00',
];

const PIECES = [
  null,
  [[1, 1, 1, 1]],
  [[2, 2], [2, 2]],
  [[0, 3, 0], [3, 3, 3]],
  [[0, 4, 4], [4, 4, 0]],
  [[5, 5, 0], [0, 5, 5]],
  [[6, 0, 0], [6, 6, 6]],
  [[0, 0, 7], [7, 7, 7]],
];

const SCORE_TABLE = [0, 100, 300, 500, 800];
const SPIN_SCORE  = {
  'T-SPIN': [400, 800, 1200, 1600],
  'J-SPIN': [0, 300, 600, 900],
  'L-SPIN': [0, 300, 600, 900],
};

// ── SRS Wall-Kick Tables (screen coords: x→right, y→down) ──
// Source: Tetris guideline — JLSTZ kicks, y values negated from wiki (wiki uses y↑)
const SRS_KICKS_JLSTZ = {
  '01': [[-1,0],[-1,-1],[0,2],[-1,2]],   // N→E
  '10': [[1,0],[1,1],[0,-2],[1,-2]],      // E→N
  '12': [[1,0],[1,1],[0,-2],[1,-2]],      // E→S
  '21': [[-1,0],[-1,-1],[0,2],[-1,2]],   // S→E
  '23': [[1,0],[1,-1],[0,2],[1,2]],       // S→W
  '32': [[-1,0],[-1,1],[0,-2],[-1,-2]],  // W→S
  '30': [[-1,0],[-1,1],[0,-2],[-1,-2]],  // W→N
  '03': [[1,0],[1,-1],[0,2],[1,2]],       // N→W
};
const SRS_KICKS_I = {
  '01': [[-2,0],[1,0],[-2,1],[1,-2]],    // N→E
  '10': [[2,0],[-1,0],[2,-1],[-1,2]],    // E→N
  '12': [[-1,0],[2,0],[-1,-2],[2,1]],    // E→S
  '21': [[1,0],[-2,0],[1,2],[-2,-1]],    // S→E
  '23': [[2,0],[-1,0],[2,-1],[-1,2]],    // S→W
  '32': [[-2,0],[1,0],[-2,1],[1,-2]],    // W→S
  '30': [[1,0],[-2,0],[1,2],[-2,-1]],    // W→N
  '03': [[-1,0],[2,0],[-1,-2],[2,1]],    // N→W
};

// ── Audio ──────────────────────────────────────────────────
const NOTE_FREQ = {
  A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25,
  F5: 698.46, G5: 783.99, A5: 880.00,
};
const BPM = 150, BEAT = 60 / BPM;
const MELODY = [
  ['E5',1],['B4',.5],['C5',.5],['D5',1],['C5',.5],['B4',.5],
  ['A4',1],['A4',.5],['C5',.5],['E5',1],['D5',.5],['C5',.5],
  ['B4',1.5],['C5',.5],['D5',1],['E5',1],
  ['C5',1],['A4',1],['A4',2],
  ['D5',1.5],['F5',.5],['A5',1],['G5',.5],['F5',.5],
  ['E5',1.5],['C5',.5],['E5',1],['D5',.5],['C5',.5],
  ['B4',1],['B4',.5],['C5',.5],['D5',1],['E5',1],
  ['C5',1],['A4',1],['A4',2],
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
  loopFilter.frequency.value = 1800;
  masterGain.connect(loopFilter);
  loopFilter.connect(audioCtx.destination);
  scheduleBgmLoop();
}

function playNote(freq, t, dur) {
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.22, t);
  g.gain.setValueAtTime(0.001, t + dur * 0.82);
  osc.connect(g); g.connect(masterGain);
  osc.start(t); osc.stop(t + dur);
}

function scheduleBgmLoop() {
  if (bgmMuted || !audioCtx) return;
  const start = Math.max(audioCtx.currentTime + 0.05, nextLoopAt);
  nextLoopAt = start + TOTAL_DURATION;
  let t = start;
  MELODY.forEach(([note, beats]) => {
    const dur = beats * BEAT;
    if (NOTE_FREQ[note]) playNote(NOTE_FREQ[note], t, dur);
    t += dur;
  });
  bgmTimer = setTimeout(scheduleBgmLoop, (nextLoopAt - audioCtx.currentTime - 0.1) * 1000);
}

function toggleMute() {
  bgmMuted = !bgmMuted;
  muteBtn.textContent = bgmMuted ? '🔇' : '🔊';
  if (bgmMuted) {
    clearTimeout(bgmTimer);
    if (masterGain) masterGain.gain.value = 0;
  } else {
    if (masterGain) { masterGain.gain.value = 0.28; nextLoopAt = 0; scheduleBgmLoop(); }
  }
}

// ── DOM ────────────────────────────────────────────────────
const canvas          = document.getElementById('board');
const ctx             = canvas.getContext('2d');
const nextCvs         = document.getElementById('next-canvas');
const nCtx            = nextCvs.getContext('2d');
const holdCvs         = document.getElementById('hold-canvas');
const hCtx            = holdCvs.getContext('2d');
const scoreEl         = document.getElementById('score-val');
const startBtn        = document.getElementById('start-btn');
const muteBtn         = document.getElementById('mute-btn');
const globalBestEl    = document.getElementById('global-best');
const globalBestUser  = document.getElementById('global-best-user');
const authLoggedOut   = document.getElementById('auth-logged-out');
const authLoggedIn    = document.getElementById('auth-logged-in');
const userEmailEl     = document.getElementById('user-email-display');
const loginOpenBtn    = document.getElementById('login-open-btn');
const logoutBtn       = document.getElementById('logout-btn');
const authModal       = document.getElementById('auth-modal');
const modalTitle      = document.getElementById('modal-title');
const authEmailInput  = document.getElementById('auth-email');
const authPassInput   = document.getElementById('auth-password');
const authError       = document.getElementById('auth-error');
const authSubmitBtn   = document.getElementById('auth-submit');
const authToggleBtn   = document.getElementById('auth-toggle');
const authSkipBtn     = document.getElementById('auth-skip-btn');
const modalCloseBtn   = document.getElementById('modal-close');

// ── Game State ─────────────────────────────────────────────
let board, piece, nextPiece, score;
let running = false, animId = null;
let dropCounter = 0, lastTime = 0;
let lastActionWasRotation = false;
let spinLabel = '', spinLabelTimer = 0;
let hasPlayedBefore = false;
// Hold
let holdPiece = null, holdUsed = false;
// Soft drop
let softDropping = false;
// DAS
let dasDir = 0, dasTimer = null, dasInterval = null;

// ── Board ──────────────────────────────────────────────────
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// ── Piece ──────────────────────────────────────────────────
function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const matrix = PIECES[type].map(r => [...r]);
  return {
    type,
    rot: 0,
    matrix,
    pos: { x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2), y: 0 },
  };
}

function rotate(matrix) {
  const R = matrix.length, C = matrix[0].length;
  const res = Array.from({ length: C }, () => Array(R).fill(0));
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      res[c][R - 1 - r] = matrix[r][c];
  return res;
}

function rotateCCW(matrix) {
  const R = matrix.length, C = matrix[0].length;
  const res = Array.from({ length: C }, () => Array(R).fill(0));
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      res[C - 1 - c][r] = matrix[r][c];
  return res;
}

// ── Collision ──────────────────────────────────────────────
function isOccupied(c, r) {
  return c < 0 || c >= COLS || r < 0 || r >= ROWS || (r >= 0 && board[r][c]);
}

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

// ── Ghost ──────────────────────────────────────────────────
function getGhostY() {
  let gy = piece.pos.y;
  while (!collides({ matrix: piece.matrix, pos: { x: piece.pos.x, y: gy + 1 } })) gy++;
  return gy;
}

function drawGhost() {
  const gy = getGhostY();
  if (gy === piece.pos.y) return;
  const color = COLORS[piece.type];
  piece.matrix.forEach((row, r) =>
    row.forEach((val, c) => {
      if (!val) return;
      const px = (piece.pos.x + c) * CELL, py = (gy + r) * CELL;
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = color;
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
      ctx.globalAlpha = 1;
    })
  );
}

// ── Spin detection ─────────────────────────────────────────
function checkSpin() {
  if (!lastActionWasRotation) return null;
  const { type, pos } = piece;
  if (type !== 3 && type !== 6 && type !== 7) return null;
  // T/L/J 피스는 어떤 회전 상태에서도 3×3 개념 박스에 들어간다.
  // 매트릭스 크기(2×3 or 3×2)와 무관하게 고정 오프셋으로 코너 체크.
  const occupied = [[0,0],[2,0],[0,2],[2,2]]
    .filter(([dc, dr]) => isOccupied(pos.x + dc, pos.y + dr)).length;
  if (occupied < 3) return null;
  return type === 3 ? 'T-SPIN' : type === 6 ? 'J-SPIN' : 'L-SPIN';
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
    if (board[r].every(v => v !== 0)) { board.splice(r, 1); board.unshift(Array(COLS).fill(0)); count++; }
    else r--;
  }
  return count;
}

function lockAndScore() {
  const spin = checkSpin();
  merge();
  const lines = clearLines();
  if (spin && SPIN_SCORE[spin]) {
    score += SPIN_SCORE[spin][Math.min(lines, 3)];
    spinLabel = spin + (lines ? ` ×${lines}` : '');
    spinLabelTimer = 90;
  } else {
    score += SCORE_TABLE[Math.min(lines, 4)];
    if (lines >= 4) { spinLabel = 'TETRIS!'; spinLabelTimer = 90; }
    else spinLabel = '';
  }
  scoreEl.textContent = score;
  lastActionWasRotation = false;
}

function applyRotation(newMatrix, newRot) {
  const origMatrix = piece.matrix, origRot = piece.rot;
  piece.matrix = newMatrix;
  piece.rot    = newRot;
  // Test 1: no kick
  if (!collides(piece)) { lastActionWasRotation = true; return; }
  // Tests 2-5: SRS kick offsets
  const kickTable = piece.type === 1 ? SRS_KICKS_I : SRS_KICKS_JLSTZ;
  const kicks = kickTable[`${origRot}${newRot}`] || [];
  for (const [dx, dy] of kicks) {
    piece.pos.x += dx;
    piece.pos.y += dy;
    if (!collides(piece)) { lastActionWasRotation = true; return; }
    piece.pos.x -= dx;
    piece.pos.y -= dy;
  }
  // All tests failed: revert
  piece.matrix = origMatrix;
  piece.rot    = origRot;
}

function moveLeft()       { piece.pos.x--; if (collides(piece)) piece.pos.x++; }
function moveRight()      { piece.pos.x++; if (collides(piece)) piece.pos.x--; }
function rotatePiece()    { applyRotation(rotate(piece.matrix),    (piece.rot + 1) % 4); }
function rotatePieceCCW() { applyRotation(rotateCCW(piece.matrix), (piece.rot + 3) % 4); }

function drop(manual = false) {
  if (manual) lastActionWasRotation = false;
  piece.pos.y++;
  if (collides(piece)) { piece.pos.y--; lockAndScore(); spawnPiece(); }
  dropCounter = 0;
}

function hardDrop() {
  lastActionWasRotation = false;
  while (!collides({ matrix: piece.matrix, pos: { x: piece.pos.x, y: piece.pos.y + 1 } }))
    piece.pos.y++;
  lockAndScore();
  dropCounter = 0;
  spawnPiece();
}

function doHold() {
  if (holdUsed) return;
  holdUsed = true;
  lastActionWasRotation = false;
  const origMatrix = PIECES[piece.type].map(r => [...r]);
  if (holdPiece === null) {
    holdPiece = { type: piece.type, matrix: origMatrix };
    piece = nextPiece;
    nextPiece = randomPiece();
  } else {
    const prev = holdPiece;
    holdPiece = { type: piece.type, matrix: origMatrix };
    const m = PIECES[prev.type].map(r => [...r]);
    piece = {
      type: prev.type,
      rot: 0,
      matrix: m,
      pos: { x: Math.floor(COLS / 2) - Math.floor(m[0].length / 2), y: 0 },
    };
  }
  piece.pos = { x: Math.floor(COLS / 2) - Math.floor(piece.matrix[0].length / 2), y: 0 };
  piece.rot = 0;
  dropCounter = 0;
  drawHold();
}

function spawnPiece() {
  piece = nextPiece;
  nextPiece = randomPiece();
  holdUsed = false;
  if (collides(piece)) {
    running = false;
    startBtn.textContent = 'RESTART';
    handleGameOver();
  }
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
  ctx.strokeStyle = '#111122'; ctx.lineWidth = 1;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
  board.forEach((row, r) =>
    row.forEach((val, c) => { if (val) drawCell(ctx, c, r, COLORS[val], CELL); })
  );
  if (piece) {
    drawGhost();
    piece.matrix.forEach((row, r) =>
      row.forEach((val, c) => {
        if (val) drawCell(ctx, piece.pos.x + c, piece.pos.y + r, COLORS[val], CELL);
      })
    );
  }
  if (spinLabel && spinLabelTimer > 0) {
    ctx.globalAlpha = Math.min(1, spinLabelTimer / 30);
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Segoe UI';
    ctx.fillStyle = '#f0e040';
    ctx.fillText(spinLabel, canvas.width / 2, 40);
    ctx.globalAlpha = 1;
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
    row.forEach((val, c) => { if (val) drawCell(nCtx, ox + c, oy + r, COLORS[val], NEXT_CELL); })
  );
}

function drawHold() {
  hCtx.fillStyle = '#080810';
  hCtx.fillRect(0, 0, holdCvs.width, holdCvs.height);
  if (!holdPiece) return;
  const m = holdPiece.matrix;
  const ox = Math.floor((4 - m[0].length) / 2);
  const oy = Math.floor((4 - m.length) / 2);
  hCtx.globalAlpha = holdUsed ? 0.35 : 1.0;
  m.forEach((row, r) =>
    row.forEach((val, c) => { if (val) drawCell(hCtx, ox + c, oy + r, COLORS[val], NEXT_CELL); })
  );
  hCtx.globalAlpha = 1;
}

function drawOverlayBase(extra = []) {
  ctx.fillStyle = 'rgba(0,0,0,0.70)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px Segoe UI';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 50);
  ctx.font = '16px Segoe UI';
  ctx.fillStyle = '#aaa';
  ctx.fillText('Your Score: ' + score.toLocaleString(), canvas.width / 2, canvas.height / 2 - 18);
  extra.forEach(([text, color, y]) => {
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, y);
  });
}

function drawWelcome() {
  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#111122'; ctx.lineWidth = 1;
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

// ── Game Over & API ────────────────────────────────────────
async function handleGameOver() {
  drawBoard();
  drawOverlayBase(); // 즉시 기본 화면 표시

  let saved = false;
  if (TetrisAPI.isLoggedIn()) {
    try { await TetrisAPI.submitScore(score); saved = true; }
    catch (e) { console.warn('점수 저장 실패:', e.message); }
  }

  let topEntry = null;
  try {
    const tops = await TetrisAPI.getTopScores(1);
    topEntry = tops[0] || null;
    if (topEntry) updateTopScoreDisplay(topEntry);
  } catch {}

  // 결과 포함 오버레이 재렌더
  const extra = [];
  if (topEntry) {
    const email = topEntry.email.length > 18
      ? topEntry.email.slice(0, 16) + '…' : topEntry.email;
    extra.push([`Global Best: ${topEntry.score.toLocaleString()}`, '#00e5ff', canvas.height / 2 + 14]);
    extra.push([email, '#555', canvas.height / 2 + 34]);
  }
  if (saved)
    extra.push(['✓ 점수 저장 완료!', '#00c853', canvas.height / 2 + 58]);
  else if (!TetrisAPI.isLoggedIn())
    extra.push(['로그인하면 점수가 저장됩니다', '#666', canvas.height / 2 + 58]);

  drawBoard();
  drawOverlayBase(extra);
}

// ── API UI Helpers ─────────────────────────────────────────
function updateAuthUI() {
  const loggedIn = TetrisAPI.isLoggedIn();
  authLoggedOut.hidden = loggedIn;
  authLoggedIn.hidden  = !loggedIn;
  if (loggedIn) userEmailEl.textContent = TetrisAPI.getUser().email;
}

function updateTopScoreDisplay(entry) {
  if (!entry) return;
  globalBestEl.textContent = entry.score.toLocaleString();
  const email = entry.email.length > 16
    ? entry.email.slice(0, 14) + '…' : entry.email;
  globalBestUser.textContent = email;
}

async function refreshTopScore() {
  try {
    const tops = await TetrisAPI.getTopScores(1);
    if (tops[0]) updateTopScoreDisplay(tops[0]);
  } catch {}
}

// ── Auth Modal ─────────────────────────────────────────────
let modalMode = 'login'; // 'login' | 'register'
let modalShowSkip = false;

function openModal(mode = 'login', showSkip = false) {
  modalMode = mode;
  modalShowSkip = showSkip;
  modalTitle.textContent    = mode === 'login' ? '로그인' : '회원가입';
  authSubmitBtn.textContent = mode === 'login' ? '로그인' : '가입하기';
  authToggleBtn.textContent = mode === 'login' ? '회원가입하기 →' : '← 로그인으로';
  authSkipBtn.hidden        = !showSkip;
  authError.textContent     = '';
  authEmailInput.value = authPassInput.value = '';
  authModal.hidden = false;
  authEmailInput.focus();
}

function closeModal() { authModal.hidden = true; }

async function handleAuthSubmit() {
  const email    = authEmailInput.value.trim();
  const password = authPassInput.value;
  authError.textContent = '';
  authSubmitBtn.disabled = true;
  try {
    if (modalMode === 'register') {
      await TetrisAPI.register(email, password);
      await TetrisAPI.login(email, password); // 가입 후 자동 로그인
    } else {
      await TetrisAPI.login(email, password);
    }
    updateAuthUI();
    refreshTopScore();
    closeModal();
    if (modalShowSkip) actuallyStartGame(); // 로그인 후 게임 시작
  } catch (e) {
    authError.textContent = e.message;
  } finally {
    authSubmitBtn.disabled = false;
  }
}

loginOpenBtn.addEventListener('click', () => openModal('login', false));
logoutBtn.addEventListener('click', () => { TetrisAPI.logout(); updateAuthUI(); });
modalCloseBtn.addEventListener('click', () => {
  // 최초 시작 모달을 X로 닫으면 게임은 시작하지 않음
  closeModal();
});
authModal.addEventListener('click', e => { if (e.target === authModal) closeModal(); });
authSubmitBtn.addEventListener('click', handleAuthSubmit);
authSkipBtn.addEventListener('click', () => { closeModal(); actuallyStartGame(); });
authToggleBtn.addEventListener('click', () =>
  openModal(modalMode === 'login' ? 'register' : 'login', modalShowSkip)
);
authEmailInput.addEventListener('keydown', e => { if (e.key === 'Enter') authPassInput.focus(); });
authPassInput.addEventListener('keydown',  e => { if (e.key === 'Enter') handleAuthSubmit(); });

// ── Game Loop ──────────────────────────────────────────────
function gameLoop(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  const interval = softDropping ? SOFT_DROP_INTERVAL : DROP_INTERVAL;
  if (dropCounter >= interval) drop(softDropping);
  spinLabelTimer = Math.max(0, spinLabelTimer - 1);
  if (running) { drawBoard(); drawNext(); drawHold(); animId = requestAnimationFrame(gameLoop); }
}

// ── Start ──────────────────────────────────────────────────
function startGame() {
  // 최초 START이고 비로그인 상태: 로그인 팝업 먼저
  if (!hasPlayedBefore && !TetrisAPI.isLoggedIn()) {
    openModal('login', true);
    return;
  }
  actuallyStartGame();
}

function actuallyStartGame() {
  hasPlayedBefore = true;
  if (animId) cancelAnimationFrame(animId);
  stopDAS();
  initAudio();
  board = createBoard();
  score = 0;
  scoreEl.textContent = '0';
  running = true;
  dropCounter = lastTime = 0;
  lastActionWasRotation = false;
  spinLabel = ''; spinLabelTimer = 0;
  softDropping = false;
  holdPiece = null; holdUsed = false;
  piece = randomPiece();
  nextPiece = randomPiece();
  startBtn.textContent = 'RESTART';
  drawHold();
  animId = requestAnimationFrame(gameLoop);
}

// ── DAS ────────────────────────────────────────────────────
function startDAS(dir) {
  if (dasDir === dir) return;
  stopDAS();
  dasDir = dir;
  if (!running) return;
  if (dir < 0) moveLeft(); else moveRight();
  dasTimer = setTimeout(() => {
    dasInterval = setInterval(() => {
      if (!running) { stopDAS(); return; }
      if (dasDir < 0) moveLeft(); else moveRight();
    }, ARR);
  }, DAS_DELAY);
}

function stopDAS() {
  clearTimeout(dasTimer);
  clearInterval(dasInterval);
  dasTimer = dasInterval = null;
  dasDir = 0;
}

// ── Input ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (authModal && !authModal.hidden) return;
  if (e.key === 'Enter' && !running) { e.preventDefault(); startGame(); return; }
  if (!running) return;
  switch (e.key) {
    case 'ArrowLeft':   startDAS(-1);    break;
    case 'ArrowRight':  startDAS(1);     break;
    case 'ArrowDown':   softDropping = true; break;
    case 'ArrowUp':     if (!e.repeat) rotatePiece();    break;
    case 'z': case 'Z': if (!e.repeat) rotatePieceCCW(); break;
    case ' ':           if (!e.repeat) hardDrop();       break;
    case 'c': case 'C':
    case 'Shift':       if (!e.repeat) doHold();         break;
    default: return;
  }
  e.preventDefault();
});

document.addEventListener('keyup', e => {
  switch (e.key) {
    case 'ArrowLeft':  if (dasDir < 0) stopDAS(); break;
    case 'ArrowRight': if (dasDir > 0) stopDAS(); break;
    case 'ArrowDown':  softDropping = false;       break;
    case 'Shift':      /* Shift keyup - no action needed */ break;
  }
});

startBtn.addEventListener('click', startGame);
muteBtn.addEventListener('click', toggleMute);

// ── Init ───────────────────────────────────────────────────
board = createBoard();
drawWelcome();
nCtx.fillStyle = '#080810';
nCtx.fillRect(0, 0, nextCvs.width, nextCvs.height);
updateAuthUI();
refreshTopScore();
