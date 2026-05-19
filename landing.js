// Falling tetromino-block background animation
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

const BLOCK_SIZE = 18;
const BLOCK_COLORS = [
  '#00e5ff', '#ffee00', '#aa00ff',
  '#00c853', '#ff1744', '#2979ff', '#ff6d00',
];

// Simple single-cell blocks falling at varying speeds/opacities
const blocks = [];
const BLOCK_COUNT = 40;

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function makeBlock(randomY = false) {
  return {
    x:       Math.random() * canvas.width,
    y:       randomY ? Math.random() * canvas.height : -BLOCK_SIZE * 2,
    size:    BLOCK_SIZE * (0.6 + Math.random() * 0.8),
    speed:   0.4 + Math.random() * 1.2,
    alpha:   0.04 + Math.random() * 0.09,
    color:   BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)],
    angle:   Math.random() * Math.PI * 2,
    spin:    (Math.random() - 0.5) * 0.015,
  };
}

function init() {
  resize();
  for (let i = 0; i < BLOCK_COUNT; i++) {
    blocks.push(makeBlock(true)); // scatter initial blocks vertically
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    b.y     += b.speed;
    b.angle += b.spin;

    if (b.y > canvas.height + BLOCK_SIZE * 2) {
      blocks[i] = makeBlock(false);
      continue;
    }

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.globalAlpha = b.alpha;
    ctx.fillStyle = b.color;
    const half = b.size / 2;
    ctx.fillRect(-half, -half, b.size, b.size);
    // subtle inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-half, -half, b.size, b.size * 0.2);
    ctx.restore();
  }

  requestAnimationFrame(draw);
}

window.addEventListener('resize', resize);
init();
draw();

// ── Landing Ranking ────────────────────────────────────────
(function () {
  const listEl   = document.getElementById('lnd-ranking-list');
  const refreshBtn = document.getElementById('lnd-refresh-btn');
  const MEDALS   = ['🥇', '🥈', '🥉'];

  async function loadRankings() {
    listEl.innerHTML = '<p class="ranking-status">불러오는 중…</p>';
    refreshBtn.classList.add('spinning');
    try {
      const tops = await TetrisAPI.getTopScores(10);
      if (!tops.length) {
        listEl.innerHTML = '<p class="ranking-status">아직 기록이 없습니다</p>';
        return;
      }
      listEl.innerHTML = tops.map((entry, i) => {
        const rank    = i + 1;
        const medal   = MEDALS[i] || rank;
        const cls     = i < 3 ? ` medal-${rank}` : '';
        const email   = entry.email.length > 24
          ? entry.email.slice(0, 22) + '…' : entry.email;
        return `<div class="rank-row${cls}">
          <span class="rank-num">${medal}</span>
          <span class="rank-email">${email}</span>
          <span class="rank-score">${entry.score.toLocaleString()}</span>
        </div>`;
      }).join('');
    } catch {
      listEl.innerHTML = '<p class="ranking-status">서버에 연결할 수 없습니다</p>';
    } finally {
      refreshBtn.classList.remove('spinning');
    }
  }

  refreshBtn.addEventListener('click', loadRankings);
  loadRankings();
})();

// ── Landing Auth ───────────────────────────────────────────
(function () {
  const loggedInEl  = document.getElementById('lnd-logged-in');
  const formWrap    = document.getElementById('lnd-form-wrap');
  const emailInput  = document.getElementById('lnd-email-input');
  const passInput   = document.getElementById('lnd-password-input');
  const errorEl     = document.getElementById('lnd-error');
  const submitBtn   = document.getElementById('lnd-submit-btn');
  const toggleBtn   = document.getElementById('lnd-toggle-btn');
  const titleEl     = document.getElementById('lnd-form-title');
  const emailDisplay= document.getElementById('lnd-email');
  const logoutBtn   = document.getElementById('lnd-logout-btn');

  let mode = 'login'; // 'login' | 'register'

  function setMode(m) {
    mode = m;
    titleEl.textContent   = m === 'login' ? '로그인' : '회원가입';
    submitBtn.textContent = m === 'login' ? '로그인' : '가입하기';
    toggleBtn.textContent = m === 'login' ? '회원가입하기 →' : '← 로그인으로';
    errorEl.textContent   = '';
  }

  function updateUI() {
    const loggedIn = TetrisAPI.isLoggedIn();
    loggedInEl.hidden = !loggedIn;
    formWrap.hidden   = loggedIn;
    if (loggedIn) emailDisplay.textContent = TetrisAPI.getUser().email;
  }

  async function handleSubmit() {
    const email    = emailInput.value.trim();
    const password = passInput.value;
    errorEl.textContent = '';
    submitBtn.disabled = true;
    try {
      if (mode === 'register') {
        await TetrisAPI.register(email, password);
        await TetrisAPI.login(email, password);
      } else {
        await TetrisAPI.login(email, password);
      }
      updateUI();
    } catch (e) {
      errorEl.textContent = e.message;
    } finally {
      submitBtn.disabled = false;
    }
  }

  toggleBtn.addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
  submitBtn.addEventListener('click', handleSubmit);
  logoutBtn.addEventListener('click', () => { TetrisAPI.logout(); updateUI(); });
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') passInput.focus(); });
  passInput.addEventListener('keydown',  e => { if (e.key === 'Enter') handleSubmit(); });

  updateUI();
})();
