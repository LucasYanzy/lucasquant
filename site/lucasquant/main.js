/* LucasQuant — scroll-directed particle studies. No remote assets or rendering dependencies. */
(() => {
  'use strict';
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const mix = (a, b, progress) => a + (b - a) * progress;
  const smooth = (start, end, value) => { const t = clamp((value - start) / (end - start)); return t * t * t * (t * (t * 6 - 15) + 10); };
  const damp = (value, target, response, dt) => {
    const next = mix(value, target, 1 - Math.exp(-dt / response));
    return Math.abs(next - target) < .0001 ? target : next;
  };
  const tau = Math.PI * 2;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compactHeight = matchMedia('(max-height: 519px)');
  const staticComposition = () => reduced.matches;
  const readingFlow = () => !document.body.classList.contains('motion-ready');
  const mobile = () => innerWidth <= 650;
  let selectedFactor = 0, selectedType = 'growth';
  const factorWeights = [1, 0, 0, 0, 0, 0];
  const typeWidths = { growth: .85, defensive: .59, cyclical: 1.1 };
  let distributionWidth = typeWidths.growth;
  let motionPaused = false;
  let fieldMode = 'flow', fieldMorph = 0;
  let schedule = () => {};
  const updateReadout = (element, text) => {
    element.getAnimations().forEach(animation => animation.cancel());
    element.textContent = text;
    if (!reduced.matches) element.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
  };

  // Navigation follows the document's scroll; it never captures wheel or touch events.
  const menu = document.getElementById('menuButton');
  const navigation = document.getElementById('navigation');
  const headerElement = document.querySelector('.header');
  const navIndicator = document.createElement('span');
  navIndicator.className = 'nav-indicator'; navIndicator.setAttribute('aria-hidden', 'true');
  navigation.append(navIndicator);
  const typeControls = document.querySelector('.type-controls');
  const typeIndicator = document.createElement('span');
  typeIndicator.className = 'type-indicator'; typeIndicator.setAttribute('aria-hidden', 'true');
  typeControls.append(typeIndicator);
  const moveIndicator = (container, item, prefix) => {
    container.style.setProperty(`--${prefix}-opacity`, item ? '1' : '0');
    if (!item) return;
    container.style.setProperty(`--${prefix}-x`, `${item.offsetLeft}px`);
    container.style.setProperty(`--${prefix}-width`, `${item.offsetWidth}px`);
  };
  const syncIndicators = () => {
    moveIndicator(navigation, navigation.querySelector('a[aria-current]'), 'nav');
    moveIndicator(typeControls, typeControls.querySelector('[aria-pressed="true"]'), 'type');
  };
  navigation.querySelectorAll('a').forEach(link => {
    link.addEventListener('pointerenter', () => moveIndicator(navigation, link, 'nav'));
    link.addEventListener('focus', () => moveIndicator(navigation, link, 'nav'));
  });
  navigation.addEventListener('pointerleave', syncIndicators);
  navigation.addEventListener('focusout', event => { if (!navigation.contains(event.relatedTarget)) syncIndicators(); });
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
      // Preview never changes the explicitly selected view or its description.
      const alpha = scenes.find(scene => scene.kind === 'alpha');
      if (alpha) alpha.hoverFactor = -1;
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
      moveIndicator(typeControls, button, 'type');
      updateReadout(document.getElementById('typeReadout'), `${typeNames[selectedType]} · 切换研究分组，观察相同指标条件下的结果分布（概念示意）。`);
      schedule(true);
    });
  });
  const fieldConsole = document.getElementById('fieldConsole');
  const heroCopy = document.querySelector('.hero-copy');
  const heroFooter = document.querySelector('.hero-footer');
  document.querySelectorAll('[data-field]').forEach(button => {
    button.addEventListener('click', () => {
      fieldMode = button.dataset.field;
      document.querySelectorAll('[data-field]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      updateReadout(document.getElementById('fieldReadout'), fieldMode === 'focus' ? '从细微的信号，看见整体的结构。' : '微小的变化，连成更大的图景。');
      schedule();
    });
  });
  // Arrow navigation supplements the existing Tab and Enter controls.
  ['.factor-controls', '.type-controls', '.field-controls'].forEach(selector => {
    const group = document.querySelector(selector);
    group.addEventListener('keydown', event => {
      const buttons = [...group.querySelectorAll('button')];
      const index = buttons.indexOf(document.activeElement);
      if (index < 0 || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next].focus({ preventScroll: true }); buttons[next].click();
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
  const particleCount = 6400;
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
    { kind: 'hero', element: document.getElementById('top'), canvas: document.getElementById('heroCanvas'), stage: document.querySelector('.hero-stage') },
    ...[...document.querySelectorAll('[data-scene]')].map(element => ({ kind: element.dataset.scene, element, canvas: element.querySelector('canvas'), stage: element.querySelector('.chapter-stage') }))
  ];
  const scenes = sources.map(source => ({
    ...source, ctx: source.canvas.getContext('2d'), width: 0, height: 0,
    progress: 0, targetProgress: 0, entrance: 0, active: false, measured: false,
    intro: source.element.querySelector('.chapter-intro'),
    detail: source.element.querySelector('.chapter-detail'),
    introItems: [...source.element.querySelectorAll('.chapter-intro .scene-copy > *')],
    detailItems: [...source.element.querySelectorAll('.chapter-detail .scene-copy > *')],
    steps: [...source.element.querySelectorAll('[data-step-index]')],
    pointer: { x: 0, y: 0, targetX: 0, targetY: 0, influence: 0, active: false },
    pulses: [], ripples: [], nodes: [], hoverFactor: -1,
  })).filter(scene => scene.ctx);
  if (!scenes.length) return;
  scenes.filter(scene => scene.detail).forEach(scene => {
    scene.cue = scene.element.querySelector('.chapter-cue');
    scene.inspection = scene.element.querySelector('.inspection-controls');
    scene.interlude = document.createElement('div'); scene.interlude.className = 'particle-interlude'; scene.interlude.hidden = true;
    scene.interludeStage = document.createElement('div'); scene.interludeStage.className = 'particle-interlude-stage';
    scene.interlude.append(scene.interludeStage); scene.detail.before(scene.interlude);
    if (matchMedia('(pointer:coarse)').matches) scene.inspection.querySelector('.inspection-hint').textContent = '轻触粒子 · 继续滑动探索';
  });
  const heroPointer = scenes[0].pointer;
  let interactionClock = 0;
  const factorButtons = [...document.querySelectorAll('[data-factor]')];
  const hitFactor = (scene, x, y) => {
    if (scene.kind !== 'alpha' || !staticComposition() && scene.progress <= .80) return -1;
    const label = scene.nodes.findIndex(node => node.label && x >= node.label.left && x <= node.label.right && y >= node.label.top && y <= node.label.bottom);
    if (label >= 0) return label;
    let nearest = mobile() ? 12 : 9, factor = -1;
    scene.nodes.forEach((node,index) => {
      const samples = node.samples || [];
      for (let segment = 1; segment < samples.length; segment++) {
        const a = samples[segment - 1], b = samples[segment];
        const dx = b.x - a.x, dy = b.y - a.y;
        const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / Math.max(.000001,dx * dx + dy * dy));
        const distance = Math.hypot(x - mix(a.x,b.x,t),y - mix(a.y,b.y,t)) + Math.max(0,mix(a.z,b.z,t)) * 2;
        if (distance < nearest) { nearest = distance; factor = index; }
      }
    });
    return factor;
  };
  scenes.forEach(scene => {
    let press = null;
    const coordinates = event => {
      const bounds = scene.canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    scene.stage.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      const { x, y } = coordinates(event);
      const overControl = !!event.target.closest('a,button');
      scene.pointer.targetX = x / Math.max(1, scene.width) * 2 - 1;
      scene.pointer.targetY = y / Math.max(1, scene.height) * 2 - 1;
      scene.pointer.active = !overControl;
      scene.hoverFactor = overControl ? -1 : hitFactor(scene, x, y);
      scene.stage.dataset.nodeHover = String(scene.hoverFactor >= 0);
      schedule();
    }, { passive: true });
    const releasePointer = () => {
      scene.pointer.targetX = 0; scene.pointer.targetY = 0; scene.pointer.active = false;
      scene.hoverFactor = -1; scene.stage.dataset.nodeHover = 'false'; press = null; schedule();
    };
    scene.stage.addEventListener('pointerleave', releasePointer);
    scene.stage.addEventListener('pointercancel', releasePointer);
    scene.stage.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || event.target.closest('a,button')) return;
      press = { ...coordinates(event), id: event.pointerId, time: performance.now() };
    }, { passive: true });
    scene.stage.addEventListener('pointerup', event => {
      if (!press || press.id !== event.pointerId) return;
      const { x, y } = coordinates(event);
      const isTap = Math.hypot(x - press.x, y - press.y) < 12 && performance.now() - press.time < 650;
      press = null;
      if (!isTap || event.target.closest('a,button')) return;
      const factor = hitFactor(scene, x, y);
      if (factor >= 0) factorButtons[factor].click();
      if (!reduced.matches) {
        scene.pulses.push({ x: x / scene.width, y: y / scene.height, start: interactionClock });
        if (scene.pulses.length > 3) scene.pulses.shift();
      }
      schedule();
    }, { passive: true });
  });
  if (matchMedia('(pointer:coarse)').matches) document.getElementById('fieldHint').textContent = '轻触粒子 · 激起涟漪';
  let frame = 0, dirty = true, snapProgress = true, clock = 0, lastFrame = 0;
  let layoutDirty = true, headerHeight = 70;
  const motionToggle = document.getElementById('motionToggle');
  motionToggle.addEventListener('click', () => {
    motionPaused = !motionPaused;
    motionToggle.setAttribute('aria-pressed', String(motionPaused));
    motionToggle.setAttribute('aria-label', motionPaused ? '继续自动动态' : '暂停自动动态');
    motionToggle.querySelector('.motion-toggle-label').textContent = motionPaused ? '继续动态' : '暂停动态';
    schedule(true);
  });
  document.querySelectorAll('[data-seek]').forEach(button => button.addEventListener('click', () => {
    const [kind, progress] = button.dataset.seek.split(':');
    const scene = scenes.find(item => item.kind === kind);
    if (!scene) return;
    const point = Number(progress);
    let top = scene.start - headerHeight + scene.travel * point;
    if (scene.compactInterlude) {
      top = point > .8
        ? scene.detail.getBoundingClientRect().top + scrollY - headerHeight - 20
        : scene.artStart - headerHeight + scene.artTravel * point;
    }
    window.scrollTo({ top, behavior: reduced.matches ? 'instant' : 'smooth' });
    if (button.closest('.inspection-controls') && point > .8) {
      const focusDetail = () => {
        const active = document.activeElement;
        if ((active === button || active === document.body) && scene.detail.getAttribute('aria-hidden') === 'false') {
          const heading = scene.detail.querySelector('h3'); heading.tabIndex = -1; heading.focus({ preventScroll:true });
        }
        removeEventListener('scrollend',focusDetail);
      };
      addEventListener('scrollend',focusDetail,{ once:true }); setTimeout(focusDetail,1400);
    }
  }));
  const syncMotion = () => {
    document.body.classList.toggle('motion-ready', !reduced.matches && !compactHeight.matches);
    scenes.forEach(scene => {
      scene.appliedProgress = null;
      if (!scene.interlude) return;
      const compactInterlude = compactHeight.matches && !reduced.matches;
      if (compactInterlude && !scene.compactInterlude) scene.interludeStage.append(scene.canvas,scene.cue,scene.inspection);
      else if (!compactInterlude && scene.compactInterlude) {
        scene.stage.prepend(scene.canvas); scene.intro.before(scene.cue,scene.inspection);
      }
      scene.compactInterlude = compactInterlude; scene.interlude.hidden = !compactInterlude;
      scene.element.classList.toggle('has-interlude',compactInterlude);
    });
    if (reduced.matches) document.querySelectorAll('[data-reveal]').forEach(element => element.classList.add('revealed'));
    resize();
  };
  const setSize = scene => {
    const bounds = scene.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, mobile() ? 1.5 : 1.75);
    if (scene.width !== bounds.width || scene.height !== bounds.height || scene.dpr !== dpr) {
      scene.width = bounds.width; scene.height = bounds.height; scene.dpr = dpr;
      scene.canvas.width = Math.round(bounds.width * dpr); scene.canvas.height = Math.round(bounds.height * dpr);
      scene.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const detailCopy = scene.element.querySelector('.chapter-detail .scene-copy');
    scene.detailBottom = detailCopy ? detailCopy.offsetTop + detailCopy.offsetHeight + 22 : 0;
    if (scene.kind === 'hero') {
      const ceiling = heroCopy.offsetTop + heroCopy.offsetHeight + 14;
      const floor = fieldConsole.offsetTop - 19;
      scene.focusY = (ceiling + floor) / 2 / Math.max(1,scene.height);
      scene.focusScale = Math.max(55,Math.min(scene.width * .30,(floor - ceiling) * .43));
    }
  };
  function resize() {
    scenes.forEach(setSize);
    syncIndicators();
    layoutDirty = true;
    schedule(true);
  }
  function measureLayout() {
    headerHeight = headerElement.offsetHeight;
    scenes.forEach(scene => {
      scene.start = scene.element.getBoundingClientRect().top + scrollY;
      scene.total = scene.element.offsetHeight;
      scene.travel = Math.max(1, scene.total - scene.stage.offsetHeight);
      const art = scene.compactInterlude ? scene.interlude : scene.canvas;
      scene.artStart = art.getBoundingClientRect().top + scrollY;
      scene.artTravel = scene.compactInterlude ? Math.max(1,scene.interlude.offsetHeight - scene.interludeStage.offsetHeight) : 0;
    });
    layoutDirty = false;
  }
  function updateScroll() {
    if (layoutDirty) measureLayout();
    const header = headerHeight;
    const pageHeight = innerHeight;
    let current = '';
    for (const scene of scenes) {
      const bounds = { top: scene.start - scrollY, bottom: scene.start + scene.total - scrollY };
      const wasActive = scene.active;
      scene.active = bounds.top < pageHeight && bounds.bottom > header;
      scene.targetEntrance = smooth(0, .75, (pageHeight - bounds.top) / Math.max(1, pageHeight - header));
      scene.targetProgress = clamp((header - bounds.top) / scene.travel);
      if (readingFlow() && !reduced.matches) {
        // Short windows retain a readable document and scrub the artwork as it crosses the viewport.
        scene.targetProgress = scene.compactInterlude ? clamp((scrollY + header - scene.artStart) / scene.artTravel) : scene.kind === 'hero'
          ? clamp((header - bounds.top) / Math.max(1,scene.total - (pageHeight - header)))
          : clamp((scrollY + pageHeight * .85 - scene.artStart) / (pageHeight * .70 + scene.height * .65));
      }
      // A deep link or a resized viewport starts at its actual position. Normal scrolling is damped.
      if (snapProgress || !scene.measured || !wasActive || reduced.matches) {
        scene.progress = scene.targetProgress;
        scene.entrance = scene.targetEntrance;
      }
      scene.measured = true;
      if (scene.kind !== 'hero' && bounds.top <= pageHeight * .45 && bounds.bottom > pageHeight * .45) current = scene.kind;
    }
    snapProgress = false;
    headerElement.style.setProperty('--reading-progress', clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)).toFixed(5));
    headerElement.dataset.scrolled = String(scrollY > 30);
    navigation.querySelectorAll('a').forEach(link => {
      if (link.hash === `#${current}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    syncIndicators();
  }
  function applyChapter(scene) {
    const p = scene.progress;
    const future = scene.kind === 'gamma' || scene.kind === 'omega';
    const element = scene.element;
    const set = (name, value) => element.style.setProperty(name, value);
    set('--progress', p.toFixed(4));
    set('--art-opacity', mix(.48, 1, scene.entrance).toFixed(4));
    set('--detail-visibility', p > .70 ? 'visible' : 'hidden');
    set('--object-opacity', smooth(.76, .88, p).toFixed(4));
    const inspection = future || reduced.matches ? 0 : inspectionAmount(p);
    set('--inspection', inspection.toFixed(4));
    set('--inspection-opacity', (smooth(.38,.43,p) * (1 - smooth(.59,.65,p))).toFixed(4));
    set('--inspection-visibility', p > .38 && p < .65 && !reduced.matches ? 'visible' : 'hidden');
    set('--cue-opacity', (smooth(.43, .47, p) * (1 - smooth(.59, .65, p))).toFixed(4));
    set('--word-opacity', (mix(.7, .15, smooth(.23, .73, p)) * (1 - inspection * .95)).toFixed(4));
    set('--word-x', `${-smooth(0, 1, p) * 15}px`);
    element.dataset.phase = future ? 'future' : p < .30 ? 'gather' : p < .70 ? 'reveal' : 'detail';
    element.dataset.inspection = inspection.toFixed(4);
    element.dataset.progress = p.toFixed(4);
    element.dataset.targetProgress = scene.targetProgress.toFixed(4);
    const staticMode = readingFlow();
    scene.introItems.forEach((item, index) => {
      const exit = future || staticMode ? 0 : smooth(.26 + index * .012, .37 + index * .012, p);
      item.style.setProperty('--item-opacity', (1 - exit).toFixed(4));
      item.style.setProperty('--item-y', `${-exit * (12 + index * 2)}px`);
    });
    scene.detailItems.forEach((item, index) => {
      const enter = staticMode ? 1 : smooth(.70 + index * .010, .77 + index * .010, p);
      item.style.setProperty('--item-opacity', enter.toFixed(4));
      item.style.setProperty('--item-y', `${(1 - enter) * 18}px`);
      item.inert = !staticMode && enter < .12;
    });
    const introHidden = !staticMode && !future && p > .43;
    scene.intro.inert = introHidden;
    scene.intro.setAttribute('aria-hidden', String(introHidden));
    if (scene.detail) {
      const detailHidden = !staticMode && p < .70;
      scene.detail.inert = detailHidden;
      scene.detail.setAttribute('aria-hidden', String(detailHidden));
    }
    if (scene.inspection) {
      const hidden = reduced.matches || p <= .38 || p >= .65;
      scene.inspection.inert = hidden; scene.inspection.setAttribute('aria-hidden',String(hidden));
    }
    const step = p < .30 ? 0 : p < .70 ? 1 : 2;
    scene.steps.forEach((button, index) => {
      if (index === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }
  function camera(scene, x, y, z, centerX, centerY, scale) {
    const perspective = 4.4 / (4.4 + z);
    return [scene.width * centerX + x * scale * perspective, scene.height * centerY + y * scale * perspective, perspective];
  }
  function position(scene, detail = 0) {
    const compact = mobile();
    const staticLayout = !document.body.classList.contains('motion-ready');
    if (scene.compactInterlude) return { x:compact ? .5 : .715, y:.50, scale:Math.min(scene.width * .28,scene.height * .30) };
    if (compact && staticLayout) return { x: .5, y: .47, scale: Math.min(scene.width * .28, scene.height * .32) };
    const base = {
      x: (compact ? .51 : .715) + scene.pointer.x * .008, y: (compact ? .67 : .50) + scene.pointer.y * .006,
      scale: Math.min(scene.width * (compact ? .34 : .20), scene.height * (compact ? .25 : .36)),
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
  function inspectionAmount(progress) {
    return smooth(.22,.38,progress) * (1 - smooth(.56,.78,progress));
  }
  function inspectionPlacement(scene, placement, amount) {
    placement.x = mix(placement.x,.5 + scene.pointer.x * .008,amount);
    placement.y = mix(placement.y,scene.compactInterlude ? .52 : .55,amount);
  }
  function atmosphere(scene, x, y, radius, opacity = .08, tint = [186, 188, 211]) {
    const { ctx, width, height } = scene;
    const glow = ctx.createRadialGradient(width * x, height * y, 0, width * x, height * y, radius);
    glow.addColorStop(0, `rgba(${tint},${opacity})`); glow.addColorStop(.5, `rgba(${tint},${opacity * .4})`); glow.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
  }
  const inkCache = new Map();
  function ink(color, opacity) {
    let palette = inkCache.get(color);
    if (!palette) { palette = Array.from({ length: 65 }, (_, index) => `rgba(${color},${index / 64})`); inkCache.set(color, palette); }
    // Interpolated factor colors are quantized below; keep the cache bounded on long visits.
    if (inkCache.size > 160) inkCache.delete(inkCache.keys().next().value);
    return palette[Math.round(clamp(opacity) * 64)];
  }
  function dot(ctx, x, y, size, opacity, color = '218,220,231') {
    ctx.fillStyle = ink(color, opacity);
    if (size < 1.6) ctx.fillRect(x - size / 2, y - size / 2, size, size);
    else { ctx.beginPath(); ctx.arc(x,y,size / 2,0,tau); ctx.fill(); }
  }
  function interact(scene, x, y) {
    const pointer = scene.pointer;
    let ox = 0, oy = 0, light = 0;
    if (pointer.influence > .001 && !reduced.matches) {
      const dx = x - (pointer.x + 1) * scene.width / 2, dy = y - (pointer.y + 1) * scene.height / 2;
      const field = Math.exp(-(dx * dx + dy * dy) / (mobile() ? 8500 : 22000)) * pointer.influence;
      ox += dx * field * .14; oy += dy * field * .14; light += field * .30;
    }
    for (const ripple of scene.ripples) {
      const dx = x - ripple.x, dy = y - ripple.y;
      const distance = Math.hypot(dx, dy);
      const band = (distance - ripple.radius) / ripple.width;
      if (Math.abs(band) > 3) continue;
      const force = Math.exp(-band * band) * ripple.opacity;
      ox += dx / Math.max(1, distance) * force * 18;
      oy += dy / Math.max(1, distance) * force * 18;
      light += force * .55;
    }
    return [x + ox, y + oy, light];
  }
  function drawRipples(scene) {
    const { ctx } = scene;
    ctx.save();
    for (const ripple of scene.ripples) {
      ctx.strokeStyle = ink('172,205,230', ripple.opacity * .17);
      ctx.lineWidth = .65;
      ctx.beginPath(); ctx.arc(ripple.x, ripple.y, ripple.radius, 0, tau); ctx.stroke();
      ctx.strokeStyle = ink('172,205,230', ripple.opacity * .06);
      ctx.beginPath(); ctx.arc(ripple.x, ripple.y, ripple.radius + 9, 0, tau); ctx.stroke();
    }
    ctx.restore();
  }
  function tracer(ctx, x, y, opacity, size = 1) {
    dot(ctx, x, y, 11 * size, opacity * .025, '173,208,235');
    dot(ctx, x, y, 5 * size, opacity * .10, '190,221,244');
    dot(ctx, x, y, 1.5 * size, opacity, '238,248,255');
  }
  // Shared curve: the fine filaments and the points belong to the same moving surface.
  function heroSurface(u, band, cross, time, tilt) {
    const ripple = Math.sin(u * 3 - time * .22) * .045;
    const radius = 1.03 + band * .38 + ripple;
    const twist = u * 2 + time * .12;
    return [
      Math.cos(u) * radius,
      Math.sin(u) * radius * tilt + Math.sin(twist) * band * .52 + Math.cos(cross) * .022,
      Math.sin(u) * .72 + Math.cos(twist) * band * .58 + Math.sin(cross) * .032,
    ];
  }
  function signalRotation(x, y, z, time) {
    const angle = .25 + time * .065;
    const c = Math.cos(angle), s = Math.sin(angle);
    return [x * c + z * s, y * .98 - z * .17, -x * s + z * c + y * .17];
  }
  function heroFilament(u, band, time, tilt) {
    const flow = heroSurface(u,band,u * 6,time,tilt);
    const latitude = band * Math.PI * .94;
    const radius = Math.cos(latitude);
    const focus = signalRotation(Math.cos(u) * radius,Math.sin(latitude),Math.sin(u) * radius,time);
    return flow.map((value,index) => mix(value,focus[index],fieldMorph));
  }
  function drawHero(scene) {
    const { ctx, width, height, progress: p } = scene;
    const compact = mobile();
    const approach = smooth(.08,.86,p), time = clock + approach * 4.8;
    const cx = mix(.50,compact ? .50 : .61,approach) + heroPointer.x * .010;
    const flowY = mix(compact ? .735 : .69,compact ? .70 : .50,approach);
    const cy = mix(flowY,mix(scene.focusY,compact ? .68 : .50,approach),fieldMorph) + heroPointer.y * .008;
    const size = Math.min(width * (compact ? .57 : .46),height * (compact ? .46 : .55));
    const flowScale = size * mix(1,compact ? 1.12 : 1.38,approach);
    const scale = mix(flowScale,mix(scene.focusScale,flowScale * .70,approach),fieldMorph) * (1 + Math.sin(time * .32) * .009);
    const tilt = mix(.40,.57,approach) + Math.sin(time * .16) * .025 + heroPointer.y * .025;
    atmosphere(scene,cx,cy,scale * 1.55,.045,[133,170,205]);
    const gradient = ctx.createLinearGradient(width * .12,height * .28,width * .94,height * .79);
    gradient.addColorStop(0,'#8da9c430'); gradient.addColorStop(.5,'#deedff8c'); gradient.addColorStop(1,'#8da9c433');
    const filaments = compact ? 17 : 29;
    ctx.save(); ctx.strokeStyle = gradient;
    for (let line = 0; line < filaments; line++) {
      const band = (line / (filaments - 1) - .5) * .98;
      const edge = line === 0 || line === filaments - 1;
      ctx.globalAlpha = (edge ? .8 : .2) * (1 - Math.sin(fieldMorph * Math.PI) * .55);
      ctx.lineWidth = edge ? .75 : .45;
      ctx.beginPath();
      for (let step = 0; step <= 128; step++) {
        const u = step / 128 * tau + time * .075;
        const [x,y,z] = heroFilament(u,band,time,tilt);
        const projected = camera(scene,x,y,z,cx,cy,scale);
        const [px,py] = interact(scene,projected[0],projected[1]);
        if (!step) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.stroke();
    }
    ctx.restore();
    // Depth buckets preserve front/back light without sorting thousands of objects per frame.
    if (!scene.heroBuffer) {
      scene.heroBuffer = new Float32Array(particleCount * 6);
      scene.depthBuckets = Array.from({length:8},() => []);
    }
    scene.depthBuckets.forEach(bucket => { bucket.length = 0; });
    const limit = compact ? 3800 : particleCount;
    const data = scene.heroBuffer;
    for (let index = 0; index < limit; index++) {
      const point = points[Math.floor(index * particleCount / limit)];
      const u = point.u * tau + time * (.075 + (point.v - .5) * .005);
      const band = point.v - .5;
      const flow = heroSurface(u,band,point.w * tau,time,tilt);
      const focus = signalRotation(point.x,point.y,point.z,time);
      const x = mix(flow[0],focus[0],fieldMorph), y = mix(flow[1],focus[1],fieldMorph), z = mix(flow[2],focus[2],fieldMorph);
      const [sx,sy,depth] = camera(scene,x,y,z,cx,cy,scale);
      const [px,py,reflection] = interact(scene,sx,sy);
      const front = clamp((1 - z) / 2);
      const rim = mix(Math.pow(Math.abs(band) * 2,4),Math.pow(1 - Math.abs(z),3),fieldMorph);
      const sweep = Math.pow(.5 + .5 * Math.cos(u - time * .19 + 1),6);
      const offset = index * 6;
      data[offset] = px; data[offset + 1] = py;
      data[offset + 2] = (.42 + point.seed * .68 + front * .48) * depth;
      data[offset + 3] = .10 + point.seed * .18 + front * .38 + rim * .23 + sweep * .14 + reflection;
      data[offset + 4] = point.seed; data[offset + 5] = front;
      scene.depthBuckets[Math.min(7,Math.floor(front * 8))].push(offset);
    }
    for (let bucket = 0; bucket < 8; bucket++) {
      const color = bucket < 3 ? '150,176,201' : '218,232,247';
      for (const offset of scene.depthBuckets[bucket]) {
        const x = data[offset], y = data[offset + 1], radius = data[offset + 2], light = data[offset + 3];
        dot(ctx,x,y,radius,light,color);
        if (data[offset + 4] > .991 && data[offset + 5] > .56) tracer(ctx,x,y,Math.min(.92,light),.65);
      }
    }
    for (let index = 0; index < 8; index++) {
      const u = time * .14 + index / 8 * tau;
      const [x,y,z] = heroFilament(u,(index % 3 - 1) * .35,time,tilt);
      const [px,py] = camera(scene,x,y,z,cx,cy,scale);
      const [ix,iy] = interact(scene,px,py);
      tracer(ctx,ix,iy,.25 + clamp((1 - z) / 2) * .48,.7);
    }
    if (fieldMorph > .01) {
      ctx.save(); ctx.globalAlpha = fieldMorph * .4; ctx.strokeStyle = '#abcce263'; ctx.lineWidth = .5;
      const x = width * cx, y = height * cy;
      for (let tick = 0; tick < 48; tick++) {
        const angle = tick / 48 * tau;
        const radius = scale * 1.22;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(angle) * radius,y + Math.sin(angle) * radius);
        ctx.lineTo(x + Math.cos(angle) * (radius + (tick % 4 ? 3 : 7)),y + Math.sin(angle) * (radius + (tick % 4 ? 3 : 7))); ctx.stroke();
      }
      ctx.restore();
    }
  }
  // Unit-sphere paths keep every factor in the same field throughout the transition.
  // For antipodal directions, select a stable tangent instead of crossing the center.
  function sphereArc(a, b, progress) {
    if (progress <= 0) return a;
    if (progress >= 1) return b;
    const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2],-1,1);
    let tx = b[0] - a[0] * dot, ty = b[1] - a[1] * dot, tz = b[2] - a[2] * dot;
    let length = Math.hypot(tx,ty,tz);
    if (length < .000001) {
      if (dot > 0) return a;
      const axis = Math.abs(a[1]) < .9 ? [0,1,0] : [1,0,0];
      tx = a[1] * axis[2] - a[2] * axis[1];
      ty = a[2] * axis[0] - a[0] * axis[2];
      tz = a[0] * axis[1] - a[1] * axis[0];
      length = Math.hypot(tx,ty,tz);
    }
    const angle = Math.acos(dot) * progress, c = Math.cos(angle), s = Math.sin(angle) / length;
    return [a[0] * c + tx * s,a[1] * c + ty * s,a[2] * c + tz * s];
  }
  function alphaBand(group, longitude, across = 0) {
    const y = -.76 + group * .304 + across * .15;
    const radius = Math.sqrt(Math.max(0,1 - y * y));
    return [Math.cos(longitude) * radius,y,Math.sin(longitude) * radius];
  }
  function bandShoulder(group, yaw, tilt) {
    const y = -.76 + group * .304, radius = Math.sqrt(1 - y * y);
    // Tangent of the projected latitude: leaders stay on the right silhouette as the field rotates.
    return yaw - Math.asin(radius * Math.cos(tilt) / (4.4 + y * Math.sin(tilt)));
  }
  const alphaSamples = points.map(point => {
    const length = Math.hypot(point.x,point.y,point.z);
    return { from:[point.x / length,point.y / length,point.z / length],to:alphaBand(point.group,point.u * tau,point.v - .5) };
  });
  function drawAlpha(scene) {
    const { ctx } = scene;
    const p = staticComposition() ? .86 : scene.progress;
    const gather = smooth(0,.19,p), resolve = smooth(.56,.81,p);
    const closeup = inspectionAmount(p);
    const placement = position(scene,smooth(.66,.84,p));
    const compact = mobile();
    placement.x = compact ? mix(placement.x,.405,resolve) : mix(placement.x,.675,resolve);
    inspectionPlacement(scene,placement,closeup);
    const studySize = Math.min(scene.width * (compact ? .43 : .32),scene.height * (scene.compactInterlude ? .30 : .36));
    const size = mix(placement.scale * mix(1,compact ? .96 : .94,resolve),studySize,closeup);
    const cx = scene.width * placement.x, cy = scene.height * placement.y;
    const yaw = .23 + clock * .037 + smooth(0,.72,p) * .8;
    const tilt = mix(.12,.38,resolve) + closeup * .18;
    const c = Math.cos(yaw), s = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    const rotate = point => {
      const x = point[0] * c + point[2] * s, z = -point[0] * s + point[2] * c;
      return [x,point[1] * ct - z * st,point[1] * st + z * ct];
    };
    const project = point => {
      const [x,y,z] = rotate(point);
      const projected = camera(scene,x,y,z,placement.x,placement.y,size);
      const [px,py,reflection] = interact(scene,projected[0],projected[1]);
      return [px,py,z,projected[2],reflection];
    };
    atmosphere(scene,placement.x,placement.y,size * 1.6,.045,[160,190,218]);
    // The original orbital study remains a distinct, interactive middle scene.
    ctx.save(); ctx.lineWidth = .65;
    for (let orbit = 0; orbit < 3; orbit++) {
      const angle = orbit * Math.PI / 3 + clock * .025 + p * .30;
      let previous;
      for (let step = 0; step <= 100; step++) {
        const u = step / 100 * tau, x = Math.cos(u) * 1.03, y = Math.sin(u) * .27;
        const [px,py,z] = project([x * Math.cos(angle) - y * Math.sin(angle),x * Math.sin(angle) + y * Math.cos(angle),Math.sin(u) * .88]);
        if (previous) {
          ctx.strokeStyle = ink('175,207,231',closeup * (1 - resolve) * (.045 + clamp((1 - z) / 2) * .12));
          ctx.beginPath(); ctx.moveTo(previous[0],previous[1]); ctx.lineTo(px,py); ctx.stroke();
        }
        previous = [px,py];
      }
    }
    ctx.restore();
    const annotation = smooth(.78,.85,p);
    const labelX = Math.min(cx + size * 1.15,scene.width - (compact ? 78 : 124));
    scene.nodes = [];
    ctx.save();
    for (let group = 0; group < 6; group++) {
      const weight = factorWeights[group], preview = scene.hoverFactor === group ? .22 : 0;
      const emphasis = Math.min(1,weight + preview);
      const samples = [];
      // The center and two edges describe a finite band, rather than six disconnected objects.
      for (const edge of [-.5,0,.5]) {
        let previous = null;
        for (let step = 0; step <= 120; step++) {
          const u = step / 120 * tau;
          const [x,y,z] = project(alphaBand(group,u,edge));
          if (edge === 0 && step % 3 === 0) samples.push({x,y,z});
          if (previous) {
            const front = clamp((1 - z) / 2);
            ctx.strokeStyle = ink('185,214,236',resolve * (edge === 0 ? .065 + emphasis * .25 : .03 + emphasis * .09) * (.35 + front * .65));
            ctx.lineWidth = edge === 0 ? .65 + emphasis * .35 : .5;
            ctx.beginPath(); ctx.moveTo(previous[0],previous[1]); ctx.lineTo(x,y); ctx.stroke();
          }
          previous = [x,y];
        }
      }
      const labelY = cy + (-.76 + group * .304) * size * .94;
      scene.nodes.push({x:labelX + (compact ? 27 : 41),y:labelY,radius:0,label:{left:labelX - 9,right:labelX + (compact ? 68 : 100),top:labelY - (compact ? 10 : 13),bottom:labelY + (compact ? 10 : 13)},samples});
      if (annotation > .001) {
        const [ax,ay] = project(alphaBand(group,bandShoulder(group,yaw,tilt)));
        const leadX = labelX - (compact ? 7 : 12);
        ctx.globalAlpha = annotation;
        ctx.strokeStyle = ink('180,207,228',.10 + emphasis * .26); ctx.lineWidth = .6;
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(leadX - 7,labelY); ctx.lineTo(leadX,labelY); ctx.stroke();
        dot(ctx,ax,ay,1.6,.25 + emphasis * .55,'203,225,242');
        ctx.textAlign = 'left';
        ctx.font = `${compact ? 7 : 9}px SFMono-Regular,Consolas,monospace`;
        ctx.fillStyle = ink('160,190,214',.58 + emphasis * .35);
        ctx.fillText(String(group + 1).padStart(2,'0'),labelX,labelY + 3);
        ctx.font = `${compact ? 9 : 12}px -apple-system,BlinkMacSystemFont,sans-serif`;
        ctx.fillStyle = ink('221,234,245',.62 + emphasis * .36);
        ctx.fillText(factorNames[group],labelX + (compact ? 17 : 24),labelY + 3);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    const limit = compact ? 3500 : particleCount;
    if (!scene.alphaBuffer) { scene.alphaBuffer = new Float32Array(particleCount * 6); scene.alphaDepth = Array.from({length:8},() => []); }
    scene.alphaDepth.forEach(bucket => { bucket.length = 0; });
    const buffer = scene.alphaBuffer;
    for (let index = 0; index < limit; index++) {
      const sampleIndex = Math.floor(index * particleCount / limit), point = points[sampleIndex], path = alphaSamples[sampleIndex];
      const delayed = smooth(.56 + point.seed * .018,.79 + point.seed * .018,p);
      const unit = sphereArc(path.from,path.to,delayed);
      const shell = mix(Math.hypot(point.x,point.y,point.z),.975 + point.w * .025,delayed);
      const drift = 1 - gather;
      const field = [unit[0] * shell + point.scatterX * drift * .26,unit[1] * shell + point.scatterY * drift * .26,unit[2] * shell + point.scatterZ * drift * .19];
      const [x,y,z,depth,reflection] = project(field);
      const front = clamp((1 - z) / 2);
      const selected = factorWeights[point.group], preview = scene.hoverFactor === point.group ? .15 : 0;
      const prominence = mix(1,.45 + selected * .55 + preview,resolve);
      const light = (.14 + front * .46 + point.seed * .18) * prominence + reflection;
      const offset = index * 6;
      buffer[offset] = x; buffer[offset + 1] = y; buffer[offset + 2] = (.45 + point.seed * .6 + front * .22) * depth;
      buffer[offset + 3] = light; buffer[offset + 4] = selected; buffer[offset + 5] = point.seed;
      scene.alphaDepth[Math.min(7,Math.floor(front * 8))].push(offset);
    }
    for (let bucket = 0; bucket < 8; bucket++) {
      for (const offset of scene.alphaDepth[bucket]) {
        const color = buffer[offset + 4] > .5 ? '224,239,250' : '164,190,212';
        dot(ctx,buffer[offset],buffer[offset + 1],buffer[offset + 2],buffer[offset + 3],color);
        if (buffer[offset + 5] > .997 && bucket > 4) tracer(ctx,buffer[offset],buffer[offset + 1],buffer[offset + 3] * .6,.6);
      }
    }
    if (annotation > .001) {
      ctx.save(); ctx.globalAlpha = annotation; ctx.textAlign = 'center';
      const captionX = compact ? scene.width * .5 : cx + size * .1;
      const captionY = Math.min(cy + size * 1.16 + 16,scene.height - (scene.compactInterlude ? 36 : 73));
      ctx.font = `${compact ? 9 : 11}px -apple-system,BlinkMacSystemFont,sans-serif`; ctx.fillStyle = '#b4c5d7';
      ctx.fillText('六条信号带，六个观察视角。',captionX,captionY);
      ctx.font = `${compact ? 7 : 9}px -apple-system,BlinkMacSystemFont,sans-serif`; ctx.fillStyle = '#6f8195';
      ctx.fillText('分组示意 · 不表示因子数值或权重',captionX,captionY + (compact ? 15 : 21));
      ctx.restore();
    }
  }
  function drawBeta(scene) {
    const { ctx } = scene;
    const p = staticComposition() ? .86 : scene.progress;
    const gather = smooth(0,.20,p), unfold = smooth(.56,.81,p);
    const closeup = inspectionAmount(p);
    const placement = position(scene,smooth(.66,.84,p));
    inspectionPlacement(scene,placement,closeup);
    const studySize = Math.min(scene.width * (mobile() ? .25 : .22),scene.height * .28);
    const size = mix(Math.min(placement.scale * .91,scene.width * (mobile() ? .28 : .155)),studySize,closeup);
    atmosphere(scene,placement.x,placement.y,size * 2,.06,[200,211,235]);
    const sigma = distributionWidth;
    if (unfold > .001) {
      const [left,bottom] = camera(scene,-1.75,.53,0,placement.x,placement.y,size);
      const gradient = ctx.createLinearGradient(0,bottom - size * 1.2,0,bottom);
      gradient.addColorStop(0,ink('153,190,221',unfold * .095));
      gradient.addColorStop(1,ink('153,190,221',unfold * .008));
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.moveTo(left,bottom);
      for (let step = 0; step <= 96; step++) {
        const x = -1.75 + step / 96 * 3.5;
        const bell = Math.exp(-.5 * (x / sigma * 1.5) ** 2);
        const [px,py] = camera(scene,x,.53 - bell * 1.16,0,placement.x,placement.y,size);
        ctx.lineTo(px,py);
      }
      const [right] = camera(scene,1.75,.53,0,placement.x,placement.y,size);
      ctx.lineTo(right,bottom); ctx.closePath(); ctx.fill();
    }
    const limit = mobile() ? 3200 : 5800;
    for (let index = 0; index < limit; index++) {
      const point = points[index];
      const studyTime = clock + smooth(.22,.81,p) * 4.5;
      const t = (point.u - .5) * 3.5, angle = point.v * tau + t * 2.6 + studyTime * .12;
      const radius = .18 + point.w * .12;
      const wx = t, wy = Math.sin(t * 1.8 - studyTime * .17) * .34 + Math.sin(angle) * radius;
      const wz = Math.cos(angle) * radius;
      const bell = Math.exp(-.5 * (t / sigma * 1.5) ** 2);
      const dy = .53 - bell * (1.14 + point.v * .07) + (point.w - .5) * .075;
      const dz = (point.v - .5) * .60 * bell;
      const individual = smooth(.56 + point.seed * .018,.79 + point.seed * .018,p);
      const arc = Math.sin(individual * Math.PI) * .16;
      const x = wx + point.scatterX * (1 - gather) * .2;
      const y = mix(wy,dy,individual) + Math.sin(t * 1.6) * arc + point.scatterY * (1 - gather) * .2;
      const z = mix(wz,dz,individual) + Math.cos(t * 1.6) * arc;
      const [sx,sy,depth] = camera(scene,x,y,z,placement.x,placement.y,size);
      const [px,py,reflection] = interact(scene,sx,sy);
      dot(ctx,px,py,(.5 + point.seed * .67) * depth,.22 + point.w * .55 + reflection,'209,219,237');
    }
    // A small fraction fills the distribution rather than outlining a flat bell.
    if (unfold > .01) {
      ctx.save(); ctx.globalAlpha = unfold;
      for (let index = 0; index < limit / 3; index++) {
        const point = points[index];
        const x = (point.u - .5) * 3.5;
        const bell = Math.exp(-.5 * (x / sigma * 1.5) ** 2);
        const y = .53 - bell * 1.16 * point.v;
        const [px,py] = camera(scene,x,y,(point.w - .5) * .24,placement.x,placement.y,size);
        dot(ctx,px,py,.65,.06 + point.v * .19,'179,199,227');
      }
      ctx.restore();
    }
    const annotation = smooth(.78,.86,p);
    if (annotation > .001) {
      ctx.save(); ctx.globalAlpha = annotation;
      const [left,bottom] = camera(scene,-1.8,.57,0,placement.x,placement.y,size);
      const [right] = camera(scene,1.8,.57,0,placement.x,placement.y,size);
      ctx.strokeStyle = '#a6b7cc70'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(left,bottom); ctx.lineTo(right,bottom); ctx.stroke();
      for (let tick = 0; tick <= 12; tick++) {
        const x = mix(left,right,tick / 12);
        ctx.strokeStyle = tick === 6 ? '#a6b7cc88' : '#a6b7cc38';
        ctx.beginPath(); ctx.moveTo(x,bottom); ctx.lineTo(x,bottom + (tick % 3 ? 3 : 6)); ctx.stroke();
      }
      ctx.font = `${mobile() ? 7 : 9}px SFMono-Regular,Consolas,monospace`; ctx.fillStyle = '#9ca9bc';
      ctx.textAlign = 'left'; ctx.fillText('POSSIBLE OUTCOMES',left,bottom + 20);
      ctx.textAlign = 'right'; ctx.fillText('R(t+h) →',right,bottom + 20);
      const cx = scene.width * placement.x;
      ctx.setLineDash([2,6]); ctx.strokeStyle = '#a6b7cc38';
      ctx.beginPath(); ctx.moveTo(cx,scene.height * placement.y - size * .72); ctx.lineTo(cx,bottom); ctx.stroke();
      ctx.setLineDash([]);
      // Cursor inspection describes this conceptual shape without inventing a market statistic.
      const pointerX = (scene.pointer.x + 1) * scene.width / 2;
      const pointerY = (scene.pointer.y + 1) * scene.height / 2;
      if (scene.pointer.influence > .02 && pointerX > left && pointerX < right && pointerY > bottom - size * 1.6 && pointerY < bottom + 45) {
        const t = clamp((pointerX - cx) / size,-1.75,1.75);
        const bell = Math.exp(-.5 * (t / sigma * 1.5) ** 2);
        const y = scene.height * placement.y + (.53 - bell * 1.16) * size;
        ctx.globalAlpha = annotation * scene.pointer.influence;
        ctx.strokeStyle = '#c9e1f699';
        ctx.beginPath(); ctx.moveTo(pointerX,bottom); ctx.lineTo(pointerX,y); ctx.stroke();
        tracer(ctx,pointerX,y,.95,1.15);
        ctx.fillStyle = '#d2e3f2'; ctx.textAlign = 'center';
        ctx.fillText(t < -.45 ? '左尾 / LOWER' : t > .45 ? '右尾 / UPPER' : '中心 / CENTER',clamp(pointerX,left + 45,right - 45),bottom + 39);
      }
      ctx.restore();
    }
  }
  function drawGamma(scene) {
    const { ctx, width, height } = scene;
    const p = staticComposition() ? .75 : scene.progress;
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
    for (let component = 0; component < 2; component++) {
      ctx.strokeStyle = component === 0 ? '#a9cde755' : '#b7bedb36'; ctx.lineWidth = .65;
      ctx.setLineDash(component === 0 ? [5,7] : [1,5]);
      ctx.beginPath();
      for (let segment = 0; segment <= 180; segment++) {
        const u = segment / 180 * amount;
        const wave = Math.sin(u * (component === 0 ? 13 : 42) - clock * (component === 0 ? .22 : .65)) * (component === 0 ? .28 : 1) * amplitude * Math.sin(u * Math.PI) ** 1.3;
        const [x,y] = interact(scene,startX + vx * u + nx * wave,startY + vy * u + ny * wave);
        if (!segment) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
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
      const [px,py,reflection] = interact(scene,x,y);
      dot(ctx, px, py, point.seed > .92 ? 1.4 : .7, point.seed * .6 + reflection, '216,213,235');
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
    const p = staticComposition() ? .65 : scene.progress;
    const placement = position(scene);
    placement.y = mobile() ? (staticComposition() ? .47 : .70) : .53;
    const size = placement.scale * 1.05;
    atmosphere(scene, placement.x, placement.y, size * 1.8, .038, [178,181,197]);
    ctx.save(); ctx.lineWidth = .6;
    for (let filament = 0; filament < 9; filament++) {
      ctx.strokeStyle = filament === 0 || filament === 8 ? '#b6cddd2b' : '#b6cddd0e';
      ctx.beginPath();
      for (let step = 0; step <= 120; step++) {
        const u = .3 + step / 120 * (tau - .6);
        const radius = .95 + (filament / 8 - .5) * .12 + Math.sin(u * 2 + clock * .2) * .012;
        const [px,py] = camera(scene,Math.sin(u) * radius,-Math.cos(u) * radius * .63,0,placement.x,placement.y,size);
        const [x,y] = interact(scene,px,py);
        if (!step) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    ctx.restore();
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
      const [sx, sy, depth] = camera(scene, x, y, z, placement.x, placement.y, size);
      const [px,py,reflection] = interact(scene,sx,sy);
      const fade = Math.sin(travel * Math.PI) ** opening;
      dot(ctx, px, py, (.4 + point.seed * .55) * depth, fade * (.12 + point.seed * .48) + reflection, '171,176,193');
    }
    for (let highlight = 0; highlight < 3; highlight++) {
      const travel = (clock * .025 + highlight / 3) % 1, u = .3 + travel * (tau - .6);
      const [px,py] = camera(scene,Math.sin(u) * .95,-Math.cos(u) * .95 * .63,0,placement.x,placement.y,size);
      const [x,y] = interact(scene,px,py);
      tracer(ctx,x,y,Math.sin(travel * Math.PI) * .8,.7);
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
    const precise = dirty || Math.abs(fieldMorph - Number(fieldMode === 'focus')) > .0001 || scenes.some(scene => scene.active && (scene.pointer.active || scene.pulses.length || Math.abs(scene.progress - scene.targetProgress) > .0001));
    const interval = 1000 / (precise ? 60 : 30);
    if (lastFrame && timestamp - lastFrame < interval - 1) { frame = requestAnimationFrame(render); return; }
    const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .05) : 1 / 60;
    lastFrame = timestamp;
    if (dirty) { updateScroll(); dirty = false; }
    const animated = !reduced.matches && !dialog.open;
    const ambient = animated && !motionPaused;
    if (ambient) clock += dt;
    if (animated) interactionClock += dt;
    const targetMorph = Number(fieldMode === 'focus');
    fieldMorph = reduced.matches ? targetMorph : damp(fieldMorph,targetMorph,.23,dt);
    const targetFactor = selectedFactor;
    distributionWidth = reduced.matches ? typeWidths[selectedType] : damp(distributionWidth, typeWidths[selectedType], .18, dt);
    factorWeights.forEach((weight, index) => {
      factorWeights[index] = reduced.matches ? Number(index === targetFactor) : damp(weight, Number(index === targetFactor), .15, dt);
    });
    for (const scene of scenes) {
      if (!scene.active) { scene.pulses.length = 0; scene.ripples.length = 0; scene.pointer.active = false; scene.hoverFactor = -1; continue; }
      const pointer = scene.pointer;
      pointer.x = damp(pointer.x, reduced.matches ? 0 : pointer.targetX, .20, dt);
      pointer.y = damp(pointer.y, reduced.matches ? 0 : pointer.targetY, .20, dt);
      pointer.influence = damp(pointer.influence, pointer.active && animated ? 1 : 0, .24, dt);
      scene.pulses = reduced.matches ? [] : scene.pulses.filter(pulse => interactionClock - pulse.start < 1.8);
      scene.ripples = scene.pulses.map(pulse => {
        const age = (interactionClock - pulse.start) / 1.8;
        return { x: pulse.x * scene.width, y: pulse.y * scene.height, radius: 8 + age * Math.min(scene.width,scene.height) * .85, width: 22 + age * 22, opacity: (1 - age) ** 2 };
      });
      scene.progress = animated ? damp(scene.progress, scene.targetProgress, .055, dt) : scene.targetProgress;
      scene.entrance = animated ? damp(scene.entrance, scene.targetEntrance, .12, dt) : scene.targetEntrance;
      if (scene.kind === 'hero') {
        scene.element.style.setProperty('--hero-scroll', scene.progress.toFixed(4));
        scene.element.style.setProperty('--hero-copy-opacity', (1 - smooth(.02,.43,scene.progress)).toFixed(4));
        scene.element.style.setProperty('--hero-caption-opacity', (smooth(.44,.72,scene.progress) * (1 - smooth(.92,1,scene.progress))).toFixed(4));
        const copyHidden = !readingFlow() && scene.progress > .43;
        const consoleHidden = !readingFlow() && scene.progress > .36;
        heroCopy.inert = copyHidden; heroCopy.setAttribute('aria-hidden',String(copyHidden));
        fieldConsole.inert = consoleHidden; fieldConsole.setAttribute('aria-hidden',String(consoleHidden));
        heroFooter.inert = !readingFlow() && scene.progress > .76;
      } else if (scene.appliedProgress !== scene.progress || scene.appliedEntrance !== scene.entrance) {
        applyChapter(scene);
        scene.appliedProgress = scene.progress; scene.appliedEntrance = scene.entrance;
      }
      scene.ctx.clearRect(0, 0, scene.width, scene.height);
      drawFunctions[scene.kind](scene);
      drawRipples(scene);
    }
    const settling = Math.abs(fieldMorph - targetMorph) > .0001 || Math.abs(distributionWidth - typeWidths[selectedType]) > .0001 || factorWeights.some((weight,index) => Math.abs(weight - Number(index === targetFactor)) > .0001) || scenes.some(scene => scene.active && (scene.pulses.length || Math.abs(scene.pointer.x - scene.pointer.targetX) > .0001 || Math.abs(scene.pointer.y - scene.pointer.targetY) > .0001 || Math.abs(scene.pointer.influence - Number(scene.pointer.active)) > .0001 || Math.abs(scene.progress - scene.targetProgress) > .0001 || Math.abs(scene.entrance - scene.targetEntrance) > .0001));
    if (animated && (ambient || settling) && scenes.some(scene => scene.active)) frame = requestAnimationFrame(render);
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
  if ('ResizeObserver' in window) {
    const main = document.querySelector('main');
    const layoutObserver = new ResizeObserver(entries => {
      if (entries.some(entry => entry.target !== main)) scenes.forEach(setSize);
      layoutDirty = true; schedule(true);
    });
    layoutObserver.observe(main);
    document.querySelectorAll('.chapter-detail .scene-copy').forEach(element => layoutObserver.observe(element));
    layoutObserver.observe(heroCopy);
  }
  document.fonts?.ready.then(() => { layoutDirty = true; syncIndicators(); schedule(true); });
  reduced.addEventListener('change', syncMotion);
  compactHeight.addEventListener('change', syncMotion);
  syncMotion();
  schedule(true);
})();
