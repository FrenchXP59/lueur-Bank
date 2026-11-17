/* Lueur Bank · interactions */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.hero');

  /* ============ HERO : brume interactive ============ */
  const fog = document.getElementById('fog');
  const fctx = fog.getContext('2d');
  const mask = document.createElement('canvas');
  const mctx = mask.getContext('2d');
  const motes = document.getElementById('motes');
  const pctx = motes.getContext('2d');
  const hint = document.getElementById('heroHint');

  const S = 0.4;               // résolution de la brume (floue par nature)
  let W = 0, H = 0, dpr = 1, puffs = [], parts = [], stamps = [];
  let start = performance.now(), last = start, running = true;
  const pointer = { x: -999, y: -999, px: -999, py: -999, active: false, lastMove: 0, travelled: 0 };

  function resize() {
    const r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    fog.width = mask.width = Math.ceil(W * S);
    fog.height = mask.height = Math.ceil(H * S);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    motes.width = W * dpr; motes.height = H * dpr;
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildPuffs(); buildMotes();
  }
  function buildPuffs() {
    const n = W < 700 ? 18 : 30;
    puffs = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * W,
      y: H * (0.15 + Math.random() * 0.85),
      r: (W < 700 ? 140 : 220) + Math.random() * (W < 700 ? 160 : 260),
      v: (0.08 + Math.random() * 0.22) * (i % 2 ? 1 : -1),
      ph: Math.random() * Math.PI * 2,
      a: 0.35 + Math.random() * 0.4,
      tint: Math.random() < 0.5
    }));
  }
  function buildMotes() {
    const n = W < 700 ? 34 : 70;
    parts = Array.from({ length: n }, () => newMote(true));
  }
  function newMote(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 10,
      r: 0.6 + Math.random() * 2.2,
      vy: 0.15 + Math.random() * 0.45,
      ph: Math.random() * 6.28,
      amp: 0.2 + Math.random() * 0.6,
      tw: 0.5 + Math.random() * 1.5,
      ox: 0, oy: 0
    };
  }

  // tampons de "clarté" : la brume revient doucement là où on est passé
  function stamp(x, y, r, strength) {
    stamps.push({ x, y, r, life: 1, s: strength });
    if (stamps.length > 420) stamps.splice(0, stamps.length - 420);
  }
  function brushLine(x0, y0, x1, y1, r, s) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(d / (r * 0.35)));
    for (let i = 1; i <= steps; i++) stamp(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, r, s);
  }

  function onMove(x, y) {
    const r = hero.getBoundingClientRect();
    x -= r.left; y -= r.top;
    if (pointer.px < -900) { pointer.px = x; pointer.py = y; }
    const brush = W < 700 ? 90 : 130;
    brushLine(pointer.px, pointer.py, x, y, brush, 1);
    pointer.travelled += Math.hypot(x - pointer.px, y - pointer.py);
    pointer.px = x; pointer.py = y; pointer.x = x; pointer.y = y;
    pointer.active = true; pointer.lastMove = performance.now();
    if (pointer.travelled > 600) hint.classList.add('gone');
  }
  hero.addEventListener('pointermove', e => onMove(e.clientX, e.clientY));
  hero.addEventListener('pointerleave', () => { pointer.px = pointer.py = -999; pointer.active = false; });
  hero.addEventListener('touchstart', e => { const t = e.touches[0]; pointer.px = -999; onMove(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('touchmove', e => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('touchend', () => { pointer.px = pointer.py = -999; pointer.active = false; });

  const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

  function drawFog(t, dt) {
    const el = (t - start) / 1000;
    // L'aube se lève : la brume s'éclaircit d'elle-même sans jamais disparaître
    const dawn = ease((el - 0.4) / 5);
    const small = W < 700;
    const baseA = 0.97 - dawn * (small ? 0.8 : 0.67); // 0.97 -> 0.30 (0.17 mobile)
    const puffK = 1 - dawn * (small ? 0.55 : 0.3);

    // balayage automatique (sans souris) : un souffle traverse le titre
    const idle = t - pointer.lastMove > 2500;
    if (el > 1 && el < 4.6) {
      const k = (el - 1) / 3.6;
      const x = W * (0.18 + 0.64 * k), y = H * (0.45 + Math.sin(k * Math.PI * 2) * 0.08);
      stamp(x, y, W < 700 ? 120 : 190, 0.85);
    } else if (idle && el > 4.6) {
      const k = el * 0.18;
      stamp(W * (0.5 + Math.sin(k) * 0.32), H * (0.48 + Math.sin(k * 1.7) * 0.12), W < 700 ? 80 : 120, 0.25);
    }

    // masque
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, mask.width, mask.height);
    mctx.setTransform(S, 0, 0, S, 0, 0);
    const decay = dt / 2600;
    for (let i = stamps.length - 1; i >= 0; i--) {
      const s = stamps[i];
      s.life -= decay;
      if (s.life <= 0) { stamps.splice(i, 1); continue; }
      const a = Math.min(1, s.life * 1.25) * s.s * 0.5;
      const g = mctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = g;
      mctx.beginPath(); mctx.arc(s.x, s.y, s.r, 0, 6.2832); mctx.fill();
    }

    // brume
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, fog.width, fog.height);
    fctx.setTransform(S, 0, 0, S, 0, 0);
    const bg = fctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, `rgba(226,214,240,${baseA * 0.75})`);
    bg.addColorStop(0.45, `rgba(246,236,246,${baseA})`);
    bg.addColorStop(1, `rgba(252,240,232,${Math.min(1, baseA + 0.15)})`);
    fctx.fillStyle = bg; fctx.fillRect(0, 0, W, H);

    for (const p of puffs) {
      p.x += p.v * dt * 0.06;
      if (p.x - p.r > W) p.x = -p.r; if (p.x + p.r < 0) p.x = W + p.r;
      const y = p.y + Math.sin(el * 0.25 + p.ph) * 18;
      const a = p.a * puffK;
      const g = fctx.createRadialGradient(p.x, y, 0, p.x, y, p.r);
      const c = p.tint ? '250,240,246' : '236,228,248';
      g.addColorStop(0, `rgba(${c},${a})`);
      g.addColorStop(0.5, `rgba(${c},${a * 0.45})`);
      g.addColorStop(1, `rgba(${c},0)`);
      fctx.fillStyle = g;
      fctx.fillRect(p.x - p.r, y - p.r, p.r * 2, p.r * 2);
    }
    // trouées
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = 'destination-out';
    fctx.drawImage(mask, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
  }

  function drawMotes(t, dt) {
    const el = (t - start) / 1000;
    pctx.clearRect(0, 0, W, H);
    const fadeIn = ease((el - 1.5) / 3);
    for (const m of parts) {
      m.y -= m.vy * dt * 0.06;
      const x = m.x + Math.sin(el * 0.6 + m.ph) * 14 * m.amp;
      // la lumière s'écarte doucement du curseur
      if (pointer.active) {
        const dx = x + m.ox - pointer.x, dy = m.y + m.oy - pointer.y, d = Math.hypot(dx, dy);
        if (d < 120 && d > 0.1) { m.ox += dx / d * (120 - d) * 0.02; m.oy += dy / d * (120 - d) * 0.02; }
      }
      m.ox *= 0.97; m.oy *= 0.97;
      if (m.y < -10) Object.assign(m, newMote(false));
      const tw = 0.55 + 0.45 * Math.sin(el * m.tw * 2 + m.ph);
      const fadeTop = Math.min(1, m.y / (H * 0.25));
      const a = tw * fadeIn * Math.max(0, fadeTop) * 0.9;
      const px = x + m.ox, py = m.y + m.oy, rr = m.r * 4;
      const g = pctx.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, `rgba(255,244,214,${a})`);
      g.addColorStop(0.3, `rgba(255,214,150,${a * 0.5})`);
      g.addColorStop(1, 'rgba(255,214,150,0)');
      pctx.fillStyle = g;
      pctx.beginPath(); pctx.arc(px, py, rr, 0, 6.2832); pctx.fill();
    }
  }

  function frame(t) {
    const dt = Math.min(50, t - last); last = t;
    if (running) { drawFog(t, dt); drawMotes(t, dt); }
    requestAnimationFrame(frame);
  }

  resize();
  addEventListener('resize', () => { clearTimeout(resize._t); resize._t = setTimeout(resize, 150); });
  new IntersectionObserver(([e]) => { running = e.isIntersecting; }, { threshold: 0 }).observe(hero);
  if (reduce) { start -= 10000; drawFog(performance.now(), 16); drawMotes(performance.now(), 16); }
  else requestAnimationFrame(frame);

  /* parallaxe + brume qui se lève au scroll */
  const contents = document.querySelectorAll('.hero-content');
  const topbar = document.getElementById('topbar');
  function onScroll() {
    const y = scrollY, h = innerHeight;
    if (y < h * 1.2) {
      const k = Math.min(1, y / (h * 0.8));
      contents.forEach(c => { c.style.transform = `translateY(${y * 0.35}px)`; c.style.opacity = 1 - k * 0.9; });
      fog.style.opacity = 1 - k * 0.8;
    }
    topbar.classList.toggle('scrolled', y > h * 0.7);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ============ Apparitions au scroll ============ */
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ============ Compteurs ============ */
  const fmt = n => Math.round(n).toLocaleString('fr-FR');
  const cio = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      cio.unobserve(e.target);
      const el = e.target, to = +el.dataset.count, from = el.dataset.from ? +el.dataset.from : 0;
      if (reduce) { el.textContent = fmt(to); continue; }
      const t0 = performance.now(), dur = 1800;
      (function tick(t) {
        const k = ease((t - t0) / dur);
        el.textContent = fmt(from + (to - from) * k);
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    }
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

  /* ============ Navigation par sections (points + clavier pour l'oral) ============ */
  const sections = [...document.querySelectorAll('main section[data-title]')];
  const dots = document.querySelector('.dots');
  sections.forEach(s => {
    const a = document.createElement('a');
    a.href = '#' + s.id; a.innerHTML = `<span>${s.dataset.title}</span>`;
    a.setAttribute('aria-label', s.dataset.title);
    dots.appendChild(a);
  });
  const dotLinks = [...dots.children];
  let current = 0;
  const sio = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) {
      current = sections.indexOf(e.target);
      dotLinks.forEach((d, i) => d.classList.toggle('active', i === current));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => sio.observe(s));

  addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, summary') || e.metaKey || e.ctrlKey || e.altKey) return;
    let dir = 0;
    if (['ArrowRight', 'PageDown'].includes(e.key)) dir = 1;
    if (['ArrowLeft', 'PageUp'].includes(e.key)) dir = -1;
    if (!dir) return;
    e.preventDefault();
    const i = Math.max(0, Math.min(sections.length - 1, current + dir));
    sections[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ============ Personas ============ */
  const tabs = [...document.querySelectorAll('.persona-tabs button')];
  const personas = [...document.querySelectorAll('.persona')];
  tabs.forEach(b => b.addEventListener('click', () => {
    tabs.forEach(x => x.setAttribute('aria-selected', x === b));
    personas.forEach(p => p.classList.toggle('is-active', p.dataset.p === b.dataset.p));
    personas.forEach(p => p.querySelector('video')?.pause());
  }));

  /* Vidéos : déposer videos/persona-parent.mp4, videos/persona-retraite.mp4, videos/persona-couple.mp4 */
  document.querySelectorAll('.video-slot').forEach(slot => {
    const src = `videos/${slot.dataset.video}.mp4`;
    fetch(src, { method: 'HEAD' }).then(r => {
      if (!r.ok || !(r.headers.get('content-type') || '').startsWith('video')) return;
      const v = document.createElement('video');
      v.src = src; v.controls = true; v.playsInline = true; v.preload = 'metadata';
      if (slot.dataset.poster) v.poster = slot.dataset.poster;
      slot.querySelector('.play').remove(); slot.querySelector('.video-tag').remove();
      slot.appendChild(v);
    }).catch(() => {});
    slot.querySelector('.play').addEventListener('click', () => {
      const tag = slot.querySelector('.video-tag');
      if (!tag) return;
      tag.textContent = 'La vidéo arrive bientôt ✨';
      tag.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], { duration: 400 });
    });
  });

  /* Mentions légales */
  document.querySelectorAll('.open-legal').forEach(a => a.addEventListener('click', () => {
    document.getElementById('mentions').open = true;
  }));
})();
