'use strict';
const filters = document.querySelector('.filters');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const projects = [...document.querySelectorAll('.project')];
filters.hidden = false;
for (const button of filterButtons) {
  button.addEventListener('click', () => {
    let count = 0;
    for (const project of projects) {
      project.hidden = button.dataset.filter !== 'todos' && !project.dataset.categories.split(' ').includes(button.dataset.filter);
      if (!project.hidden) count++;
    }
    for (const other of filterButtons) other.setAttribute('aria-pressed', String(other === button));
    document.getElementById('filter-status').textContent = `${count} ${count === 1 ? 'projeto exibido' : 'projetos exibidos'}.`;
  });
}
// Dependency-free spiral galaxy, contained in the hero with no scroll interception.
(() => {
  const canvas = document.getElementById('galaxy');
  const toggle = document.getElementById('motion-toggle');
  const wrap = document.querySelector('.galaxy-art');
  const ctx = canvas.getContext('2d');
  if (!ctx) { toggle.hidden = true; return; }
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = preference.matches;
  let visible = false, frame = 0, last = 0, rotation = 0, width = 1, height = 1, pointerX = 0, pointerY = 0;
  let seed = 93121;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const stars = Array.from({ length: 4200 }, (_, i) => {
    const radius = Math.pow(random(), .72);
    const angle = (i % 4) * Math.PI / 2 + radius * 5.2 + (random() - .5) * (.24 + radius * .45);
    return { radius, angle, scatter: (random() - .5) * .055, size: .3 + random() * 1.05, alpha: .22 + random() * .65, warm: random() };
  });
  const background = Array.from({ length: 80 }, () => ({ x: random(), y: random(), size: .3 + random() * .6, alpha: .12 + random() * .3 }));
  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const star of background) {
      ctx.fillStyle = `rgba(173,197,240,${star.alpha})`;
      ctx.beginPath(); ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save(); ctx.translate(width * .5 + pointerX, height * .49 + pointerY); ctx.rotate(-.38); ctx.scale(1, .68);
    const radius = Math.min(width * .44, height * .58);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    glow.addColorStop(0, '#fff1daba'); glow.addColorStop(.06, '#bce8ff80'); glow.addColorStop(.18, '#8bb5ff23'); glow.addColorStop(.55, '#9474ed0b'); glow.addColorStop(1, '#9474ed00');
    ctx.fillStyle = glow; ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.globalCompositeOperation = 'lighter';
    for (const star of stars) {
      const angle = star.angle + rotation;
      const x = Math.cos(angle) * star.radius * radius;
      const y = Math.sin(angle) * star.radius * radius + star.scatter * radius;
      const color = star.radius < .18 ? `255,${Math.round(224 + star.warm * 25)},206` : star.warm > .48 ? '152,125,246' : '130,208,255';
      ctx.fillStyle = `rgba(${color},${star.alpha})`;
      ctx.beginPath(); ctx.arc(x, y, star.size, 0, Math.PI * 2); ctx.fill();
    }
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * .18);
    core.addColorStop(0, '#fffce6'); core.addColorStop(.16, '#e6eeffbb'); core.addColorStop(.5, '#a9dbff30'); core.addColorStop(1, '#a9dbff00');
    ctx.fillStyle = core; ctx.fillRect(-radius * .18, -radius * .18, radius * .36, radius * .36); ctx.restore();
  }
  function tick(now) {
    frame = 0;
    if (!paused && last) rotation += Math.min(now - last, 50) * .000018;
    last = now; draw();
    if (!paused && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function schedule() { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick); }
  function resize() {
    const rect = wrap.getBoundingClientRect(); width = rect.width; height = rect.height;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw(); schedule();
  }
  function updateToggle() {
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Ativar animação da galáxia' : 'Pausar animação da galáxia');
    toggle.textContent = paused ? 'Ativar animação ▷' : 'Pausar animação Ⅱ';
    last = 0; if (paused) { pointerX = 0; pointerY = 0; } draw(); schedule();
  }
  toggle.addEventListener('click', () => { paused = !paused; updateToggle(); });
  preference.addEventListener('change', () => { paused = preference.matches; updateToggle(); });
  wrap.addEventListener('pointermove', event => {
    if (paused || event.pointerType !== 'mouse') return;
    const rect = wrap.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - .5) * 10;
    pointerY = ((event.clientY - rect.top) / rect.height - .5) * 7;
  });
  wrap.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) { if (frame) cancelAnimationFrame(frame); frame = 0; last = 0; } else schedule();
  }).observe(wrap);
  document.addEventListener('visibilitychange', () => {
    last = 0;
    if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; } else schedule();
  });
  new ResizeObserver(resize).observe(wrap); resize(); updateToggle();
})();
