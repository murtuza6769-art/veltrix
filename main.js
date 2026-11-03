/* VELTRIX landing page: motion, scroll scenes and the working product demos */
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
  const fmt = n => n.toLocaleString('en-US');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const now = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  if (!motion) root.classList.add('no-motion');
  if (G && ST) G.registerPlugin(ST);

  /* ================= helpers ================= */
  const countTo = (el, to, { dur = 0.9, prefix = '', suffix = '', dec = 0 } = {}) => {
    if (!el) return;
    // start from what is on screen, and cancel a count that is still running on this element
    el._count?.kill();
    const shown = el._shown ?? parseFloat(el.textContent.replace(/[^0-9.-]/g, ''));
    const from = Number.isFinite(shown) ? shown : 0;
    const render = v => { el._shown = v; el.textContent = prefix + (dec ? v.toFixed(dec) : fmt(Math.round(v))) + suffix; };
    if (!motion) return render(to);
    const o = { v: from };
    el._count = G.to(o, { v: to, duration: dur, ease: 'power3.out', onUpdate: () => render(o.v) });
  };
  const icon = (id, size = 14) => `<svg width="${size}" height="${size}"><use href="#${id}"/></svg>`;
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const toast = (text, opt = {}) => {
    const wrap = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = (opt.av ? `<span class="av ${opt.av.cls}">${opt.av.i}</span>` : `<span class="t-ico">${icon(opt.icon || 'i-check')}</span>`) + `<span>${esc(text)}</span>`;
    wrap.appendChild(t);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    if (motion) G.from(t, { y: 20, opacity: 0, scale: 0.96, duration: 0.5, ease: 'expo.out' });
    setTimeout(() => {
      if (motion) G.to(t, { opacity: 0, y: 10, duration: 0.3, onComplete: () => t.remove() });
      else t.remove();
    }, 3600);
  };

  /* ================= smooth scroll ================= */
  let lenis = null;
  if (motion && window.Lenis && finePointer) {
    // inner scroll areas keep their own wheel scrolling instead of moving the page
    // (only while they can actually scroll, so the page stays smooth over them otherwise)
    const ownScroll = '.dir-list, .thread, .cp-a, .modal, .palette, .mnav, .note, .fit-scroll, .ex-tabs, .kanban';
    const canScroll = el => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
    lenis = new window.Lenis({ lerp: 0.11, wheelMultiplier: 1, prevent: node => { const el = node.closest?.(ownScroll); return !!el && (el.matches('.modal, .palette, .mnav') || canScroll(el)); } });
    lenis.on('scroll', ST.update);
    G.ticker.add(t => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }
  const goTo = target => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: el.id === 'top' ? 0 : -10, duration: 1.4 });
    else el.scrollIntoView({ behavior: motion ? 'smooth' : 'auto' });
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-toast')) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    if (a.dataset.feature) selectFeature(a.dataset.feature, true);
    closeMenu();
    goTo(el);
    // move keyboard focus with the scroll (skip link, nav, rail)
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  /* ================= fitted fragments ================= */
  const fits = $$('.fit');
  fits.forEach(f => f.parentElement.classList.add('fit-box'));
  const layoutFits = () => {
    const phone = innerWidth <= 600;
    fits.forEach(f => {
      const box = f.parentElement;
      const narrow = phone && !!f.dataset.wm;
      const w = narrow ? +f.dataset.wm : +f.dataset.w, h = +f.dataset.h;
      const cs = getComputedStyle(box);
      const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      let s = Math.min(1, avail / w);
      // pinned stages also have to fit the viewport height (short laptop screens)
      if (f.dataset.vh && wide()) s = Math.min(s, Math.max(0.5, (innerHeight - +f.dataset.vh) / h));
      // some fragments scroll sideways rather than shrink past legibility
      const scroll = !!f.dataset.min && s < +f.dataset.min;
      if (scroll) s = +f.dataset.min;
      box.classList.toggle('fit-scroll', scroll);
      f.style.width = `${w}px`;
      const auto = narrow || (box.id === 'problemStage' && !wide());
      f.style.height = auto ? 'auto' : `${h}px`;
      f.style.setProperty('--s', s);
      box.style.setProperty('--sw', `${w * s}px`);
      box.style.height = `${f.offsetHeight * s + (scroll ? 14 : 0)}px`;
    });
  };
  layoutFits();
  let fitT;
  addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(layoutFits, 100); });
  // content that renders later (charts, stories, filtered lists) changes the page height:
  // keep every scroll trigger measured against the real layout
  let stT;
  if (ST) new ResizeObserver(() => { clearTimeout(stT); stT = setTimeout(() => ST.refresh(), 200); }).observe(document.body);
  const whenSeen = (el, fn, threshold = 0.15) => {
    if (!el) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { o.disconnect(); fn(); } }, { threshold });
    o.observe(el);
  };

  /* ================= split headings into words ================= */
  const splitWords = el => {
    const out = [];
    const wrap = (word, emph) => `<span class="w"><span>${emph ? `<em>${word}</em>` : word}</span></span>`;
    el.childNodes.forEach(n => {
      if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(p => out.push(/^\s+$/.test(p) ? ' ' : p ? wrap(esc(p)) : ''));
      else if (n.tagName === 'EM') n.textContent.split(/(\s+)/).forEach(p => out.push(/^\s+$/.test(p) ? ' ' : p ? wrap(esc(p), true) : ''));
      else out.push(n.outerHTML);
    });
    el.setAttribute('aria-label', el.textContent);
    el.innerHTML = out.join('');
    $$('.w', el).forEach(w => w.setAttribute('aria-hidden', 'true'));
  };
  $$('.split-words').forEach(splitWords);
  const scrubText = $('#scrubText'), scrubAfter = $('#scrubAfter');
  [scrubText, scrubAfter].forEach(el => {
    el.setAttribute('aria-label', el.textContent);
    el.innerHTML = el.textContent.split(' ').map(w => `<span class="sw" aria-hidden="true">${esc(w)}</span>`).join(' ');
  });
  scrubAfter.innerHTML = scrubAfter.innerHTML.replace(/<span class="sw" aria-hidden="true">one<\/span> <span class="sw" aria-hidden="true">board<\/span>/, '<em><span class="sw" aria-hidden="true">one</span> <span class="sw" aria-hidden="true">board</span></em>');

  /* ================= intro + hero entrance ================= */
  const intro = $('.intro');
  const heroIn = () => {
    countHeroKpis();
    drawHeroChart();
    if (!motion) return;
    const tl = G.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.nav-bar > *', { y: -20, opacity: 0, duration: 0.9, stagger: 0.07 }, 0)
      .from('.announce', { y: 16, opacity: 0, duration: 0.9 }, 0.05)
      .from('.hero-title .ln > span', { yPercent: 115, rotate: 2, duration: 1.2, stagger: 0.1 }, 0.1)
      .from('.hero-sub', { y: 24, opacity: 0, duration: 1 }, 0.45)
      .from('.hero-actions > *', { y: 20, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.55)
      .from('.hero-proof li', { y: 12, opacity: 0, duration: 0.8, stagger: 0.06 }, 0.65)
      .from('#heroVisual', { y: 160, opacity: 0, duration: 1.6, ease: 'expo.out' }, 0.45)
      .from('.app-side > *', { x: -16, opacity: 0, duration: 0.8, stagger: 0.04 }, 0.9)
      .from('.kpi', { y: 20, opacity: 0, duration: 0.8, stagger: 0.07 }, 1)
      .from('.ov-grid .card', { y: 24, opacity: 0, duration: 0.9, stagger: 0.08 }, 1.1)
      .from('.float', { y: 40, opacity: 0, scale: 0.92, duration: 1, stagger: 0.12, ease: 'back.out(1.4)' }, 1.3);
  };
  if (!motion) {
    intro?.remove();
    heroIn();
  } else {
    G.set('.hero-title .ln > span', { yPercent: 115 });
    const num = $('#introNum'), o = { v: 0 };
    const tl = G.timeline({ onComplete: () => intro.remove() });
    // GSAP owns the dots' transform so they grow from their own centre at the tips of the V
    G.set('.intro-mark circle', { scale: 0, transformOrigin: '50% 50%' });
    tl.to('.intro-mark path', { strokeDashoffset: 0, duration: 0.55, ease: 'power2.inOut' }, 0)
      .to('.intro-mark circle', { scale: 1, duration: 0.35, stagger: 0.07, ease: 'back.out(2.5)' }, 0.35)
      .to(o, { v: 100, duration: 0.85, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(o.v); } }, 0)
      .to('.intro-mark', { scale: 0.6, opacity: 0, duration: 0.35, ease: 'power2.in' }, 1.05)
      .fromTo('.intro', { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.75, ease: 'expo.inOut', onStart: () => { G.set('.hero-title .ln > span', { clearProps: 'yPercent' }); heroIn(); } }, 1.1);
    setTimeout(() => { if (document.contains(intro)) tl.progress(1); }, 4000);
  }

  /* ================= nav ================= */
  const nav = $('#nav');
  const progress = $('.nav-progress span');
  const ind = $('.nav-ind');
  const sectionLinks = $$('.nav-link[data-section]');
  const themed = $$('main > section, footer');
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('is-scrolled', y > 20);
    const menuOpen = !$('#mnav').hidden;
    nav.classList.toggle('is-hidden', y > 800 && y > lastY + 2 && !ddMenu.classList.contains('is-open') && !menuOpen && !nav.contains(document.activeElement));
    if (y < lastY - 2) nav.classList.remove('is-hidden');
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    const under = themed.find(s => { const r = s.getBoundingClientRect(); return r.top <= 46 && r.bottom > 46; });
    nav.classList.toggle('is-light', !!under && under.dataset.theme !== 'dark' && !menuOpen);
    let active = null;
    sectionLinks.forEach(a => {
      const r = document.getElementById(a.dataset.section).getBoundingClientRect();
      const on = r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5;
      a.classList.toggle('is-active', on);
      if (on) active = a;
    });
    if (active && active.offsetParent) {
      ind.style.opacity = 1;
      ind.style.width = `${active.offsetWidth - 28}px`;
      ind.style.transform = `translateX(${active.offsetLeft + 14}px)`;
    } else ind.style.opacity = 0;
    railSections.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      railLinks[i].classList.toggle('is-on', r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5);
    });
  };

  // section rail
  const rail = $('.rail');
  const railSections = $$('main > section[data-name]');
  rail.innerHTML = railSections.map(s => `<a href="#${s.id}" aria-label="${s.dataset.name}"><span>${s.dataset.name}</span></a>`).join('');
  const railLinks = $$('a', rail);

  // product dropdown
  const ddBtn = $('.dd-btn'), ddMenu = $('#dd-product');
  const setDD = open => { ddBtn.setAttribute('aria-expanded', open); ddMenu.classList.toggle('is-open', open); };
  let hoverOpened = 0;
  ddBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = ddBtn.getAttribute('aria-expanded') === 'true';
    setDD(!open || performance.now() - hoverOpened < 600);
  });
  if (finePointer) {
    let t;
    $('.dd').addEventListener('mouseenter', () => { clearTimeout(t); if (ddBtn.getAttribute('aria-expanded') !== 'true') hoverOpened = performance.now(); setDD(true); });
    $('.dd').addEventListener('mouseleave', () => { t = setTimeout(() => setDD(false), 200); });
  }
  document.addEventListener('click', e => { if (!e.target.closest('.dd')) setDD(false); });
  ddMenu.addEventListener('click', e => { if (e.target.closest('a')) setDD(false); });

  // mobile menu
  const burger = $('.burger'), mnav = $('#mnav');
  function closeMenu() {
    if (mnav.hidden) return;
    mnav.hidden = true; burger.setAttribute('aria-expanded', 'false'); nav.classList.remove('menu-open');
    burger.innerHTML = icon('i-menu', 22); lenis?.start(); document.body.style.overflow = '';
  }
  burger.addEventListener('click', () => {
    if (!mnav.hidden) return closeMenu();
    mnav.hidden = false; burger.setAttribute('aria-expanded', 'true'); nav.classList.add('menu-open');
    burger.innerHTML = icon('i-x', 22); lenis?.stop(); document.body.style.overflow = 'hidden';
    if (motion) G.from('.mnav nav a, .mnav-cta > *', { y: 30, opacity: 0, duration: 0.6, stagger: 0.04, ease: 'expo.out' });
    onScroll();
  });

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ================= magnetic + cursor ================= */
  if (finePointer && motion) {
    $$('.magnetic').forEach(el => {
      const kids = [...el.children];
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        G.to(el, { x: dx * 0.2, y: dy * 0.3, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
        G.to(kids, { x: dx * 0.08, y: dy * 0.1, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
      });
      el.addEventListener('mouseleave', () => {
        G.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
        G.to(kids, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
      });
    });
    const c = $('.cursor'), label = $('.cursor-label');
    let x = -100, y = -100, cx = x, cy = y;
    addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; c.classList.add('is-on'); }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => c.classList.remove('is-on'));
    $$('.kcard').forEach(k => { k.dataset.cursor = 'Drag'; });
    document.addEventListener('mouseover', e => {
      const lab = e.target.closest('[data-cursor]');
      c.classList.toggle('has-label', !!lab);
      label.textContent = lab ? lab.dataset.cursor : '';
      c.classList.toggle('is-link', !lab && !!e.target.closest('a, button, label, input[type="range"], .o-node, [role="tab"]'));
      c.style.opacity = e.target.closest('input[type="text"], input[type="email"], input[type="search"], textarea') ? '0' : '';
    });
    G.ticker.add(() => {
      cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
      c.style.transform = `translate(${cx}px, ${cy}px)`;
    });
  }

  /* ================= hero: the live product ================= */
  const app = $('#app');
  const people = { LK: { i: 'LK', cls: 'av-2' }, PR: { i: 'PR', cls: 'av-3' }, MO: { i: 'MO', cls: 'av-1' }, OA: { i: 'OA', cls: 'av-5' }, JT: { i: 'JT', cls: 'av-4' } };
  function countHeroKpis() {
    $$('.kpi b[data-count]').forEach(b => { b._shown = 0; countTo(b, +b.dataset.count, { prefix: b.dataset.prefix || '', suffix: b.dataset.suffix || '', dec: +(b.dataset.dec || 0), dur: 1.6 }); });
  }
  // sidebar views
  const appTitles = { overview: 'Overview', projects: 'Projects · Timeline', inbox: 'Inbox', automations: 'Automations' };
  $$('.app-nav button').forEach(b => b.addEventListener('click', () => {
    $$('.app-nav button').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-current', x === b ? 'page' : 'false'); });
    $$('.app-view', app).forEach(v => v.classList.toggle('is-on', v.dataset.v === b.dataset.app));
    $('#appTitle').textContent = appTitles[b.dataset.app];
    if (motion && b.dataset.app === 'projects') G.from('.g-bar', { scaleX: 0, transformOrigin: '0 50%', duration: 0.9, stagger: 0.06, ease: 'expo.out' });
    if (motion && b.dataset.app === 'inbox') G.from('.inbox li', { x: 20, opacity: 0, duration: 0.5, stagger: 0.05, ease: 'expo.out' });
  }));
  // inbox
  const inboxBadge = $('#inboxBadge');
  $('#inboxList').addEventListener('click', e => {
    const b = e.target.closest('[data-done]');
    if (!b) return;
    const li = b.closest('li');
    if (li.classList.contains('is-gone')) return;
    const wasUnread = li.classList.contains('unread');
    li.classList.add('is-gone');
    const next = li.nextElementSibling || li.previousElementSibling;
    setTimeout(() => {
      li.remove();
      if (!$('#inboxList li')) $('#inboxList').innerHTML = '<li class="inbox-empty">Inbox zero. Nothing needs you right now.</li>';
      (next?.querySelector('[data-done]') || $('[data-app="inbox"]')).focus({ preventScroll: true });
    }, 400);
    if (wasUnread) { const n = Math.max(0, +inboxBadge.textContent - 1); inboxBadge.textContent = n; inboxBadge.classList.toggle('is-zero', n === 0); }
  });
  // generic switches
  document.addEventListener('click', e => {
    const sw = e.target.closest('.switch[role="switch"]');
    if (!sw) return;
    const on = !sw.classList.contains('is-on');
    $$(`.switch[aria-label="${sw.getAttribute('aria-label')}"]`).forEach(s => {
      s.classList.toggle('is-on', on); s.setAttribute('aria-checked', on);
      s.closest('li')?.classList.toggle('is-off', !on);
    });
    $('#autoActive').textContent = $$('.rules .switch.is-on').length;
    toast(`${sw.getAttribute('aria-label')} ${on ? 'switched on' : 'paused, history kept'}`, { icon: 'i-zap' });
  });
  // small helpers on buttons
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-toast]');
    if (t) { e.preventDefault(); toast(t.dataset.toast, { icon: 'i-spark' }); }
    if (e.target.closest('[data-copy-link]')) {
      const url = location.href.split('#')[0] + '#top';
      (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => toast('Link to this workspace view copied'), () => toast('Share link: ' + url, { icon: 'i-link' }));
    }
  });

  // live feed + tasks
  const autoLog = $('#autoLog');
  let runs = 18420;
  const logAuto = (text, ic = 'i-zap', col = 'c-jade', isRun = true) => {
    const li = document.createElement('li');
    li.className = 'new';
    li.innerHTML = `<span class="f-ico ${col}">${icon(ic, 13)}</span><p>${esc(text)}</p><time>${now()}</time>`;
    autoLog.prepend(li);
    while (autoLog.children.length > 4) autoLog.lastElementChild.remove();
    if (motion) G.from(li, { height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, duration: 0.6, ease: 'expo.out' });
    setTimeout(() => li.classList.remove('new'), 2000);
    if (!isRun) return;
    runs++;
    $('#runCount').textContent = fmt(runs);
    $('#kRuns').textContent = fmt(runs); $('#kRuns')._shown = runs;
  };
  const tasks = $('#tasks');
  let copilotStage = 0;
  const emailBox = $('[data-id="t4"] input', tasks);
  const copilotIdle = { text: $('#copilotText').textContent, yes: $('#copilotYes').textContent };
  // the launch email cannot be sent while it waits on Design QA
  const setEmailBlocked = blocked => {
    const tag = $('[data-id="t4"] .tag', tasks);
    tag.textContent = blocked ? 'Waiting on QA' : 'Ready';
    tag.className = `tag ${blocked ? 'tag-warn' : 'tag-ready'}`;
    if (blocked) tag.dataset.blocked = ''; else delete tag.dataset.blocked;
    emailBox.disabled = blocked;
    emailBox.closest('label').title = blocked ? 'Waiting on Design QA' : '';
  };
  setEmailBlocked(true);
  const rules = {
    t3: { on: () => {
      if (!emailBox.checked) setEmailBlocked(false);
      logAuto('Design QA done → launch email moved to Ready');
      toast('Lena K. was told the launch email is ready', { av: people.LK });
      $('#copilotText').textContent = 'Design QA is closed. The launch email is unblocked and can go out Thursday as planned.';
      $('#copilotYes').textContent = 'Schedule it';
      copilotStage = 2;
    }, off: () => {
      // a sent email stays sent; an unsent one waits on QA again
      if (!emailBox.checked) { setEmailBlocked(true); logAuto('Design QA reopened → launch email held', 'i-alert', 'c-saffron'); }
      else logAuto('Design QA reopened', 'i-clock', 'c-saffron', false);
      $('#copilotText').textContent = copilotIdle.text;
      $('#copilotYes').textContent = copilotIdle.yes;
      copilotStage = 0;
    } },
    t4: { on: () => { logAuto('Launch email sent → 12,400 queued, tracking opens', 'i-mail', 'c-sky'); toast('Campaign live. Results stream into Analytics', { av: people.LK }); } },
    t5: { on: () => { logAuto('Forecast filed → shared with Finance', 'i-chart', 'c-sky'); toast('Omar A. shared the Q4 forecast with Finance', { av: people.OA }); } }
  };
  const refreshBoard = () => {
    const all = $$('.task', tasks), done = all.filter(t => t.querySelector('input').checked);
    const pct = Math.round(done.length / all.length * 100);
    countTo($('#pct'), pct, { dur: 0.8 });
    $('#pctBar').style.width = `${pct}%`;
    $('.app-projects li span').textContent = `${pct}%`;
    const blocked = $$('[data-blocked]', tasks).length;
    $('#kBlock').textContent = blocked;
    $('.kbar.warn i').style.width = `${blocked ? 18 : 0}%`;
  };
  tasks.addEventListener('change', e => {
    const li = e.target.closest('.task');
    if (!li) return;
    $$('.task.hint', tasks).forEach(t => t.classList.remove('hint'));
    const on = e.target.checked;
    li.classList.toggle('is-done', on);
    const r = rules[li.dataset.id];
    if (on) r?.on ? r.on() : logAuto(`${li.querySelector('.t-title').textContent} completed`, 'i-check', 'c-jade', false);
    else r?.off ? r.off() : logAuto(`${li.querySelector('.t-title').textContent} reopened`, 'i-clock', 'c-saffron', false);
    refreshBoard();
  });
  // copilot float: 0 = suggesting, 1 = reminder set, waiting on QA, 2 = QA closed, ready to schedule
  $('#copilotYes').addEventListener('click', () => {
    const qa = $('[data-id="t3"] input', tasks);
    if (!qa.checked && copilotStage === 0) {
      toast('Copilot will remind Lena when Design QA closes', { av: people.LK });
      logAuto('Copilot set a reminder for Lena K.', 'i-spark', 'c-saffron', false);
      $('#copilotText').textContent = 'Done. I\'ll message Lena the moment Design QA is ticked off. Try ticking it in the checklist.';
      $('#copilotYes').textContent = 'Got it';
      copilotStage = 1;
    } else if (!qa.checked) {
      toast('Still waiting on Design QA. Lena will hear as soon as it closes', { icon: 'i-clock' });
    } else if (emailBox.checked) {
      toast('The launch email has already gone out', { icon: 'i-mail' });
    } else {
      toast('Launch email scheduled for Thursday 10:00', { icon: 'i-cal' });
      $('#copilotText').textContent = 'Scheduled for Thursday at 10:00. I\'ll post open rates in #launch after 24 hours.';
      G && motion && G.fromTo('.f-copilot', { scale: 0.97 }, { scale: 1, duration: 0.5, ease: 'back.out(2)' });
    }
  });
  $('#copilotNo').addEventListener('click', () => {
    $('#copilotText').textContent = 'Okay. I\'ll check the launch timeline again at 15:00 and flag anything at risk.';
    toast('Copilot will check again at 15:00', { icon: 'i-clock' });
  });
  // ambient activity while the hero is visible
  const ambient = [['Overdue check → nothing overdue', 'i-clock', 'c-sky'], ['Kickoff booked → onboarding project opened', 'i-cal', 'c-jade'], ['Stripe payout matched → milestone closed', 'i-card', 'c-saffron'], ['Daily digest sent to 4 people', 'i-mail', 'c-sky']];
  let ambI = 0, heroVisible = true;
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe($('.hero'));
  setInterval(() => { if (heroVisible && !document.hidden) logAuto(...ambient[ambI++ % ambient.length]); }, 6500);

  // hero chart: draw-in and hover readout
  function drawHeroChart() {
    const line = $('.hc-line'), area = $('.hc-area');
    if (!motion) return;
    const len = line.getTotalLength();
    G.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 2, ease: 'power2.inOut', delay: 0.9 });
    G.from(area, { opacity: 0, duration: 1.2, delay: 1.6 });
    G.from('.hc-dot', { opacity: 0, scale: 0.6, transformOrigin: 'center', duration: 0.5, delay: 2.6 });
    G.from('.hc-tip', { opacity: 0, duration: 0.5, delay: 2.6 });
  }
  (() => {
    const svg = $('#heroChart'), line = $('.hc-line'), dot = $('.hc-dot'), tip = $('.hc-tip'), card = $('.chart-card');
    const len = line.getTotalLength();
    const pointAtX = x => { let lo = 0, hi = len; for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (line.getPointAtLength(mid).x < x) lo = mid; else hi = mid; } return line.getPointAtLength(lo); };
    const place = x => {
      const p = pointAtX(clamp(x, 2, 518));
      dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
      const sr = svg.getBoundingClientRect(), cr = card.getBoundingClientRect(), k = sr.width / cr.width;
      const sx = (sr.left - cr.left) / (cr.width / card.offsetWidth), sy = (sr.top - cr.top) / (cr.height / card.offsetHeight);
      const half = tip.offsetWidth / 2 + 6;
      tip.style.left = `${clamp(sx + p.x / 520 * svg.clientWidth, half, card.offsetWidth - half)}px`;
      tip.style.top = `${sy + p.y / 200 * svg.clientHeight}px`;
      const week = Math.min(13, Math.round(p.x / 520 * 12) + 1), val = (28 + (200 - p.y) / 200 * 24).toFixed(1);
      tip.innerHTML = `<b>$${val}k</b> week ${week}`;
      return k;
    };
    place(460);
    svg.addEventListener('mousemove', e => { const r = svg.getBoundingClientRect(); place((e.clientX - r.left) / r.width * 520); });
    svg.addEventListener('mouseleave', () => place(460));
    addEventListener('resize', () => place(460));
  })();

  // hero depth: scroll flattens the product, the mouse moves the floating layers
  if (motion) {
    G.fromTo('#heroVisual .fit', { '--rx': '18deg' }, { '--rx': '0deg', ease: 'none', scrollTrigger: { trigger: '#heroVisual', start: 'top 92%', end: 'top 18%', scrub: 0.6 } });
    G.to('.hero-title', { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '40% top', scrub: true } });
    G.to('.f-copilot', { yPercent: -30, ease: 'none', scrollTrigger: { trigger: '#heroVisual', start: 'top 60%', end: 'bottom top', scrub: true } });
    G.to('.f-deal', { yPercent: -150, ease: 'none', scrollTrigger: { trigger: '#heroVisual', start: 'top 60%', end: 'bottom top', scrub: true } });
    G.to('.f-run', { yPercent: -30, ease: 'none', scrollTrigger: { trigger: '#heroVisual', start: 'top 60%', end: 'bottom top', scrub: true } });
    G.to('.hero-glow.g1', { yPercent: 30, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    if (finePointer) {
      const floats = $$('.float');
      G.set(floats, { z: 60 });
      $('.hero').addEventListener('mousemove', e => {
        const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
        floats.forEach(f => G.to(f, { xPercent: -nx * f.dataset.depth / 3, rotateY: nx * 6, rotateX: -ny * 6, duration: 1.2, ease: 'power3.out', overwrite: 'auto' }));
      });
    }
  }

  /* ================= problem → solution (pinned scrub) ================= */
  const psTools = $('#psTools'), psMeet = $('#psMeet'), psHours = $('#psHours'), problem = $('#problem');
  const setStats = k => {
    psTools.textContent = Math.round(lerp(6, 1, k));
    psMeet.textContent = Math.round(lerp(9, 2, k));
    psHours.textContent = lerp(9.5, 1.2, k).toFixed(1);
    problem.classList.toggle('is-solved', k > 0.6);
  };
  // the pinned scenes are built per breakpoint, so resizing across 960px rebuilds or removes them cleanly
  const mm = motion ? G.matchMedia() : null;
  const wideMQ = '(min-width: 961px)', narrowMQ = '(max-width: 960px)';
  if (!mm) setStats(1);
  mm?.add(narrowMQ, () => setStats(1));
  mm?.add(wideMQ, () => {
    const words = $$('.sw', scrubText), after = $$('.sw', scrubAfter);
    const cards = $$('.chaos .m');
    G.set(after, { opacity: 0, y: 14 });
    const tl = G.timeline({ scrollTrigger: { trigger: problem, start: 'top top', end: 'bottom bottom', scrub: 0.8 } });
    tl.to(words, { opacity: 1, stagger: 0.02, duration: 0.1, ease: 'none' }, 0)
      .fromTo(cards, { y: (i) => [30, -20, 40, -30, 20][i] }, { y: (i) => [-30, 20, -40, 30, -20][i], duration: 0.4, ease: 'none' }, 0)
      .to(cards, {
        x: (i, el) => 380 - (el.offsetLeft + el.offsetWidth / 2),
        y: (i, el) => 300 - (el.offsetTop + el.offsetHeight / 2),
        rotation: 0, scale: 0.35, opacity: 0, duration: 0.3, stagger: 0.03, ease: 'power2.in'
      }, 0.42)
      .to(scrubText, { opacity: 0, y: -24, duration: 0.08 }, 0.52)
      .set(scrubAfter, { opacity: 1 }, 0.55)
      .to(after, { opacity: 1, y: 0, stagger: 0.01, duration: 0.06 }, 0.55)
      .to('.order', { opacity: 1, scale: 1, y: 0, duration: 0.18, ease: 'power3.out' }, 0.52)
      .from('.o-row', { x: 30, opacity: 0, stagger: 0.025, duration: 0.1 }, 0.58)
      .to({ k: 0 }, { k: 1, duration: 0.3, ease: 'none', onUpdate() { setStats(this.targets()[0].k); } }, 0.45)
      .to({}, { duration: 0.25 }, 0.75);
    return () => setStats(1);
  });

  /* ================= playground: note → tasks ================= */
  const roster = {
    maya: { i: 'MO', cls: 'av-1', n: 'Maya O.' }, omar: { i: 'OA', cls: 'av-5', n: 'Omar A.' },
    lena: { i: 'LK', cls: 'av-2', n: 'Lena K.' }, priya: { i: 'PR', cls: 'av-3', n: 'Priya R.' },
    jonas: { i: 'JT', cls: 'av-4', n: 'Jonas T.' }
  };
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const tagsFor = [
    [/contract|vendor|legal|office/i, 'Operations', 'tag-jade'], [/forecast|invoice|finance|budget|payroll/i, 'Finance', 'tag-saffron'],
    [/hire|hiring|onboarding|interview|agents?/i, 'People', 'tag-coral'], [/email|launch|campaign|copy|post|homepage/i, 'Marketing', 'tag-sky'],
    [/design|qa|bug|release|build|kickoff/i, 'Client work', 'tag-jade']
  ];
  const dueRe = /\b(?:by|on|due)?\s*(today|tonight|tomorrow|eow|end of (?:the )?week|(next\s+)?(mon|tue|wed|thu|fri|sat|sun)(?:day|s|sday|nesday|rsday|r|rs|urday)?)\b/i;
  const dueOf = m => {
    if (!m) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const w = m[1].toLowerCase();
    let add = 0;
    if (w === 'tomorrow') add = 1;
    else if (w === 'today' || w === 'tonight') add = 0;
    else if (w.startsWith('eow') || w.startsWith('end')) add = (5 - today.getDay() + 7) % 7;
    else { add = (days.indexOf(m[3].toLowerCase()) - today.getDay() + 7) % 7; if (m[2]) add += 7; }
    const d = new Date(today); d.setDate(d.getDate() + add);
    const label = add === 0 ? 'Today' : add === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return { label, soon: add <= 2 };
  };
  const parseLine = raw => {
    let s = raw.replace(/^[\s\-*•]+/, '').trim();
    if (!s) return null;
    let owner = null;
    for (const k of Object.keys(roster)) {
      const re = new RegExp(`(^${k}\\s*(?::|to|will|-)?\\s+|,?\\s*\\b${k}\\b,?)`, 'i');
      if (re.test(s)) { owner = roster[k]; s = s.replace(re, ' '); break; }
    }
    const dm = s.match(dueRe);
    const due = dueOf(dm);
    if (dm) s = s.replace(dm[0], ' ');
    const hi = /!!|urgent|asap|overdue/i.test(s);
    s = s.replace(/!+/g, ' ').replace(/\b(asap|urgent)\b/ig, ' ').replace(/^\s*(need(s)?|todo|to)\s+/i, '');
    s = s.replace(/\s{2,}/g, ' ').replace(/[\s,;:.]+$/, '').replace(/^[\s,;:]+/, '').trim();
    if (s.split(' ').length < 2) return null;
    s = s.charAt(0).toUpperCase() + s.slice(1);
    const tag = tagsFor.find(([re]) => re.test(raw)) || [null, 'General', 'tag-sky'];
    return { title: s, owner, due, hi, tag };
  };
  const noteIn = $('#noteInput'), parsedList = $('#parsedList'), spark = $('.pb-spark');
  let lastSig = '';
  const renderParsed = () => {
    spark.classList.remove('is-busy');
    const lines = noteIn.value.split('\n');
    const header = lines.length && /sync|meeting|standup|notes|retro/i.test(lines[0]) && lines[0].split(' ').length <= 5;
    const items = (header ? lines.slice(1) : lines).map(parseLine).filter(Boolean);
    const sig = JSON.stringify(items);
    if (sig === lastSig) return;
    lastSig = sig;
    parsedList.innerHTML = items.map(it => `<li>
      <span class="p-t"><i class="flag${it.hi ? ' hi' : ''}" title="${it.hi ? 'High priority' : 'Normal priority'}"></i><span>${esc(it.title)}</span></span>
      <span class="tag ${it.tag[2]}">${it.tag[1]}</span>
      ${it.owner ? `<span class="av av-s ${it.owner.cls}" title="${it.owner.n}">${it.owner.i}</span>` : '<span class="av av-s av-none" title="No owner yet">?</span>'}
      <span class="p-due${it.due?.soon ? ' soon' : ''}">${it.due ? it.due.label : 'No date'}</span>
    </li>`).join('') || '<li class="empty">Type a note on the left. Each line becomes a task.</li>';
    const owners = new Set(items.filter(i => i.owner).map(i => i.owner.i));
    $('#parsedCount').textContent = `${items.length} task${items.length === 1 ? '' : 's'}`;
    $('#parsedLive').textContent = `Copilot found ${items.length} task${items.length === 1 ? '' : 's'} with ${owners.size} owner${owners.size === 1 ? '' : 's'}.`;
    $('#parsedMeta').textContent = `${owners.size} owner${owners.size === 1 ? '' : 's'} notified on save`;
    if (header) $('.po-title').textContent = lines[0].replace(/[—–-].*$/, '').trim().replace(/^./, c => c.toUpperCase()) || 'Meeting';
    if (motion) G.from(parsedList.children, { opacity: 0, x: 16, duration: 0.45, stagger: 0.04, ease: 'expo.out' });
  };
  let nt;
  noteIn.addEventListener('input', () => { spark.classList.add('is-busy'); clearTimeout(nt); nt = setTimeout(renderParsed, 350); });
  renderParsed();
  $$('.pi-chips [data-add]').forEach(b => b.addEventListener('click', () => {
    noteIn.value = noteIn.value.replace(/\s+$/, '') + '\n' + b.dataset.add;
    noteIn.dispatchEvent(new Event('input'));
    noteIn.scrollTop = noteIn.scrollHeight;
  }));
  $('#parsedSave').addEventListener('click', e => {
    const n = parsedList.querySelectorAll('li:not(.empty)').length;
    if (!n) return;
    toast(`${n} tasks added to Q4 launch. ${$('#parsedMeta').textContent.split(' ')[0]} owners notified (demo)`, { av: people.MO });
    e.currentTarget.textContent = 'Added';
    setTimeout(() => { $('#parsedSave').textContent = 'Add to Q4 launch'; }, 2200);
  });

  /* ================= workflow canvas ================= */
  const canvas = $('#canvas');
  const ruleText = $('#ruleText');
  const ruleFull = 'When a deal closes in HubSpot, open an onboarding project, give it to Priya, invoice the kickoff and tell #wins.';
  let step = -1, typeTimer;
  const typeRule = on => {
    clearInterval(typeTimer);
    if (!on) { ruleText.textContent = ''; return; }
    if (!motion) { ruleText.textContent = ruleFull; return; }
    let i = ruleText.textContent.length;
    typeTimer = setInterval(() => {
      ruleText.textContent = ruleFull.slice(0, ++i);
      if (i >= ruleFull.length) clearInterval(typeTimer);
    }, 20);
  };
  const setStep = s => {
    if (s === step) return;
    step = s;
    canvas.dataset.step = s;
    $$('.flow-steps li').forEach((li, i) => li.classList.toggle('is-on', i === s));
    $('#canvasState').textContent = ['Connecting', 'Draft', 'Live'][s];
    $$('.n-src .n-c', canvas).forEach((c, i) => {
      c.textContent = s === 0 ? 'Connecting…' : 'Connected';
      if (s === 0) setTimeout(() => { if (step === 0) c.textContent = 'Connected'; }, 700 + i * 500);
    });
    typeRule(s >= 1);
    if (s === 2) startRuns(); else stopRuns();
  };
  const clients = ['Holloway Dental', 'Brightline Tours', 'Kessler & Ode', 'Fjord Coffee', 'Marlow Legal', 'Acme Freight', 'Tessera'];
  let runN = 1284, runTimer = null, running = false;
  const pathEl = id => $(`#${id}`, canvas);
  const travel = (pulse, id, dur) => new Promise(res => {
    const p = pathEl(id), len = p.getTotalLength();
    const graph = $('#graph'), sx = graph.clientWidth / 720, sy = graph.clientHeight / 336;
    p.classList.add('is-hot');
    const t0 = performance.now();
    pulse.style.opacity = 1;
    const tick = t => {
      const k = Math.min((t - t0) / dur, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const pt = p.getPointAtLength(e * len);
      pulse.style.transform = `translate(${pt.x * sx}px, ${pt.y * sy}px)`;
      if (k < 1) requestAnimationFrame(tick);
      else { pulse.style.opacity = 0; p.classList.remove('is-hot'); res(); }
    };
    requestAnimationFrame(tick);
  });
  const flash = n => { n.classList.add('is-hot'); setTimeout(() => n.classList.remove('is-hot'), 650); };
  const runOnce = async () => {
    if (running) return;
    running = true;
    const src = Math.random() > 0.35 ? 0 : 1;
    flash($$('.n-src', canvas)[src]);
    await travel($('.p1', canvas), src ? 'e2' : 'e1', motion ? 700 : 1);
    flash($('.n-core', canvas));
    await Promise.all([travel($('.p1', canvas), 'e3', motion ? 650 : 1), travel($('.p2', canvas), 'e4', motion ? 650 : 1), travel($('.p3', canvas), 'e5', motion ? 650 : 1)]);
    $$('.n-act', canvas).forEach(flash);
    runN++;
    const row = document.createElement('div');
    row.className = 'run-row new';
    row.innerHTML = `<span class="ok">${icon('i-check', 10)}</span><b>Run ${fmt(runN)}</b><span>${clients[runN % clients.length]}</span><span class="muted">3 actions</span><span class="muted">${(1.6 + Math.random() * 1.2).toFixed(1)} s</span>`;
    $('#runLog').prepend(row);
    while ($('#runLog').children.length > 3) $('#runLog').lastElementChild.remove();
    if (motion) G.from(row, { y: -12, opacity: 0, duration: 0.5, ease: 'expo.out' });
    setTimeout(() => row.classList.remove('new'), 1200);
    running = false;
  };
  const startRuns = () => { if (runTimer) return; runOnce(); runTimer = setInterval(() => { if (!document.hidden) runOnce(); }, 2800); };
  const stopRuns = () => { clearInterval(runTimer); runTimer = null; };
  // on wide screens the scroll position owns the step, so jump to where the rule is live instead of forcing it
  let flowST = null;
  function showLiveRule() {
    if (flowST) {
      const y = flowST.start + 0.82 * (flowST.end - flowST.start);
      if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else scrollTo({ top: y, behavior: motion ? 'smooth' : 'auto' });
      setTimeout(runOnce, 1400);
    } else { goTo('#workflows'); setStep(2); setTimeout(runOnce, 600); }
  }
  $('#runTest').addEventListener('click', () => { if (step < 2) showLiveRule(); else runOnce(); });
  $$('.node', canvas).forEach(n => {
    n.addEventListener('mouseenter', () => { n.dataset.links.split(' ').forEach(id => pathEl(id).classList.add('is-hot')); n.classList.add('is-hot'); });
    n.addEventListener('mouseleave', () => { n.dataset.links.split(' ').forEach(id => pathEl(id).classList.remove('is-hot')); n.classList.remove('is-hot'); });
  });
  // narrow screens and reduced motion: the rule simply runs while the canvas is on screen
  const runWhileVisible = () => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStep(2); startRuns(); } else stopRuns(); }, { threshold: 0.3 });
    o.observe(canvas);
    return () => { o.disconnect(); stopRuns(); };
  };
  if (!mm) runWhileVisible();
  mm?.add(narrowMQ, runWhileVisible);
  mm?.add(wideMQ, () => {
    const bars = $$('.fs-bar i');
    const resume = () => { if (step === 2) startRuns(); };
    flowST = ST.create({
      trigger: '.flow', start: 'top top', end: 'bottom bottom',
      onUpdate: self => {
        const p = self.progress * 3;
        bars.forEach((b, i) => b.style.setProperty('--p', clamp(p - i, 0, 1)));
        setStep(Math.min(2, Math.floor(p)));
      },
      onEnter: resume, onEnterBack: resume,
      onLeave: stopRuns, onLeaveBack: () => { setStep(0); stopRuns(); }
    });
    G.from('.canvas', { rotateY: -14, rotateX: 6, scale: 0.92, opacity: 0, transformPerspective: 1600, ease: 'expo.out', duration: 1.4, scrollTrigger: { trigger: '.flow', start: 'top 70%', once: true } });
    return () => { flowST = null; stopRuns(); bars.forEach(b => b.style.removeProperty('--p')); };
  });
  setStep(0);

  /* ================= cinematic image ================= */
  mm?.add(wideMQ, () => {
    const tl = G.timeline({ scrollTrigger: { trigger: '.cine', start: 'top top', end: 'bottom bottom', scrub: 0.8 } });
    tl.fromTo('.cine-media', { clipPath: 'inset(22% 30% 22% 30% round 28px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.inOut', duration: 0.55 }, 0)
      .to('.cine-media img', { scale: 1, ease: 'none', duration: 1 }, 0)
      .to('.cine-scrim', { opacity: 1, duration: 0.3 }, 0.35)
      .from('.cine-h .ln > span', { yPercent: 110, stagger: 0.08, duration: 0.25, ease: 'power3.out' }, 0.5)
      .from('.cine-copy p', { y: 30, opacity: 0, duration: 0.2 }, 0.62);
  });
  mm?.add(narrowMQ, () => {
    G.from('.cine-h .ln > span', { yPercent: 110, stagger: 0.1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.cine', start: 'top 70%', once: true } });
  });

  /* ================= feature explorer ================= */
  const panel = $('#panel-ex');
  const exTabs = $$('.ex-tabs button');
  let autoplay = true, exTween = null;
  function selectFeature(f, user = false) {
    if (user) autoplay = false;
    exTabs.forEach(b => { const on = b.dataset.feature === f; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); if (on) panel.setAttribute('aria-labelledby', b.id); });
    const row = $('.ex-tabs'), cur = exTabs.find(b => b.dataset.feature === f);
    if (row.scrollWidth > row.clientWidth + 4) row.scrollTo({ left: cur.offsetLeft - 20, behavior: motion ? 'smooth' : 'auto' });
    $$('.view', panel).forEach(v => v.classList.toggle('is-on', v.dataset.view === f));
    if (f === 'monitor' && motion) G.fromTo('.load-row i', { scaleX: 0 }, { scaleX: 1, duration: 1, stagger: 0.08, ease: 'expo.out' });
    if (f === 'copilot') askCopilot($('.cp-q .is-on').dataset.q);
    if (motion) G.fromTo(panel, { rotateY: -3, transformPerspective: 1800 }, { rotateY: 0, duration: 0.9, ease: 'expo.out', overwrite: 'auto' });
    runExProgress();
  }
  const runExProgress = () => {
    exTween?.kill();
    $$('.ex-prog').forEach(p => { p.style.transform = 'scaleX(0)'; });
    if (!motion || !autoplay) return;
    const cur = $('.ex-tabs .is-on .ex-prog');
    exTween = G.fromTo(cur, { scaleX: 0 }, { scaleX: 1, duration: 7, ease: 'none', paused: !exVisible, onComplete: () => {
      const i = exTabs.findIndex(b => b.classList.contains('is-on'));
      selectFeature(exTabs[(i + 1) % exTabs.length].dataset.feature);
    } });
  };
  let exVisible = false;
  new IntersectionObserver(([e]) => { exVisible = e.isIntersecting; if (exTween) exVisible ? exTween.play() : exTween.pause(); }, { threshold: 0.4 }).observe($('.explorer'));
  exTabs.forEach(b => b.addEventListener('click', () => selectFeature(b.dataset.feature, true)));
  runExProgress();
  const rovingTabs = list => {
    const tabs = $$('[role="tab"]', list);
    const sync = () => tabs.forEach(t => { t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1; });
    sync();
    new MutationObserver(sync).observe(list, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
    if (list.classList.contains('ex-tabs')) return;
    list.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      const i = tabs.indexOf(document.activeElement);
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (/Right|Down/.test(e.key) ? 1 : -1) + tabs.length) % tabs.length;
      tabs[n].focus(); tabs[n].click(); e.preventDefault();
    });
  };
  $$('[role="tablist"]').forEach(rovingTabs);
  $('.ex-stage').addEventListener('mouseenter', () => exTween?.pause());
  $('.ex-stage').addEventListener('mouseleave', () => exVisible && exTween?.play());
  $('.ex-tabs').addEventListener('keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const i = exTabs.indexOf(document.activeElement);
    const n = exTabs[(i + (/Down|Right/.test(e.key) ? 1 : -1) + exTabs.length) % exTabs.length];
    n.focus(); n.click(); e.preventDefault();
  });
  $$('[data-goto-feature]').forEach(b => b.addEventListener('click', () => selectFeature(b.dataset.gotoFeature, true)));
  if (finePointer) {
    $('.ex-stage').addEventListener('mousemove', e => {
      const r = panel.getBoundingClientRect();
      panel.style.setProperty('--mx', `${e.clientX - r.left}px`);
      panel.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }
  // kanban: drag and drop, arrow keys move a card between columns
  let dragging = null;
  const cols = $$('.col', panel);
  const refreshCols = moved => {
    cols.forEach(c => { c.querySelector('.col-h span').textContent = c.querySelectorAll('.kcard').length; });
    if (!moved) return;
    const col = moved.closest('.col');
    moved.classList.toggle('is-done', col.dataset.col === 'done');
    $('#kanMeta').textContent = `Moved "${moved.querySelector('b').textContent}" to ${col.querySelector('.col-h').childNodes[1].textContent.trim()}`;
    if (motion) G.fromTo(moved, { scale: 0.95 }, { scale: 1, duration: 0.5, ease: 'back.out(2)' });
  };
  $$('.kcard', panel).forEach(k => {
    k.addEventListener('dragstart', e => { autoplay = false; exTween?.kill(); dragging = k; k._from = [k.parentElement, k.nextElementSibling]; k.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); });
    k.addEventListener('dragend', e => {
      k.classList.remove('is-drag'); cols.forEach(c => c.classList.remove('is-over')); dragging = null;
      const [col, next] = k._from;
      if (e.dataTransfer.dropEffect === 'none') { col.insertBefore(k, next && next.parentElement === col ? next : null); refreshCols(); return; }
      refreshCols(k.parentElement === col ? null : k);
    });
    k.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const i = cols.indexOf(k.closest('.col')) + (e.key === 'ArrowRight' ? 1 : -1);
      if (i < 0 || i >= cols.length) return;
      cols[i].appendChild(k); k.focus(); refreshCols(k); e.preventDefault();
    });
  });
  cols.forEach(c => {
    c.addEventListener('dragover', e => {
      if (!dragging) return;
      e.preventDefault(); c.classList.add('is-over');
      const after = [...c.querySelectorAll('.kcard:not(.is-drag)')].find(el => e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2);
      after ? c.insertBefore(dragging, after) : c.appendChild(dragging);
    });
    c.addEventListener('dragleave', e => { if (!c.contains(e.relatedTarget)) c.classList.remove('is-over'); });
    c.addEventListener('drop', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  });
  $$('.rules li').forEach(li => li.classList.toggle('is-off', !li.querySelector('.switch').classList.contains('is-on')));
  // copilot answers (scripted demo answers built from the sample workspace)
  const answers = {
    risk: { text: 'Two projects need attention. <b>Q4 launch</b> depends on Design QA, which is 3 screens from done, so the launch email may slip a day. <b>Hiring · Support</b> is 30% complete with interviews booked past the target date.', rows: [['Q4 launch', 50, 'c-saffron', 'At risk'], ['Hiring · Support', 30, 'c-coral', 'Behind'], ['Website relaunch', 42, 'c-jade', 'On track'], ['Client onboarding', 88, 'c-jade', 'On track']], src: ['Design QA thread', 'Q4 launch timeline', 'Greenhouse'] },
    load: { text: '<b>Priya</b> is booked for 37 hours across 3 projects this week, 92% of capacity. Moving “Migrate blog redirects” to <b>Omar</b>, who has 18 hours booked, would bring her to 78%.', rows: [['Priya R.', 92, 'c-coral', '37 h'], ['Lena K.', 70, 'c-sky', '28 h'], ['Maya O.', 58, 'c-sky', '23 h'], ['Omar A.', 44, 'c-jade', '18 h']], src: ['Calendars', 'Task estimates', 'Time off'] },
    week: { text: 'This week the team closed <b>34 tasks</b>, 9 more than last week. Revenue recognised reached <b>$48.2k</b>, up 12.4%. 4,310 automation runs saved roughly <b>41 hours</b>. One blocker remains: Design QA.', rows: [['Tasks closed', 85, 'c-jade', '34'], ['Revenue', 74, 'c-sky', '$48.2k'], ['Hours saved', 68, 'c-saffron', '41 h'], ['Blockers', 12, 'c-coral', '1']], src: ['All projects', 'Stripe', 'Automation log'] }
  };
  let cpTimer;
  function askCopilot(q) {
    const a = answers[q], box = $('#cpAnswer');
    clearInterval(cpTimer);
    box.innerHTML = `<div class="cp-head"><span class="fc-spark">${icon('i-spark', 14)}</span>Copilot<span class="typing"><i></i><i></i><i></i></span></div><p class="cp-text"></p>
      <div class="cp-viz">${a.rows.map(r => `<div class="cp-row ${r[2]}"><span>${r[0]}</span><em><i style="width:0%" data-w="${r[1]}"></i></em><b>${r[3]}</b></div>`).join('')}</div>
      <div class="cp-src">Sources ${a.src.map(s => `<span>${s}</span>`).join('')}</div>`;
    box.setAttribute('aria-busy', 'true');
    const p = $('.cp-text', box), plain = a.text.replace(/<[^>]+>/g, '');
    let i = 0;
    const finish = () => {
      clearInterval(cpTimer);
      p.innerHTML = a.text;
      box.setAttribute('aria-busy', 'false');
      $('.typing', box)?.remove();
      $('.cp-viz', box).classList.add('is-on');
      $$('.cp-viz i', box).forEach(el => { requestAnimationFrame(() => { el.style.transition = 'width 1s cubic-bezier(.16,1,.3,1)'; el.style.width = el.dataset.w + '%'; }); });
    };
    if (!motion) return finish();
    cpTimer = setInterval(() => { i += 3; p.textContent = plain.slice(0, i); if (i >= plain.length) finish(); }, 16);
  }
  $$('.cp-q button').forEach(b => b.addEventListener('click', () => {
    autoplay = false; exTween?.kill();
    $$('.cp-q button').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); });
    askCopilot(b.dataset.q);
  }));
  // collaboration thread
  $('#compose').addEventListener('submit', e => {
    e.preventDefault();
    autoplay = false; exTween?.kill();
    const inp = $('#composeIn'), v = inp.value.trim();
    if (!v) { inp.focus(); return; }
    const thread = $('#thread');
    const add = (av, cls, name, html) => {
      const m = document.createElement('div');
      m.className = 'msg new';
      m.innerHTML = `<span class="av av-s ${cls}">${av}</span><div><b>${name}</b><time>${now()}</time><p>${html}</p></div>`;
      thread.appendChild(m); thread.scrollTop = 1e6;
      return m;
    };
    add('YO', 'av-5', 'You', esc(v));
    inp.value = '';
    const typing = add('PR', 'av-3', 'Priya R.', '<span class="typing"><i></i><i></i><i></i></span>');
    setTimeout(() => { $('p', typing).textContent = 'Got it. Adding that to the QA checklist now.'; }, 1400);
  });

  /* ================= analytics dashboard ================= */
  const dashChart = $('#dashChart'), dashSum = $('#dashSum'), dashSide = $('#dashSide'), dashCtl = $('#dashCtl');
  const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  let dash = 'revenue', range = 30, metric = 'hours';
  const workload = { people: ['Priya R.', 'Lena K.', 'Maya O.', 'Omar A.', 'Jonas T.', 'Sam W.'], days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'], h: [] };
  const rnd0 = seeded(41);
  workload.h = workload.people.map((p, i) => workload.days.map(() => Math.round(clamp([8.6, 6.4, 5.6, 4.2, 6.8, 5.2][i] + (rnd0() - 0.5) * 3, 1, 11) * 2) / 2));
  const series = (n, total, seed, trend = 0.35) => {
    const r = seeded(seed);
    const raw = Array.from({ length: n }, (_, i) => 0.85 + r() * 0.28 + Math.sin(i / n * 6.3) * 0.06 + i / n * trend);
    const sum = raw.reduce((a, b) => a + b, 0);
    return raw.map(v => Math.round(v / sum * total));
  };
  const tipEl = () => $('.ch-tip', dashChart) || dashChart.appendChild(Object.assign(document.createElement('div'), { className: 'ch-tip' }));
  const showTip = (x, y, html) => { const t = tipEl(); t.style.left = `${x}px`; t.style.top = `${y}px`; t.innerHTML = html; t.style.opacity = 1; };
  const hideTip = () => { const t = $('.ch-tip', dashChart); if (t) t.style.opacity = 0; };
  const seg = (items, cur, attr) => `<div class="seg seg-dark" role="group" aria-label="${attr === 'range' ? 'Date range' : 'Metric'}">${items.map(([v, l]) => `<button type="button" class="${String(v) === String(cur) ? 'is-on' : ''}" aria-pressed="${String(v) === String(cur)}" data-${attr}="${v}">${l}</button>`).join('')}</div>`;
  const smooth = p => p.reduce((s, pt, i, a) => { if (!i) return `M${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`; const p0 = a[i - 2] || a[i - 1], p1 = a[i - 1], p3 = a[i + 1] || pt; const c1 = [p1[0] + (pt[0] - p0[0]) / 6, p1[1] + (pt[1] - p0[1]) / 6], c2 = [pt[0] - (p3[0] - p1[0]) / 6, pt[1] - (p3[1] - p1[1]) / 6]; return s + ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`; }, '');
  const sums = list => list.map(([l, v, cls]) => `<div><span>${l}</span><b class="${cls || ''}">${v}</b></div>`).join('');

  const renderDash = () => {
    const W = dashChart.clientWidth, H = dashChart.clientHeight;
    if (!W) return;
    hideTip();
    if (dash === 'revenue') {
      const cfg = { 7: [48210, 12.4, 9], 30: [196400, 8.1, 31], 90: [571900, 17.6, 84] }[range];
      const n = range === 90 ? 13 : range, cur = series(n, cfg[0], range * 7 + 3), prev = series(n, cfg[0] / (1 + cfg[1] / 100), range * 11 + 5, 0.15);
      dashCtl.innerHTML = seg([[7, '7 days'], [30, '30 days'], [90, '90 days']], range, 'range');
      dashSum.innerHTML = sums([['Revenue recognised', '$' + fmt(cfg[0])], ['vs previous period', '+' + cfg[1] + '%', 'up'], ['Projects billed', cfg[2]]]);
      const pad = { l: 46, r: 10, t: 10, b: 26 }, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      const max = Math.max(...cur, ...prev) * 1.15;
      const pts = a => a.map((v, i) => [pad.l + i / (a.length - 1) * iw, pad.t + ih - v / max * ih]);
      const d = a => smooth(pts(a));
      const cp = pts(cur);
      const ticks = [0.25, 0.5, 0.75, 1].map(k => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih - k * ih}" y2="${pad.t + ih - k * ih}"/>`).join('');
      const labs = [0.25, 0.5, 0.75, 1].map(k => `<text class="ch-lab" x="${pad.l - 10}" y="${pad.t + ih - k * ih + 4}" text-anchor="end">$${Math.round(max * k / 1000)}k</text>`).join('');
      const today = new Date();
      const xl = Array.from({ length: 5 }, (_, i) => { const dt = new Date(today); dt.setDate(dt.getDate() - Math.round((4 - i) / 4 * (range - 1))); return `<text class="ch-lab" x="${pad.l + i / 4 * iw}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}">${dt.toLocaleDateString('en-US', range === 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' })}</text>`; }).join('');
      dashChart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue over the last ${range} days"><g class="ch-grid">${ticks}</g>${labs}${xl}<path class="ch-area" d="${d(cur)} L${pad.l + iw} ${pad.t + ih} L${pad.l} ${pad.t + ih} Z"/><path class="ch-prev" d="${d(prev)}"/><path class="ch-line" d="${d(cur)}"/><line class="ch-vline" y1="${pad.t}" y2="${pad.t + ih}" opacity="0"/><circle class="ch-hov" r="5" opacity="0"/><rect x="${pad.l}" y="0" width="${iw}" height="${H}" fill="transparent" class="ch-hit"/></svg>`;
      const svg = $('svg', dashChart), line = $('.ch-line', svg);
      if (motion) { const len = line.getTotalLength(); G.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.3, ease: 'expo.out' }); G.from('.ch-area', { opacity: 0, duration: 0.9 }); }
      $('.ch-hit', svg).addEventListener('mousemove', e => {
        const r = svg.getBoundingClientRect(), i = clamp(Math.round((e.clientX - r.left - pad.l) / iw * (cur.length - 1)), 0, cur.length - 1);
        const [x, y] = cp[i];
        $('.ch-hov', svg).setAttribute('cx', x); $('.ch-hov', svg).setAttribute('cy', y); $('.ch-hov', svg).setAttribute('opacity', 1);
        const v = $('.ch-vline', svg); v.setAttribute('x1', x); v.setAttribute('x2', x); v.setAttribute('opacity', 1);
        const dt = new Date(); dt.setDate(dt.getDate() - (cur.length - 1 - i) * (range === 90 ? 7 : 1));
        showTip(x, y, `<b>$${fmt(cur[i])}</b> · ${range === 90 ? 'week of ' : ''}${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
      });
      $('.ch-hit', svg).addEventListener('mouseleave', () => { hideTip(); $('.ch-hov', svg).setAttribute('opacity', 0); $('.ch-vline', svg).setAttribute('opacity', 0); });
      const split = [['Client onboarding', 0.41, 'c-jade'], ['Retainers', 0.27, 'c-sky'], ['Website relaunch', 0.19, 'c-saffron'], ['Workshops', 0.13, 'c-coral']];
      dashSide.innerHTML = `<h3>By project</h3>${split.map(([n, k, c]) => `<div class="ds-item ${c}"><i></i><span>${n}</span><b>$${fmt(Math.round(cfg[0] * k))}</b></div>`).join('')}<div class="ds-note"><b>${icon('i-spark')}Copilot insight</b>Onboarding revenue grows fastest when kickoff happens within 3 days of the deal closing. Your rule currently averages 1.4 days.</div>`;
    }
    if (dash === 'delivery') {
      const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
      const M = { hours: { v: [6, 9, 14, 18, 22, 25, 27, 31, 34, 36, 38, 41], f: v => `${v} h`, l: 'Hours saved per week' }, ontime: { v: [61, 64, 68, 71, 75, 79, 82, 84, 87, 89, 91, 93], f: v => `${v}%`, l: 'Projects on time' }, meetings: { v: [9, 9, 8, 7, 6, 5, 4, 4, 3, 2, 2, 2], f: v => `${v}`, l: 'Status meetings a week' } }[metric];
      dashCtl.innerHTML = seg([['hours', 'Hours saved'], ['ontime', 'On time'], ['meetings', 'Meetings']], metric, 'metric');
      dashSum.innerHTML = sums([[M.l + ', now', M.f(M.v[11])], ['Twelve months ago', M.f(M.v[0])], ['Change', (metric === 'meetings' ? '−' : '+') + Math.abs(M.v[11] - M.v[0]) + (metric === 'ontime' ? ' pts' : metric === 'hours' ? ' h' : ''), 'up']]);
      const pad = { l: 10, r: 10, t: 28, b: 26 }, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, bw = iw / 12 * 0.62, max = Math.max(...M.v);
      dashChart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${M.l} by month">${M.v.map((v, i) => { const x = pad.l + (i + 0.5) * iw / 12, h = v / max * ih; return `<rect class="ch-bar${i === 11 ? ' key' : ''}" data-i="${i}" x="${x - bw / 2}" y="${pad.t + ih - h}" width="${bw}" height="${h}" rx="6"/><text class="ch-lab" x="${x}" y="${H - 6}" text-anchor="middle">${months[i]}</text>${[0, 6, 11].includes(i) ? `<text class="ch-lab" x="${x}" y="${pad.t + ih - h - 8}" text-anchor="middle" style="fill:var(--on-ink);font-size:12px">${M.f(v)}</text>` : ''}`; }).join('')}</svg>`;
      const svg = $('svg', dashChart);
      if (motion) G.from($$('.ch-bar', svg), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.9, stagger: 0.04, ease: 'expo.out' });
      $$('.ch-bar', svg).forEach(b => {
        b.addEventListener('mouseenter', () => { const i = +b.dataset.i; showTip(+b.getAttribute('x') + bw / 2, +b.getAttribute('y'), `<b>${M.f(M.v[i])}</b> · ${months[i]}`); });
        b.addEventListener('mouseleave', hideTip);
      });
      dashSide.innerHTML = `<h3>What moved it</h3>${[['Onboarding rule', 'c-jade', '14 h'], ['Weekly summary', 'c-sky', '9 h'], ['Invoice matching', 'c-saffron', '11 h'], ['Overdue nudges', 'c-coral', '7 h']].map(([n, c, v]) => `<div class="ds-item ${c}"><i></i><span>${n}</span><b>${v}</b></div>`).join('')}<div class="ds-note"><b>${icon('i-spark')}Copilot insight</b>The biggest jump came in March, when status updates moved from a weekly meeting to the board.</div>`;
    }
    if (dash === 'workload') {
      dashCtl.innerHTML = `<button class="app-btn app-btn-primary" type="button" id="rebalance">${icon('i-spark', 12)}Rebalance with Copilot</button>`;
      const all = workload.h.flat(), over = all.filter(h => h > 9).length, avg = all.reduce((a, b) => a + b, 0) / all.length;
      dashSum.innerHTML = sums([['Average day', avg.toFixed(1) + ' h'], ['Days over 9 h', over, over ? '' : 'up'], ['Free capacity', Math.round(all.reduce((a, h) => a + Math.max(0, 8 - h), 0)) + ' h', 'up']]);
      const pad = { l: 82, r: 6, t: 6, b: 26 }, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, cw = iw / 10, ch = ih / 6;
      const colour = h => h > 9 ? '#EE6B4D' : h > 7.5 ? '#F2B04A' : `rgba(106,166,224,${0.18 + h / 9 * 0.6})`;
      dashChart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Team workload heatmap">${workload.people.map((p, r) => `<text class="ch-lab" x="0" y="${pad.t + r * ch + ch / 2 + 4}" style="font-size:12px">${p}</text>${workload.h[r].map((h, c) => `<rect class="ch-cell" data-r="${r}" data-c="${c}" x="${pad.l + c * cw + 2}" y="${pad.t + r * ch + 2}" width="${cw - 4}" height="${ch - 4}" rx="6" fill="${colour(h)}"/>`).join('')}`).join('')}${workload.days.map((d, c) => `<text class="ch-lab" x="${pad.l + c * cw + cw / 2}" y="${H - 6}" text-anchor="middle">${d}</text>`).join('')}</svg>`;
      const svg = $('svg', dashChart);
      if (motion) G.from($$('.ch-cell', svg), { opacity: 0, scale: 0.6, transformOrigin: 'center', duration: 0.5, stagger: { each: 0.008, from: 'start' }, ease: 'back.out(2)' });
      $$('.ch-cell', svg).forEach(cell => {
        cell.addEventListener('mouseenter', () => { const r = +cell.dataset.r, c = +cell.dataset.c; showTip(+cell.getAttribute('x') + cw / 2, +cell.getAttribute('y'), `<b>${workload.people[r]}</b> · ${workload.days[c]} · ${workload.h[r][c]} h`); });
        cell.addEventListener('mouseleave', hideTip);
      });
      $('#rebalance').addEventListener('click', () => {
        // move hours from anyone over 8 h to whoever has the most room that day; nothing is lost
        let moved = 0;
        workload.h.forEach((row, r) => row.forEach((h, c) => {
          let extra = Math.max(0, h - 7.5);
          if (h <= 8) return;
          while (extra > 0.01) {
            const col = workload.h.map((x, k) => (k === r ? Infinity : x[c]));
            const low = col.indexOf(Math.min(...col)), room = 8 - workload.h[low][c];
            if (room <= 0.01) break;
            const give = Math.min(extra, room);
            workload.h[low][c] = Math.round((workload.h[low][c] + give) * 2) / 2; row[c] = Math.round((row[c] - give) * 2) / 2;
            extra -= give; moved += give;
          }
        }));
        toast(moved ? `Copilot moved ${moved.toFixed(1)} h of tasks to teammates with room (demo).` : 'Everyone is already at 8 hours a day or less', { icon: 'i-spark' });
        renderDash();
        $('#rebalance')?.focus({ preventScroll: true });
      });
      dashSide.innerHTML = `<h3>Scale</h3>${[['Light, under 5 h', 'c-sky'], ['Full, 7.5 to 9 h', 'c-saffron'], ['Over capacity, 9 h+', 'c-coral']].map(([n, c]) => `<div class="ds-item ${c}"><i></i><span>${n}</span><b></b></div>`).join('')}<div class="ds-note"><b>${icon('i-spark')}Copilot insight</b>${over ? `Priya is over 9 hours on ${workload.h[0].filter(h => h > 9).length} days. Rebalancing moves review tasks to people with room.` : 'Workload is balanced. No one is booked past 9 hours.'}</div>`;
    }
    if (dash === 'pipeline') {
      const stages = [['Lead', 412000, 'var(--on-ink-3)'], ['Qualified', 286000, '#6AA6E0'], ['Proposal', 174000, '#F2B04A'], ['Negotiation', 96000, '#EE6B4D'], ['Won this quarter', 228000, '#1DB386']];
      const tot = stages.reduce((a, s) => a + s[1], 0);
      dashCtl.innerHTML = '<span class="muted" style="font-size:12.5px">Synced from HubSpot 2 min ago</span>';
      dashSum.innerHTML = sums([['Open pipeline', '$' + fmt(tot - 228000)], ['Weighted forecast', '$' + fmt(318400)], ['Win rate', '31%', 'up']]);
      const R = Math.min(W * 0.45, H) / 2 - 6, cx = Math.min(W / 2, R + 20), cy = H / 2, r0 = R * 0.62;
      let a0 = -Math.PI / 2;
      const arcs = stages.map(([n, v, c], i) => {
        const a1 = a0 + v / tot * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0;
        const p = (a, r) => `${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`;
        const d = `M${p(a0, R)} A${R} ${R} 0 ${large} 1 ${p(a1, R)} L${p(a1, r0)} A${r0} ${r0} 0 ${large} 0 ${p(a0, r0)} Z`;
        const mid = (a0 + a1) / 2; a0 = a1;
        return `<path class="ch-cell" data-i="${i}" d="${d}" fill="${c}" data-mx="${cx + Math.cos(mid) * R}" data-my="${cy + Math.sin(mid) * R}"/>`;
      }).join('');
      const legend = stages.map(([n, v, c], i) => `<g transform="translate(${cx + R + 40}, ${cy - stages.length * 17 + i * 34})"><rect width="12" height="12" rx="3" fill="${c}"/><text class="ch-lab" x="22" y="10" style="font-size:13px;fill:var(--on-ink-2)">${n}</text><text class="ch-lab" x="${Math.max(170, W - (cx + R + 40) - 10)}" y="10" text-anchor="end" style="font-size:13px;fill:var(--on-ink)">$${Math.round(v / 1000)}k</text></g>`).join('');
      dashChart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pipeline by stage">${arcs}<text x="${cx}" y="${cy - 4}" text-anchor="middle" style="fill:var(--on-ink);font:500 26px Geist">$${(tot / 1e6).toFixed(2)}M</text><text class="ch-lab" x="${cx}" y="${cy + 18}" text-anchor="middle">pipeline and won, this quarter</text>${W > 520 ? legend : ''}</svg>`;
      const svg = $('svg', dashChart);
      if (motion) G.from($$('.ch-cell', svg), { opacity: 0, scale: 0.85, transformOrigin: `${cx}px ${cy}px`, duration: 0.8, stagger: 0.08, ease: 'expo.out' });
      $$('.ch-cell', svg).forEach(s => {
        s.addEventListener('mouseenter', () => { const st = stages[+s.dataset.i]; showTip(+s.dataset.mx, +s.dataset.my, `<b>${st[0]}</b> · $${fmt(st[1])} · ${Math.round(st[1] / tot * 100)}%`); });
        s.addEventListener('mouseleave', hideTip);
      });
      dashSide.innerHTML = (W > 520 ? '' : `<h3>By stage</h3>${stages.map(([n, v, c]) => `<div class="ds-item" style="--c:${c}"><i></i><span>${n}</span><b>$${Math.round(v / 1000)}k</b></div>`).join('')}`) + `<h3>Deals closing this month</h3>${[['Acme Freight, expansion', 'c-jade', '$48k'], ['Tessera retainer', 'c-saffron', '$32k'], ['Marlow Legal', 'c-sky', '$21k'], ['Fjord Coffee rebrand', 'c-coral', '$14k']].map(([n, c, v]) => `<div class="ds-item ${c}"><i></i><span>${n}</span><b>${v}</b></div>`).join('')}<div class="ds-note"><b>${icon('i-spark')}Copilot insight</b>When a deal closes, the onboarding rule opens its project automatically, so delivery can staff it the same day.</div>`;
    }
    if (motion) G.from([...dashSum.children, ...dashSide.children], { y: 12, opacity: 0, duration: 0.6, stagger: 0.04, ease: 'expo.out' });
  };
  $('#dashTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-dash]');
    if (!b) return;
    dash = b.dataset.dash;
    $$('#dashTabs button').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b); });
    renderDash();
  });
  dashCtl.addEventListener('click', e => {
    const r = e.target.closest('[data-range]'), m = e.target.closest('[data-metric]');
    // the controls are re-rendered, so hand focus to the new copy of the pressed button
    if (r) { range = +r.dataset.range; renderDash(); $(`[data-range="${range}"]`, dashCtl)?.focus({ preventScroll: true }); }
    if (m) { metric = m.dataset.metric; renderDash(); $(`[data-metric="${metric}"]`, dashCtl)?.focus({ preventScroll: true }); }
  });
  let dashDrawn = false;
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { dashDrawn = true; renderDash(); o.disconnect(); } }, { threshold: 0.2 }).observe($('.dash'));
  let rz, lastW = 0, lastH = 0;
  new ResizeObserver(() => { const w = dashChart.clientWidth, h = dashChart.clientHeight; if (Math.abs(w - lastW) < 4 && Math.abs(h - lastH) < 4) return; lastW = w; lastH = h; clearTimeout(rz); rz = setTimeout(() => dashDrawn && renderDash(), 120); }).observe(dashChart);
  // big counters
  $$('.cnt').forEach(el => {
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { el._shown = 0; countTo(el, +el.dataset.to, { dec: +(el.dataset.dec || 0), dur: 1.8 }); o.disconnect(); } }, { threshold: 0.6 }).observe(el);
  });

  /* ================= integrations: orbit + directory ================= */
  const apps = [
    ['Slack', 'chat', 'Post updates and create tasks from messages', 1, '#4A154B'], ['Microsoft Teams', 'chat', 'Channel updates and approvals', 0, '#4B53BC'],
    ['Zoom', 'chat', 'Meeting notes become tasks', 0, '#2D8CFF'], ['Gmail', 'chat', 'Turn an email into a task', 0, '#C5221F'],
    ['HubSpot', 'sales', 'Deals open projects when they close', 1, '#E8603C'], ['Salesforce', 'sales', 'Opportunities, accounts and owners', 0, '#0B8ACF'],
    ['Pipedrive', 'sales', 'Pipeline stages trigger rules', 0, '#1A1A1A'], ['Intercom', 'sales', 'Escalate conversations to the board', 0, '#1F8DED'],
    ['Stripe', 'finance', 'Payments close milestones', 1, '#635BFF'], ['QuickBooks', 'finance', 'Invoices drafted from projects', 1, '#2CA01C'],
    ['Xero', 'finance', 'Bills, invoices and budgets', 0, '#13B5EA'], ['Brex', 'finance', 'Spend tracked per project', 0, '#3B3B3B'],
    ['GitHub', 'dev', 'Pull requests linked to tasks', 1, '#24292F'], ['GitLab', 'dev', 'Merge requests and pipelines', 0, '#E2432A'],
    ['Jira', 'dev', 'Two-way issue sync', 0, '#2684FF'], ['Linear', 'dev', 'Issues and cycles in one view', 0, '#5E6AD2'],
    ['Sentry', 'dev', 'Errors open tasks for the owner', 0, '#362D59'], ['Google Drive', 'all', 'Files attached where the work is', 1, '#1E8E3E'],
    ['Google Calendar', 'all', 'Deadlines and kickoffs on your calendar', 0, '#1A73E8'], ['Notion', 'all', 'Docs linked to projects', 0, '#1F1F1F'],
    ['Figma', 'all', 'Frames attached to design tasks', 0, '#A259FF'], ['Greenhouse', 'all', 'New hires get a checklist', 0, '#24A47F'],
    ['Typeform', 'all', 'Responses become requests', 0, '#262627'], ['Zapier', 'all', '6,000 more apps, no code', 0, '#FF4F00']
  ];
  const initials = n => n.split(' ').map(w => w[0]).join('').slice(0, 2);
  const orbitApps = [0, 4, 8, 12, 17, 9, 1, 5, 14, 18, 20, 23];
  const orbitNodes = $('#orbitNodes'), orbitLines = $('#orbitLines');
  orbitNodes.innerHTML = orbitApps.map(i => `<button class="o-node${apps[i][3] ? ' is-on' : ''}" type="button" data-app="${i}" style="--nc:${apps[i][4]}" aria-label="${apps[i][0]}, ${apps[i][3] ? 'connected' : 'not connected'}. Toggle connection">${initials(apps[i][0])}<span class="o-tip">${apps[i][0]} · ${apps[i][3] ? 'Connected' : 'Click to connect'}</span></button>`).join('');
  orbitLines.innerHTML = orbitApps.map(() => '<line x1="300" y1="300" x2="300" y2="300"/>').join('') + '<circle class="o-pulse" r="4" cx="300" cy="300" opacity="0"/>';
  const oNodes = $$('.o-node', orbitNodes), oLines = $$('line', orbitLines);
  let orbitAngle = 0, orbitPaused = false, orbitSeen = false;
  new IntersectionObserver(([e]) => { orbitSeen = e.isIntersecting; }).observe($('#orbit'));
  const placeOrbit = () => {
    oNodes.forEach((n, k) => {
      const inner = k < 5, count = inner ? 5 : 7, idx = inner ? k : k - 5, r = inner ? 140 : 230;
      const a = (idx / count) * Math.PI * 2 + (inner ? orbitAngle : -orbitAngle * 0.7) + (inner ? 0 : 0.3);
      const x = 300 + Math.cos(a) * r, y = 300 + Math.sin(a) * r;
      n.style.left = `${x / 6}%`; n.style.top = `${y / 6}%`;
      n.dataset.side = x < 170 ? 'l' : x > 430 ? 'r' : '';
      oLines[k].setAttribute('x2', x); oLines[k].setAttribute('y2', y);
      oLines[k].classList.toggle('is-hot', !!apps[orbitApps[k]][3] && n.matches(':hover, :focus-visible'));
    });
  };
  placeOrbit();
  if (motion) {
    G.ticker.add(() => { if (!orbitPaused && orbitSeen && !document.hidden) { orbitAngle += 0.0016; placeOrbit(); } });
    const pulse = $('.o-pulse', orbitLines);
    const shoot = () => {
      const on = oNodes.map((n, k) => k).filter(k => apps[orbitApps[k]][3]);
      if (!on.length) return;
      const k = on[Math.floor(Math.random() * on.length)], l = oLines[k];
      const o = { t: 0 };
      G.to(o, { t: 1, duration: 0.9, ease: 'power2.inOut', onStart: () => pulse.setAttribute('opacity', 1), onUpdate: () => { pulse.setAttribute('cx', lerp(+l.getAttribute('x2'), 300, o.t)); pulse.setAttribute('cy', lerp(+l.getAttribute('y2'), 300, o.t)); }, onComplete: () => pulse.setAttribute('opacity', 0) });
    };
    setInterval(() => orbitSeen && !document.hidden && shoot(), 1400);
    const nodesIn = G.from(oNodes, { scale: 0, opacity: 0, duration: 0.8, stagger: 0.05, ease: 'back.out(2)', paused: true });
    const coreIn = G.from('.orbit-core', { scale: 0.5, opacity: 0, rotate: -30, duration: 1, ease: 'expo.out', paused: true });
    whenSeen($('#orbit'), () => { nodesIn.play(); coreIn.play(); }, 0.25);
  }
  $('#orbit').addEventListener('mouseenter', () => { orbitPaused = true; });
  $('#orbit').addEventListener('mouseleave', () => { orbitPaused = false; });
  const toggleApp = i => {
    const a = apps[i];
    a[3] = a[3] ? 0 : 1;
    countTo($('#connCount'), apps.filter(x => x[3]).length, { dur: 0.5 });
    oNodes.forEach(n => { if (+n.dataset.app === i) { n.classList.toggle('is-on', !!a[3]); n.setAttribute('aria-label', `${a[0]}, ${a[3] ? 'connected' : 'not connected'}. Toggle connection`); n.querySelector('.o-tip').textContent = `${a[0]} · ${a[3] ? 'Connected' : 'Click to connect'}`; } });
    $$(`.conn[data-i="${i}"]`).forEach(b => { b.classList.toggle('is-on', !!a[3]); b.textContent = a[3] ? 'Connected' : 'Connect'; b.setAttribute('aria-pressed', !!a[3]); b.setAttribute('aria-label', `${a[0]} connection`); });
    toast(a[3] ? `${a[0]} connected. First sync takes about a minute (demo)` : `${a[0]} disconnected`, { icon: 'i-link' });
    placeOrbit();
  };
  orbitNodes.addEventListener('click', e => { const n = e.target.closest('.o-node'); if (n) toggleApp(+n.dataset.app); });
  let cat = 'all';
  const dirList = $('#dirList');
  const renderDir = () => {
    const q = $('#dirQ').value.trim().toLowerCase();
    const list = apps.map((a, i) => [a, i]).filter(([a]) => (cat === 'all' || a[1] === cat) && (!q || a[0].toLowerCase().includes(q) || a[2].toLowerCase().includes(q)));
    dirList.innerHTML = list.map(([a, i]) => `<li><span class="ico" style="background:${a[4]}">${initials(a[0])}</span><div><b>${a[0]}</b><span>${a[2]}</span></div><button class="conn${a[3] ? ' is-on' : ''}" type="button" data-i="${i}" aria-pressed="${!!a[3]}" aria-label="${a[0]} connection">${a[3] ? 'Connected' : 'Connect'}</button></li>`).join('');
    $('#dirEmpty').hidden = list.length > 0;
    $('#dirShown').textContent = list.length;
    if (motion) G.from(dirList.children, { opacity: 0, y: 8, duration: 0.35, stagger: 0.012, ease: 'power2.out' });
  };
  dirList.addEventListener('click', e => { const b = e.target.closest('.conn'); if (b) toggleApp(+b.dataset.i); });
  $('#dirQ').addEventListener('input', renderDir);
  $$('#dirCats button').forEach(b => b.addEventListener('click', () => { cat = b.dataset.cat; $$('#dirCats button').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); }); renderDir(); }));
  renderDir();

  /* ================= customer stories ================= */
  const stories = [
    { q: 'We cancelled our Monday status meeting in week three and nobody asked for it back. I open one tab in the morning and I know which two things need me.', n: 'Priya Raman', r: 'COO, Northbeam Studio', av: ['PR', 'av-3'], img: 'assets/img/windows.jpg', alt: 'Silhouetted people at tall windows overlooking a city, in black and white', s: [['Hours saved a week', '41'], ['Projects on time', '93%'], ['Status meetings', '−7']] },
    { q: 'Every closed deal used to start with a chain of emails. Now the onboarding project is open, staffed and invoiced before the sales rep has hung up the phone.', n: 'Daniel Okafor', r: 'Head of Operations, Acme Freight', av: ['DO', 'av-1'], img: 'assets/img/bridge.jpg', alt: 'White arched bridge over grey water, in black and white', s: [['Kickoff after close', '1.4 days'], ['Automation runs a month', '18k'], ['Manual handoffs', '−82%']] },
    { q: 'Nine clinics, one board. When a supplier is late or a room is double-booked, the right manager hears about it first, not the patient.', n: 'Helena Brandt', r: 'Group Operations Lead, Holloway Dental', av: ['HB', 'av-4'], img: 'assets/img/lattice.jpg', alt: 'Curving glass and steel lattice roof, in black and white', s: [['Clinics connected', '9'], ['Issues caught early', '3.2×'], ['Admin hours saved', '120/mo']] }
  ];
  let storyI = 0, storyTween = null, storyHover = false;
  const storyTabs = $$('.story-tabs button');
  const showStory = (i, user) => {
    storyI = i;
    const s = stories[i];
    storyTabs.forEach((b, k) => { b.classList.toggle('is-on', k === i); b.setAttribute('aria-selected', k === i); });
    const swap = () => {
      $('#storyQuote').textContent = s.q; $('#storyName').textContent = s.n; $('#storyRole').textContent = s.r;
      $('#storyAv').textContent = s.av[0]; $('#storyAv').className = `av ${s.av[1]}`;
      const img = $('.story-pic img'); img.src = s.img; img.alt = s.alt;
      $('#storyStats').innerHTML = s.s.map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join('');
    };
    if (motion) {
      G.timeline().to(['#storyBody > *', '.story-pic img'], { opacity: 0, y: 12, duration: 0.25, ease: 'power2.in' })
        .add(swap).to(['#storyBody > *', '.story-pic img'], { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'expo.out' });
    } else swap();
    storyTween?.kill();
    $$('.story-tabs i').forEach(x => { x.style.transform = 'scaleX(0)'; });
    if (motion && !user) {
      storyTween = G.fromTo(storyTabs[i].querySelector('i'), { scaleX: 0 }, { scaleX: 1, duration: 8, ease: 'none', paused: storyHover, onComplete: () => showStory((storyI + 1) % stories.length) });
    }
  };
  storyTabs.forEach((b, i) => b.addEventListener('click', () => showStory(i, true)));
  $('.story-card').addEventListener('mouseenter', () => { storyHover = true; storyTween?.pause(); });
  $('.story-card').addEventListener('mouseleave', () => { storyHover = false; if (storyVisible) storyTween?.play(); });
  $('#storyStats').innerHTML = stories[0].s.map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join('');
  let storyStarted = false, storyVisible = false;
  new IntersectionObserver(([e]) => {
    storyVisible = e.isIntersecting;
    if (storyVisible && !storyStarted) { storyStarted = true; showStory(0); }
    else if (storyTween) storyVisible && !storyHover ? storyTween.play() : storyTween.pause();
  }, { threshold: 0.3 }).observe($('.story'));

  /* ================= pricing ================= */
  let yearly = true, estPlan = 'team';
  const prices = { starter: { y: 10, m: 12, n: 'Starter' }, team: { y: 18, m: 22, n: 'Team' }, scale: { y: 32, m: 38, n: 'Scale' } };
  const billBtns = $$('[data-bill]'), pill = $('.bt-pill'), seats = $('#seats');
  const placePill = () => { const b = billBtns.find(x => x.classList.contains('is-on')); pill.style.width = `${b.offsetWidth}px`; pill.style.transform = `translateX(${b.offsetLeft}px)`; };
  const renderPrices = () => {
    $$('.plan .num').forEach(n => countTo(n, +(yearly ? n.dataset.y : n.dataset.m), { dur: 0.6 }));
    const p = prices[estPlan], each = yearly ? p.y : p.m, n = +seats.value;
    $('#seatOut').textContent = n;
    seats.style.setProperty('--fill', `${(n - seats.min) / (seats.max - seats.min) * 100}%`);
    $('#estPlan').textContent = `${p.n}, billed ${yearly ? 'yearly' : 'monthly'}`;
    countTo($('#invTotal'), each * n, { prefix: '$', dur: 0.4 });
    $('#invSave').textContent = yearly ? `Saves $${fmt((p.m - p.y) * n * 12)} a year` : `Save $${fmt((p.m - p.y) * n * 12)} a year with yearly billing`;
  };
  const setYearly = v => { yearly = v; billBtns.forEach(b => { const on = (b.dataset.bill === 'yearly') === v; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); }); placePill(); renderPrices(); };
  billBtns.forEach(b => b.addEventListener('click', () => setYearly(b.dataset.bill === 'yearly')));
  $$('#estPlans button').forEach(b => b.addEventListener('click', () => { estPlan = b.dataset.p; $$('#estPlans button').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); }); renderPrices(); }));
  seats.addEventListener('input', renderPrices);
  addEventListener('resize', placePill);
  document.fonts?.ready.then(placePill);
  placePill(); renderPrices();
  $$('[data-plan-cta]').forEach(a => a.addEventListener('click', () => { setTimeout(() => { $('#ctaEmail').focus({ preventScroll: true }); $('#ctaMsg').textContent = `${a.dataset.planCta} plan selected. 14 days free, no card.`; }, 900); }));
  if (finePointer && motion) {
    $$('.plan').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
        if (!el._arrived) return;
        G.to(el, { rotateY: nx * 6, rotateX: -ny * 6, y: -6, transformPerspective: 1200, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
      });
      el.addEventListener('mouseleave', () => { if (el._arrived) G.to(el, { rotateY: 0, rotateX: 0, y: 0, duration: 0.9, ease: 'power3.out', overwrite: 'auto' }); });
    });
  }

  /* ================= faq ================= */
  $$('.faq details').forEach((d, i) => {
    const s = d.querySelector('summary'), a = d.querySelector('.faq-a');
    if (i === 0) d.open = true;
    s.addEventListener('click', e => {
      if (!motion) return;
      e.preventDefault();
      if (d.open) G.to(a, { height: 0, duration: 0.45, ease: 'power3.inOut', overwrite: true, onComplete: () => { d.open = false; a.style.height = ''; } });
      else { d.open = true; G.fromTo(a, { height: 0 }, { height: a.scrollHeight, duration: 0.6, ease: 'expo.out', overwrite: true, onComplete: () => { a.style.height = ''; } }); }
    });
  });

  /* ================= forms ================= */
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const shake = el => motion && G.fromTo(el, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
  const ctaForm = $('#ctaForm'), ctaEmail = $('#ctaEmail'), ctaMsg = $('#ctaMsg');
  ctaForm.addEventListener('submit', e => {
    e.preventDefault();
    const v = ctaEmail.value.trim(), ok = emailOk(v);
    ctaForm.classList.toggle('is-bad', !ok);
    ctaEmail.setAttribute('aria-invalid', !ok);
    ctaMsg.className = `cta-msg ${ok ? 'is-ok' : 'is-bad'}`;
    if (!v) ctaMsg.textContent = 'Enter your work email to start the trial.';
    else if (!ok) ctaMsg.textContent = 'That address is missing something. Try name@company.com.';
    else { ctaMsg.textContent = `Trial reserved for ${v}. This page is a demo, so no account was created and no email was sent.`; ctaEmail.value = ''; }
    if (!ok) { ctaEmail.focus(); shake(ctaForm); }
  });
  ctaEmail.addEventListener('input', () => { if (ctaForm.classList.contains('is-bad')) { ctaForm.classList.remove('is-bad'); ctaMsg.className = 'cta-msg'; ctaMsg.textContent = '14 days free. No card. Cancel in two clicks.'; } });
  $('#newsForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('#newsEmail'), msg = $('#newsMsg'), ok = emailOk(inp.value.trim());
    msg.className = ok ? 'is-ok' : 'is-bad';
    msg.textContent = ok ? 'Subscribed in this demo. No email was stored.' : 'Enter a valid email address.';
    if (ok) inp.value = ''; else shake($('.news-f'));
  });

  /* ================= demo modal ================= */
  const modal = $('#demoModal'), demoForm = $('#demoForm'), done = $('.modal-done');
  let modalReturn = null;
  const openModal = () => {
    modalReturn = document.activeElement;
    modal.hidden = false; lenis?.stop(); document.body.style.overflow = 'hidden';
    demoForm.hidden = false; done.hidden = true;
    $$('.field', demoForm).forEach(f => { const inp = f.querySelector('input, .select-btn'); if (inp) setErr(inp, ''); });
    setTimeout(() => $('#dName').focus(), 50);
  };
  const closeModal = () => { modal.hidden = true; lenis?.start(); document.body.style.overflow = ''; closeSelect(); modalReturn?.focus?.(); };
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-demo]')) { e.preventDefault(); closeMenu(); openModal(); }
    if (e.target.closest('[data-close-modal]') || e.target === modal) closeModal();
  });
  modal.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if ($('#sizeSelect').classList.contains('is-open')) closeSelect(true); else closeModal(); }
    if (e.key === 'Tab') {
      const f = $$('button, input, [tabindex="0"]', modal).filter(el => el.offsetParent && !el.closest('[hidden]'));
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });
  // custom select
  const sel = $('#sizeSelect'), selBtn = $('.select-btn', sel), opts = $$('[role="option"]', sel);
  let selVal = '', act = -1;
  selBtn.classList.add('is-empty');
  const openSelect = () => { sel.classList.add('is-open'); selBtn.setAttribute('aria-expanded', 'true'); act = Math.max(0, opts.findIndex(o => o.dataset.v === selVal)); markAct(); };
  function closeSelect(focus) { sel.classList.remove('is-open'); selBtn.setAttribute('aria-expanded', 'false'); selBtn.removeAttribute('aria-activedescendant'); if (focus) selBtn.focus(); }
  opts.forEach((o, i) => { o.id = `size-opt-${i}`; });
  const markAct = () => { opts.forEach((o, i) => o.classList.toggle('is-act', i === act)); if (opts[act]) selBtn.setAttribute('aria-activedescendant', opts[act].id); };
  selBtn.addEventListener('blur', () => setTimeout(() => { if (!sel.contains(document.activeElement)) closeSelect(); }, 120));
  const choose = i => {
    selVal = opts[i].dataset.v;
    opts.forEach((o, k) => o.setAttribute('aria-selected', k === i));
    $('#sizeVal').textContent = opts[i].textContent; selBtn.classList.remove('is-empty');
    sel.closest('.field').classList.remove('is-bad'); sel.closest('.field').querySelector('.err').textContent = '';
    closeSelect(true);
  };
  selBtn.addEventListener('click', () => sel.classList.contains('is-open') ? closeSelect() : openSelect());
  selBtn.addEventListener('keydown', e => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); if (!sel.classList.contains('is-open')) openSelect(); else { act = clamp(act + (e.key === 'ArrowDown' ? 1 : -1), 0, opts.length - 1); markAct(); } }
    if ((e.key === 'Enter' || e.key === ' ') && sel.classList.contains('is-open')) { e.preventDefault(); choose(act); }
  });
  opts.forEach((o, i) => o.addEventListener('click', () => choose(i)));
  document.addEventListener('click', e => { if (!e.target.closest('#sizeSelect')) closeSelect(); });
  $$('.chips button', modal).forEach(b => b.addEventListener('click', () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true')));
  const setErr = (input, msg) => {
    const f = input.closest('.field'), err = f.querySelector('.err');
    if (!err.id) err.id = `err-${input.id || 'size'}`;
    f.classList.toggle('is-bad', !!msg); err.textContent = msg || '';
    input.setAttribute('aria-invalid', !!msg);
    if (msg) input.setAttribute('aria-describedby', err.id); else input.removeAttribute('aria-describedby');
  };
  demoForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#dName').value.trim(), mail = $('#dEmail').value.trim();
    const errs = [[$('#dName'), name.length < 2 ? 'Tell us your name.' : ''], [$('#dEmail'), !mail ? 'A work email is required.' : !emailOk(mail) ? 'That email looks incomplete.' : ''], [selBtn, selVal ? '' : 'Choose a team size.']];
    errs.forEach(([el, m]) => setErr(el, m));
    const bad = errs.find(([, m]) => m);
    if (bad) { bad[0].focus(); shake(demoForm); return; }
    const interests = $$('.chips [aria-pressed="true"]', modal).map(b => b.textContent);
    $('#demoDoneText').textContent = `Thanks, ${name.split(' ')[0]}. In a live deployment a product specialist would email ${mail} within one business day to book a 20-minute walkthrough for a ${selVal}-person team${interests.length ? ` focused on ${interests.join(', ').toLowerCase()}` : ''}. This is a demo page, so nothing was sent.`;
    demoForm.hidden = true; done.hidden = false;
    $('.modal-done .btn').focus();
    if (motion) G.from('.modal-done > *', { y: 16, opacity: 0, duration: 0.6, stagger: 0.06, ease: 'expo.out' });
    demoForm.reset(); selVal = ''; $('#sizeVal').textContent = 'Choose a size'; selBtn.classList.add('is-empty'); opts.forEach(o => o.setAttribute('aria-selected', 'false'));
    $$('.chips button', modal).forEach(b => b.setAttribute('aria-pressed', 'false'));
  });

  /* ================= footer ================= */
  const clock = $('#clock');
  const tickClock = () => { clock.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }); };
  tickClock(); setInterval(tickClock, 15000);
  new IntersectionObserver(([e]) => $('.foot-word').classList.toggle('is-lit', e.isIntersecting), { threshold: 0.6 }).observe($('.foot-word'));

  /* ================= command palette ================= */
  const pal = $('#palette'), palQ = $('#palQ'), palList = $('#palList');
  const cmds = [
    ...railSections.map(s => ({ t: s.dataset.name, k: 'Go to section', run: () => goTo(s) })),
    { t: 'Book a demo', k: 'Action', run: openModal },
    { t: 'Run a workflow test', k: 'Action', run: showLiveRule },
    { t: 'Ask Copilot what is at risk', k: 'Action', run: () => { $$('.cp-q button').forEach(x => { x.classList.toggle('is-on', x.dataset.q === 'risk'); x.setAttribute('aria-pressed', x.dataset.q === 'risk'); }); goTo('#product'); selectFeature('copilot', true); } },
    { t: 'Switch billing to monthly', k: 'Action', run: () => { setYearly(false); goTo('#pricing'); } },
    { t: 'Switch billing to yearly', k: 'Action', run: () => { setYearly(true); goTo('#pricing'); } },
    { t: 'Email the VELTRIX team', k: 'Contact', run: () => { location.href = 'mailto:hello@veltrix.io?subject=VELTRIX%20question'; } }
  ];
  let palSel = 0, palItems = cmds, lastFocus;
  const renderPal = () => {
    const q = palQ.value.trim().toLowerCase();
    palItems = cmds.filter(c => c.t.toLowerCase().includes(q));
    palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
    palList.innerHTML = palItems.map((c, i) => `<li role="option" id="pal-opt-${i}" aria-selected="${i === palSel}" data-i="${i}">${c.t}<span>${c.k}</span></li>`).join('') || '<li aria-disabled="true">Nothing matches</li>';
    if (palItems.length) palQ.setAttribute('aria-activedescendant', `pal-opt-${palSel}`); else palQ.removeAttribute('aria-activedescendant');
    $('#pal-opt-' + palSel)?.scrollIntoView({ block: 'nearest' });
  };
  const openPal = () => { lastFocus = document.activeElement; pal.hidden = false; palQ.value = ''; palSel = 0; renderPal(); palQ.focus(); lenis?.stop(); };
  const closePal = () => { pal.hidden = true; lenis?.start(); lastFocus?.focus?.(); };
  const runPal = i => { const c = palItems[i]; if (!c) return; closePal(); c.run(); };
  document.addEventListener('click', e => { if (e.target.closest('[data-open-palette]')) { e.preventDefault(); openPal(); } });
  palQ.addEventListener('input', () => { palSel = 0; renderPal(); });
  palList.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) runPal(+li.dataset.i); });
  pal.addEventListener('click', e => { if (e.target === pal) closePal(); });
  pal.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePal(); return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && palItems.length) { palSel = (palSel + (e.key === 'ArrowDown' ? 1 : -1) + palItems.length) % palItems.length; renderPal(); e.preventDefault(); }
    if (e.key === 'Enter') { runPal(palSel); e.preventDefault(); }
    if (e.key === 'Tab') { e.preventDefault(); palQ.focus(); }
  });
  let typed = '';
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? openPal() : closePal(); return; }
    if (e.key === 'Escape') { setDD(false); closeMenu(); }
    if (e.target.matches('input, textarea')) return;
    typed = (typed + e.key.toLowerCase()).slice(-7);
    if (typed === 'veltrix') {
      typed = '';
      toast('Everything connected. You found the hidden shortcut.', { icon: 'i-spark' });
      if (motion) G.fromTo('.nav .logo-mark', { rotate: 0 }, { rotate: 360, duration: 1.1, ease: 'expo.inOut' });
    }
  });

  /* ================= section entrances, each with its own motion ================= */
  if (motion) {
    const mark = (sel, kind = '') => $$(sel).forEach(el => el.setAttribute('data-reveal', kind));
    mark('.sec-kicker'); mark('.sec-sub'); mark('.logos p');
    mark('.play-in', 'left'); mark('.play-out', 'right'); mark('.play-bridge', 'scale');
    // on narrow screens the tabs scroll sideways, so off-screen tabs would never intersect: reveal the row as one
    mark(wide() ? '.ex-tabs button' : '.ex-tabs', 'left');
    mark('.an-kpi'); mark('.fineprint-dark'); mark('.dash', 'scale');
    mark('.integr-copy .h2'); mark('.dir', 'right');
    mark('.story-tabs button'); mark('.estimator'); mark('.faq details', 'right'); mark('.faq-side .btn'); mark('.support', 'scale');
    mark('.cta-sub'); mark('.cta-form'); mark('.cta-msg'); mark('.foot-brand > *'); mark('.foot-cols > div'); mark('.news');
    // reveals use IntersectionObserver, so they fire even when content above changes height later
    const queue = [];
    let qT;
    const revealIO = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { queue.push(e.target); revealIO.unobserve(e.target); } });
      clearTimeout(qT);
      qT = setTimeout(() => { if (queue.length) G.to(queue.splice(0), { opacity: 1, x: 0, y: 0, scale: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: 'auto' }); }, 20);
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('[data-reveal]').forEach(el => revealIO.observe(el));
    // keyboard users can tab into a block before its entrance has played: show it at once
    document.addEventListener('focusin', e => { const r = e.target.closest('[data-reveal]'); if (r && +getComputedStyle(r).opacity < 1) { revealIO.unobserve(r); G.to(r, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.3, overwrite: 'auto' }); } });
    const onSeen = (el, tween, threshold) => { tween.pause(0); whenSeen(el, () => tween.play(), threshold); };
    // word-by-word headings
    $$('.split-words').forEach(h => onSeen(h, G.from($$('.w > span', h), { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.045 }), 0.3));
    // feature panel swings in
    onSeen($('.explorer'), G.from('.ex-panel', { rotateX: 14, y: 80, opacity: 0, transformPerspective: 1600, transformOrigin: '50% 0', duration: 1.4, ease: 'expo.out' }));
    // story card opens like a curtain
    onSeen($('.story'), G.fromTo('.story-card', { clipPath: 'inset(0% 0% 100% 0% round 22px)' }, { clipPath: 'inset(0% 0% 0% 0% round 22px)', duration: 1.4, ease: 'expo.inOut', clearProps: 'clipPath' }), 0.05);
    // pricing cards rise in a fan
    onSeen($('.plans'), G.from('.plan', { y: 90, opacity: 0, rotateX: 18, transformPerspective: 1200, transformOrigin: '50% 100%', duration: 1.2, stagger: { each: 0.12, onComplete() { this.targets()[0]._arrived = true; } }, ease: 'expo.out' }), 0.1);
    // final call to action: the dark panel expands into the page
    G.fromTo('.cta', { clipPath: 'inset(6% 4% 6% 4% round 40px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'top 25%', scrub: 0.6 } });
    onSeen($('.cta-in'), G.from('.cta-mark', { scale: 0.4, rotate: -40, opacity: 0, duration: 1.2, ease: 'expo.out' }), 0.3);
    // marquee fades in after the hero
    onSeen($('.logos'), G.from('.marquee', { opacity: 0, y: 30, duration: 1.2, ease: 'expo.out' }), 0.3);
    // parallax on the photos
    G.fromTo('.story-pic img', { yPercent: -6, scale: 1.12 }, { yPercent: 6, scale: 1.12, ease: 'none', scrollTrigger: { trigger: '.story-card', start: 'top bottom', end: 'bottom top', scrub: true } });
    G.fromTo('.foot-word', { yPercent: 30 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  if (ST) { addEventListener('load', () => { layoutFits(); ST.refresh(); }); document.fonts?.ready.then(() => { layoutFits(); ST.refresh(); }); }
})();
