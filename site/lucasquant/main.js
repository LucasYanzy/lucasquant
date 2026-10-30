/* LucasQuant — scroll-directed particle studies. No remote assets or rendering dependencies. */
(() => {
  'use strict';
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const mix = (a, b, progress) => a + (b - a) * progress;
  const smooth = (start, end, value) => { const t = clamp((value - start) / (end - start)); return t * t * t * (t * (t * 6 - 15) + 10); };
  const damp = (value, target, response, dt) => Math.abs(value - target) < .00001 ? target : mix(value, target, 1 - Math.exp(-dt / response));
  const tau = Math.PI * 2;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = () => innerWidth <= 650;
  let selectedFactor = 0, selectedType = 'growth';
  const factorWeights = [1, 0, 0, 0, 0, 0];
  const typeWidths = { growth: .85, defensive: .59, cyclical: 1.1 };
  let distributionWidth = typeWidths.growth;
  let schedule = () => {};
  const updateReadout = (element, text) => {
    element.getAnimations().forEach(animation => animation.cancel());
    element.textContent = text;
    if (!reduced.matches) element.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
  };

  // Navigation follows the document's scroll; it never captures wheel or touch events.
  const menu = document.getElementById('menuButton');
  const navigation = document.getElementById('navigation');
  const closeMenu = (restoreFocus = false) => {
    const wasOpen = menu.getAttribute('aria-expanded') === 'true';
    document.body.classList.remove('nav-open');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', '打开导航');
    if (restoreFocus && wasOpen) menu.focus();
  };
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    document.body.classList.toggle('nav-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash.length > 1) {
      const destination = document.getElementById(link.hash.slice(1));
      if (destination) {
        event.preventDefault();
        if (location.hash !== link.hash) history.pushState(null, '', link.hash);
        closeMenu();
        destination.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'instant' : 'smooth' });
        const heading = destination.querySelector('h1,h2') || destination;
        heading.setAttribute('tabindex', '-1');
        const focusDestination = () => {
          const bounds = destination.getBoundingClientRect();
          if (bounds.top < 95 && bounds.bottom > 95) heading.focus({ preventScroll: true });
          removeEventListener('scrollend', focusDestination);
        };
        if (reduced.matches) focusDestination();
        else {
          addEventListener('scrollend', focusDestination, { once: true });
          setTimeout(focusDestination, 1400);
        }
      }
    } else if (!event.target.closest('.header')) closeMenu();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(true); });
  document.addEventListener('focusin', event => { if (!event.target.closest('.header')) closeMenu(); });
  matchMedia('(min-width:651px)').addEventListener('change', () => closeMenu());

  const factorNames = ['价格偏离', '资金流', '趋势效率', '风险波动', '趋势结构', '情绪动量'];
  const factorDescriptions = [
    '价格距离相对均值有多远？偏离本身，不代表反转。',
    '量价是否相互支持？资金流因子从成交量与价格关系中寻找线索。',
    '价格走得是否连贯？趋势效率帮助区分单向推进与反复震荡。',
    '波动与风险是否改变？为当前状态补上必要的风险背景。',
    '当前处于怎样的结构？结合趋势线、通道与关键位置观察。',
    '价格动量处于怎样的温度？它描述量价状态，不是直接观测人群情绪。'
  ];
  document.querySelectorAll('[data-factor]').forEach(button => {
    button.addEventListener('click', () => {
      selectedFactor = Number(button.dataset.factor);
      document.querySelectorAll('[data-factor]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      updateReadout(document.getElementById('factorReadout'), factorDescriptions[selectedFactor]);
      schedule(true);
    });
  });
  const typeNames = { growth: '成长型', defensive: '防御型', cyclical: '周期型' };
  document.querySelectorAll('[data-type]').forEach(button => {
    button.addEventListener('click', () => {
      selectedType = button.dataset.type;
      document.querySelectorAll('[data-type]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      updateReadout(document.getElementById('typeReadout'), `${typeNames[selectedType]} · 切换研究分组，观察相同指标条件下的结果分布（概念示意）。`);
      schedule(true);
    });
  });

  const productDetails = {
    alpha: {
      eyebrow: 'XE ALPHA / A CLOSER LOOK', title: '六个视角。\n一套市场语言。',
      description: 'Alpha 将价格、成交量、趋势与波动信息整理为六组因子。先看每一组表达什么，再看它们之间的共识与分歧。',
      rows: [
        ['主图：结构与风险', '在 TradingView 图表上观察趋势结构、条件提示与 ATR 参考线，把市场读数放回价格背景。'],
        ['副图：因子与状态', '六组因子使用统一刻度，帮助理解情绪、趋势与风险状态；相近的信号先分组，减少重复放大。'],
        ['为判断提供上下文', '状态读数描述当下。它不能保证下一次涨跌，也无法保证盈利或避免损失。']
      ], href: '#alpha', footnote: '网页粒子是因子分组的视觉隐喻，不是原子模型或实时行情。实际指标在 TradingView 中计算。'
    },
    beta: {
      eyebrow: 'XE BETA / A CLOSER LOOK', title: '先明确条件。\n再研究概率。',
      description: 'Beta 是一个正在起步的研究项目：同一个指标，在不同类型的股票上，是否对应不同的后续结果？',
      rows: [
        ['为比较建立前提', '先按股票特征分组，再选择指标状态与观察期限，让每个概率问题有清楚的条件。'],
        ['从关联到结果分布', '研究相似条件下历史上出现过哪些结果，同时关注样本量、基准、统计不确定性与概率校准。'],
        ['让设想接受检验', '历史关联不等于因果，也不保证延续。真实应用需要处理时间泄漏、依赖样本和多重检验等问题。']
      ], href: '#beta', footnote: '项目处于早期阶段。主页的粒子流与分布仅作概念演示，不代表实际预测能力或真实股票的统计规律。'
    }
  };
  const dialog = document.getElementById('detailDialog');
  let dialogTrigger = null;
  document.querySelectorAll('[data-learn]').forEach(button => {
    button.addEventListener('click', () => {
      const detail = productDetails[button.dataset.learn];
      document.getElementById('dialogEyebrow').textContent = detail.eyebrow;
      document.getElementById('dialogTitle').textContent = detail.title;
      document.getElementById('dialogDescription').textContent = detail.description;
      document.getElementById('dialogFootnote').textContent = detail.footnote;
      document.getElementById('dialogRows').replaceChildren(...detail.rows.map(([title, description], index) => {
        const row = document.createElement('article');
        const number = document.createElement('span'); number.textContent = String(index + 1).padStart(2, '0');
        const content = document.createElement('div');
        const heading = document.createElement('h3'); heading.textContent = title;
        const paragraph = document.createElement('p'); paragraph.textContent = description;
        content.append(heading, paragraph); row.append(number, content); return row;
      }));
      dialogTrigger = button;
      dialog.showModal();
      dialog.scrollTop = 0;
      document.body.classList.add('dialog-open');
      if (!reduced.matches) dialog.animate([
        { opacity: 0, transform: 'translateY(18px) scale(.985)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
      schedule(true);
    });
  });
  let closingDialog = false;
  const closeDialog = () => {
    if (closingDialog) return;
    if (reduced.matches) { dialog.close(); return; }
    closingDialog = true;
    dialog.classList.add('is-closing');
    dialog.getAnimations().forEach(animation => animation.cancel());
    dialog.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }], {
      duration: 180, easing: 'cubic-bezier(.4,0,1,1)'
    }).finished.then(() => { closingDialog = false; dialog.close(); });
  };
  dialog.querySelector('.dialog-close').addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeDialog();
  });
  dialog.addEventListener('close', () => {
    dialog.classList.remove('is-closing');
    document.body.classList.remove('dialog-open');
    dialogTrigger?.focus({ preventScroll: true });
    schedule(true);
  });
  if ('IntersectionObserver' in window) {
    document.body.classList.add('reveal-ready');
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); reveal.unobserve(entry.target); }
    }), { threshold: .12 });
    document.querySelectorAll('[data-reveal]').forEach(element => reveal.observe(element));
  }

  // Deterministic source points: the page does not load quotes or financial records.
  function randomGenerator(seed) {
    return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let value = Math.imul(seed ^ seed >>> 15, 1 | seed); value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value; return ((value ^ value >>> 14) >>> 0) / 4294967296; };
  }
  const random = randomGenerator(184729);
  const particleCount = 4800;
  const points = Array.from({ length: particleCount }, (_, index) => {
    const z = 1 - 2 * (index + .5) / particleCount;
    const angle = index * 2.399963229728653;
    const radius = Math.sqrt(1 - z * z);
    const shell = .78 + random() * .22;
    return {
      x: Math.cos(angle) * radius * shell, y: Math.sin(angle) * radius * shell, z: z * shell,
      group: index % 6, seed: random(), u: random(), v: random(), w: random(),
      scatterX: (random() - .5) * 4.5, scatterY: (random() - .5) * 3.5, scatterZ: (random() - .5) * 3,
    };
  });
  const sources = [
    { kind: 'hero', element: document.getElementById('top'), canvas: document.getElementById('heroCanvas') },
    ...[...document.querySelectorAll('[data-scene]')].map(element => ({ kind: element.dataset.scene, element, canvas: element.querySelector('canvas'), stage: element.querySelector('.chapter-stage') }))
  ];
  const scenes = sources.map(source => ({
    ...source, ctx: source.canvas.getContext('2d'), width: 0, height: 0,
    progress: 0, targetProgress: 0, entrance: 0, active: false, measured: false,
    intro: source.element.querySelector('.chapter-intro'),
    detail: source.element.querySelector('.chapter-detail'),
    introItems: [...source.element.querySelectorAll('.chapter-intro .scene-copy > *')],
    detailItems: [...source.element.querySelectorAll('.chapter-detail .scene-copy > *')],
  })).filter(scene => scene.ctx);
  if (!scenes.length) return;
  const heroPointer = { x: 0, y: 0, targetX: 0, targetY: 0, influence: 0, active: false };
  const heroElement = document.getElementById('top');
  heroElement.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || reduced.matches) return;
    const bounds = heroElement.getBoundingClientRect();
    heroPointer.targetX = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    heroPointer.targetY = (event.clientY - bounds.top) / bounds.height * 2 - 1;
    heroPointer.active = true;
  }, { passive: true });
  heroElement.addEventListener('pointerleave', () => {
    heroPointer.targetX = 0; heroPointer.targetY = 0; heroPointer.active = false;
  });
  let frame = 0, dirty = true, snapProgress = true, clock = 0, lastFrame = 0;
  const syncMotion = () => {
    document.body.classList.toggle('motion-ready', !reduced.matches);
    scenes.forEach(scene => { scene.appliedProgress = null; });
    if (reduced.matches) document.querySelectorAll('[data-reveal]').forEach(element => element.classList.add('revealed'));
    resize();
  };
  const setSize = scene => {
    const bounds = scene.canvas.getBoundingClientRect();
    scene.width = bounds.width; scene.height = bounds.height;
    const dpr = Math.min(devicePixelRatio || 1, mobile() ? 1.75 : 2);
    scene.canvas.width = Math.round(bounds.width * dpr); scene.canvas.height = Math.round(bounds.height * dpr);
    scene.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const detailCopy = scene.element.querySelector('.chapter-detail .scene-copy');
    scene.detailBottom = detailCopy ? detailCopy.offsetTop + detailCopy.offsetHeight + 22 : 0;
  };
  function resize() {
    scenes.forEach(setSize);
    snapProgress = true;
    schedule(true);
  }
  function updateScroll() {
    const header = document.querySelector('.header').offsetHeight;
    const pageHeight = innerHeight;
    let current = '';
    for (const scene of scenes) {
      const bounds = scene.element.getBoundingClientRect();
      const wasActive = scene.active;
      scene.active = bounds.top < pageHeight && bounds.bottom > header;
      scene.targetEntrance = smooth(0, .75, (pageHeight - bounds.top) / Math.max(1, pageHeight - header));
      scene.targetProgress = scene.kind === 'hero' ? clamp((header - bounds.top) / bounds.height) : clamp((header - bounds.top) / Math.max(1, bounds.height - scene.stage.offsetHeight));
      // A deep link or a resized viewport starts at its actual position. Normal scrolling is damped.
      if (snapProgress || !scene.measured || !wasActive || reduced.matches) {
        scene.progress = scene.targetProgress;
        scene.entrance = scene.targetEntrance;
      }
      scene.measured = true;
      if (scene.kind !== 'hero' && bounds.top <= pageHeight * .45 && bounds.bottom > pageHeight * .45) current = scene.kind;
    }
    snapProgress = false;
    navigation.querySelectorAll('a').forEach(link => {
      if (link.hash === `#${current}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function applyChapter(scene) {
    const p = scene.progress;
    const future = scene.kind === 'gamma' || scene.kind === 'omega';
    const element = scene.element;
    const set = (name, value) => element.style.setProperty(name, value);
    set('--progress', p.toFixed(4));
    set('--art-opacity', mix(.3, 1, scene.entrance).toFixed(4));
    set('--detail-visibility', p > .385 ? 'visible' : 'hidden');
    set('--object-opacity', smooth(.74, .90, p).toFixed(4));
    set('--word-opacity', mix(.8, .26, smooth(.28, .83, p)).toFixed(4));
    set('--word-x', `${-smooth(0, 1, p) * 15}px`);
    element.dataset.phase = future ? 'future' : p < .32 ? 'gather' : p < .74 ? 'reveal' : 'detail';
    element.dataset.progress = p.toFixed(4);
    element.dataset.targetProgress = scene.targetProgress.toFixed(4);
    const staticMode = reduced.matches;
    scene.introItems.forEach((item, index) => {
      const exit = future || staticMode ? 0 : smooth(.31 + index * .014, .44 + index * .014, p);
      item.style.setProperty('--item-opacity', (1 - exit).toFixed(4));
      item.style.setProperty('--item-y', `${-exit * (12 + index * 2)}px`);
    });
    scene.detailItems.forEach((item, index) => {
      const enter = staticMode ? 1 : smooth(.39 + index * .014, .51 + index * .014, p);
      item.style.setProperty('--item-opacity', enter.toFixed(4));
      item.style.setProperty('--item-y', `${(1 - enter) * 18}px`);
      item.inert = !staticMode && enter < .12;
    });
    const introHidden = !staticMode && !future && p > .50;
    scene.intro.inert = introHidden;
    scene.intro.setAttribute('aria-hidden', String(introHidden));
    if (scene.detail) {
      const detailHidden = !staticMode && p < .39;
      scene.detail.inert = detailHidden;
      scene.detail.setAttribute('aria-hidden', String(detailHidden));
    }
  }
  function camera(scene, x, y, z, centerX, centerY, scale) {
    const perspective = 4.4 / (4.4 + z);
    return [scene.width * centerX + x * scale * perspective, scene.height * centerY + y * scale * perspective, perspective];
  }
  function position(scene, detail = 0) {
    const compact = mobile();
    const staticLayout = !document.body.classList.contains('motion-ready');
    if (compact && staticLayout) return { x: .5, y: .47, scale: Math.min(scene.width * .28, scene.height * .32) };
    const base = {
      x: compact ? .51 : .715, y: compact ? .67 : .50,
      scale: Math.min(scene.width * (compact ? .34 : .175), scene.height * (compact ? .25 : .315)),
    };
    if (!compact) return base;
    const top = Math.max(scene.detailBottom, scene.height * .48);
    const space = Math.max(100, scene.height - 74 - top);
    const amount = smooth(0, 1, detail);
    return {
      x: mix(base.x, .5, amount),
      y: mix(base.y, (top + space * .45) / scene.height, amount),
      scale: mix(base.scale, Math.min(scene.width * .28, space * .35), amount),
    };
  }
  function atmosphere(scene, x, y, radius, opacity = .08, tint = [186, 188, 211]) {
    const { ctx, width, height } = scene;
    const glow = ctx.createRadialGradient(width * x, height * y, 0, width * x, height * y, radius);
    glow.addColorStop(0, `rgba(${tint},${opacity})`); glow.addColorStop(.5, `rgba(${tint},${opacity * .4})`); glow.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
  }
  function dot(ctx, x, y, size, opacity, color = '218,220,231') {
    ctx.fillStyle = `rgba(${color},${clamp(opacity).toFixed(3)})`;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  function drawHero(scene) {
    const { ctx, width, height, progress } = scene;
    const compact = mobile();
    const time = reduced.matches ? 0 : clock;
    const cx = .5 + heroPointer.x * .018;
    const cy = (compact ? .73 : height < 500 ? .81 : .75) + heroPointer.y * .012;
    const breathe = 1 + Math.sin(time * .42) * .025;
    const scale = Math.min(width * (compact ? .70 : .50), height * (compact ? .52 : height < 500 ? 1.02 : .55)) * breathe;
    const tilt = (compact ? .35 : height < 500 ? .18 : .31) + Math.sin(time * .19) * .025 + heroPointer.y * .035;
    const pointerX = (heroPointer.x + 1) * width / 2;
    const pointerY = (heroPointer.y + 1) * height / 2;
    atmosphere(scene, cx, cy, scale * 1.75, .075 + Math.sin(time * .42) * .007);
    const limit = compact ? 3200 : particleCount;
    for (let index = 0; index < limit; index++) {
      const point = points[index];
      const u = point.u * tau + time * (.115 + (point.v - .5) * .008);
      const band = point.v;
      const major = 1.04 + (band - .5) * .30 + Math.sin(u * 3 - time * .32) * .035;
      const twist = u * 2 - time * .22;
      let x = Math.cos(u) * major;
      let y = Math.sin(u) * major * tilt + Math.sin(twist) * (band - .5) * .42;
      const z = Math.sin(u) * .6 + Math.cos(twist) * (band - .5) * .55;
      x += Math.sin(u * 3 - time * .32) * .035;
      y += Math.sin(time * .42) * .025;
      y += point.scatterY * progress * .10;
      let [px, py, depth] = camera(scene, x, y, z, cx, cy, scale * (1 + progress * .15));
      const dx = px - pointerX, dy = py - pointerY;
      const field = Math.exp(-(dx * dx + dy * dy) / 26000) * heroPointer.influence;
      px += dx * field * .13; py += dy * field * .13;
      const pulse = .5 + .5 * Math.sin(u * 2 - time * .42);
      const light = .19 + point.w * .43 + pulse * .23 + field * .18 + (depth - .8) * .2;
      dot(ctx, px, py, (.55 + point.seed * 1.05) * depth, light, point.seed > .88 ? '239,235,248' : '172,175,197');
    }
    // The cross-current moves independently of the orbit; its endpoints fade before wrapping.
    for (let index = 0; index < limit / 3; index++) {
      const point = points[index];
      const travel = (point.u + time * (.028 + point.v * .003)) % 1;
      const x = (travel - .5) * 3.4;
      const y = .15 * Math.sin(x * 2.3 - time * .3) + (point.v - .5) * .12 - .06;
      const [px, py] = camera(scene, x, y, (point.w - .5) * .2, cx, cy, scale);
      const fade = Math.sin(travel * Math.PI) ** .65;
      dot(ctx, px, py, point.seed > .9 ? 1.4 : .7, fade * (.12 + point.seed * .46), '207,205,223');
    }
  }
  function drawAlpha(scene) {
    const { ctx } = scene;
    const p = reduced.matches ? .82 : scene.progress;
    const gather = smooth(.01, .30, p);
    const explode = smooth(.40, .84, p);
    const placement = position(scene, smooth(.38, .77, p));
    const size = placement.scale * mix(.90, 1.09, smooth(.08, .43, p));
    atmosphere(scene, placement.x, placement.y, size * 1.65, .055);
    const limit = mobile() ? 3000 : particleCount;
    const rotation = .22 + clock * .035 + p * .35;
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    const colors = factorWeights.map(weight => `${Math.round(mix(188,236,weight * explode))},${Math.round(mix(193,231,weight * explode))},${Math.round(mix(211,246,weight * explode))}`);
    for (let index = 0; index < limit; index++) {
      const point = points[index];
      const angle = point.group / 6 * tau - Math.PI / 6;
      const gx = Math.cos(angle) * 1.04, gy = Math.sin(angle) * .79;
      const sphereX = point.x * cos + point.z * sin;
      const sphereZ = -point.x * sin + point.z * cos;
      const delay = point.seed * .025 + point.group * .002;
      const split = smooth(.40 + delay, .80 + delay, p);
      const arc = Math.sin(split * Math.PI) * .16;
      const localScale = mix(1, .27, split);
      const drift = 1 - gather;
      const swirl = drift * .32;
      const x = sphereX * localScale + gx * split - Math.sin(angle) * arc + (point.scatterX * Math.cos(swirl) - point.scatterY * Math.sin(swirl)) * drift * .25;
      const y = point.y * localScale + gy * split + Math.cos(angle) * arc * .6 + (point.scatterY * Math.cos(swirl) + point.scatterX * Math.sin(swirl)) * drift * .25;
      const z = sphereZ * localScale + (point.w - .5) * arc * .35 + point.scatterZ * drift * .20;
      const [px, py, depth] = camera(scene, x, y, z, placement.x, placement.y, size);
      const facing = clamp((1.2 - z) / 2.2);
      const highlight = factorWeights[point.group];
      const alpha = (.12 + facing * .70) * mix(1, .64 + highlight * .36, explode);
      const pointSize = (.45 + point.seed * .75 + facing * .32) * depth * mix(1, .85 + highlight * .28, explode);
      dot(ctx, px, py, pointSize, alpha, colors[point.group]);
    }
    const annotation = smooth(.74, .90, p);
    if (annotation > .001) {
      const centerX = scene.width * placement.x, centerY = scene.height * placement.y;
      ctx.save();
      ctx.globalAlpha = annotation;
      for (let group = 0; group < 6; group++) {
        const angle = group / 6 * tau - Math.PI / 6;
        const x = centerX + Math.cos(angle) * size * 1.04;
        const y = centerY + Math.sin(angle) * size * .79;
        const highlight = factorWeights[group];
        ctx.strokeStyle = `rgba(139,137,156,${.13 + highlight * .3})`;
        ctx.lineWidth = .55;
        ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(mix(centerX, x, annotation), mix(centerY, y, annotation)); ctx.stroke();
        const labelY = y + size * .36;
        ctx.fillStyle = `rgba(211,207,223,${.65 + highlight * .35})`;
        ctx.textAlign = 'center';
        ctx.font = `${mobile() ? 8 : 10}px -apple-system,BlinkMacSystemFont,sans-serif`;
        ctx.fillText(factorNames[group], x, labelY);
        ctx.font = `${mobile() ? 5 : 7}px SFMono-Regular,Consolas,monospace`;
        ctx.fillStyle = '#737383'; ctx.fillText(`x${group + 1} / FACTOR`, x, labelY + (mobile() ? 10 : 15));
      }
      ctx.restore();
    }
  }
  function drawBeta(scene) {
    const { ctx } = scene;
    const p = reduced.matches ? .83 : scene.progress;
    const gather = smooth(.01, .30, p);
    const placement = position(scene, smooth(.38, .77, p));
    const size = mobile() ? placement.scale * .96 : Math.min(placement.scale * 1.06, scene.width * .145);
    atmosphere(scene, placement.x, placement.y, size * 1.65, .05, [184,174,215]);
    const sigma = distributionWidth;
    const limit = mobile() ? 2700 : 4400;
    for (let index = 0; index < limit; index++) {
      const point = points[index];
      const t = (point.u - .5) * 3.2;
      const angle = point.v * tau + t * 3;
      const waveRadius = .16 + point.w * .14;
      const wx = t;
      const wy = Math.sin(t * 2.1 - clock * .09) * .35 + Math.sin(angle + clock * .06) * waveRadius;
      const wz = Math.cos(angle + clock * .06) * waveRadius;
      const dx = (point.u - .5) * 3.2;
      const bell = Math.exp(-.5 * (dx / sigma * 1.7) ** 2);
      const dy = .48 - bell * (1.05 + point.v * .05) + (point.w - .5) * .055;
      const dz = (point.v - .5) * .46 * bell;
      const unfold = smooth(.40 + point.seed * .025, .81 + point.seed * .025, p);
      const bend = Math.sin(unfold * Math.PI) * .11;
      const x = mix(wx, dx, unfold) + point.scatterX * (1 - gather) * .18;
      const y = mix(wy, dy, unfold) + Math.sin(t * 1.6) * bend + point.scatterY * (1 - gather) * .18;
      const z = mix(wz, dz, unfold) + Math.cos(t * 1.6) * bend;
      const [px, py, depth] = camera(scene, x, y, z, placement.x, placement.y, size);
      dot(ctx, px, py, (.45 + point.seed * .8) * depth, .15 + point.w * .61, point.seed > .93 ? '239,235,250' : '178,171,207');
    }
    const annotation = smooth(.75, .90, p);
    if (annotation > .001) {
      ctx.save(); ctx.globalAlpha = annotation;
      const [left, bottom] = camera(scene, -1.65, .51, 0, placement.x, placement.y, size);
      const [right] = camera(scene, 1.65, .51, 0, placement.x, placement.y, size);
      ctx.strokeStyle = '#77718365'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(left, bottom); ctx.lineTo(mix(left, right, annotation), bottom); ctx.stroke();
      ctx.font = `${mobile() ? 7 : 9}px SFMono-Regular,Consolas,monospace`; ctx.fillStyle = '#797487';
      ctx.textAlign = 'left'; ctx.fillText('POSSIBLE OUTCOMES', left, bottom + 18);
      ctx.textAlign = 'right'; ctx.fillText('R(t+h) →', right, bottom + 18);
      const cx = scene.width * placement.x;
      ctx.setLineDash([2, 6]); ctx.strokeStyle = '#77718340';
      ctx.beginPath(); ctx.moveTo(cx, scene.height * placement.y - size * .65); ctx.lineTo(cx, bottom); ctx.stroke();
      ctx.restore();
    }
  }
  function drawGamma(scene) {
    const { ctx, width, height } = scene;
    const p = reduced.matches ? .75 : scene.progress;
    const compact = mobile();
    const startX = width * (compact ? .08 : .55), startY = height * (compact ? .83 : .25);
    const endX = width * (compact ? .93 : .94), endY = height * (compact ? .50 : .82);
    const vx = endX - startX, vy = endY - startY;
    const length = Math.hypot(vx, vy), nx = -vy / length, ny = vx / length;
    const amount = mix(.12, 1, smooth(.02, .76, p));
    const amplitude = (compact ? 24 : 36) * mix(.55, 1, smooth(.02, .6, p));
    atmosphere(scene, compact ? .52 : .77, compact ? .68 : .54, length * .56, .035, [209,207,219]);
    ctx.save();
    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, '#a6a6c000'); gradient.addColorStop(.4, '#bbbbd060'); gradient.addColorStop(.7, '#eeebffba'); gradient.addColorStop(1, '#c8c5dc00');
    ctx.strokeStyle = gradient;
    for (let line = 0; line < 31; line++) {
      const offset = (line - 15) * .42;
      ctx.lineWidth = line === 15 ? 1.2 : .45;
      ctx.globalAlpha = line === 15 ? .9 : .1 + (1 - Math.abs(line - 15) / 15) * .4;
      ctx.beginPath();
      for (let segment = 0; segment <= 220; segment++) {
        const u = segment / 220 * amount;
        const envelope = Math.sin(u * Math.PI) ** 1.3;
        const wave = (Math.sin(u * 42 - clock * .65) + Math.sin(u * 13 - clock * .22) * .28) * amplitude * envelope + offset;
        const x = startX + vx * u + nx * wave, y = startY + vy * u + ny * wave;
        if (!segment) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = .6; ctx.strokeStyle = gradient; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(startX + vx * amount, startY + vy * amount); ctx.stroke();
    ctx.restore();
    for (let index = 0; index < 250; index++) {
      const point = points[index];
      const u = point.u * amount;
      const wave = (Math.sin(u * 42 - clock * .65) + Math.sin(u * 13 - clock * .22) * .28) * amplitude * Math.sin(u * Math.PI) ** 1.3;
      const x = startX + vx * u + nx * wave, y = startY + vy * u + ny * wave;
      dot(ctx, x, y, point.seed > .92 ? 1.4 : .7, point.seed * .6, '216,213,235');
    }
    const annotation = smooth(.55, .84, p);
    if (annotation > .001) {
      const a = .46, b = a + tau / 42;
      const offset = amplitude * 1.65;
      const ax = startX + vx * a + nx * offset, ay = startY + vy * a + ny * offset;
      const bx = startX + vx * b + nx * offset, by = startY + vy * b + ny * offset;
      ctx.save(); ctx.globalAlpha = annotation;
      ctx.strokeStyle = '#8d879d80'; ctx.lineWidth = .65;
      ctx.beginPath(); ctx.moveTo(ax - nx * 4, ay - ny * 4); ctx.lineTo(ax + nx * 4, ay + ny * 4);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx - nx * 4, by - ny * 4);
      ctx.moveTo(bx, by); ctx.lineTo(bx + nx * 4, by + ny * 4); ctx.stroke();
      ctx.font = `${compact ? 7 : 9}px SFMono-Regular,Consolas,monospace`; ctx.fillStyle = '#94909e'; ctx.textAlign = 'center';
      ctx.fillText('CYCLE / T', (ax + bx) / 2 + nx * 19, (ay + by) / 2 + ny * 19);
      ctx.restore();
    }
  }
  function drawOmega(scene) {
    const { ctx } = scene;
    const p = reduced.matches ? .65 : scene.progress;
    const placement = position(scene);
    placement.y = mobile() ? (reduced.matches ? .47 : .70) : .53;
    const size = placement.scale * 1.05;
    atmosphere(scene, placement.x, placement.y, size * 1.8, .038, [178,181,197]);
    const limit = mobile() ? 1800 : 3300;
    for (let index = 0; index < limit; index++) {
      const point = points[index];
      const travel = (point.u + clock * .009) % 1;
      const u = .3 + travel * (tau - .6);
      const radius = .95 + (point.v - .5) * .12 + Math.sin(u * 2 + clock * .2) * .012;
      const opening = .3 + smooth(0, 1, p) * .25;
      const x = Math.sin(u) * radius;
      const y = -Math.cos(u) * radius * .63;
      const z = (point.w - .5) * .30;
      const [px, py, depth] = camera(scene, x, y, z, placement.x, placement.y, size);
      const fade = Math.sin(travel * Math.PI) ** opening;
      dot(ctx, px, py, (.4 + point.seed * .55) * depth, fade * (.12 + point.seed * .48), '171,176,193');
    }
    ctx.save();
    ctx.fillStyle = '#bbbbcb60'; ctx.font = `italic ${mobile() ? 43 : 65}px Georgia,serif`; ctx.textAlign = 'center';
    ctx.fillText('ω', scene.width * placement.x, scene.height * placement.y + 15);
    ctx.restore();
  }
  const drawFunctions = { hero: drawHero, alpha: drawAlpha, beta: drawBeta, gamma: drawGamma, omega: drawOmega };
  function render(timestamp) {
    frame = 0;
    if (document.hidden) return;
    const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .05) : 1 / 60;
    lastFrame = timestamp;
    if (dirty) { updateScroll(); dirty = false; }
    const animated = !reduced.matches && !dialog.open;
    if (animated) clock += dt;
    heroPointer.x = damp(heroPointer.x, reduced.matches ? 0 : heroPointer.targetX, .24, dt);
    heroPointer.y = damp(heroPointer.y, reduced.matches ? 0 : heroPointer.targetY, .24, dt);
    heroPointer.influence = damp(heroPointer.influence, heroPointer.active && animated ? 1 : 0, .3, dt);
    distributionWidth = reduced.matches ? typeWidths[selectedType] : damp(distributionWidth, typeWidths[selectedType], .18, dt);
    factorWeights.forEach((weight, index) => {
      factorWeights[index] = reduced.matches ? Number(index === selectedFactor) : damp(weight, Number(index === selectedFactor), .15, dt);
    });
    for (const scene of scenes) {
      if (!scene.active) continue;
      scene.progress = animated ? damp(scene.progress, scene.targetProgress, .085, dt) : scene.targetProgress;
      scene.entrance = animated ? damp(scene.entrance, scene.targetEntrance, .12, dt) : scene.targetEntrance;
      if (scene.kind === 'hero') {
        scene.element.style.setProperty('--hero-scroll', smooth(0, .75, scene.progress).toFixed(4));
      } else if (scene.appliedProgress !== scene.progress || scene.appliedEntrance !== scene.entrance) {
        applyChapter(scene);
        scene.appliedProgress = scene.progress; scene.appliedEntrance = scene.entrance;
      }
      scene.ctx.clearRect(0, 0, scene.width, scene.height);
      drawFunctions[scene.kind](scene);
    }
    if (animated && scenes.some(scene => scene.active)) frame = requestAnimationFrame(render);
    else lastFrame = 0;
  }
  schedule = (needsUpdate = false) => {
    if (needsUpdate) dirty = true;
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  };
  addEventListener('scroll', () => schedule(true), { passive: true });
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    lastFrame = 0; schedule(true);
  });
  reduced.addEventListener('change', syncMotion);
  syncMotion();
  schedule(true);
})();
