/* VELTRIX — page behaviour.
   Every figure comes from one seeded sample workspace (Northbeam, Nov 4, 2026). */
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
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const money = n => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `$${(n / 1e3).toFixed(1)}k` : `$${fmt(n)}`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (id, s = 14) => `<svg width="${s}" height="${s}"><use href="#${id}"/></svg>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  if (!motion) root.classList.add('no-motion');
  if (G && ST) G.registerPlugin(ST);
  const EASE = 'expo.out';

  const toast = (text, ic = 'i-check') => {
    const wrap = $('#toasts'), t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="ic">${icon(ic, 13)}</span><span>${esc(text)}</span>`;
    wrap.appendChild(t);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    if (motion) G.from(t, { y: 14, opacity: 0, duration: 0.5, ease: EASE });
    setTimeout(() => { if (motion) G.to(t, { opacity: 0, y: 8, duration: 0.3, onComplete: () => t.remove() }); else t.remove(); }, 3600);
  };
  const whenSeen = (el, fn, threshold = 0.2) => {
    if (!el) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { o.disconnect(); fn(); } }, { threshold });
    o.observe(el);
  };
  const visibleFlag = (el, threshold = 0) => {
    const f = { on: true };
    if (el) new IntersectionObserver(([e]) => { f.on = e.isIntersecting; }, { threshold }).observe(el);
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

  /* ================= smooth scroll (unchanged: the tilt is tuned to it) ================= */
  let lenis = null;
  if (motion && window.Lenis && finePointer) {
    const own = '.chat-log, .wfb-log, .pal-box ul, .mnav, .fit-scroll, .app-nav, .int-cats, .an-controls .seg';
    const canScroll = el => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
    lenis = new window.Lenis({ lerp: 0.1, prevent: n => { const el = n.closest?.(own); return !!el && canScroll(el); } });
    lenis.on('scroll', ST.update);
    G.ticker.add(t => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }
  /* ================= fitted product window (unchanged) ================= */
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
  layoutFits();
  let fitT;
  addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(layoutFits, 120); });
  let stT;
  if (ST) new ResizeObserver(() => { clearTimeout(stT); stT = setTimeout(() => ST.refresh(), 200); }).observe(document.body);

  /* ================= hero: product views drive the window below ================= */
  const VIEW_TITLES = { projects: 'Projects', rules: 'Automations', copilot: 'Copilot', report: 'Reporting' };
  const viewBtns = $$('#views button'), VIEW_MS = 6500;
  let viewIdx = 0, viewTimer = null, viewAuto = true, barTween = null;
  function showView(i, user) {
    viewIdx = i;
    const key = viewBtns[i].dataset.view;
    viewBtns.forEach((b, k) => { const on = k === i; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
    $$('#app .ap-view').forEach(v => v.classList.toggle('is-on', v.dataset.view === key));
    $$('#app .ap-nav span[data-nav]').forEach(s => s.classList.toggle('is-on', s.dataset.nav === key));
    $('#apTitle').textContent = VIEW_TITLES[key];
    if (key === 'report') drawAppChart();
    const v = $(`#app .ap-view[data-view="${key}"]`);
    if (motion) G.fromTo(v.children, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.05, ease: EASE });
    // the bar over the active tab fills while that view is showing, then the next view takes over
    barTween?.kill(); clearTimeout(viewTimer);
    if (user) viewAuto = false;
    const em = $('.v-bar em', viewBtns[i]);
    $$('#views .v-bar em').forEach(e => { if (e !== em && motion) G.set(e, { scaleX: 0 }); });
    if (motion && viewAuto) {
      barTween = G.fromTo(em, { scaleX: 0 }, { scaleX: 1, duration: VIEW_MS / 1000, ease: 'none', onComplete: () => { if (viewAuto && heroSeen.on) showView((viewIdx + 1) % viewBtns.length); } });
    } else if (motion) G.set(em, { scaleX: 1 });
  }
  viewBtns.forEach((b, i) => b.addEventListener('click', () => showView(i, true)));
  $$('#app .ap-nav span[data-nav]').forEach(s => s.addEventListener('click', () => { const i = viewBtns.findIndex(b => b.dataset.view === s.dataset.nav); if (i >= 0) showView(i, true); }));
  const heroSeen = visibleFlag($('.hero'));
  // project filter inside the window
  $$('#app .ap-seg [data-pf]').forEach(b => b.addEventListener('click', () => {
    $$('#app .ap-seg [data-pf]').forEach(x => x.classList.toggle('is-on', x === b));
    const f = b.dataset.pf;
    $$('#apProjects .ap-tr:not(.ap-th)').forEach(r => r.classList.toggle('is-dim', f === 'risk' ? r.dataset.risk !== '1' : f === 'mine' ? r.dataset.mine !== '1' : false));
  }));
  $('#apBell')?.addEventListener('click', () => toast('2 unread: Design QA flagged as the launch blocker · Invoice 2287 paid', 'i-bell'));
  $$('#app .ap-acts .ap-btn').forEach(b => b.addEventListener('click', () => toast(b.classList.contains('ap-btn-q') ? 'Timelines open in the full product' : 'Reminder drafted for Maya. Nothing is sent until you approve it.', 'i-spark')));
  $$('#app .ap-head .ap-btn').forEach(b => b.addEventListener('click', () => toast('Creating rules isn’t available in this demo', 'i-flow')));

  // the reporting view: 12 weeks of revenue against the 12 before
  const w12 = buckets('revenue', 84), p12 = buckets('revenue', 84, 84);
  const t12 = w12.reduce((s, b) => s + b.v, 0), tp12 = p12.reduce((s, b) => s + b.v, 0);
  function drawAppChart() {
    const svg = $('#apChart'); if (!svg || svg.dataset.done) return;
    svg.dataset.done = '1';
    const all = [...w12, ...p12].map(b => b.v), lo = Math.min(...all) * 0.86, hi = Math.max(...all) * 1.05;
    const X = i => i / 11 * 640, Y = v => 220 - (v - lo) / (hi - lo) * 210;
    const line = a => a.map((b, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(b.v).toFixed(1)}`).join(' ');
    svg.innerHTML = `<defs><linearGradient id="apFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3F3F3" stop-opacity=".12"/><stop offset="1" stop-color="#F3F3F3" stop-opacity="0"/></linearGradient></defs>`
      + [55, 110, 165].map(y => `<line class="gl" x1="0" x2="640" y1="${y}" y2="${y}"/>`).join('')
      + `<path class="pv" d="${line(p12)}"/><path class="ar" d="${line(w12)} L640 220 L0 220 Z"/><path class="ln" d="${line(w12)}"/>`;
    $('#apX').innerHTML = w12.map((b, i) => i % 3 === 2 ? `<span style="left:${(i / 11 * 100).toFixed(1)}%">${b.short}</span>` : '').join('');
    if (motion) { const l = $('.ln', svg), n = l.getTotalLength(); G.fromTo(l, { strokeDasharray: n, strokeDashoffset: n }, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' }); G.from($('.ar', svg), { opacity: 0, duration: 1, delay: 0.4 }); }
  }
  $('#apRev').textContent = `$${Math.round(t12).toLocaleString('en-US')}`;
  $('#apRevD').textContent = `${pctDelta(t12, tp12) >= 0 ? '+' : '−'}${Math.abs(pctDelta(t12, tp12)).toFixed(1)}% on the 12 weeks before`;
  $('#apR30').textContent = money(K.rev30);
  ['#apOn', '#apOn2', '#pfOn'].forEach(s => { const el = $(s); if (el) el.textContent = `${K.ontime30.toFixed(1)}%`; });
  $('#apCy').textContent = `${K.cycle30.toFixed(1)} days`;

  /* ================= hero: the run line plays the real handoff, step by step ================= */
  const runline = $('#runline'), runSteps = $$('#runline li');
  const playRun = async () => {
    if (!motion) { runSteps.forEach(li => li.classList.add('is-on')); return; }
    runline.style.setProperty('--run', '0%');
    for (let i = 0; i < runSteps.length; i++) {
      await sleep(i ? 520 : 900);
      runSteps[i].classList.add('is-on');
      runline.style.setProperty('--run', `${(i + 1) / runSteps.length * 100}%`);
      $('#hStamp').textContent = runSteps[i].querySelector('time').textContent;
    }
  };

  /* ================= hero entrance (the stage line is unchanged) ================= */
  const heroIn = () => {
    showView(0);
    playRun();
    if (!motion) return;
    const tl = G.timeline({ defaults: { ease: EASE } });
    tl.from('.nav-bar > *', { y: -14, opacity: 0, duration: 0.9, stagger: 0.06 }, 0)
      .from('.hero-title .ln > span', { yPercent: 110, duration: 1.2, stagger: 0.1 }, 0.1)
      .from('.h-stamp', { y: 12, opacity: 0, duration: 0.9 }, 0.4)
      .from('.runline li', { y: 12, opacity: 0, duration: 0.8, stagger: 0.06 }, 0.45)
      .from('.h-foot > *', { y: 18, opacity: 0, duration: 1, stagger: 0.08 }, 0.55)
      .from('.views > *', { y: 10, opacity: 0, duration: 0.8, stagger: 0.04 }, 0.65)
      .from('#heroStage', { y: 140, opacity: 0, duration: 1.6, ease: 'expo.out' }, 0.5);
  };
  heroIn();

  /* ================= one Monday: bars grow to show how late each step landed ================= */
  const cmp = $('#cmp');
  if (motion) whenSeen(cmp, () => {
    $$('.cmp-a .cmp-bar', cmp).forEach((bar, i) => { const v = parseFloat(bar.style.getPropertyValue('--d')) || 0; G.fromTo(bar, { '--d': 0 }, { '--d': v, duration: 1.3, delay: 0.25 + i * 0.12, ease: 'power2.inOut' }); });
    G.from($$('.cmp-t b', cmp), { opacity: 0, y: 10, duration: 0.9, stagger: 0.15, delay: 0.9, ease: EASE });
  }, 0.25);

  /* ================= your week: numbers you can change inside the sentence ================= */
  const wkVal = {};
  const wkCalc = () => {
    const hrs = wkVal.hand * wkVal.min * wkVal.ppl / 60;
    const out = $('#wkHours'), from = parseFloat(out.textContent.replace(/,/g, '')) || 0;
    if (motion) { const o = { v: from }; G.to(o, { v: hrs, duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: () => { out.textContent = fmt(o.v); } }); } else out.textContent = fmt(hrs);
    $('#wkWeeks').textContent = fmt(hrs * 48 / 40);
    $('#wkCount').textContent = fmt(wkVal.hand * 48);
    // fill one person's week, Monday first, an hour per cell
    const filled = Math.min(40, Math.round(hrs));
    $$('#wkCells i').forEach((cell, n) => cell.classList.toggle('on', n < filled));
    const share = hrs / 40;
    $('#wkShare').textContent = share >= 1 ? `${share.toFixed(1)} people’s full weeks` : Math.abs(share - 0.5) < 0.005 ? 'Half of one person’s week' : `${Math.round(share * 100)}% of one person’s week`;
  };
  $$('#wkSentence .num').forEach(n => {
    const out = $('output', n), [down, up] = $$('button', n), k = n.dataset.k, min = +n.dataset.min, max = +n.dataset.max, step = +n.dataset.step;
    wkVal[k] = +out.textContent;
    const set = v => { wkVal[k] = clamp(v, min, max); out.textContent = wkVal[k]; down.disabled = wkVal[k] <= min; up.disabled = wkVal[k] >= max; wkCalc(); if (motion) G.fromTo(out, { y: -4, opacity: .4 }, { y: 0, opacity: 1, duration: 0.3 }); };
    down.addEventListener('click', () => set(wkVal[k] - step)); up.addEventListener('click', () => set(wkVal[k] + step));
    n.addEventListener('wheel', e => { if (document.activeElement && n.contains(document.activeElement)) { e.preventDefault(); set(wkVal[k] + (e.deltaY < 0 ? step : -step)); } }, { passive: false });
  });
  $('#wkHours').textContent = '20'; $$('#wkCells i').forEach((cell, n) => cell.classList.toggle('on', n < 20));

  /* ================= one record: annotations linked to the task's fields ================= */
  const anat = $('#anatomy'), anLines = $('#anLines');
  const drawAnat = () => {
    if (innerWidth <= 960) { anLines.innerHTML = ''; return; }
    const box = anat.getBoundingClientRect();
    anLines.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    anLines.innerHTML = $$('.an-side li', anat).map(li => {
      const f = $(`.task [data-f="${li.dataset.f}"]`, anat), a = li.getBoundingClientRect(), b = f.getBoundingClientRect(), left = li.closest('.an-l');
      const y1 = a.top + 12 - box.top, y2 = b.top + b.height / 2 - box.top;
      const x1 = (left ? a.right + 12 : a.left - 12) - box.left, x2 = (left ? b.left - 2 : b.right + 2) - box.left, mx = (x1 + x2) / 2;
      return `<path data-f="${li.dataset.f}" d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"/><circle data-f="${li.dataset.f}" cx="${x2}" cy="${y2}" r="2.5"/>`;
    }).join('');
  };
  $$('.an-side li', anat).forEach(li => {
    const on = v => {
      anat.classList.toggle('is-hover', v);
      li.classList.toggle('is-hot', v);
      $$(`.task [data-f="${li.dataset.f}"]`, anat).forEach(x => x.classList.toggle('is-hot', v));
      $$(`#anLines [data-f="${li.dataset.f}"]`).forEach(x => x.classList.toggle('is-hot', v));
    };
    li.addEventListener('pointerenter', () => on(true)); li.addEventListener('pointerleave', () => on(false));
  });
  drawAnat(); addEventListener('resize', drawAnat); document.fonts?.ready.then(drawAnat);
  if (motion) whenSeen(anat, () => { drawAnat(); $$('#anLines path').forEach((p, i) => { const n = p.getTotalLength(); G.fromTo(p, { strokeDasharray: n, strokeDashoffset: n }, { strokeDashoffset: 0, duration: 1, delay: 0.2 + i * 0.08, ease: 'power2.out', onComplete: () => { p.style.strokeDasharray = ''; } }); }); }, 0.3);

  /* ================= how it works: the step you are reading drives the window ================= */
  const steps = $$('#works .step'), wss = $$('#win .ws'), WIN_TITLES = ['Connections', 'New rule', 'Run log · Mon, Oct 26', '#ops · Monday'];
  let typed = false;
  const typeRule = async () => {
    if (typed) return; typed = true;
    const el = $('#typeRule'), text = 'When a deal is won and worth over $10,000, open onboarding and book a kickoff';
    if (!motion) { el.textContent = text; return; }
    for (let n = 1; n <= text.length; n++) { el.textContent = text.slice(0, n); await sleep(24); }
  };
  const setStep = i => {
    steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
    wss.forEach((w, k) => w.classList.toggle('is-on', k === i));
    $('#winTitle').textContent = WIN_TITLES[i];
    if (i === 1) typeRule();
  };
  const stepIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setStep(steps.indexOf(e.target)); }), { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(s => stepIO.observe(s));
  $$('.tg .sw').forEach(s => { s.setAttribute('role', 'switch'); s.setAttribute('tabindex', '0'); s.setAttribute('aria-checked', s.classList.contains('is-on'));
    const flip = () => { s.classList.toggle('is-on'); s.setAttribute('aria-checked', s.classList.contains('is-on')); };
    s.addEventListener('click', flip); s.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } }); });
  const last7 = { rev: periodValue('revenue', 7), revPrev: periodValue('revenue', 7, 7), ontime: periodValue('ontime', 7), runs: periodValue('runs', 7) };
  $('#postRev').textContent = money(last7.rev); $('#postOn').textContent = `${last7.ontime.toFixed(1)}%`; $('#postRuns').textContent = fmt(last7.runs);

  /* ================= Copilot: answers cite their sources, listed in the rail ================= */
  const ANSWERS = {
    risk: () => ({ q: 'Which projects need attention this week?', html: 'Two of the four. <b>Q4 product launch</b> is at risk: Design QA has 3 screens left and the launch email waits on it<sup>1</sup><sup>2</sup>. <b>Support hiring</b> is behind at 30% with three weeks to go<sup>3</sup>.',
      card: [['Q4 product launch', 62, 'At risk'], ['Support hiring', 30, 'Behind'], ['Brightline onboarding', 88, 'On track'], ['Website relaunch', 42, 'On track']],
      src: [['Q4 launch board', '8 of 13 tasks done · due Fri, Nov 20'], ['Design QA', 'Task · Maya Ortiz · 8 of 11 screens'], ['Support hiring', '3 of 10 tasks · due Nov 27']], acts: ['Draft a reminder for Maya', 'Open the Q4 launch board'] }),
    load: () => ({ q: 'Who has room for more work?', html: '<b>Omar Aziz</b> has the most room at 18 of 40 hours<sup>1</sup>. <b>Priya Rao</b> is booked 37 of 40. Moving “Pricing page build” (about 6 hours<sup>2</sup>) from Priya to Omar would bring her to 31 and Omar to 24.',
      card: [['Priya Rao', 92, '37 h'], ['Lena Kraus', 70, '28 h'], ['Maya Ortiz', 58, '23 h'], ['Jonas Tan', 50, '20 h'], ['Omar Aziz', 45, '18 h']],
      src: [['Team calendars', 'This week · 5 people'], ['Task estimates', 'Pricing page build · 6 h']], acts: ['Draft the move', 'Keep it as it is'] }),
    week: () => { const d = pctDelta(last7.rev, last7.revPrev); return { q: 'How did last week go?', html: `The workspace recognised <b>${money(last7.rev)}</b> in revenue, ${d >= 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(1)}% on the week before<sup>1</sup>. On-time delivery averaged <b>${last7.ontime.toFixed(1)}%</b><sup>2</sup> and rules ran <b>${fmt(last7.runs)}</b> times<sup>3</sup>. One blocker remains: Design QA on the launch.`,
      src: [['Invoices', `Last 7 days · ${money(last7.rev)}`], ['Tasks', 'Closed against their due dates'], ['Rule log', `${fmt(last7.runs)} runs in 7 days`]], acts: ['Post this summary to #ops'] }; },
    rule: () => ({ q: 'Turn “chase unpaid invoices” into a rule', html: 'Here is a draft. Check it reads the way you meant before you turn it on: <b>when an invoice is 3 days overdue</b>, email the client contact a reminder<sup>1</sup> and tell the account owner in #billing<sup>2</sup>.',
      src: [['Billing', 'Invoice due dates'], ['Client contacts', 'Primary contact per account']], acts: ['Turn it on', 'Edit the draft'] })
  };
  const cpLog = $('#cpLog'), cpSrc = $('#cpSrc');
  let cpBusy = false;
  async function ask(key) {
    if (cpBusy) return; cpBusy = true;
    $$('#cpQs button').forEach(b => { const on = b.dataset.q === key; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
    const a = ANSWERS[key]();
    cpLog.insertAdjacentHTML('beforeend', `<p class="cp-q">${esc(a.q)}</p>`);
    const qEl = cpLog.lastElementChild;
    const box = document.createElement('div'); box.className = 'cp-a'; box.innerHTML = '<span class="cp-thinking"><i></i><i></i><i></i></span>'; cpLog.appendChild(box);
    cpLog.scrollTop = cpLog.scrollHeight;
    cpSrc.innerHTML = '';
    await sleep(motion ? 650 : 0);
    const words = a.html.split(' '); box.innerHTML = '<p></p>'; const p = $('p', box);
    for (let n = 1; n <= words.length; n++) { p.innerHTML = words.slice(0, n).join(' '); if (motion) await sleep(24); }
    if (a.card) box.insertAdjacentHTML('beforeend', `<div class="cp-card">${a.card.map(r => `<div class="cp-row"><span>${r[0]}</span><i><em style="width:${r[1]}%"></em></i><b>${r[2]}</b></div>`).join('')}</div>`);
    box.insertAdjacentHTML('beforeend', `<div class="cp-acts">${a.acts.map((t, i) => `<button type="button" class="btn btn-sm ${i ? 'btn-dark' : 'btn-light'}">${t}</button>`).join('')}</div>`);
    $$('.cp-acts button', box).forEach((b, i) => b.addEventListener('click', () => toast(i ? 'Kept as it is.' : 'Drafted. Nothing changes until a person approves it in the full product.', 'i-spark')));
    cpSrc.innerHTML = a.src.map(s => `<li><b>${s[0]}</b><small>${s[1]}</small></li>`).join('');
    if (motion) { G.from([...box.children].slice(1), { y: 8, opacity: 0, duration: 0.5, stagger: 0.06, ease: EASE }); G.from($$('li', cpSrc), { x: 10, opacity: 0, duration: 0.5, stagger: 0.08, ease: EASE }); }
    while (cpLog.children.length > (innerWidth <= 600 ? 2 : 6)) cpLog.firstElementChild.remove();
    if (innerWidth > 600) cpLog.scrollTo({ top: Math.max(0, qEl.offsetTop - 18), behavior: motion ? 'smooth' : 'auto' });
    cpBusy = false;
  }
  $$('#cpQs button').forEach(b => b.addEventListener('click', () => ask(b.dataset.q)));
  whenSeen(cpLog, () => ask('risk'), 0.4);

  /* ================= team: hours per day, and Copilot's suggested move ================= */
  const TEAM = [['Priya Rao', 'Operations lead', [8, 8, 7, 7, 7]], ['Lena Kraus', 'Web', [6, 6, 6, 5, 5]], ['Maya Ortiz', 'Design', [5, 5, 5, 4, 4]], ['Jonas Tan', 'People', [4, 4, 4, 4, 4]], ['Omar Aziz', 'Client services', [4, 4, 4, 3, 3]]];
  const capEl = $('#cap');
  const initials = n => n.split(' ').map(w => w[0]).join('');
  capEl.insertAdjacentHTML('beforeend', TEAM.map(([n, r, d], pi) => `<div class="cap-row" role="row" data-p="${pi}"><span class="cap-who" role="cell"><i class="av${pi === 0 ? ' av-1' : ''}">${initials(n)}</i><span>${n}<small>${r}</small></span></span>${d.map(h => `<span class="cap-day" role="cell"><i style="--h:${h}"></i><span>${h}h</span></span>`).join('')}<span class="cap-wk" role="cell"><b></b><small></small></span></div>`).join(''));
  const paintCap = () => $$('.cap-row[data-p]', capEl).forEach(row => {
    const d = TEAM[row.dataset.p][2], tot = d.reduce((s, x) => s + x, 0);
    $$('.cap-day', row).forEach((c, k) => { const i = $('i', c); i.style.setProperty('--h', d[k]); i.classList.toggle('full', d[k] >= 7); $('span', c).textContent = `${d[k]}h`; });
    $('.cap-wk b', row).textContent = `${tot} h`; $('.cap-wk small', row).textContent = `of 40 · ${40 - tot} free`;
  });
  paintCap();
  let moved = false;
  $('#tmMove').addEventListener('click', () => {
    moved = !moved;
    // the 6-hour task leaves Priya's Wednesday to Friday and lands on Omar's
    [2, 3, 4].forEach(k => { TEAM[0][2][k] += moved ? -2 : 2; TEAM[4][2][k] += moved ? 2 : -2; });
    paintCap();
    [2, 3, 4].forEach(k => { $$('.cap-row[data-p="4"] .cap-day i')[k].classList.toggle('moved', moved); });
    $('#tmMove').textContent = moved ? 'Undo the move' : 'Apply the move';
    $('#tmTip').textContent = moved ? 'Moved. Priya is at 31 of 40 hours, Omar at 24. In the full product, both would approve it first.' : 'Copilot suggests moving “Pricing page build” (6 h) from Priya to Omar.';
  });

  /* ================= questions: one answer open at a time ================= */
  $$('.qa details').forEach(d => d.addEventListener('toggle', () => { if (d.open) $$('.qa details').forEach(o => { if (o !== d) o.open = false; }); }));

  /* ================= demo request (honest: there is no backend yet) ================= */
  const form = $('#demoForm'), fstate = $('#formState');
  form.addEventListener('submit', e => {
    e.preventDefault();
    let bad = null;
    $$('.f', form).forEach(f => { f.classList.remove('is-bad'); f.querySelector('.err')?.remove(); });
    [['name', v => v.trim().length > 1, 'Add your name'], ['email', v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Add a valid work email'], ['company', v => v.trim().length > 1, 'Add your company'], ['size', v => !!v, 'Choose a team size']].forEach(([n, ok, msg]) => {
      const el = form.elements[n]; if (ok(el.value)) return;
      const f = el.closest('.f'); f.classList.add('is-bad'); f.insertAdjacentHTML('beforeend', `<span class="err">${msg}</span>`); bad = bad || el;
    });
    if (bad) { bad.focus(); return; }
    fstate.hidden = false;
    fstate.innerHTML = `<b>Nothing was sent.</b>Thanks, ${esc(form.elements.name.value.trim().split(' ')[0])}. This page isn’t connected to a backend yet, so your request stayed in your browser. On the live site it would reach the team, who would reply to ${esc(form.elements.email.value)}.`;
    if (motion) G.from(fstate, { y: 10, opacity: 0, duration: 0.5, ease: EASE });
  });
  $$('[data-demo]').forEach(a => a.addEventListener('click', () => setTimeout(() => form.elements.name.focus({ preventScroll: true }), 900)));

  /* ================= navigation ================= */
  const nav = $('#nav'), burger = $('#burger'), mnav = $('#mnav');
  let lastY = 0;
  const onScroll = () => { const y = scrollY; nav.classList.toggle('is-scrolled', y > 20); nav.classList.toggle('is-hidden', y > lastY && y > 500 && mnav.hidden); lastY = y; };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  function closeMenu() { mnav.hidden = true; burger.setAttribute('aria-expanded', 'false'); }
  burger.addEventListener('click', () => { const open = mnav.hidden; mnav.hidden = !open; burger.setAttribute('aria-expanded', open); });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const el = a.getAttribute('href').length > 1 && $(a.getAttribute('href')); if (!el) return;
    e.preventDefault(); closeMenu();
    if (lenis) lenis.scrollTo(el, { offset: a.getAttribute('href') === '#top' ? 0 : -40, duration: 1.3 }); else el.scrollIntoView({ behavior: motion ? 'smooth' : 'auto' });
  });

  /* ================= reveals: one gentle language for the whole page ================= */
  if (motion) {
    const groups = ['.sec .label, .sec .h2, .sec .lead', '.statement', '.cmp-h, .cmp-r, .cmp-t', '.wk-sentence, .wk-answer', '.anatomy', '.cp-qs, .cp-body', '.tm-act', '.cap', '.rt-row', '.qa details', '.next li', '.form', '.foot-log'];
    groups.forEach(sel => $$(sel).forEach(el => el.classList.add('rv')));
    // IntersectionObserver reads live positions, so a jump from the nav can never land on an unrevealed section
    let queue = [], flush = null;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); queue.push(e.target); } });
      if (queue.length && !flush) flush = requestAnimationFrame(() => { G.to(queue, { opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: EASE, overwrite: true, onComplete: drawAnat }); queue = []; flush = null; });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rv').forEach(el => io.observe(el));
  }
  /* ================= dashboard tilt (unchanged) ================= */
  const mmHero = motion ? G.matchMedia() : null;
  mmHero?.add('(min-width: 961px)', () => {
    G.set('#stageTilt', { rotateX: 16, scale: 0.93, transformOrigin: '50% 0%' });
    G.to('#stageTilt', { rotateX: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '#heroStage', start: 'top 85%', end: 'top 12%', scrub: 0.8 } });
    G.to('.hero-inner', { yPercent: -18, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: '.hero', start: '12% top', end: '55% top', scrub: true } });
    return () => G.set('#stageTilt', { clearProps: 'transform' });
  });
  if (ST) { addEventListener('load', () => { layoutFits(); ST.refresh(); }); document.fonts?.ready.then(() => { layoutFits(); ST.refresh(); }); }
})();
