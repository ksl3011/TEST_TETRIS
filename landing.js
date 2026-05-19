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
