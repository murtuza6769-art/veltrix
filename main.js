/* VELTRIX — motion system, scroll scenes and interactive product demos.
   Every number on the page comes from one seeded sample dataset (see DATA). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const motion = !!(G && ST) && !reduced;
  const wide = () => innerWidth > 960;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const money = n => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `$${(n / 1e3).toFixed(1)}k` : `$${fmt(n)}`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (id, s = 14) => `<svg width="${s}" height="${s}"><use href="#${id}"/></svg>`;
  const now = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  if (!motion) root.classList.add('no-motion');
  if (G && ST) G.registerPlugin(ST);
  const EASE = 'expo.out';

  /* ================= helpers ================= */
  const countTo = (el, to, { dur = 1, format = fmt } = {}) => {
    if (!el) return;
    el._count?.kill();
    const from = el._shown ?? 0;
    const render = v => { el._shown = v; el.textContent = format(v); };
    if (!motion) return render(to);
    const o = { v: from };
    el._count = G.to(o, { v: to, duration: dur, ease: 'power3.out', onUpdate: () => render(o.v) });
  };
  const toast = (text, ic = 'i-check') => {
    const wrap = $('#toasts'), t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="ic">${icon(ic, 13)}</span><span>${esc(text)}</span>`;
    wrap.appendChild(t);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    if (motion) G.from(t, { y: 16, opacity: 0, duration: 0.5, ease: EASE });
    setTimeout(() => { if (motion) G.to(t, { opacity: 0, y: 8, duration: 0.3, onComplete: () => t.remove() }); else t.remove(); }, 3600);
  };
  const whenSeen = (el, fn, threshold = 0.2) => {
    if (!el) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { o.disconnect(); fn(); } }, { threshold });
    o.observe(el);
  };
  const visibleFlag = (el, threshold = 0) => {
    const f = { on: false };
    new IntersectionObserver(([e]) => { f.on = e.isIntersecting; }, { threshold }).observe(el);
    return f;
  };

  /* ================= DATA: one seeded sample dataset ================= */
  const DAYS = 730;
  // the sample workspace is a snapshot taken on one fixed day, so every figure is stable and can also ship in the HTML
  const today = new Date(2026, 10, 4);
  const DATA = (() => {
    const r = seeded(20261104);
    const rows = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(today); d.setDate(d.getDate() - (DAYS - 1 - i));
      const t = i / DAYS, dow = d.getDay(), weekend = dow === 0 || dow === 6;
      const season = Math.sin(t * Math.PI * 4) * 0.05;
      rows.push({
        d,
        revenue: Math.round((weekend ? 0.35 : 1) * (5200 + 3400 * t) * (1 + season + (r() - 0.5) * 0.22)),
        ontime: clamp(82 + 11 * t + (r() - 0.5) * 6, 70, 99),
        cycle: clamp(6.1 - 2.3 * t + (r() - 0.5) * 0.9, 2.2, 8),
        runs: Math.round((weekend ? 0.3 : 1) * (0.6 + 1.1 * t + r() * 1.1))
      });
    }
    return rows;
  })();
  const METRICS = {
    revenue: { label: 'Revenue', agg: 'sum', format: v => money(v), axis: v => v >= 1000 ? `$${+(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`, better: 'up' },
    ontime: { label: 'On-time delivery', agg: 'avg', format: v => `${v.toFixed(1)}%`, axis: v => `${Math.round(v)}%`, better: 'up' },
    cycle: { label: 'Cycle time', agg: 'avg', format: v => `${v.toFixed(1)} d`, axis: v => `${v.toFixed(1)}d`, better: 'down' },
    runs: { label: 'Automation runs', agg: 'sum', format: v => fmt(v), axis: v => fmt(v), better: 'up' }
  };
  const aggregate = (rows, key) => {
    const vals = rows.map(x => x[key]);
    const s = vals.reduce((a, b) => a + b, 0);
    return METRICS[key].agg === 'sum' ? s : s / (vals.length || 1);
  };
  const windowRows = (days, offset = 0) => DATA.slice(DAYS - days - offset, DAYS - offset);
  const periodValue = (key, days, offset = 0) => aggregate(windowRows(days, offset), key);
  // chart buckets: 7 and 30 days daily, 90 days weekly, 12 months monthly
  const buckets = (key, days, offset = 0) => {
    const rows = windowRows(days, offset);
    if (days <= 30) return rows.map(x => ({ label: x.d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), short: days === 7 ? x.d.toLocaleDateString('en-US', { weekday: 'short' }) : x.d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), v: x[key] }));
    const size = days <= 120 ? 7 : null, out = [];
    if (size) for (let i = rows.length % size; i < rows.length; i += size) { const ch = rows.slice(i, i + size); out.push({ label: `Week of ${ch[0].d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, short: ch[0].d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), v: aggregate(ch, key) }); }
    else { const by = new Map(); rows.forEach(x => { const k = `${x.d.getFullYear()}-${x.d.getMonth()}`; if (!by.has(k)) by.set(k, []); by.get(k).push(x); }); [...by.values()].slice(-12).forEach(ch => out.push({ label: ch[0].d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), short: ch[0].d.toLocaleDateString('en-US', { month: 'short' }), v: aggregate(ch, key) })); }
    return out;
  };
  const K = {
    rev30: periodValue('revenue', 30), revPrev: periodValue('revenue', 30, 30),
    ontime30: periodValue('ontime', 30), ontimePrev: periodValue('ontime', 30, 30),
    cycle30: periodValue('cycle', 30), runs30: periodValue('runs', 30), rev84: periodValue('revenue', 84)
  };
  const RULE_SHARE = [0.26, 0.41, 0.33];
  const ruleRuns = RULE_SHARE.map((s, i) => i < 2 ? Math.round(K.runs30 * s) : 0);
  ruleRuns[2] = K.runs30 - ruleRuns[0] - ruleRuns[1];
  const pctDelta = (a, b) => (a - b) / b * 100;

  /* ================= smooth scroll + anchors ================= */
  let lenis = null;
  if (motion && window.Lenis && finePointer) {
    const own = '.chat-log, .wfb-log, .pal-box ul, .mnav, .fit-scroll, .app-nav, .int-cats, .an-controls .seg';
    const canScroll = el => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
    lenis = new window.Lenis({ lerp: 0.1, prevent: n => { const el = n.closest?.(own); return !!el && canScroll(el); } });
    lenis.on('scroll', ST.update);
    G.ticker.add(t => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }
  const goTo = (target, offset = 0) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (typeof target === 'number') { lenis ? lenis.scrollTo(target, { duration: 1.2 }) : scrollTo({ top: target, behavior: motion ? 'smooth' : 'auto' }); return; }
    if (lenis) lenis.scrollTo(el, { offset, duration: 1.3 });
    else el.scrollIntoView({ behavior: motion ? 'smooth' : 'auto' });
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id.length > 1 && $(id);
    if (!el) return;
    e.preventDefault();
    closeAllDD(); closeMenu();
    if (a.dataset.case) selectCase(+a.dataset.case);
    if (a.dataset.tour) { showTourStep(+a.dataset.tour, true); return; }
    goTo(el);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  /* ================= fitted product fragments ================= */
  const fits = $$('.fit');
  fits.forEach(f => f.parentElement.classList.add('fit-box'));
  function layoutFits() {
    const phone = innerWidth <= 600;
    fits.forEach(f => {
      const box = f.parentElement, narrow = phone && !!f.dataset.wm;
      const tablet = !phone && innerWidth <= 960 && !!f.dataset.wt;   // a mid-size design for tablets, used only below 961px
      const w = narrow ? +f.dataset.wm : tablet ? +f.dataset.wt : +f.dataset.w, h = +f.dataset.h;
      const cs = getComputedStyle(box);
      const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      let s = Math.min(1, avail / w);
      if (f.closest('.connect-stage, .tour-stage') && wide() && motion) s = Math.min(s, Math.max(0.5, (innerHeight - 150) / h));
      const scroll = !!f.dataset.min && s < +f.dataset.min;
      if (scroll) s = +f.dataset.min;
      box.classList.toggle('fit-scroll', scroll);
      f.style.width = `${w}px`;
      f.style.height = (narrow || tablet || f.dataset.auto) ? 'auto' : `${h}px`;
      f.style.setProperty('--s', s);
      box.style.setProperty('--sw', `${w * s}px`);
      box.style.height = `${f.offsetHeight * s + (scroll ? 14 : 0)}px`;
    });
  }
  layoutFits();
  let fitT;
  addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(() => { layoutFits(); placePills(); }, 120); });
  let stT;
  if (ST) new ResizeObserver(() => { clearTimeout(stT); stT = setTimeout(() => ST.refresh(), 200); }).observe(document.body);

  /* ================= segmented controls: sliding pill ================= */
  const segs = $$('.seg');
  segs.forEach(s => { const p = document.createElement('span'); p.className = 'seg-pill'; p.setAttribute('aria-hidden', 'true'); s.prepend(p); });
  function placePills() {
    segs.forEach(s => {
      const on = $('button.is-on', s), p = $('.seg-pill', s);
      if (!on || !p) return;
      p.style.width = `${on.offsetWidth}px`;
      p.style.transform = `translateX(${on.offsetLeft}px)`;
    });
  }
  const setSeg = (group, btn) => { $$('button', group).forEach(b => { b.classList.toggle('is-on', b === btn); b.setAttribute('aria-pressed', b === btn); }); placePills(); };
  document.fonts?.ready.then(placePills);
  placePills();

  /* ================= signal field: a dotted grid that carries lime pulses ================= */
  // Dots are painted once to an offscreen canvas; each frame only draws the moving pulses and the pointer light.
  const makeField = (canvas, { pulses = 6, gap = 28, light = true } = {}) => {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), host = canvas.parentElement;
    let W = 0, H = 0, dots = null, list = [], raf = 0, on = false, last = 0, px = -9999, py = -9999;
    const spawn = () => {
      const h = Math.random() < 0.62, span = h ? W : H, lanes = Math.max(1, Math.floor((h ? H : W) / gap));
      const dir = Math.random() < 0.5 ? 1 : -1;
      return { h, dir, lane: (Math.floor(Math.random() * lanes) + 0.5) * gap, p: dir > 0 ? -160 : span + 160, v: 110 + Math.random() * 170, span };
    };
    const paint = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (dots) ctx.drawImage(dots, 0, 0, W, H);
      if (light && px > -999) {
        const g = ctx.createRadialGradient(px, py, 0, px, py, 260);
        g.addColorStop(0, 'rgba(184,243,107,.09)'); g.addColorStop(1, 'rgba(184,243,107,0)');
        ctx.fillStyle = g; ctx.fillRect(px - 260, py - 260, 520, 520);
      }
      list.forEach(s => {
        const tail = 150, x1 = s.h ? s.p : s.lane, y1 = s.h ? s.lane : s.p, x0 = s.h ? s.p - tail * s.dir : s.lane, y0 = s.h ? s.lane : s.p - tail * s.dir;
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(184,243,107,0)'); g.addColorStop(1, 'rgba(184,243,107,.6)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.fillStyle = '#B8F36B'; ctx.shadowColor = 'rgba(184,243,107,.9)'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(x1, y1, 2, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
      });
    };
    const frame = t => {
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      list.forEach(s => { s.p += s.v * dt * s.dir; });
      list = list.filter(s => s.dir > 0 ? s.p < s.span + 170 : s.p > -170);
      while (list.length < pulses) list.push(spawn());
      paint();
      raf = on ? requestAnimationFrame(frame) : 0;
    };
    const size = () => {
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      dots = document.createElement('canvas'); dots.width = canvas.width; dots.height = canvas.height;
      const d = dots.getContext('2d'); d.scale(dpr, dpr); d.fillStyle = 'rgba(196,197,201,.12)';
      for (let x = gap / 2; x < W; x += gap) for (let y = gap / 2; y < H; y += gap) d.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
      list = list.map(s => ({ ...s, span: s.h ? W : H }));
      paint();
    };
    size();
    if (!motion) return { size };
    new IntersectionObserver(([e]) => { on = e.isIntersecting && !document.hidden; if (on && !raf) { last = 0; raf = requestAnimationFrame(frame); } }).observe(host);
    document.addEventListener('visibilitychange', () => { on = !document.hidden && host.getBoundingClientRect().bottom > 0 && host.getBoundingClientRect().top < innerHeight; if (on && !raf) raf = requestAnimationFrame(frame); });
    if (finePointer && light) {
      host.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; });
      host.addEventListener('pointerleave', () => { px = py = -9999; });
    }
    return { size };
  };
  const fields = [makeField($('#heroField'), { pulses: 8 }), makeField($('#cxField'), { pulses: 5, light: false }), makeField($('#filmsField'), { pulses: 4 }), makeField($('#demoField'), { pulses: 6 })].filter(Boolean);
  let fieldT;
  addEventListener('resize', () => { clearTimeout(fieldT); fieldT = setTimeout(() => fields.forEach(f => f.size()), 200); });

  /* ================= numbers: every figure comes from DATA ================= */
  // The hero dashboard, the tour, analytics and Copilot all read the same sample dataset,
  // so a figure shown in one place always matches the same figure anywhere else.
  const signed = (d, unit = '%') => { const r = Math.round(d * 10) / 10; return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(1)}${unit}`; };   // a change that rounds to zero reads 0.0, never −0.0
  const fullMoney = v => `$${Math.round(v).toLocaleString('en-US')}`;
  const shortDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  // a delta chip: the arrow shows direction, the colour shows whether that direction is good
  const setDelta = (id, text, dirUp, good) => { const el = $(id); if (!el) return; el.className = `kpi-d ${good ? (dirUp ? 'up' : 'good-down') : (dirUp ? 'bad-up' : 'down')}`; el.innerHTML = `<i></i><b>${text}</b>`; };
  // KPI cards for the chosen period (7, 30 or 90 days), each compared with the period before it
  function renderHeroKpis(days, animate) {
    const span = `prior ${days} days`, v = k => periodValue(k, days), pv = k => periodValue(k, days, days), dur = animate ? 0.9 : 1.6;
    countTo($('#hwRev'), v('revenue') / 1000, { format: x => x.toFixed(1), dur });
    const dR = pctDelta(v('revenue'), pv('revenue')); setDelta('#hwRevD', signed(dR), dR >= 0, dR >= 0);
    countTo($('#hwOn'), v('ontime'), { format: x => x.toFixed(1), dur });
    const dOn = v('ontime') - pv('ontime'); setDelta('#hwOnD', signed(dOn, ' pts'), dOn >= 0, dOn >= 0);
    countTo($('#hwCycle'), v('cycle'), { format: x => x.toFixed(1), dur });
    const dCy = v('cycle') - pv('cycle'); setDelta('#hwCycleD', signed(dCy, ' d'), dCy >= 0, dCy <= 0);   // a shorter cycle is the good direction
    countTo($('#hwRuns'), v('runs'), { dur });
    const dRu = pctDelta(v('runs'), pv('runs')); setDelta('#hwRunsD', signed(dRu), dRu >= 0, dRu >= 0);
    $$('#hsWin .kpi-vs').forEach(el => { el.textContent = `vs ${span}`; });
    const rows = windowRows(days);
    $('#dbDates span').textContent = `${shortDate(rows[0].d)} – ${shortDate(rows[rows.length - 1].d)}, ${rows[rows.length - 1].d.getFullYear()}`;
    // seven bars: the period split into seven equal slices, the latest slice lit
    [['#kbRev', 'revenue'], ['#kbOn', 'ontime'], ['#kbCycle', 'cycle'], ['#kbRuns', 'runs']].forEach(([sel, key]) => {
      const el = $(sel); if (!el) return;
      const parts = Array.from({ length: 7 }, (_, i) => aggregate(rows.slice(Math.round(i * rows.length / 7), Math.round((i + 1) * rows.length / 7)), key));
      const lo = Math.min(...parts), hi = Math.max(...parts);
      el.innerHTML = parts.map(x => `<i style="height:${(30 + 70 * ((x - lo) / (hi - lo || 1))).toFixed(0)}%"></i>`).join('');
    });
    if (animate && motion) G.from('#hsWin .kpi-mini i', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.5, stagger: 0.012, ease: EASE });
  }
  // revenue by week: a smooth line through the last 12 weekly totals
  let hc = null;
  function drawHeroChart() {
    const w12 = buckets('revenue', 84), p12 = buckets('revenue', 84, 84), n = w12.length;
    const tot = w12.reduce((s, b) => s + b.v, 0), ptot = p12.reduce((s, b) => s + b.v, 0), d = pctDelta(tot, ptot);
    countTo($('#hsRev'), tot, { format: fullMoney, dur: 1.8 });
    const dEl = $('#hsRevD'); dEl.textContent = `${signed(d)} vs the 12 weeks before`; dEl.classList.toggle('down', d < 0);
    const vals = w12.map(b => b.v), step = 5000;
    const lo = Math.floor(Math.min(...vals) * 0.9 / step) * step, hi = Math.ceil(Math.max(...vals) * 1.06 / step) * step;
    const X = i => i / (n - 1) * 400, Y = v => (hi - v) / (hi - lo) * 100;
    const pts = vals.map((v, i) => [X(i), Y(v)]);
    const curve = pts.map(([x, y], i) => {                                    // Catmull-Rom → cubic Bézier
      if (!i) return `M${x} ${y}`;
      const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] || pts[i];
      return `C${(p1[0] + (x - p0[0]) / 6).toFixed(2)} ${(p1[1] + (y - p0[1]) / 6).toFixed(2)} ${(x - (p3[0] - p1[0]) / 6).toFixed(2)} ${(y - (p3[1] - p1[1]) / 6).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
    $('#hcLn').setAttribute('d', curve); $('#hcAr').setAttribute('d', `${curve} L400 100 L0 100 Z`);
    const area = $('#hcArea'); area.querySelectorAll('.db-gl-l').forEach(g => g.remove());
    const ticks = []; for (let t = lo; t <= hi + 1; t += step * Math.ceil((hi - lo) / step / 4)) ticks.push(t);
    ticks.forEach(t => area.insertAdjacentHTML('afterbegin', `<i class="db-gl-l" style="top:${Y(t).toFixed(2)}%"></i>`));
    $('#hcY').innerHTML = ticks.map(t => `<span style="top:${Y(t).toFixed(2)}%">$${t / 1000}K</span>`).join('');
    $('#hcX').innerHTML = w12.map((b, i) => (n - 1 - i) % 2 === 0 ? `<span data-i="${i}" style="left:${(i / (n - 1) * 100).toFixed(2)}%">${b.short}</span>` : '').join('');
    hc = { w12, n, X, Y };
    markWeek(n - 1);
  }
  function markWeek(i) {
    if (!hc) return;
    const mk = $('#hcMk'), top = `${hc.Y(hc.w12[i].v).toFixed(2)}%`;
    mk.style.left = `${(i / (hc.n - 1) * 100).toFixed(2)}%`;
    mk.querySelector('.db-mk-l').style.top = top; mk.querySelector('.db-mk-d').style.top = top;
    const t = $('#hcTip'); t.style.top = top; t.textContent = `${hc.w12[i].label} · ${fullMoney(hc.w12[i].v)}`;
    mk.classList.toggle('flip', i > hc.n / 2);
    $$('#hcX span').forEach(s => s.classList.toggle('on', +s.dataset.i === i));
  }
  // on-time delivery band: for each of the last 12 weeks, the lowest and highest daily on-time rate
  let hb = null;
  function drawBand() {
    const rows = windowRows(84), weeks = Array.from({ length: 12 }, (_, w) => rows.slice(w * 7, w * 7 + 7));
    const top = weeks.map(w => Math.max(...w.map(r => r.ontime))), bot = weeks.map(w => Math.min(...w.map(r => r.ontime))), avg = weeks.map(w => aggregate(w, 'ontime'));
    const lo = Math.floor(Math.min(...bot)) - 1, hi = Math.ceil(Math.max(...top)) + 1;
    const X = i => i / 11 * 600, Y = v => 92 - (v - lo) / (hi - lo) * 84;
    const line = a => a.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(2)}`).join(' ');
    const band = `${line(top)} ${bot.map((v, i) => [i, v]).reverse().map(([i, v]) => `L${X(i).toFixed(1)} ${Y(v).toFixed(2)}`).join(' ')} Z`;
    $('#hsBandBg').setAttribute('d', band); $('#hsBandClip').setAttribute('d', band);
    $('#hsBandTop').setAttribute('d', line(top)); $('#hsBandBot').setAttribute('d', line(bot));
    $('#hsOn').textContent = `${K.ontime30.toFixed(1)}%`;
    $('#hsBest').textContent = `${Math.max(...avg).toFixed(1)}%`;
    $('#hsLow').textContent = `${Math.min(...bot).toFixed(1)}%`;
    hb = { top, bot, avg, weeks, Y };
    markBand(8);
  }
  function markBand(i) {
    if (!hb) return;
    const box = $('#hsBand'), h = box.clientHeight || 100, py = v => hb.Y(v) / 100 * h;
    const mk = $('#hsBandMk'), t = py(hb.top[i]), b = py(hb.bot[i]);
    mk.style.left = `${(i / 11 * 100).toFixed(2)}%`;
    mk.querySelector('.db-vd1').style.top = `${t - 3.5}px`;
    mk.querySelector('.db-vl').style.cssText = `top:${t}px;height:${Math.max(0, b - t)}px`;
    mk.querySelector('.db-vd2').style.top = `${b - 3.5}px`;
    const pill = $('#hsBandPill'); pill.style.top = `${(t + b) / 2}px`;
    pill.textContent = `Week of ${shortDate(hb.weeks[i][0].d)} · ${hb.avg[i].toFixed(1)}%`;
    pill.style.transform = `translate(${i < 2 ? '-12%' : i > 9 ? '-88%' : '-50%'}, -50%)`;
  }
  function fillNumbers() {
    renderHeroKpis(30, false);
    drawHeroChart();
    drawBand();
    const vals = { rev30: money(K.rev30), ontime30: `${K.ontime30.toFixed(1)}%`, cycle30: `${K.cycle30.toFixed(1)} d`, runs30: fmt(K.runs30), rev84: money(K.rev84) };
    $$('[data-kpi]').forEach(el => { el.textContent = vals[el.dataset.kpi]; });
    $$('.wfr small').forEach((s, i) => { if (i < 3) s.textContent = s.textContent.replace(/ran \d+ times/, `ran ${ruleRuns[i]} times`); });
  }

  /* ================= hero: entrance and the dashboard controls ================= */
  const offIn = (el, anc) => { let x = 0, y = 0; for (let n = el; n && n !== anc; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return [x, y]; };
  const heroIn = () => {
    fillNumbers();
    if (!motion) return;
    const tl = G.timeline({ defaults: { ease: EASE } });
    tl.from('.nav-bar > *', { y: -16, opacity: 0, duration: 0.9, stagger: 0.06 }, 0)
      .from('.eyebrow', { y: 14, opacity: 0, duration: 0.8 }, 0.05)
      .from('.hero-title .ln > span', { yPercent: 112, rotate: 3, transformOrigin: '0% 100%', duration: 1.3, stagger: 0.1 }, 0.1)
      .from('.hero-sub', { y: 24, opacity: 0, duration: 1 }, 0.45)
      .from('.hero-cta > *', { y: 18, opacity: 0, duration: 0.9, stagger: 0.07 }, 0.55)
      .from('.film-btn', { y: 18, opacity: 0, duration: 0.9 }, 0.68)
      .from('#heroStage', { y: 140, opacity: 0, duration: 1.6, ease: 'expo.out' }, 0.5)
      // inside the dashboard only: content settles in after the frame arrives
      .from('#hsWin .db-nav > span', { x: -8, opacity: 0, duration: 0.6, stagger: 0.035 }, 1.0)
      .from('#hsWin .kpi', { y: 12, opacity: 0, duration: 0.7, stagger: 0.06 }, 1.05)
      .from('#hsWin .db-card', { y: 14, opacity: 0, duration: 0.8, stagger: 0.07 }, 1.15)
      .from('#hsWin .kpi-mini i', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.7, stagger: 0.01, ease: 'power3.out' }, 1.3)
      .add(() => {
        const l = $('#hcLn'); if (!l) return;
        const len = l.getTotalLength();
        G.fromTo(l, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', onComplete: () => { l.style.strokeDasharray = ''; } });
        G.from(['#hcAr', '#hcMk', '#hsBandMk'], { opacity: 0, duration: 1, delay: 0.5 });
      }, 1.35);
  };
  heroIn();
  // KPI period
  $$('#dbRange button').forEach(b => b.addEventListener('click', () => {
    $$('#dbRange button').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); });
    renderHeroKpis(+b.dataset.days, true);
  }));
  // charts: hover to read a week; leaving returns to the resting week
  const cfPlot = $('#hcArea'), bandBox = $('#hsBand');
  $('#hcPlot')?.addEventListener('pointermove', e => { if (!hc) return; const r = cfPlot.getBoundingClientRect(); markWeek(clamp(Math.round((e.clientX - r.left) / r.width * (hc.n - 1)), 0, hc.n - 1)); });
  $('#hcPlot')?.addEventListener('pointerleave', () => hc && markWeek(hc.n - 1));
  bandBox?.addEventListener('pointermove', e => { const r = bandBox.getBoundingClientRect(); markBand(clamp(Math.round((e.clientX - r.left) / r.width * 11), 0, 11)); });
  bandBox?.addEventListener('pointerleave', () => markBand(8));
  addEventListener('resize', () => hb && markBand(8));
  $('#dbBell').addEventListener('click', () => toast('2 unread: Design QA flagged as the launch blocker; Invoice 2287 paid', 'i-bell'));
  $('#dbNew').addEventListener('click', () => toast('Creating projects isn’t available in this demo', 'i-folder'));
  const mmHero = motion ? G.matchMedia() : null;
  mmHero?.add('(min-width: 961px)', () => {
    G.set('#stageTilt', { rotateX: 16, scale: 0.93, transformOrigin: '50% 0%' });
    G.to('#stageTilt', { rotateX: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '#heroStage', start: 'top 85%', end: 'top 12%', scrub: 0.8 } });
    G.to('.hero-inner', { yPercent: -18, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: '.hero', start: '12% top', end: '55% top', scrub: true } });
    return () => G.set('#stageTilt', { clearProps: 'transform' });
  });

  /* ================= film modal: the 36-second product film ================= */
  const modal = $('#filmModal'), full = $('#filmFull');
  let filmReturn = null;
  const openFilm = () => {
    filmReturn = document.activeElement; closeAllDD?.(); modal.hidden = false; lenis?.stop();
    if (motion) G.fromTo('.film-box', { y: 30, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: EASE });
    full.play().catch(() => {});
    $('#filmClose').focus();
  };
  const closeFilm = () => { if (modal.hidden) return; full.pause(); modal.hidden = true; lenis?.start(); filmReturn?.focus?.(); };
  document.addEventListener('click', e => { if (e.target.closest('[data-film]')) { e.preventDefault(); openFilm(); } });
  $('#filmClose').addEventListener('click', closeFilm);
  modal.addEventListener('click', e => { if (e.target === modal) closeFilm(); });
  modal.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); closeFilm(); }
    if (e.key === 'Tab') { const f = [$('#filmClose'), full]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
  });


  /* ================= nav ================= */
  const nav = $('#nav'), progress = $('.progress span'), ind = $('.nav-ind');
  const themed = $$('main > section, footer');
  const navMap = [['tour', 0], ['workflows', 0], ['copilot', 0], ['analytics', 0], ['solutions', 1], ['integrations', 2], ['faq', 3]];
  const navItems = [$$('.nav-links > .dd')[0], $$('.nav-links > .dd')[1], $('.nav-links > a.nav-link'), $$('.nav-links > .dd')[2]];
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('is-scrolled', y > 20);
    const anyOpen = !!$('.dd.is-open') || !$('#mnav').hidden || nav.contains(document.activeElement);
    if (y > 700 && y > lastY + 4 && !anyOpen) nav.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 700) nav.classList.remove('is-hidden');
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    const under = themed.find(s => { const r = s.getBoundingClientRect(); return r.top <= 40 && r.bottom > 40; });
    nav.classList.toggle('is-light', !!under && under.dataset.theme !== 'dark' && $('#mnav').hidden);
    let active = -1;
    navMap.forEach(([id, i]) => { const r = $('#' + id).getBoundingClientRect(); if (r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5) active = i; });
    const it = navItems[active];
    if (it && it.offsetParent) {
      const btn = it.matches('a') ? it : $('.nav-link', it);
      ind.style.opacity = 1; ind.style.width = `${btn.offsetWidth - 28}px`;
      ind.style.transform = `translateX(${it.offsetLeft + 14}px)`;
    } else ind.style.opacity = 0;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  // dropdowns: hover on mouse, tap/click/keyboard everywhere
  const dds = $$('[data-dd]');
  function closeAllDD(except) { dds.forEach(d => { if (d !== except) { d.classList.remove('is-open'); $('.nav-link', d).setAttribute('aria-expanded', 'false'); } }); }
  const openDD = (d, open) => { closeAllDD(open ? d : null); d.classList.toggle('is-open', open); $('.nav-link', d).setAttribute('aria-expanded', open); };
  dds.forEach(d => {
    const btn = $('.nav-link', d);
    let t, hoverAt = 0;
    btn.addEventListener('click', e => { e.stopPropagation(); const open = d.classList.contains('is-open'); openDD(d, !open || performance.now() - hoverAt < 500); });
    btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); openDD(d, true); $('a, button', $('.dd-panel', d))?.focus(); } });
    if (finePointer) {
      d.addEventListener('mouseenter', () => { clearTimeout(t); if (!d.classList.contains('is-open')) hoverAt = performance.now(); openDD(d, true); });
      d.addEventListener('mouseleave', () => { t = setTimeout(() => openDD(d, false), 180); });
    }
    d.addEventListener('focusout', e => { if (!d.contains(e.relatedTarget)) openDD(d, false); });
  });
  document.addEventListener('click', e => { if (!e.target.closest('[data-dd]')) closeAllDD(); });
  // mobile menu
  const burger = $('.burger'), mnav = $('#mnav');
  function closeMenu() {
    if (mnav.hidden) return;
    mnav.hidden = true; burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu');
    burger.innerHTML = icon('i-menu', 22); lenis?.start(); document.body.style.overflow = ''; onScroll();
  }
  burger.addEventListener('click', () => {
    if (!mnav.hidden) return closeMenu();
    mnav.hidden = false; burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu');
    burger.innerHTML = icon('i-x', 22); lenis?.stop(); document.body.style.overflow = 'hidden'; onScroll();
    if (motion) G.from('.mnav nav > *, .mnav > .btn', { y: 24, opacity: 0, duration: 0.6, stagger: 0.05, ease: EASE });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeAllDD(); closeMenu(); if (!$('#palette').hidden) closePal(); } });

  // magnetic primary buttons (subtle, mouse only)
  if (motion && finePointer) {
    $$('[data-magnetic]').forEach(el => {
      el.addEventListener('mousemove', e => { const r = el.getBoundingClientRect(); G.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.16, y: (e.clientY - r.top - r.height / 2) * 0.24, duration: 0.5, ease: 'power3.out', overwrite: 'auto' }); });
      el.addEventListener('mouseleave', () => G.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' }));
    });
  }

  /* ================= system: the statement lights up as you read it ================= */
  const stmt = $('#statement');
  stmt.setAttribute('aria-label', stmt.textContent);
  stmt.innerHTML = stmt.textContent.split(' ').map(w => `<span class="sw" aria-hidden="true">${esc(w)}</span>`).join(' ');
  if (motion) G.to('#statement .sw', { opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: '#statement', start: 'top 82%', end: 'bottom 50%', scrub: 0.6 } });

  /* ================= five working parts: an expanding selector that advances on its own ================= */
  const partEls = $$('#parts .part');
  let partI = 0, partAuto = true, partTw = null;
  const partsVis = visibleFlag($('#parts'), 0.3);
  function setPart(i, user) {
    if (user) partAuto = false;
    partI = i;
    partEls.forEach((p, k) => { p.classList.toggle('is-on', k === i); p.setAttribute('aria-selected', k === i); p.tabIndex = k === i ? 0 : -1; });
    partTw?.kill();
    $$('.part-bar', $('#parts')).forEach(b => { b.style.transform = 'scaleX(0)'; });
    if (motion) {
      G.fromTo($('.part-img', partEls[i]), { scale: 1.14, clipPath: 'inset(8% 8% 8% 8% round 14px)' }, { scale: 1, clipPath: 'inset(0% 0% 0% 0% round 14px)', duration: 1.1, delay: 0.15, ease: EASE, overwrite: 'auto' });
      if (partAuto) partTw = G.fromTo($('.part-bar', partEls[i]), { scaleX: 0 }, { scaleX: 1, duration: 6, ease: 'none', paused: !partsVis.on, onComplete: () => { if (partAuto) setPart((partI + 1) % partEls.length); } });
    }
  }
  partEls.forEach((p, k) => {
    p.addEventListener('click', () => setPart(k, true));
    if (finePointer) { let t; p.addEventListener('mouseenter', () => { t = setTimeout(() => { if (partI !== k) setPart(k, true); }, 260); }); p.addEventListener('mouseleave', () => clearTimeout(t)); }
  });
  $('#parts').addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const n = (partI + (/Right|Down/.test(e.key) ? 1 : -1) + partEls.length) % partEls.length;
    setPart(n, true); partEls[n].focus();
  });
  setPart(0);
  new IntersectionObserver(([e]) => { if (partTw) e.isIntersecting ? partTw.play() : partTw.pause(); }, { threshold: 0.3 }).observe($('#parts'));

  /* ================= problem: the photograph opens out to full bleed as you scroll ================= */
  const mmPage = motion ? G.matchMedia() : null;
  mmPage?.add('(min-width: 961px)', () => {
    const tl = G.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#problem', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
    tl.fromTo('#problemMedia', { clipPath: 'inset(16% 20% 16% 20% round 28px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 0.5 }, 0)
      .fromTo('#problemMedia img', { scale: 1.18 }, { scale: 1, duration: 0.6 }, 0)
      .from('.problem-copy', { y: 60, opacity: 0.2, duration: 0.3 }, 0.05)
      .from('#gaps .gap', { y: 30, opacity: 0, scale: 0.94, duration: 0.12, stagger: 0.09 }, 0.42)
      .to({}, { duration: 0.15 });
  });


  /* ================= SEQUENCE 1: scattered → connected ================= */
  const TILES = [
    { lg: 'gmail', c: '#EA4335', t: 'Email', m: '23 unread', p: 'RE: RE: FW: launch date??', f: 'Launch date confirmed · Nov 20', x: 30, y: 40, r: -4, slot: 0 },
    { lg: 'slack', c: '#4A154B', t: '#launch', m: '14 new', p: 'Who owns the vendor contract?', f: 'Vendor contract · owner Maya', x: 380, y: 6, r: 3, slot: 1 },
    { lg: 'googledrive', c: '#4285F4', t: 'Tracker_v3.xlsx', m: '5 editors', p: 'Design QA: "Done?"', f: 'Design QA · 8 of 11 screens', x: 746, y: 46, r: 4, slot: 2 },
    { lg: 'googlecalendar', c: '#4285F4', t: 'Calendar', m: '4 syncs', p: 'Launch sync (again) 16:30', f: 'Status meeting not needed', x: 10, y: 290, r: 2, slot: 3 },
    { lg: 'zoom', c: '#0B5CFF', t: 'Standup notes', m: '3 asks', p: 'Is anyone free to review?', f: 'Omar has 18 h free this week', x: 766, y: 296, r: -3, slot: 4 },
    { lg: 'hubspot', c: '#FF7A59', t: 'CRM', m: 'stale', p: 'Acme Freight: closed won?', f: 'Acme Freight · onboarding open', x: 140, y: 500, r: -2, slot: 5 },
    { lg: 'stripe', c: '#635BFF', t: 'Invoices', m: '1 overdue', p: 'Invoice 2291 · 3 days late', f: 'Invoice 2291 · reminder sent', x: 630, y: 506, r: 5, slot: 6 }
  ];
  const cx = $('#cx'), cxTiles = $('#cxTiles'), HUB = [490, 310];
  cxTiles.innerHTML = TILES.map((t, i) => `<div class="cx-tile" data-i="${i}" style="left:${t.x}px;top:${t.y}px"><div class="th"><span class="lg"><i style="--c:${t.c};--logo:url('assets/logos/${t.lg}.svg')"></i></span><b>${t.t}</b><em>${t.m}</em></div><p data-raw="${esc(t.p)}" data-filed="${esc(t.f)}">${esc(t.p)}</p></div>`).join('');
  const tileEls = $$('.cx-tile', cxTiles);
  $('#cxPaths').innerHTML = TILES.map(t => { const sx = t.x + 102, sy = t.y + 40, mx = (sx + HUB[0]) / 2 + (sy - HUB[1]) * 0.2, my = (sy + HUB[1]) / 2 - (sx - HUB[0]) * 0.12; return `<path d="M${sx} ${sy} Q${mx} ${my} ${HUB[0]} ${HUB[1]}"/>`; }).join('');
  $('#cxPulses').innerHTML = TILES.map(() => '<circle r="4" opacity="0"/>').join('');
  const cxPaths = $$('#cxPaths path'), cxDots = $$('#cxPulses circle');
  const fileTile = (el, on) => {
    el.classList.toggle('is-filed', on);
    const p = $('p', el), em = $('em', el);
    p.textContent = on ? p.dataset.filed : p.dataset.raw;
    em.textContent = on ? 'filed' : TILES[+el.dataset.i].m;
    if (motion && !cx.classList.contains('is-static')) G.fromTo([p, em], { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.04, delay: +el.dataset.i * 0.03, ease: EASE, overwrite: 'auto' });
  };
  const staticConnect = () => {
    cx.classList.add('is-static');
    tileEls.forEach((el, i) => { $(`.cxw-slot[data-slot="${TILES[i].slot}"]`).appendChild(el); fileTile(el, true); });
    $('#connectStage .fit').dataset.auto = '1';
    $$('#cxSteps li').forEach(li => li.classList.add('is-on'));
    layoutFits();
  };
  const cxSteps = $$('#cxSteps li');
  const setCxStep = p => {
    const n = Math.min(5, Math.floor(p * 6.2));
    cxSteps.forEach((li, i) => { li.classList.toggle('is-on', i === n); li.classList.toggle('is-done', i < n); });
    $('#cxMeter').style.transform = `scaleX(${p})`;
  };
  const mm = motion ? G.matchMedia() : null;
  if (!mm) staticConnect();
  mm?.add('(max-width: 960px)', () => { staticConnect(); });
  mm?.add('(min-width: 961px)', () => {
    if (cx.classList.contains('is-static')) { cx.classList.remove('is-static'); tileEls.forEach(el => { cxTiles.appendChild(el); fileTile(el, false); }); delete $('#connectStage .fit').dataset.auto; layoutFits(); }
    const lens = cxPaths.map(p => p.getTotalLength());
    cxPaths.forEach((p, i) => { p.style.strokeDasharray = lens[i]; p.style.strokeDashoffset = lens[i]; });
    // where each tile lands inside the workspace; layout offsets ignore the workspace's own scale-in
    const target = i => {
      const slot = $(`.cxw-slot[data-slot="${TILES[i].slot}"]`), tile = tileEls[i];
      const [x, y] = offIn(slot, cx);
      return [x + (slot.offsetWidth - tile.offsetWidth) / 2 - TILES[i].x, y + (slot.offsetHeight - tile.offsetHeight) / 2 - TILES[i].y];
    };
    G.set('#cxWs', { opacity: 0, scale: 0.94, y: 24 });
    const filed = { v: false };
    const tl = G.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#connect', start: 'top top', end: 'bottom bottom', scrub: 0.7, invalidateOnRefresh: true,
      onUpdate: self => {
        setCxStep(self.progress);
        const on = self.progress > 0.56;
        if (on !== filed.v) { filed.v = on; tileEls.forEach(el => fileTile(el, on)); }
        const k = (self.progress - 0.28) / 0.26;
        cxDots.forEach((d, i) => {
          if (k <= 0 || k >= 1) { d.setAttribute('opacity', 0); return; }
          const q = (k * 2.4 + i * 0.13) % 1, pt = cxPaths[i].getPointAtLength(lens[i] * q);
          d.setAttribute('cx', pt.x); d.setAttribute('cy', pt.y); d.setAttribute('opacity', 1);
        });
      } } });
    tl.fromTo(tileEls, { opacity: 0, scale: 0.8, y: (i) => (i % 2 ? -30 : 30), rotation: (i) => TILES[i].r * 2.5 }, { opacity: 1, scale: 1, y: 0, rotation: (i) => TILES[i].r, duration: 0.13, stagger: 0.013 }, 0)
      .fromTo('#cxHub', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.08 }, 0.16)
      .to(cxPaths, { strokeDashoffset: 0, duration: 0.14, stagger: 0.01 }, 0.17)
      .to(tileEls, { y: (i) => (i % 2 ? -12 : 12), duration: 0.2 }, 0.3)
      .to('#cxWs', { opacity: 1, scale: 1, y: 0, duration: 0.12 }, 0.5)
      .to(tileEls, { x: i => target(i)[0], y: i => target(i)[1], rotation: 0, duration: 0.16, stagger: 0.012, ease: 'power2.inOut' }, 0.52)
      .to(cxPaths, { opacity: 0, duration: 0.06 }, 0.56)
      .to('#cxHub', { opacity: 0, scale: 0.7, duration: 0.06 }, 0.58)
      .from('#cxFoot > span', { y: 10, opacity: 0, duration: 0.06, stagger: 0.015 }, 0.78)
      .to({}, { duration: 0.12 }, 0.88);
    return () => { cxDots.forEach(d => d.setAttribute('opacity', 0)); };
  });


  /* ================= SEQUENCE 2: product tour ================= */
  const app = $('#app'), tourArts = $$('#tourSteps article'), VIEWS = tourArts.map(a => a.dataset.v);
  const dots = $('.tour-dots');
  dots.innerHTML = VIEWS.map((v, i) => `<button type="button" aria-label="Show ${tourArts[i].querySelector('b').textContent}"></button>`).join('');
  let tourIdx = -1, tourST = null, tourChartDrawn = false;
  function setView(idx) {
    if (idx === tourIdx) return;
    tourIdx = idx;
    const v = VIEWS[idx], shown = v === 'all' ? 'all' : v;
    tourArts.forEach((a, i) => a.classList.toggle('is-on', i === idx));
    $$('button', dots).forEach((b, i) => b.classList.toggle('is-on', i === idx));
    $$('.app-nav button').forEach(b => { const on = b.dataset.v === v; b.classList.toggle('is-on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); b.classList.toggle('lit', v === 'all'); });
    $$('.views .v').forEach(el => el.classList.toggle('is-on', el.dataset.v === shown));
    $('#appCrumb').textContent = v === 'all' ? 'Everything' : tourArts[idx].querySelector('b').textContent;
    const cur = $(`.views .v[data-v="${shown}"]`);
    allvStop();
    if (v === 'all') allvIn();
    else if (motion) G.fromTo($$(':scope > * > *', cur).filter(el => !el.matches('.anm-tip')).slice(0, 12), { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.04, ease: EASE, overwrite: 'auto' });
    if (v === 'analytics' && !tourChartDrawn) { tourChartDrawn = true; drawTourChart(); }
  }
  // "All of it, connected": lines are measured from where the cards really sit, then signals run along them
  let allvTweens = [];
  function allvStop() { allvTweens.forEach(t => t.kill()); allvTweens = []; }
  function allvIn() {
    const box = $('.allv'), svg = $('.allv-lines', box), cards = $$('.allc', box), core = $('.allv-core', box);
    const W = box.clientWidth, H = box.clientHeight, hx = W / 2, hy = H / 2;
    const ends = cards.map(c => [c.offsetLeft + c.offsetWidth / 2, c.offsetTop + c.offsetHeight / 2]);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = ends.map(([x, y]) => { const mx = (x + hx) / 2 + (y - hy) * 0.12, my = (y + hy) / 2 - (x - hx) * 0.08; return `<path d="M${x} ${y} Q${mx} ${my} ${hx} ${hy}"/>`; }).join('') + ends.map(() => '<circle r="3.5" opacity="0"/>').join('');
    const paths = $$('path', svg), dots = $$('circle', svg);
    cards.forEach((c, i) => { c.onmouseenter = c.onfocus = () => paths[i].classList.add('hot'); c.onmouseleave = c.onblur = () => paths[i].classList.remove('hot'); });
    if (!motion) return;
    const lens = paths.map(p => p.getTotalLength());
    const tl = G.timeline();
    tl.fromTo(core, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.8)' }, 0)
      .fromTo(paths, { strokeDasharray: (i) => lens[i], strokeDashoffset: (i) => -lens[i] }, { strokeDashoffset: 0, duration: 0.8, stagger: 0.05, ease: 'power2.inOut' }, 0.15)
      .fromTo(cards, { x: (i) => hx - ends[i][0], y: (i) => hy - ends[i][1], scale: 0.5, opacity: 0 }, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.9, stagger: 0.05, ease: 'expo.out' }, 0.2)
      .add(() => paths.forEach(p => { p.style.strokeDasharray = ''; }));
    allvTweens.push(tl);
    // a signal leaves each card for the hub in turn, and the hub answers with a soft pulse
    dots.forEach((d, i) => {
      const o = { k: 0 };
      allvTweens.push(G.to(o, { k: 1, duration: 1.4, ease: 'power1.inOut', repeat: -1, repeatDelay: 1.6, delay: 1.1 + i * 0.5,
        onUpdate: () => { const pt = paths[i].getPointAtLength(lens[i] * o.k); d.setAttribute('cx', pt.x); d.setAttribute('cy', pt.y); d.setAttribute('opacity', o.k < 0.06 ? o.k / 0.06 : o.k > 0.92 ? (1 - o.k) / 0.08 : 1); },
        onRepeat: () => G.fromTo(core, { boxShadow: '0 0 0 10px rgba(184,243,107,.22)' }, { boxShadow: '0 0 0 10px rgba(184,243,107,0)', duration: 0.8, ease: 'power2.out' }) }));
    });
  }
  function showTourStep(idx, scroll) {
    if (tourST && scroll) {
      const y = tourST.start + (idx + 0.5) / VIEWS.length * (tourST.end - tourST.start);
      goTo(y);
    } else { setView(idx); if (scroll) goTo('#tour'); }
  }
  $$('.app-nav button').forEach(b => b.addEventListener('click', () => showTourStep(VIEWS.indexOf(b.dataset.v), !!tourST)));
  $$('button', dots).forEach((b, i) => b.addEventListener('click', () => showTourStep(i, !!tourST)));
  $$('.allc').forEach(c => c.addEventListener('click', () => showTourStep(VIEWS.indexOf(c.dataset.go), !!tourST)));
  setView(0);
  mm?.add('(min-width: 961px)', () => {
    tourST = ST.create({ trigger: '#tour', start: 'top top', end: 'bottom bottom', onUpdate: s => setView(Math.min(VIEWS.length - 1, Math.floor(s.progress * VIEWS.length))) });
    if (finePointer) {
      const stage = $('#tourStage');
      const mv = e => { const r = stage.getBoundingClientRect(); G.to(app, { rotateY: ((e.clientX - r.left) / r.width - 0.5) * 4, rotateX: -((e.clientY - r.top) / r.height - 0.5) * 3, duration: 0.8, ease: 'power3.out', overwrite: 'auto' }); };
      const lv = () => G.to(app, { rotateY: 0, rotateX: 0, duration: 1, ease: 'power3.out', overwrite: 'auto' });
      stage.addEventListener('mousemove', mv); stage.addEventListener('mouseleave', lv);
      return () => { tourST = null; stage.removeEventListener('mousemove', mv); stage.removeEventListener('mouseleave', lv); };
    }
    return () => { tourST = null; };
  });
  function drawTourChart() {
    // drawn at the box's real size so it fills the view instead of floating inside it
    const svg = $('#tourChart'), W = svg.clientWidth || 640, H = svg.clientHeight || 300;
    const cur = buckets('revenue', 84).slice(-12), prev = buckets('revenue', 84, 84).slice(-12);
    const pad = { l: 44, r: 14, t: 16, b: 26 }, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const all = [...cur, ...prev].map(c => c.v), unit = 5000;
    const lo = Math.floor(Math.min(...all) * 0.9 / unit) * unit, hi = Math.ceil(Math.max(...all) * 1.05 / unit) * unit;
    const x = i => pad.l + i / (cur.length - 1) * iw, y = v => pad.t + ih - (v - lo) / (hi - lo) * ih;
    const line = a => a.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(c.v).toFixed(1)}`).join(' ');
    const ticks = [0, 1, 2, 3].map(k => lo + (hi - lo) * k / 3), n = cur.length - 1;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '<defs><linearGradient id="tcFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B8F36B" stop-opacity=".16"/><stop offset="1" stop-color="#B8F36B" stop-opacity="0"/></linearGradient></defs>'
      + ticks.map(t => `<line class="gl" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="lb" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">$${Math.round(t / 1000)}k</text>`).join('')
      + cur.map((c, i) => i % 2 === 1 || i === n ? `<text class="lb" x="${x(i)}" y="${H - 6}" text-anchor="${i === n ? 'end' : 'middle'}">${c.short}</text>` : '').join('')
      + `<path class="pv" d="${line(prev)}"/><path class="ar" fill="url(#tcFill)" d="${line(cur)} L${x(n)} ${pad.t + ih} L${x(0)} ${pad.t + ih} Z"/><path class="ln" d="${line(cur)}"/>`
      + `<line class="vl" y1="${pad.t}" y2="${pad.t + ih}" opacity="0"/><circle class="end-ring" cx="${x(n)}" cy="${y(cur[n].v)}" r="9"/><circle class="end" cx="${x(n)}" cy="${y(cur[n].v)}" r="4.5"/>`
      + `<rect class="hit" x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
    // three figures from the same 12 weeks fill the space under the chart
    const box = svg.parentElement, best = cur.reduce((a, c) => c.v > a.v ? c : a, cur[0]);
    const tot = cur.reduce((s, c) => s + c.v, 0), dl = pctDelta(tot, prev.reduce((s, c) => s + c.v, 0));
    let foot = $('.anm-foot', box), tip = $('.anm-tip', box);
    if (!foot) { foot = document.createElement('div'); foot.className = 'anm-foot'; box.appendChild(foot); tip = document.createElement('div'); tip.className = 'anm-tip'; box.appendChild(tip); }
    foot.innerHTML = `<div><span>Best week</span><b>${money(best.v)}</b><small>${best.label}</small></div><div><span>Average week</span><b>${money(tot / cur.length)}</b><small>12-week mean</small></div><div><span>vs previous 12 weeks</span><b class="${dl >= 0 ? 'up' : 'down'}">${dl >= 0 ? '+' : ''}${dl.toFixed(1)}%</b><small>dashed line</small></div>`;
    // hover: crosshair snaps to the nearest week and the dot follows it
    const vl = $('.vl', svg), dot = $('.end', svg), ring = $('.end-ring', svg);
    const at = i => { dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(cur[i].v)); ring.setAttribute('cx', x(i)); ring.setAttribute('cy', y(cur[i].v)); };
    $('.hit', svg).addEventListener('mousemove', e => {
      const r = svg.getBoundingClientRect(), i = clamp(Math.round(((e.clientX - r.left) / r.width * W - pad.l) / iw * n), 0, n);
      at(i); vl.setAttribute('x1', x(i)); vl.setAttribute('x2', x(i)); vl.setAttribute('opacity', 1);
      tip.innerHTML = `<b>${money(cur[i].v)}</b><small>${cur[i].label} · previous ${money(prev[i].v)}</small>`;
      // SVG has no offsetTop, so measure against the box and undo the fitted scale
      const br = box.getBoundingClientRect(), k = br.width / box.offsetWidth || 1;
      tip.style.left = `${(r.left - br.left) / k + clamp(x(i) / W * r.width / k, 90, r.width / k - 90)}px`;
      tip.style.top = `${(r.top - br.top) / k + y(cur[i].v) / H * r.height / k}px`; tip.style.opacity = 1;
    });
    $('.hit', svg).addEventListener('mouseleave', () => { at(n); vl.setAttribute('opacity', 0); tip.style.opacity = 0; });
    if (motion) {
      const l = $('.ln', svg), len = l.getTotalLength();
      G.fromTo(l, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' });
      G.fromTo($('.ar', svg), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power2.inOut' });
      G.from($('.pv', svg), { opacity: 0, duration: 0.8, delay: 0.5 });
      G.from([dot, ring], { scale: 0, transformOrigin: '50% 50%', duration: 0.6, delay: 1.2, ease: 'back.out(2.5)' });
      G.from($$('div', foot), { y: 12, opacity: 0, duration: 0.7, stagger: 0.08, delay: 0.4, ease: EASE });
    }
  }

  /* ================= WORKFLOW BUILDER ================= */
  const WF = {
    onboard: { name: 'Client onboarding', input: 'Deal: Acme Freight · value $48,000',
      nodes: [
        { id: 't', k: 'Trigger', ic: 'i-target', c: 'ic-blue', t: 'Deal marked won', x: 20, y: 170, f: { App: 'CRM', Event: 'Deal stage → Won', Filter: 'Pipeline = New business' }, n: 'Starts the rule whenever a deal moves to Won in the CRM.' },
        { id: 'c', k: 'Condition', ic: 'i-branch', c: 'ic-amber', t: 'Deal value over $10k?', x: 255, y: 170, f: { Field: 'deal.value', Rule: 'greater than 10,000' }, n: 'Large deals get the full onboarding template; small ones a light checklist.' },
        { id: 'a1', k: 'Action', ic: 'i-folder', c: 'ic-blue', t: 'Create project from template', x: 540, y: 30, f: { Template: 'Onboarding · 14 tasks', Name: '{deal.company} onboarding' } },
        { id: 'a2', k: 'Action', ic: 'i-users', c: 'ic-green', t: 'Assign owner: Priya R.', x: 540, y: 125, f: { Rule: 'Ops lead with most capacity', Fallback: 'Priya R.' } },
        { id: 'a3', k: 'Action', ic: 'i-msg', c: 'ic', t: 'Post in #wins channel', x: 540, y: 220, f: { App: 'Chat', Message: 'New client: {deal.company} 🎉' } },
        { id: 'e', k: 'Else', ic: 'i-doc', c: 'ic', t: 'Light-touch checklist', x: 540, y: 330, f: { Template: 'Small client · 4 tasks' }, n: 'Used when the deal is under $10k.' }
      ],
      edges: [['t', 'c'], ['c', 'a1', 'yes'], ['c', 'a2', 'yes'], ['c', 'a3', 'yes'], ['c', 'e', 'no']],
      run: [['t', 'Deal “Acme Freight” moved to Won'], ['c', 'Value $48,000 → over $10k'], ['a1', 'Project “Acme Freight onboarding” created, 14 tasks'], ['a2', 'Priya R. assigned as owner'], ['a3', 'Posted in #wins']], skip: ['e'] },
    invoice: { name: 'Invoice follow-up', input: 'Invoice 2291 · $6,400 · 3 days overdue',
      nodes: [
        { id: 't', k: 'Trigger', ic: 'i-card', c: 'ic-blue', t: 'Invoice 3 days overdue', x: 20, y: 70, f: { App: 'Billing', Event: 'invoice.overdue', After: '3 days' } },
        { id: 'a1', k: 'Action', ic: 'i-mail', c: 'ic', t: 'Send a polite reminder', x: 290, y: 70, f: { To: '{invoice.contact}', Template: 'Friendly reminder' } },
        { id: 'w', k: 'Wait', ic: 'i-clock', c: 'ic-amber', t: 'Wait 4 days', x: 560, y: 70, f: { Duration: '4 days', 'Skip if': 'invoice paid' } },
        { id: 'c', k: 'Condition', ic: 'i-branch', c: 'ic-amber', t: 'Still unpaid?', x: 560, y: 200, f: { Field: 'invoice.status', Rule: 'is not Paid' } },
        { id: 'a2', k: 'Action', ic: 'i-users', c: 'ic-green', t: 'Task for Omar A. to call', x: 290, y: 330, f: { Assignee: 'Omar A.', Due: 'Next business day' } },
        { id: 'e', k: 'Else', ic: 'i-check', c: 'ic-green', t: 'Close the follow-up', x: 560, y: 330, f: { Action: 'Mark resolved' } }
      ],
      edges: [['t', 'a1'], ['a1', 'w'], ['w', 'c'], ['c', 'a2', 'yes'], ['c', 'e', 'no']],
      run: [['t', 'Invoice 2291 is 3 days overdue'], ['a1', 'Reminder emailed to the client contact'], ['w', 'Waited 4 days (skipped ahead in this demo)'], ['c', 'Invoice still unpaid'], ['a2', 'Task created for Omar A., due tomorrow']], skip: ['e'] },
    hire: { name: 'New hire setup', input: 'Offer signed · Sam W. · Support, starts Monday',
      nodes: [
        { id: 't', k: 'Trigger', ic: 'i-doc', c: 'ic-blue', t: 'Offer signed', x: 20, y: 170, f: { App: 'Hiring', Event: 'offer.signed' } },
        { id: 'a1', k: 'Action', ic: 'i-folder', c: 'ic-blue', t: 'First-week checklist', x: 270, y: 70, f: { Template: 'New hire · 9 tasks', Owner: 'Hiring manager' } },
        { id: 'a2', k: 'Action', ic: 'i-cal', c: 'ic', t: 'Book laptop setup', x: 270, y: 270, f: { App: 'Calendar', When: 'Day 1, 09:30' } },
        { id: 'a3', k: 'Action', ic: 'i-msg', c: 'ic', t: 'Add to team channels', x: 540, y: 170, f: { Channels: '#support, #team' } },
        { id: 'a4', k: 'Action', ic: 'i-clock', c: 'ic-amber', t: 'Remind manager on day 3', x: 540, y: 320, f: { Message: 'Check in with {hire.name}' } }
      ],
      edges: [['t', 'a1'], ['t', 'a2'], ['a1', 'a3'], ['a2', 'a3'], ['a3', 'a4']],
      run: [['t', 'Offer signed by Sam W.'], ['a1', 'Checklist created, 9 tasks'], ['a2', 'Laptop setup booked for Monday 09:30'], ['a3', 'Added to #support and #team'], ['a4', 'Reminder scheduled for Wednesday']], skip: [] }
  };
  let wfKey = 'onboard', wfRunning = false, wfSel = null;
  const wfNodesEl = $('#wfbNodes'), wfEdges = $('#wfbEdges'), wfLog = $('#wfbLog'), wfState = $('#wfbState');
  const NW = 170, NH = 58;
  const edgeD = (a, b) => {
    const sx = a.x + NW, sy = a.y + NH / 2, tx = b.x, ty = b.y + NH / 2;
    if (tx < sx) return `M${a.x + NW / 2} ${a.y + (b.y > a.y ? NH : 0)} C${a.x + NW / 2} ${(a.y + b.y + NH) / 2}, ${b.x + NW / 2} ${(a.y + b.y + NH) / 2}, ${b.x + NW / 2} ${b.y + (b.y > a.y ? 0 : NH)}`;
    const dx = Math.max(30, (tx - sx) / 2);
    return `M${sx} ${sy} C${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
  };
  function renderWF(animate) {
    const wf = WF[wfKey];
    $('#wfbName').textContent = wf.name;
    const byId = Object.fromEntries(wf.nodes.map(n => [n.id, n]));
    wfNodesEl.innerHTML = wf.nodes.map(n => `<button type="button" class="wn" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px" aria-pressed="false"><span class="ic ${n.c}">${icon(n.ic, 13)}</span><small>${n.k}</small><b>${esc(n.t)}</b></button>`).join('');
    wfEdges.innerHTML = wf.edges.map(([a, b, l], i) => { const d = edgeD(byId[a], byId[b]); const lab = l ? `<text x="${byId[b].x - 10}" y="${byId[b].y + NH / 2 - 7}" text-anchor="end">${l}</text>` : ''; return `<path id="we-${i}" data-a="${a}" data-b="${b}" d="${d}"/>${lab}`; }).join('') + '<circle class="dot" r="5" opacity="0"/>';
    $$('.wn', wfNodesEl).forEach(b => b.addEventListener('click', () => selectNode(b.dataset.id)));
    selectNode(wf.nodes[0].id);
    resetRun();
    if (animate && motion) {
      G.from($$('.wn', wfNodesEl), { y: 14, opacity: 0, duration: 0.6, stagger: 0.05, ease: EASE });
      $$('path', wfEdges).forEach(p => { const len = p.getTotalLength(); G.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.8, delay: 0.25, ease: 'power2.inOut', onComplete: () => { p.style.strokeDasharray = ''; } }); });
    }
  }
  function selectNode(id) {
    wfSel = id;
    const n = WF[wfKey].nodes.find(x => x.id === id);
    $$('.wn', wfNodesEl).forEach(b => { const on = b.dataset.id === id; b.classList.toggle('is-sel', on); b.setAttribute('aria-pressed', on); });
    $('#wfbInspector').innerHTML = `<div class="wi-h"><span class="ic ${n.c}">${icon(n.ic, 14)}</span><div><b>${esc(n.t)}</b><small>${n.k.toUpperCase()}</small></div></div>
      <div class="wi-fields">${Object.entries(n.f).map(([k, v]) => `<div class="wi-f"><span>${esc(k)}</span><code>${esc(v)}</code></div>`).join('')}</div>
      ${n.n ? `<p class="wi-note">${esc(n.n)}</p>` : ''}<p class="wi-note" style="background:var(--paper)">Sample input: ${esc(WF[wfKey].input)}</p>`;
    if (motion) G.from('#wfbInspector > *', { y: 8, opacity: 0, duration: 0.4, stagger: 0.04, ease: EASE, overwrite: 'auto' });
  }
  function resetRun() {
    wfRunning = false;
    $$('.wn', wfNodesEl).forEach(b => b.classList.remove('is-run', 'is-done', 'is-skip'));
    $$('path', wfEdges).forEach(p => p.classList.remove('is-hot', 'is-done', 'is-skip'));
    wfLog.innerHTML = '<p class="wl-empty">Run the sample to see each step execute here.</p>';
    wfState.textContent = 'Ready'; wfState.className = 'ui-chip';
    $('#wfbRun').disabled = false;
  }
  const travelEdge = (p, dur) => new Promise(res => {
    const dot = $('.dot', wfEdges), len = p.getTotalLength(), t0 = performance.now();
    p.classList.add('is-hot');
    if (!motion) { p.classList.replace('is-hot', 'is-done'); return res(); }
    const tick = t => { const k = Math.min(1, (t - t0) / dur), pt = p.getPointAtLength(len * (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y); dot.setAttribute('opacity', 1); if (k < 1) requestAnimationFrame(tick); else { dot.setAttribute('opacity', 0); p.classList.remove('is-hot'); p.classList.add('is-done'); res(); } };
    requestAnimationFrame(tick);
  });
  const logLine = (cls, text, ms) => {
    if ($('.wl-empty', wfLog)) wfLog.innerHTML = '';
    const d = document.createElement('div');
    d.className = `wl ${cls}`;
    d.innerHTML = `<time>${now()}</time><i></i><span>${esc(text)}</span><em>${ms}</em>`;
    wfLog.appendChild(d); wfLog.scrollTop = wfLog.scrollHeight;
    if (motion) G.from(d, { x: -8, opacity: 0, duration: 0.35, ease: EASE });
  };
  async function runWF() {
    if (wfRunning) return;
    resetRun();
    wfRunning = true;
    const key = wfKey, wf = WF[key];
    $('#wfbRun').disabled = true;
    wfState.textContent = 'Running · simulated'; wfState.className = 'ui-chip run';
    logLine('info', `Started with sample input: ${wf.input}`, '');
    wf.skip.forEach(id => { $(`.wn[data-id="${id}"]`, wfNodesEl)?.classList.add('is-skip'); $$(`path[data-b="${id}"]`, wfEdges).forEach(p => p.classList.add('is-skip')); });
    let total = 0;
    for (const [id, text] of wf.run) {
      if (key !== wfKey || !wfRunning) return;
      const into = $$(`path[data-b="${id}"]`, wfEdges).filter(p => !p.classList.contains('is-skip') && !p.classList.contains('is-done'));
      await Promise.all(into.map(p => travelEdge(p, 420)));
      const b = $(`.wn[data-id="${id}"]`, wfNodesEl);
      b.classList.add('is-run'); selectNode(id);
      const ms = 180 + Math.round(Math.random() * 420); total += ms;
      await sleep(motion ? 520 : 0);
      if (key !== wfKey || !wfRunning) return;
      b.classList.replace('is-run', 'is-done');
      if (motion) G.fromTo(b, { scale: 1.07 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' });
      logLine('', text, `${ms} ms`);
    }
    wf.skip.forEach(id => logLine('skip', `Skipped: ${WF[key].nodes.find(n => n.id === id).t}`, ''));
    wfState.textContent = `Completed in ${(total / 1000).toFixed(1)} s · simulated`; wfState.className = 'ui-chip done';
    $('#wfbRun').disabled = false; wfRunning = false;
  }
  $('#wfbRun').addEventListener('click', runWF);
  $('#wfbReset').addEventListener('click', () => { resetRun(); selectNode(WF[wfKey].nodes[0].id); });
  $$('#wfbTabs button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.wf === wfKey) return;
    wfKey = b.dataset.wf; wfRunning = false;
    $$('#wfbTabs button').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b); });
    renderWF(true);
  }));
  renderWF(false);
  whenSeen($('.wfb-app'), () => renderWF(true), 0.3);

  /* ================= COPILOT ================= */
  const roster = { maya: ['MO', 'av-1', 'Maya O.'], omar: ['OA', 'av-5', 'Omar A.'], lena: ['LK', 'av-2', 'Lena K.'], priya: ['PR', 'av-3', 'Priya R.'], jonas: ['JT', 'av-4', 'Jonas T.'] };
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dueRe = /\b(?:by|on|due)?\s*(today|tonight|tomorrow|(next\s+)?(mon|tue|wed|thu|fri|sat|sun)(?:day|s|sday|nesday|rsday|r|rs|urday)?)\b/i;
  const dueOf = m => {
    if (!m) return null;
    const w = m[1].toLowerCase();
    let add = w === 'tomorrow' ? 1 : (w === 'today' || w === 'tonight') ? 0 : (dayNames.indexOf(m[3].toLowerCase()) - today.getDay() + 7) % 7 + (m[2] ? 7 : 0);
    const d = new Date(today); d.setDate(d.getDate() + add);
    return { label: add === 0 ? 'Today' : add === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), soon: add <= 2 };
  };
  const parseTask = raw => {
    let s = raw.replace(/^[\s\-*•]+/, '').trim();
    if (!s) return null;
    let owner = null;
    for (const k of Object.keys(roster)) { const re = new RegExp(`(^${k}\\s*(?::|to|will|-)?\\s+|,?\\s*\\b${k}\\b,?)`, 'i'); if (re.test(s)) { owner = roster[k]; s = s.replace(re, ' '); break; } }
    const dm = s.match(dueRe), due = dueOf(dm);
    if (dm) s = s.replace(dm[0], ' ');
    const hi = /!!|urgent|asap|overdue/i.test(s);
    s = s.replace(/!+/g, ' ').replace(/\b(asap|urgent)\b/ig, ' ').replace(/^\s*(need(s)?|todo|to)\s+/i, '').replace(/\s{2,}/g, ' ').replace(/[\s,;:.]+$/, '').replace(/^[\s,;:]+/, '').trim();
    if (s.split(' ').length < 2) return null;
    return { title: s[0].toUpperCase() + s.slice(1), owner, due, hi };
  };
  const last7 = { rev: periodValue('revenue', 7), revPrev: periodValue('revenue', 7, 7), runs: periodValue('runs', 7), ontime: periodValue('ontime', 7) };
  const ANSWERS = {
    risk: () => ({ text: 'Two of the four projects need attention this week. <b>Q4 product launch</b> is at risk: Design QA has 3 screens left and the launch email waits on it. <b>Support hiring</b> is behind, with interviews booked past the target date.', card: `<div class="card">${[['Q4 product launch', 62, 'var(--warn)', 'At risk'], ['Support hiring', 30, 'var(--bad)', 'Behind'], ['Website relaunch', 42, 'var(--aqua)', 'On track'], ['Acme Freight onboarding', 88, 'var(--aqua)', 'On track']].map(r => `<div class="card-row"><span>${r[0]}</span><span class="bar" style="--c:${r[2]}"><i style="width:${r[1]}%"></i></span><small>${r[3]}</small></div>`).join('')}</div>`, src: ['Design QA task', 'Launch timeline', 'Hiring board'] }),
    load: () => ({ text: '<b>Priya R.</b> is booked for 37 hours across 3 projects, about 92% of capacity. <b>Omar A.</b> has the most room at 18 hours. Moving “Pricing page build” from Priya to Omar would bring her to roughly 78%.', card: `<div class="card">${[['Priya R.', 92, 'var(--warn)', '37 h'], ['Lena K.', 70, 'var(--lime)', '28 h'], ['Maya O.', 58, 'var(--lime)', '23 h'], ['Jonas T.', 50, 'var(--lime)', '20 h'], ['Omar A.', 45, 'var(--aqua)', '18 h']].map(r => `<div class="card-row"><span>${r[0]}</span><span class="bar" style="--c:${r[2]}"><i style="width:${r[1]}%"></i></span><small>${r[3]}</small></div>`).join('')}<div class="card-act"><button class="ui-btn ui-btn-primary" type="button" data-cp-act="Reassignment drafted in this demo. Nothing changed for real.">Draft the move</button><button class="ui-btn" type="button" data-cp-act="Kept as is.">Keep as is</button></div></div>`, src: ['Calendars', 'Task estimates'] }),
    week: () => { const d = pctDelta(last7.rev, last7.revPrev); return { text: `In the last 7 days the workspace recognised <b>${money(last7.rev)}</b> in revenue, ${d >= 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(1)}% on the week before. On-time delivery averaged <b>${last7.ontime.toFixed(1)}%</b> and automations ran <b>${fmt(last7.runs)}</b> times. One blocker remains: Design QA on the launch.`, card: '', src: ['Analytics', 'Automation log', 'Q4 launch'] }; },
    auto: q => {
      const m = q.match(/when (.+?),\s*(.+)$/i);
      const trig = m ? m[1] : 'an invoice is 3 days overdue';
      const acts = (m ? m[2] : 'remind the client and tell Omar').split(/\s*(?:,| and | then )\s*/i).filter(Boolean);
      return { text: 'Here is a draft rule. Check it reads the way you meant before turning it on.', card: `<div class="card"><div class="rule-card"><div class="rc"><span>When</span><b>${esc(trig)}</b></div>${acts.map((a, i) => `<div class="rc"><span>${i ? 'Then' : 'Do'}</span><span style="text-transform:none;font-family:var(--f);color:var(--text)">${esc(a[0].toUpperCase() + a.slice(1))}</span></div>`).join('')}</div><div class="card-act"><button class="ui-btn ui-btn-primary" type="button" data-cp-act="Draft saved in this demo only. In the product it would wait for approval.">Save as draft</button><button class="ui-btn" type="button" data-go-wf>Open in builder</button></div></div>`, src: ['Automation templates'] };
    },
    notes: q => {
      const body = q.replace(/^.*?(tasks?|notes?)\s*[:\-]?\s*/i, '');
      const lines = body.split(/\n|;/).map(parseTask).filter(Boolean);
      if (!lines.length) return null;
      const owners = new Set(lines.filter(l => l.owner).map(l => l.owner[0]));
      return { text: `I found <b>${lines.length} task${lines.length > 1 ? 's' : ''}</b> with ${owners.size} owner${owners.size === 1 ? '' : 's'}. Items marked urgent are flagged.`, card: `<div class="card">${lines.map(l => `<div class="task-row"><span class="t"><i class="flag${l.hi ? ' hi' : ''}"></i><span>${esc(l.title)}</span></span>${l.owner ? `<span class="av ${l.owner[1]}" title="${l.owner[2]}">${l.owner[0]}</span>` : '<span class="av av-none" title="No owner">?</span>'}<span class="due${l.due?.soon ? ' soon' : ''}">${l.due ? l.due.label : 'No date'}</span></div>`).join('')}<div class="card-act"><button class="ui-btn ui-btn-primary" type="button" data-cp-act="Tasks added to the demo board only.">Add to Q4 launch</button></div></div>`, src: ['Your notes'] };
    },
    fallback: () => ({ text: 'This demo answers a fixed set of questions about the sample workspace, so I can’t answer that one. Try asking which projects are at risk, who is overloaded, to summarise the week, to turn notes into tasks, or to draft an automation starting with “when…”.', card: '', src: [] })
  };
  const route = q => {
    const s = q.toLowerCase();
    if (/\bwhen\b.+,/.test(s) || /automat|create a rule|draft a rule/.test(s)) return ANSWERS.auto(q);
    if (/(tasks?|notes?)\s*[:\-]|\n/.test(q) || Object.keys(roster).some(k => new RegExp(`\\b${k}\\b`, 'i').test(s) && dueRe.test(s))) { const r = ANSWERS.notes(q); if (r) return r; }
    if (/risk|late|behind|slip|block/.test(s)) return ANSWERS.risk();
    if (/overload|workload|capacity|busy|who has room|free/.test(s)) return ANSWERS.load();
    if (/summar|week|happened|update|last 7/.test(s)) return ANSWERS.week();
    return ANSWERS.fallback();
  };
  const chatLog = $('#chatLog'), chatIn = $('#chatIn'), sendBtn = $('.send');
  let chatBusy = false;
  const greet = () => { chatLog.innerHTML = `<div class="msg ai"><span class="ic ic-amber">${icon('i-spark', 12)}</span><div class="bubble"><p>Hi Priya. I can see 4 projects, 5 people and 3 active rules in the Northbeam sample workspace. Ask me something, or pick a suggestion below.</p></div></div>`; };
  greet();
  const scrollChat = () => { chatLog.scrollTop = chatLog.scrollHeight; };
  async function ask(q) {
    q = q.trim();
    if (!q || chatBusy) return;
    chatBusy = true; sendBtn.disabled = true; chatLog.setAttribute('aria-busy', 'true');
    $$('#chatSugg button').forEach(b => { b.disabled = true; });
    const me = document.createElement('div');
    me.className = 'msg me';
    me.innerHTML = `<div class="bubble">${esc(q)}</div>`;
    chatLog.appendChild(me); scrollChat();
    const ai = document.createElement('div');
    ai.className = 'msg ai';
    ai.innerHTML = `<span class="ic ic-amber">${icon('i-spark', 12)}</span><div class="bubble"><span class="thinking" aria-label="Copilot is thinking"><i></i><i></i><i></i></span><p class="status-line">Reading the sample workspace…</p></div>`;
    chatLog.appendChild(ai); scrollChat();
    await sleep(motion ? 800 + Math.random() * 500 : 50);
    const a = route(q), bubble = $('.bubble', ai);
    bubble.innerHTML = '<p class="ans"></p>';
    const p = $('.ans', bubble), plain = a.text.replace(/<[^>]+>/g, '');
    if (motion) { p.classList.add('typing'); for (let i = 0; i < plain.length; i += 4) { p.textContent = plain.slice(0, i); if (i % 40 === 0) scrollChat(); await sleep(14); } p.classList.remove('typing'); }
    p.innerHTML = a.text;
    if (a.card) { bubble.insertAdjacentHTML('beforeend', a.card); if (motion) G.from($('.card', bubble), { y: 10, opacity: 0, duration: 0.5, ease: EASE }); }
    if (a.src.length) bubble.insertAdjacentHTML('beforeend', `<div class="sources">${a.src.map(s => `<span>${esc(s)}</span>`).join('')}</div>`);
    $$('.card-row .bar i', bubble).forEach(el => { const w = el.style.width; if (motion) { el.style.width = '0'; requestAnimationFrame(() => { el.style.transition = 'width 1s cubic-bezier(.22,1,.36,1)'; el.style.width = w; }); } });
    scrollChat();
    chatBusy = false; chatLog.setAttribute('aria-busy', 'false');
    sendBtn.disabled = !chatIn.value.trim();
    $$('#chatSugg button').forEach(b => { b.disabled = false; });
  }
  const autosize = () => { chatIn.style.height = 'auto'; chatIn.style.height = `${Math.min(120, chatIn.scrollHeight)}px`; };
  chatIn.addEventListener('input', () => { sendBtn.disabled = !chatIn.value.trim() || chatBusy; autosize(); });
  chatIn.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatForm').requestSubmit(); } });
  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); const q = chatIn.value; if (!q.trim() || chatBusy) return; chatIn.value = ''; autosize(); ask(q); });
  $$('#chatSugg button').forEach(b => b.addEventListener('click', () => ask(b.dataset.prompt)));
  $('#chatClear').addEventListener('click', () => { if (chatBusy) return; greet(); chatIn.focus(); });
  chatLog.addEventListener('click', e => {
    const b = e.target.closest('[data-cp-act]');
    if (b) { toast(b.dataset.cpAct, 'i-spark'); b.closest('.card-act').innerHTML = `<span class="ui-chip">${esc(b.textContent)}</span>`; }
    if (e.target.closest('[data-go-wf]')) { $('[data-wf="invoice"]').click(); goTo('#workflows'); }
  });

  /* ================= ANALYTICS ================= */
  const an = { m: 'revenue', r: 30, t: 'line' };
  const anChart = $('#anChart'), anTip = $('#anTip');
  const PROJ = [['Q4 product launch', 'var(--lime)'], ['Website relaunch', 'var(--warn)'], ['Acme Freight onboarding', 'var(--aqua)'], ['Support and retainers', '#C4C5C9']];
  const SHARE = { revenue: [0.31, 0.22, 0.29, 0.18], runs: [0.26, 0.41, 0.33, 0] };
  const OFFSET = { ontime: [-6.4, 1.8, 3.4, 1.2], cycle: [1.4, -0.3, -0.9, -0.2] };
  function renderKpis() {
    $('#anKpis').innerHTML = Object.entries(METRICS).map(([k, M]) => {
      const v = periodValue(k, an.r), pv = periodValue(k, an.r, an.r);
      const d = M.agg === 'sum' || k === 'revenue' ? pctDelta(v, pv) : v - pv;
      const good = M.better === 'up' ? d >= 0 : d <= 0;
      const dTxt = k === 'ontime' ? `${d >= 0 ? '+' : ''}${d.toFixed(1)} pts` : k === 'cycle' ? `${d >= 0 ? '+' : ''}${d.toFixed(1)} d` : `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
      return `<div data-k="${k}"><span>${M.label}</span><b data-v="${v}">${M.format(v)}</b><em class="${good ? 'up' : 'down'}">${dTxt} vs previous ${an.r === 365 ? '12 months' : an.r + ' days'}</em></div>`;
    }).join('');
    // figures count from their previous value to the new one, so a range change reads as a change
    $$('#anKpis b').forEach(b => {
      const k = b.parentElement.dataset.k, to = +b.dataset.v;
      if (motion && kpiWas[k] !== undefined && kpiWas[k] !== to) { b._shown = kpiWas[k]; countTo(b, to, { format: METRICS[k].format, dur: 0.9 }); }
      kpiWas[k] = to;
    });
  }
  const kpiWas = {};
  function renderSide() {
    const M = METRICS[an.m], v = periodValue(an.m, an.r);
    let rows;
    // totals are split into whole units (largest remainder), so the parts always add up to the headline figure
    const split = (total, shares) => {
      const raw = shares.map(s => total * s), out = raw.map(Math.floor);
      let left = Math.round(total) - out.reduce((a, b) => a + b, 0);
      raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0 && shares[i] > 0) { out[i]++; left--; } });
      return out;
    };
    if (SHARE[an.m]) { const parts = split(v, SHARE[an.m]); rows = PROJ.map((p, i) => [p[0], p[1], parts[i], SHARE[an.m][i]]).filter(r => r[3] > 0); }
    else rows = PROJ.map((p, i) => [p[0], p[1], v + OFFSET[an.m][i], (v + OFFSET[an.m][i]) / (an.m === 'ontime' ? 100 : 8)]);
    const b = buckets(an.m, an.r), best = b.reduce((a, x) => (M.better === 'up' ? x.v > a.v : x.v < a.v) ? x : a, b[0]);
    const unit = an.r <= 30 ? 'day' : an.r === 90 ? 'week' : 'month';
    const totalRow = `<div class="bd bd-total"><i></i><span>${M.agg === 'sum' ? 'Total, all projects' : 'Average, all projects'}</span><b>${M.format(v)}</b></div>`;
    $('#anSide').innerHTML = `<h3>By project</h3>${rows.map(r => `<div class="bd"><i class="pd" style="background:${r[1]}"></i><span>${r[0]}</span><b>${M.format(r[2])}</b><span class="bd-bar"><i style="background:${r[1]};transform:scaleX(${clamp(r[3], 0.04, 1)})"></i></span></div>`).join('')}${totalRow}<div class="an-insight"><b>${icon('i-spark', 13)}Insight</b>Best ${unit} in this range: ${best.label} at ${M.format(best.v)}.</div>`;
    if (motion) G.from('#anSide .bd-bar i', { scaleX: 0, duration: 0.9, stagger: 0.06, ease: EASE });
  }
  let lastShape = null;
  function renderChart(animate = true) {
    const W = anChart.clientWidth, H = anChart.clientHeight;
    if (!W) return;
    const M = METRICS[an.m], cur = buckets(an.m, an.r), prev = buckets(an.m, an.r, an.r).slice(-cur.length);
    const pad = { l: 52, r: 8, t: 12, b: 28 }, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const all = [...cur, ...prev].map(x => x.v);
    // round axis steps (1, 2 or 5 times a power of ten) so every gridline gets a distinct, readable label
    const lo0 = an.m === 'revenue' || an.m === 'runs' ? 0 : Math.min(...all) * 0.97, raw = (Math.max(...all) * 1.04 - lo0) / 4;
    const p10 = Math.pow(10, Math.floor(Math.log10(raw))), stepV = Math.max(an.m === 'runs' ? 1 : 0, [1, 2, 5, 10].map(m => m * p10).find(s => s >= raw));
    let min = Math.floor(lo0 / stepV) * stepV, max = min + stepV * 4;
    if (max < Math.max(...all)) max += stepV;
    if (an.m === 'ontime' && max > 100) max = 100; // a percentage can't pass 100
    const y = v => pad.t + ih - (v - min) / (max - min) * ih;
    const n = cur.length, step = iw / n;
    const x = i => an.t === 'bar' ? pad.l + step * (i + 0.5) : pad.l + (n === 1 ? iw / 2 : i / (n - 1) * iw);
    const ticks = Array.from({ length: Math.round((max - min) / stepV) + 1 }, (_, k) => min + stepV * k);
    const every = Math.ceil(n / 7);
    let svg = ticks.map(t => `<line class="gl" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="lb" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${M.axis(t)}</text>`).join('');
    svg += cur.map((c, i) => i % every === 0 || i === n - 1 ? `<text class="lb" x="${x(i)}" y="${H - 8}" text-anchor="middle">${c.short}</text>` : '').join('');
    if (an.t === 'line') {
      const d = a => a.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(c.v).toFixed(1)}`).join(' ');
      svg += `<path class="pv" d="${d(prev)}"/><path class="ar" d="${d(cur)} L${x(n - 1)} ${pad.t + ih} L${x(0)} ${pad.t + ih} Z"/><path class="ln" d="${d(cur)}"/><line class="vl" y1="${pad.t}" y2="${pad.t + ih}" opacity="0"/><circle class="hd" r="5" opacity="0"/>`;
    } else {
      // previous period sits beside the current one, thinner and muted
      const bw = Math.max(3, step * 0.7), pw = bw * 0.38, cw = bw * 0.56, rx = Math.min(3, cw / 3);
      svg += cur.map((c, i) => { const l = x(i) - bw / 2, pv = prev[i]?.v ?? min; return `<rect class="br pv" x="${l}" y="${y(pv)}" width="${pw}" height="${pad.t + ih - y(pv)}" rx="${rx}"/><rect class="br" data-i="${i}" x="${l + bw - cw}" y="${y(c.v)}" width="${cw}" height="${pad.t + ih - y(c.v)}" rx="${rx}"/>`; }).join('');
    }
    svg += `<rect x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent" class="hit"/>`;
    anTip.style.opacity = 0;
    anChart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${M.label}, ${an.r === 365 ? 'last 12 months' : 'last ' + an.r + ' days'}">${svg}</svg>`;
    anChart.appendChild(anTip);
    const s = $('svg', anChart);
    // same chart type and point count as before: reshape from the old values instead of redrawing
    const shape = an.t === 'line' ? { t: 'line', n, W, H, d: ['ln', 'ar', 'pv'].map(c => $('.' + c, s).getAttribute('d')) } : { t: 'bar', n, W, H, bars: $$('.br', s).map(b => [b.getAttribute('y'), b.getAttribute('height')]) };
    const morph = animate && motion && lastShape && lastShape.t === shape.t && lastShape.n === n && lastShape.W === W && lastShape.H === H;
    if (morph && shape.t === 'line') ['ln', 'ar', 'pv'].forEach((c, k) => G.from($('.' + c, s), { attr: { d: lastShape.d[k] }, duration: 0.85, ease: 'power3.inOut' }));
    else if (morph) $$('.br', s).forEach((b, k) => G.from(b, { attr: { y: lastShape.bars[k][0], height: lastShape.bars[k][1] }, duration: 0.75, delay: k * Math.min(0.012, 0.3 / n), ease: 'power3.inOut' }));
    else if (animate && motion) {
      if (an.t === 'line') { const l = $('.ln', s), len = l.getTotalLength(); G.fromTo(l, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }); G.from($('.ar', s), { opacity: 0, duration: 0.8 }); G.from($('.pv', s), { opacity: 0, duration: 0.8, delay: 0.3 }); }
      else G.from($$('.br:not(.pv)', s), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.8, stagger: Math.min(0.03, 0.6 / n), ease: EASE });
    }
    lastShape = shape;
    const hit = $('.hit', s);
    const show = e => {
      const r = s.getBoundingClientRect(), mx = e.clientX - r.left;
      const i = clamp(Math.round(an.t === 'bar' ? (mx - pad.l) / step - 0.5 : (mx - pad.l) / iw * (n - 1)), 0, n - 1);
      const c = cur[i], pv = prev[i];
      if (an.t === 'line') { const vl = $('.vl', s), hd = $('.hd', s); vl.setAttribute('x1', x(i)); vl.setAttribute('x2', x(i)); vl.setAttribute('opacity', 1); hd.setAttribute('cx', x(i)); hd.setAttribute('cy', y(c.v)); hd.setAttribute('opacity', 1); }
      else $$('.br:not(.pv)', s).forEach((b, k) => b.classList.toggle('hl', k === i));
      anTip.innerHTML = `<b>${M.format(c.v)}</b><small>${c.label}${pv ? ` · previous ${M.format(pv.v)}` : ''}</small>`;
      anTip.style.left = `${clamp(x(i), 90, W - 90)}px`; anTip.style.top = `${y(c.v)}px`; anTip.style.opacity = 1;
    };
    hit.addEventListener('mousemove', show);
    hit.addEventListener('mouseleave', () => { anTip.style.opacity = 0; $('.vl', s)?.setAttribute('opacity', 0); $('.hd', s)?.setAttribute('opacity', 0); $$('.br', s).forEach(b => b.classList.remove('hl')); });
  }
  const renderAn = (animate = true) => { renderKpis(); renderSide(); renderChart(animate); $$('#anKpis > div').forEach(d => d.classList.toggle('is-on', d.dataset.k === an.m)); };
  $$('#anMetric button').forEach(b => b.addEventListener('click', () => { an.m = b.dataset.m; setSeg($('#anMetric'), b); renderAn(); }));
  $$('#anRange button').forEach(b => b.addEventListener('click', () => { an.r = +b.dataset.r; setSeg($('#anRange'), b); renderAn(); }));
  $$('#anType button').forEach(b => b.addEventListener('click', () => { an.t = b.dataset.t; setSeg($('#anType'), b); renderChart(); }));
  let anDrawn = false, anW = 0;
  whenSeen($('.an'), () => { anDrawn = true; renderAn(); }, 0.15);
  new ResizeObserver(() => { if (anDrawn && Math.abs(anChart.clientWidth - anW) > 4) { anW = anChart.clientWidth; renderChart(false); } }).observe(anChart);

  /* ================= SOLUTIONS ================= */
  const CASES = [
    { t: 'Studios and agencies', p: 'Client projects, approvals and billing usually live in three tools. In VELTRIX a project carries its tasks, its approvals and the invoices it produces.', w: ['Project boards per client with approval steps', 'Time and budget tracked against each phase', 'Invoices drafted when a milestone is approved'], r: '<b>When</b> a client approves a phase, <b>then</b> draft the phase invoice and open the next phase’s tasks.', m: ['Projects', 'Automations', 'Analytics'] },
    { t: 'Client services', p: 'Onboarding, requests and renewals follow the same steps every time, which makes them ideal for rules instead of reminders.', w: ['Onboarding projects opened from the CRM', 'Requests routed to whoever has capacity', 'Renewal tasks created ahead of the date'], r: '<b>When</b> a deal is won, <b>then</b> open the onboarding project, assign an owner and book the kickoff.', m: ['Automations', 'Team', 'Integrations'] },
    { t: 'Operations teams', p: 'Recurring operational work, from month-end to vendor reviews, runs on checklists that somebody has to remember. VELTRIX runs them on a schedule and reports back.', w: ['Recurring checklists on a schedule', 'Escalations when steps are late', 'A weekly summary written from what changed'], r: '<b>Every</b> month-end, <b>then</b> create the close checklist and tell finance which items are blocked.', m: ['Automations', 'Copilot', 'Analytics'] },
    { t: 'Field and logistics', p: 'Jobs, crews and invoices move fast and change often. One workspace keeps the schedule, the people and the billing in step.', w: ['Jobs scheduled against crew availability', 'Status updates from the field into one board', 'Invoices raised the day a job closes'], r: '<b>When</b> a job is marked complete, <b>then</b> raise the invoice and update the customer.', m: ['Projects', 'Team', 'Automations'] }
  ];
  let caseIdx = -1;
  // each use case is a live scene: the old one lifts away, the new one lands card by card,
  // its checks tick, the connector draws from cause to result and the figures count up
  const scenes = $$('#caseScenes .cscene');
  const fmtCount = (el, v) => { el.textContent = el.dataset.fmt === 'usd' ? '$' + Math.round(v).toLocaleString('en-US') : String(Math.round(v)); };
  function playScene(i, prev) {
    const next = scenes[i], old = scenes[prev];
    if (!motion) { scenes.forEach((s, k) => s.classList.toggle('is-on', k === i)); return; }
    if (old && old !== next) G.to($$('.sc-card', old), { y: -28, opacity: 0, scale: 0.97, duration: 0.35, stagger: 0.04, ease: 'power2.in', overwrite: true, onComplete: () => { if (scenes[caseIdx] === old) return; old.classList.remove('is-on'); G.set($$('.sc-card', old), { clearProps: 'transform,opacity,boxShadow' }); } });
    const delay = old && old !== next ? 0.3 : 0;
    G.delayedCall(delay, () => {
      if (scenes[caseIdx] !== next) return;
      G.killTweensOf($$('.sc-card', next));
      next.classList.add('is-on');
      const cards = $$('.sc-card', next), link = $('.sc-link path', next), len = link.getTotalLength();
      const tl = G.timeline({ defaults: { ease: EASE } });
      tl.fromTo(cards, { y: 46, opacity: 0, rotate: k => (k % 2 ? 2.5 : -2.5), scale: 0.95 }, { y: 0, opacity: 1, rotate: 0, scale: 1, duration: 0.9, stagger: 0.12 }, 0)
        .fromTo($$('.sc-row', next), { x: -10, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, stagger: 0.05 }, 0.25)
        .fromTo($$('.sc-chk.on, .sc-chk.bad', next), { scale: 0 }, { scale: 1, duration: 0.45, stagger: 0.08, ease: 'back.out(3)' }, 0.45)
        .fromTo(link, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' }, 0.5)
        .fromTo($$('.sc-job', next), { scaleX: 0 }, { scaleX: 1, transformOrigin: '0% 50%', duration: 0.7, stagger: 0.05, ease: 'power3.out' }, 0.3)
        .fromTo($$('.sc-grow', next), { width: '0%' }, { width: '60%', duration: 1, ease: 'power3.out' }, 0.5)
        .fromTo($$('.sc-arc', next), { attr: { 'stroke-dashoffset': 263.9 } }, { attr: { 'stroke-dashoffset': 94 }, duration: 1.2, ease: 'power3.out' }, 0.4)
        .fromTo($$('.sc-card.hot', next), { boxShadow: '0 0 0 1px rgba(184,243,107,0), 0 0 0px rgba(184,243,107,0)' }, { boxShadow: '0 0 0 1px rgba(184,243,107,.55), 0 0 40px rgba(184,243,107,.18)', duration: 0.8, ease: 'power2.out' }, 0.9);
      $$('[data-count]', next).forEach(el => { const o = { v: 0 }; tl.to(o, { v: +el.dataset.count, duration: 1.1, ease: 'power3.out', onUpdate: () => fmtCount(el, o.v) }, 0.6); });
    });
  }
  function selectCase(i) {
    if (i === caseIdx) return;
    const prev = caseIdx; caseIdx = i;
    $$('#casesList button').forEach((b, k) => { b.classList.toggle('is-on', k === i); b.setAttribute('aria-selected', k === i); b.tabIndex = k === i ? 0 : -1; });
    playScene(i, prev);
    const c = CASES[i], body = $('#caseBody');
    const fill = () => { body.innerHTML = `<h3>${c.t}</h3><p>${c.p}</p><div class="case-block"><h4>What it organises</h4><ul class="case-list">${c.w.map(x => `<li>${x}</li>`).join('')}</ul></div><div class="case-block"><h4>Example automation</h4><p class="case-rule">${c.r}</p></div><div class="case-mods">${c.m.map(x => `<span class="tg tg-blue">${x}</span>`).join('')}</div>`; };
    if (prev < 0 || !motion) return fill();
    body.classList.add('is-swap');
    setTimeout(() => { fill(); requestAnimationFrame(() => body.classList.remove('is-swap')); }, 260);
  }
  $$('#casesList button').forEach((b, k) => b.addEventListener('click', () => selectCase(k)));
  $('#casesList').addEventListener('keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const n = (caseIdx + (/Down|Right/.test(e.key) ? 1 : -1) + CASES.length) % CASES.length;
    selectCase(n); $$('#casesList button')[n].focus();
  });
  selectCase(0);
  // hidden case photos are clipped, so lazy loading never starts them: fetch all four once the section is near

  /* ================= INTEGRATIONS ================= */
  const CATS = { all: 'All', comms: 'Communication', sales: 'CRM and sales', finance: 'Finance', eng: 'Engineering', docs: 'Docs and files', people: 'People' };
  const APPS = [
    // [name, category, official brand colour, sync examples, logo file in assets/logos (Simple Icons, CC0)]
    ['Slack', 'comms', '#4A154B', ['New tasks from messages', 'Rule notifications in channels', 'Status updates posted to threads'], 'slack'],
    ['Google Meet', 'comms', '#00897B', ['Meeting notes into tasks', 'Calls added to project timelines'], 'googlemeet'],
    ['Gmail', 'comms', '#EA4335', ['Turn an email into a task', 'Send templated replies from rules'], 'gmail'],
    ['Zoom', 'comms', '#0B5CFF', ['Meeting notes into tasks', 'Kickoff calls booked by rules'], 'zoom'],
    ['HubSpot', 'sales', '#FF7A59', ['Deal stages trigger rules', 'Company and contact sync', 'Projects linked to deals'], 'hubspot'],
    ['Salesforce', 'sales', '#00A1E0', ['Opportunities and accounts', 'Owner mapping'], 'salesforce'],
    ['Zoho CRM', 'sales', '#E42527', ['Pipeline stages trigger rules'], 'zoho'],
    ['Stripe', 'finance', '#635BFF', ['Payments close milestones', 'Revenue for analytics'], 'stripe'],
    ['QuickBooks', 'finance', '#2CA01C', ['Invoices drafted from projects', 'Payment status sync'], 'quickbooks'],
    ['Xero', 'finance', '#13B5EA', ['Invoices and bills', 'Budget tracking'], 'xero'],
    ['GitHub', 'eng', '#181717', ['Pull requests linked to tasks', 'Deploys update project status'], 'github'],
    ['Jira', 'eng', '#0052CC', ['Two-way issue sync', 'Sprint dates on timelines'], 'jira'],
    ['Linear', 'eng', '#5E6AD2', ['Issues and cycles in one view'], 'linear'],
    ['Google Drive', 'docs', '#4285F4', ['Files attached to tasks', 'Folders created per project'], 'googledrive'],
    ['Notion', 'docs', '#000000', ['Docs linked to projects'], 'notion'],
    ['Figma', 'docs', '#F24E1E', ['Frames attached to design tasks'], 'figma'],
    ['Google Calendar', 'people', '#4285F4', ['Deadlines on calendars', 'Availability for workload'], 'googlecalendar'],
    ['Greenhouse', 'people', '#24A47F', ['Offers trigger onboarding rules'], 'greenhouse']
  ];
  // Connector status. Nothing is confirmed yet, so every tool is 'illustrative'. When a connector ships, add
  // 'available' or 'planned' as a sixth field on its row above and the tiles, legend and detail panel update.
  const STATUS = { available: ['Available', 'Live and supported today.'], planned: ['Planned', 'On the roadmap; not available yet.'], illustrative: ['Illustrative', 'Shown to explain the kind of tool VELTRIX is designed to connect. Not confirmed as available.'] };
  const stOf = a => a[5] || 'illustrative';
  let intCat = 'all', intSel = 0;
  const logo = a => `<span class="int-logo" aria-hidden="true"><i class="${['zoom', 'zoho'].includes(a[4]) ? 'wide' : ''}" style="--c:${a[2]};--logo:url('assets/logos/${a[4]}.svg')"></i></span>`;
  $('#intCats').innerHTML = Object.entries(CATS).map(([k, l]) => `<button type="button" data-cat="${k}" aria-pressed="${k === 'all'}" class="${k === 'all' ? 'is-on' : ''}">${l}<span>${k === 'all' ? APPS.length : APPS.filter(a => a[1] === k).length}</span></button>`).join('');
  function renderInt(animate = true) {
    const q = $('#intQ').value.trim().toLowerCase();
    const list = APPS.map((a, i) => [a, i]).filter(([a]) => (intCat === 'all' || a[1] === intCat) && (!q || a[0].toLowerCase().includes(q) || a[3].join(' ').toLowerCase().includes(q)));
    $('#intTiles').innerHTML = list.map(([a, i]) => `<li><button type="button" data-i="${i}" aria-pressed="${i === intSel}">${logo(a)}<span><b>${a[0]}</b><small>${CATS[a[1]]}</small><em class="st st-${stOf(a)}">${STATUS[stOf(a)][0]}</em></span></button></li>`).join('');
    $('#intEmpty').hidden = list.length > 0;
    if (list.length && !list.some(([, i]) => i === intSel)) showInt(list[0][1]);
    if (animate && motion) G.from('#intTiles li', { y: 14, opacity: 0, duration: 0.5, stagger: 0.025, ease: EASE });
  }
  function showInt(i) {
    intSel = i;
    const a = APPS[i];
    $$('#intTiles button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.i === i));
    const st = stOf(a);
    $('#intDetail').innerHTML = `<div class="id-h">${logo(a)}<div><b>${a[0]}</b><small>${CATS[a[1]]}</small></div></div><p class="id-status st-${st}"><em class="st st-${st}">${STATUS[st][0]}</em>${STATUS[st][1]}</p><h4 class="id-h4">${st === 'available' ? 'What it syncs' : 'What a connector like this would sync'}</h4><ul class="id-sync">${a[3].map(s => `<li>${icon('i-check', 13)}<span>${s}</span></li>`).join('')}</ul><p class="id-note">${a[0]} is a trademark of its owner. Shown for illustration; no partnership is implied.</p>`;
    if (motion) {
      G.from('#intDetail > *', { y: 8, opacity: 0, duration: 0.4, stagger: 0.05, ease: EASE, overwrite: 'auto' });
      G.from('#intDetail .int-logo', { scale: 0.6, rotate: -12, duration: 0.7, ease: 'back.out(2.2)' });
      G.from('#intDetail .id-sync li', { x: -10, opacity: 0, duration: 0.45, stagger: 0.06, delay: 0.1, ease: EASE });
    }
  }
  $('#intTiles').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) showInt(+b.dataset.i); });
  $('#intCats').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; intCat = b.dataset.cat; $$('#intCats button').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); }); renderInt(); });
  $('#intQ').addEventListener('input', () => renderInt(false));
  $('#intLegend').innerHTML = Object.entries(STATUS).map(([k, v]) => `<span><em class="st st-${k}">${v[0]}</em>${APPS.filter(x => stOf(x) === k).length}</span>`).join('');
  renderInt(false); showInt(0);

  /* ================= FAQ ================= */
  $$('.faq details').forEach(d => {
    const s = $('summary', d), a = $('.faq-a', d);
    s.addEventListener('click', e => {
      if (!motion) return;
      e.preventDefault();
      if (d.open) G.to(a, { height: 0, duration: 0.45, ease: 'power3.inOut', overwrite: true, onComplete: () => { d.open = false; a.style.height = ''; } });
      else { d.open = true; G.fromTo(a, { height: 0 }, { height: a.scrollHeight, duration: 0.6, ease: EASE, overwrite: true, onComplete: () => { a.style.height = ''; } }); }
    });
  });

  /* ================= DEMO REQUEST FORM (honest, no backend) ================= */
  const form = $('#demoForm'), state = $('#formState');
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const setErr = (el, msg) => {
    const f = el.closest('.field'), err = $('.err', f);
    f.classList.toggle('is-bad', !!msg); f.classList.toggle('is-ok', !msg && el.matches('input') && !!el.value.trim());
    err.textContent = msg || ''; el.setAttribute('aria-invalid', !!msg);
    if (msg) el.setAttribute('aria-describedby', err.id); else el.removeAttribute('aria-describedby');
  };
  const checks = {
    fName: v => v.trim().length < 2 ? 'Enter your full name.' : '',
    fEmail: v => !v.trim() ? 'Enter your work email.' : !emailOk(v.trim()) ? 'That email looks incomplete, for example name@company.com.' : '',
    fCompany: v => !v.trim() ? 'Enter your company name.' : ''
  };
  Object.keys(checks).forEach(id => { const el = $('#' + id); el.addEventListener('blur', () => { if (el.value) setErr(el, checks[id](el.value)); }); el.addEventListener('input', () => { if (el.closest('.field').classList.contains('is-bad')) setErr(el, checks[id](el.value)); }); });
  $('#fMsg').addEventListener('input', e => { $('#fMsgCount').textContent = `${e.target.value.length} / 500`; });
  $$('.chips button', form).forEach(b => b.addEventListener('click', () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true')));
  // custom select
  const sel = $('#sizeSelect'), selBtn = $('#sizeBtn'), opts = $$('[role="option"]', sel);
  let selVal = '', act = -1;
  const markAct = () => { opts.forEach((o, i) => o.classList.toggle('is-act', i === act)); if (opts[act]) selBtn.setAttribute('aria-activedescendant', opts[act].id); };
  const openSel = () => { sel.classList.add('is-open'); selBtn.setAttribute('aria-expanded', 'true'); act = Math.max(0, opts.findIndex(o => o.dataset.v === selVal)); markAct(); };
  const closeSel = focus => { sel.classList.remove('is-open'); selBtn.setAttribute('aria-expanded', 'false'); selBtn.removeAttribute('aria-activedescendant'); if (focus) selBtn.focus(); };
  const choose = i => { selVal = opts[i].dataset.v; opts.forEach((o, k) => o.setAttribute('aria-selected', k === i)); $('#sizeVal').textContent = opts[i].textContent; selBtn.classList.remove('is-empty'); setErr(selBtn, ''); closeSel(true); };
  selBtn.addEventListener('click', () => sel.classList.contains('is-open') ? closeSel() : openSel());
  selBtn.addEventListener('keydown', e => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); if (!sel.classList.contains('is-open')) openSel(); else { act = clamp(act + (e.key === 'ArrowDown' ? 1 : -1), 0, opts.length - 1); markAct(); } }
    if ((e.key === 'Enter' || e.key === ' ') && sel.classList.contains('is-open')) { e.preventDefault(); choose(act); }
    if (e.key === 'Escape' && sel.classList.contains('is-open')) { e.stopPropagation(); closeSel(true); }
    if (e.key === 'Tab') closeSel();
  });
  opts.forEach((o, i) => o.addEventListener('click', () => choose(i)));
  document.addEventListener('click', e => { if (!e.target.closest('#sizeSelect')) closeSel(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errs = Object.entries(checks).map(([id, fn]) => { const el = $('#' + id), m = fn(el.value); setErr(el, m); return [el, m]; });
    setErr(selBtn, selVal ? '' : 'Choose a team size.'); errs.push([selBtn, selVal ? '' : 'x']);
    const bad = errs.find(([, m]) => m);
    if (bad) { bad[0].focus(); state.hidden = false; state.className = 'form-state is-bad'; state.textContent = 'Please fix the highlighted fields.'; if (motion) G.fromTo(form, { x: -6 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' }); return; }
    const btn = $('#demoSubmit');
    btn.disabled = true; btn.querySelector('span').textContent = 'Checking…';
    state.hidden = false; state.className = 'form-state is-pending'; state.textContent = 'Checking your details…';
    await sleep(700);
    const interests = $$('.chips [aria-pressed="true"]', form).map(b => b.textContent);
    const rows = [['Name', $('#fName').value], ['Work email', $('#fEmail').value], ['Company', $('#fCompany').value], ['Team size', selVal], ['Interests', interests.join(', ') || 'None selected'], ['Notes', $('#fMsg').value || 'None']];
    // a real form service is connected by setting data-endpoint on the form (for example a Formspree or own API URL)
    const endpoint = form.dataset.endpoint;
    if (endpoint) {
      btn.querySelector('span').textContent = 'Sending…'; state.textContent = 'Sending your request…';
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.fromEntries(rows)) });
        if (!res.ok) throw new Error(res.status);
        state.className = 'form-state is-sent';
        state.innerHTML = `<b>Request sent.</b>Thanks, ${esc($('#fName').value.split(' ')[0])}. The team will reply to ${esc($('#fEmail').value)} to arrange your walkthrough.`;
        form.reset(); selVal = ''; $('#sizeVal').textContent = 'Choose a size'; selBtn.classList.add('is-empty'); $$('.chips button', form).forEach(b => b.setAttribute('aria-pressed', 'false'));
      } catch {
        state.className = 'form-state is-bad';
        state.textContent = 'The request could not be sent. Please try again in a moment.';
      }
      btn.disabled = false; btn.querySelector('span').textContent = 'Request a demo';
      return;
    }
    state.className = 'form-state is-unsent';
    state.innerHTML = `<b>Not sent. This form isn't connected to a backend yet.</b>Your entries are valid. Once a form service is connected, this is what would be submitted:<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
    btn.disabled = false; btn.querySelector('span').textContent = 'Request a demo';
    state.focus?.();
  });

  /* ================= command palette ================= */
  const pal = $('#palette'), palQ = $('#palQ'), palList = $('#palList');
  const cmds = [
    ...$$('main > section[data-name]').map(s => ({ t: s.dataset.name, k: 'Go to section', run: () => goTo(s) })),
    { t: 'Run the onboarding automation', k: 'Demo', run: () => { $('[data-wf="onboard"]').click(); goTo('#workflows'); setTimeout(runWF, 1300); } },
    { t: 'Ask Copilot what is at risk', k: 'Demo', run: () => { goTo('#copilot'); setTimeout(() => ask('Which projects are at risk this week?'), 1100); } },
    { t: 'Show 12 months of revenue', k: 'Demo', run: () => { an.m = 'revenue'; an.r = 365; setSeg($('#anMetric'), $('[data-m="revenue"]')); setSeg($('#anRange'), $('[data-r="365"]')); goTo('#analytics'); anDrawn = true; renderAn(); } },
    { t: 'Watch the product film', k: 'Media', run: () => openFilm() },
    { t: 'Book a demo', k: 'Action', run: () => { goTo('#demo'); setTimeout(() => $('#fName').focus({ preventScroll: true }), 1200); } }
  ];
  let palSel = 0, palItems = cmds, palReturn;
  const renderPal = () => {
    const q = palQ.value.trim().toLowerCase();
    palItems = cmds.filter(c => c.t.toLowerCase().includes(q));
    palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
    palList.innerHTML = palItems.map((c, i) => `<li role="option" id="po-${i}" aria-selected="${i === palSel}" data-i="${i}">${c.t}<span>${c.k}</span></li>`).join('') || '<li aria-disabled="true">Nothing matches</li>';
    if (palItems.length) palQ.setAttribute('aria-activedescendant', `po-${palSel}`); else palQ.removeAttribute('aria-activedescendant');
    $('#po-' + palSel)?.scrollIntoView({ block: 'nearest' });
  };
  const openPal = () => { palReturn = document.activeElement; closeAllDD(); pal.hidden = false; palQ.value = ''; palSel = 0; renderPal(); palQ.focus(); lenis?.stop(); };
  const closePal = () => { pal.hidden = true; lenis?.start(); palReturn?.focus?.(); };
  const runPal = i => { const c = palItems[i]; if (!c) return; closePal(); c.run(); };
  document.addEventListener('click', e => { if (e.target.closest('[data-open-palette]')) { e.preventDefault(); openPal(); } });
  palQ.addEventListener('input', () => { palSel = 0; renderPal(); });
  palList.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) runPal(+li.dataset.i); });
  pal.addEventListener('click', e => { if (e.target === pal) closePal(); });
  pal.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); closePal(); }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && palItems.length) { palSel = (palSel + (e.key === 'ArrowDown' ? 1 : -1) + palItems.length) % palItems.length; renderPal(); e.preventDefault(); }
    if (e.key === 'Enter') { runPal(palSel); e.preventDefault(); }
    if (e.key === 'Tab') { e.preventDefault(); palQ.focus(); }
  });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? openPal() : closePal(); } });

  /* ================= feature films: chapters that play in turn ================= */
  // Two stacked video layers: the current film keeps playing until the next one can play,
  // then the two dissolve into each other, so a switch never shows a black frame.
  const FILMS = [['projects', 'Projects'], ['workflow', 'Workflow automation'], ['copilot', 'Copilot'], ['analytics', 'Analytics']];
  const chaps = $$('#chapters .chap'), filmBtn = $('#filmToggle'), media = $('.screen-media');
  const layerB = document.createElement('video');
  layerB.muted = true; layerB.playsInline = true; layerB.preload = 'auto'; layerB.className = 'film-layer'; layerB.setAttribute('aria-hidden', 'true'); layerB.style.opacity = 0;
  media.insertBefore(layerB, $('.screen-ctl', media));
  let filmV = $('#filmV'), spare = layerB, filmI = 0, filmPaused = !motion, filmSeen = false, swapId = 0;
  filmV.classList.add('film-layer');
  const setToggle = () => { const playing = !filmV.paused; filmBtn.innerHTML = icon(playing ? 'i-pause' : 'i-play', 14); filmBtn.setAttribute('aria-label', playing ? 'Pause film' : 'Play film'); };
  const prog = () => $('.chap-prog i', chaps[filmI]);
  function setFilm(i, user) {
    filmI = i;
    chaps.forEach((c, k) => { c.classList.toggle('is-on', k === i); c.setAttribute('aria-selected', k === i); c.tabIndex = k === i ? 0 : -1; $('.chap-prog i', c).style.transform = 'scaleX(0)'; });
    const [key, label] = FILMS[i];
    if (user) filmPaused = false;
    if (motion) G.fromTo('#filmLabel', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: EASE, onStart: () => { $('#filmLabel').textContent = label; } });
    else $('#filmLabel').textContent = label;
    const id = ++swapId, next = spare, prev = filmV;
    next.poster = `assets/film/${key}.jpg`;
    next.src = `assets/film/${key}.mp4`;
    next.load();
    const reveal = () => {
      if (id !== swapId) return;              // a newer switch has taken over
      next.currentTime = 0;
      if (!filmPaused && filmSeen) next.play().catch(() => {});
      next.setAttribute('aria-label', `Feature film: ${label}`); next.removeAttribute('aria-hidden');
      prev.setAttribute('aria-hidden', 'true'); prev.removeAttribute('aria-label');
      filmV = next; spare = prev; setToggle();
      if (motion) {
        G.set(next, { zIndex: 1 }); G.set(prev, { zIndex: 0 });
        G.fromTo(next, { opacity: 0, scale: 1.035 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'power2.out', overwrite: true });
        G.to(prev, { opacity: 0, duration: 0.7, ease: 'power2.out', overwrite: true, onComplete: () => { if (prev !== filmV) prev.pause(); } });
      } else { next.style.opacity = 1; prev.style.opacity = 0; prev.pause(); }
    };
    if (next.readyState >= 3) reveal(); else next.addEventListener('canplay', reveal, { once: true });
  }
  chaps.forEach((c, k) => c.addEventListener('click', () => { if (k !== filmI) setFilm(k, true); }));
  $('#chapters').addEventListener('keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const n = (filmI + (/Down|Right/.test(e.key) ? 1 : -1) + chaps.length) % chaps.length;
    setFilm(n, true); chaps[n].focus();
  });
  filmBtn.addEventListener('click', () => { if (filmV.paused) { filmPaused = false; filmV.play().catch(() => {}); } else { filmPaused = true; filmV.pause(); } });
  [filmV, layerB].forEach(v => {
    v.addEventListener('play', () => { if (v === filmV) setToggle(); });
    v.addEventListener('pause', () => { if (v === filmV) setToggle(); });
    v.addEventListener('timeupdate', () => { if (v === filmV && v.duration) prog().style.transform = `scaleX(${v.currentTime / v.duration})`; });
    v.addEventListener('ended', () => { if (v === filmV) setFilm((filmI + 1) % FILMS.length); });
  });
  new IntersectionObserver(([e]) => {
    filmSeen = e.isIntersecting;
    if (filmSeen && !filmPaused) filmV.play().catch(() => {}); else if (!filmSeen) filmV.pause();
  }, { threshold: 0.4 }).observe($('.screen'));
  setToggle();

  /* ================= section entrances: one language, different gestures ================= */
  if (motion) {
    // headings rise word by word out of a mask
    $$('.sec-head .h2, .tour-copy .h2, .cop-copy .h2, .faq-head .h2, .demo-h, .cx-copy .h2, .problem-copy .h2').forEach(h => {
      const parts = [];
      h.childNodes.forEach(n => {
        const wrapCls = n.nodeType === 1 ? n.className : '';
        n.textContent.split(/(\s+)/).forEach(w => parts.push(/^\s+$/.test(w) ? ' ' : w ? `<span class="w-mask"><span${wrapCls ? ` class="${wrapCls}"` : ''}>${esc(w)}</span></span>` : ''));
      });
      h.setAttribute('aria-label', h.textContent);
      h.innerHTML = parts.join('');
      $$('.w-mask', h).forEach(w => w.setAttribute('aria-hidden', 'true'));
      const tw = G.from($$('.w-mask > span', h), { yPercent: 110, rotate: 2, transformOrigin: '0% 100%', duration: 1.15, stagger: 0.04, ease: EASE, paused: true });
      whenSeen(h, () => tw.play(), 0.4);
    });
    const reveal = (sel, kind = '') => $$(sel).forEach(el => el.setAttribute('data-reveal', kind));
    reveal('main .sec-tag'); reveal('main .sec-sub'); reveal('.cop-can li'); reveal('.demo-note'); reveal('.wfb-tabs button', 'left'); reveal('.cases-list button', 'left');
    reveal('.int-side'); reveal('.faq details'); reveal('.demo-copy > p'); reveal('.demo-steps li'); reveal('.foot-cols > div'); reveal('.foot-brand'); reveal('.chap', 'left'); reveal('.films-note');
    const q = []; let qt;
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { q.push(e.target); io.unobserve(e.target); } });
      clearTimeout(qt); qt = setTimeout(() => { q.forEach(el => el.classList.add('is-in')); if (q.length) G.to(q.splice(0), { opacity: 1, x: 0, y: 0, duration: 1, stagger: 0.07, ease: EASE, overwrite: 'auto' }); }, 20);
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('[data-reveal]').forEach(el => io.observe(el));
    document.addEventListener('focusin', e => { const r = e.target.closest('[data-reveal]'); if (r && +getComputedStyle(r).opacity < 1) { io.unobserve(r); G.to(r, { opacity: 1, x: 0, y: 0, duration: 0.3 }); } });
    // product surfaces each arrive with their own gesture: tilt up, slide, unmask, scale
    const intoView = (el, from, th = 0.15) => { if (!$(el)) return; const tw = G.from(el, { ...from, paused: true }); whenSeen($(el).parentElement, () => tw.play(), th); };
    intoView('.wfb-app', { y: 80, opacity: 0, rotateX: 10, transformPerspective: 1600, transformOrigin: '50% 0', duration: 1.4, ease: EASE });
    intoView('.chat', { x: 70, opacity: 0, duration: 1.2, ease: EASE });
    intoView('.an', { clipPath: 'inset(0% 0% 100% 0% round 14px)', duration: 1.5, ease: 'expo.inOut' }, 0.05);
    intoView('.case', { y: 60, opacity: 0, duration: 1.2, ease: EASE });
    intoView('.int-detail', { y: 40, opacity: 0, duration: 1.1, ease: EASE });
    intoView('.demo-form', { y: 70, opacity: 0, rotate: 1.5, duration: 1.3, ease: EASE });
    intoView('.screen', { y: 80, opacity: 0, scale: 0.94, duration: 1.4, ease: EASE });
    whenSeen($('#parts'), () => G.from('#parts .part', { y: 60, opacity: 0, duration: 1.1, stagger: 0.07, ease: EASE }), 0.2);
    whenSeen($('#intTiles'), () => G.from('#intTiles li', { y: 20, opacity: 0, duration: 0.7, stagger: 0.03, ease: EASE }), 0.1);
  }

  /* ================= pointer layer (fine pointers only) ================= */
  if (motion && finePointer) {
    root.classList.add('spot-on');
    $$('.int-tiles, .wfb-tabs, .cases-list, .allv, .chapters').forEach(g => g.addEventListener('pointermove', e => {
      const el = e.target.closest('.int-tiles button, .wfb-tabs button, .cases-list button, .allc, .chap');
      if (!el) return;
      if (!el.hasAttribute('data-spot')) el.setAttribute('data-spot', '');
      const r = el.getBoundingClientRect(), k = r.width / el.offsetWidth || 1;
      el.style.setProperty('--mx', `${(e.clientX - r.left) / k}px`); el.style.setProperty('--my', `${(e.clientY - r.top) / k}px`);
    }));
    // the large graphite cards get the same soft light under the pointer
    $$('.part, .case').forEach(el => el.addEventListener('pointermove', e => {
      if (!el.hasAttribute('data-spot')) el.setAttribute('data-spot', '');
      const r = el.getBoundingClientRect(), k = r.width / el.offsetWidth || 1;
      el.style.setProperty('--mx', `${(e.clientX - r.left) / k}px`); el.style.setProperty('--my', `${(e.clientY - r.top) / k}px`);
    }));
    // lime buttons carry a soft highlight that follows the pointer
    $$('.btn-lime').forEach(b => b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.setProperty('--bx', `${e.clientX - r.left}px`); b.style.setProperty('--by', `${e.clientY - r.top}px`); }));
    // hovering a workflow step lights every edge connected to it
    wfNodesEl.addEventListener('pointerover', e => { const n = e.target.closest('.wn'); $$('path', wfEdges).forEach(p => p.classList.toggle('is-near', !!n && (p.dataset.a === n.dataset.id || p.dataset.b === n.dataset.id))); });
    wfNodesEl.addEventListener('pointerleave', () => $$('path.is-near', wfEdges).forEach(p => p.classList.remove('is-near')));
    // the filmed screen leans toward the pointer
    const scr = $('.screen');
    scr.addEventListener('mousemove', e => { const r = scr.getBoundingClientRect(); G.to(scr, { rotateY: ((e.clientX - r.left) / r.width - 0.5) * 4, rotateX: -((e.clientY - r.top) / r.height - 0.5) * 3, transformPerspective: 1600, duration: 0.8, ease: 'power3.out', overwrite: 'auto' }); });
    scr.addEventListener('mouseleave', () => G.to(scr, { rotateY: 0, rotateX: 0, duration: 1, ease: 'power3.out', overwrite: 'auto' }));
  }

  /* ================= scroll layer: progress-linked details ================= */
  if (motion) {
    mm.add('(min-width: 961px)', () => {
      G.fromTo('#workflows .wfb-frame', { y: 70 }, { y: 0, ease: 'none', scrollTrigger: { trigger: '#workflows', start: 'top bottom', end: 'top 20%', scrub: 0.6 } });
      G.fromTo('#caseScenes', { y: 24 }, { y: -24, ease: 'none', scrollTrigger: { trigger: '#solutions', start: 'top bottom', end: 'bottom top', scrub: true } });
      G.fromTo('.an', { scale: 0.96 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '#analytics', start: 'top 80%', end: 'top 10%', scrub: 0.6 } });
    });
    // the footer wordmark rises letter by letter as the page ends
    G.from('#footWord span', { yPercent: 100, opacity: 0, ease: 'none', stagger: 0.08, scrollTrigger: { trigger: '#footWord', start: 'top 98%', end: 'bottom 90%', scrub: 0.8 } });
  }


  if (ST) { addEventListener('load', () => { layoutFits(); placePills(); ST.refresh(); }); document.fonts?.ready.then(() => { layoutFits(); placePills(); ST.refresh(); }); }
})();
