/* 展示站交互：遥测、遥控、弹幕、参数定制、接入代码、主题与滚动 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var mqMobile = window.matchMedia ? window.matchMedia('(max-width: 767px)') : null;

  var DEFAULTS = { slackEvery: 20, bossChance: 0.7, penalty: 6, capStep: 6 };
  var THEME_KEY = 'wg-site-theme';

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function isNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /* ---------- toast ---------- */
  var toastEl = $('toast');
  var toastTimer = 0;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2600);
  }

  /* ---------- theme ---------- */
  var themeToggle = $('theme-toggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#081c2b' : '#f4faff');
    if (themeToggle) {
      var dark = theme === 'dark';
      themeToggle.setAttribute('aria-pressed', String(dark));
      themeToggle.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
    }
    if (persist) {
      try { window.localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 隐私模式忽略 */ }
    }
  }

  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
      toast(next === 'dark' ? '已切换到深海模式' : '已切换到浅色模式');
    });
  }

  /* ---------- reveal ---------- */
  var reveals = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    Array.prototype.forEach.call(reveals, function (el) { revealObserver.observe(el); });
  }

  /* ---------- header / nav ---------- */
  var header = $('site-header');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.site-nav a'));

  var sections = navLinks.map(function (link) {
    var id = link.getAttribute('href');
    var el = id ? document.querySelector(id) : null;
    return el ? { link: link, el: el } : null;
  }).filter(Boolean);

  var scrollQueued = false;

  function updateScrollUI() {
    scrollQueued = false;
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);

    if (!sections.length) return;

    var line = window.scrollY + (header ? header.offsetHeight : 60) + 110;
    var current = null;

    sections.forEach(function (item) {
      if (item.el.getBoundingClientRect().top + window.scrollY <= line) current = item;
    });

    sections.forEach(function (item) {
      var on = current === item;
      item.link.classList.toggle('is-active', on);
      if (on) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    });
  }

  function queueScrollUI() {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(updateScrollUI);
  }

  window.addEventListener('scroll', queueScrollUI, { passive: true });
  window.addEventListener('resize', queueScrollUI);
  updateScrollUI();

  /* ---------- widget telemetry ---------- */
  var wg = null;
  var lastFsmState = '';

  var ui = {
    quoteState: $('quote-state'),
    quoteAct: $('quote-act'),
    quoteLine: $('quote-line'),
    coins: $('coins'),
    cap: $('cap'),
    coinsBar: $('coins-bar'),
    coinsMeter: $('coins-meter'),
    shift: $('console-shift'),
    fsmCurrent: $('fsm-current'),
    badge: $('config-badge')
  };
  var fsmNodes = {};

  Array.prototype.forEach.call(document.querySelectorAll('.fsm-node[data-node]'), function (node) {
    fsmNodes[node.getAttribute('data-node')] = node;
  });

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function readWidgetState(node) {
    if (node.getAttribute('data-angry') === 'on') return 'angry';
    if (node.getAttribute('data-sleep') === 'on') return 'sleep';
    if (node.getAttribute('data-boss') === 'on') return 'boss';
    var phase = node.getAttribute('data-phase');
    return phase === 'slack' ? 'slack' : 'work';
  }

  function pollWidget() {
    if (!wg || !document.documentElement.contains(wg)) {
      wg = document.querySelector('.wg');
    }
    if (!wg) return;

    var stateLabel = wg.querySelector('.wg-state');
    var line = wg.querySelector('.wg-line');
    var act = wg.querySelector('.wg-act');
    var stateText = stateLabel ? stateLabel.textContent : '写代码中';

    setText(ui.quoteState, stateText);
    setText(ui.quoteAct, act && act.textContent ? '（' + act.textContent + '）' : '');
    setText(ui.quoteLine, line ? line.textContent : '');
    setText(ui.fsmCurrent, stateText);

    var coins = parseInt((wg.querySelector('.wg-coins b') || {}).textContent, 10);
    var cap = parseInt((wg.querySelector('.wg-coins i') || {}).textContent, 10);
    if (!isNumber(coins)) coins = 0;
    if (!isNumber(cap) || cap <= 0) cap = 40;

    setText(ui.coins, String(coins));
    setText(ui.cap, String(cap));

    if (ui.coinsBar) ui.coinsBar.style.width = clamp(coins / cap * 100, 0, 100) + '%';
    if (ui.coinsMeter) {
      ui.coinsMeter.setAttribute('aria-valuemax', String(cap));
      ui.coinsMeter.setAttribute('aria-valuenow', String(coins));
    }

    var shiftLabel = wg.querySelector('.wg-shift');
    setText(ui.shift, shiftLabel ? shiftLabel.textContent : '第 1 班');

    var state = readWidgetState(wg);
    if (state !== lastFsmState) {
      Object.keys(fsmNodes).forEach(function (key) {
        fsmNodes[key].classList.toggle('is-active', key === state);
      });
      lastFsmState = state;
    }
  }

  window.setInterval(pollWidget, 600);
  pollWidget();

  /* ---------- widget controls ---------- */
  var heroFeed = $('hero-feed');
  var btnFeed = $('btn-feed');
  var btnBoss = $('btn-boss');
  var btnAngry = $('btn-angry');
  var btnReset = $('btn-reset');
  var consoleNote = document.querySelector('.console-note');

  function isMobile() {
    return !!(mqMobile && mqMobile.matches);
  }

  function widget() {
    if (!wg || !document.documentElement.contains(wg)) wg = document.querySelector('.wg');
    return wg;
  }

  function widgetSleeping(node) {
    return node.getAttribute('data-sleep') === 'on';
  }

  function petWidget(source) {
    var node = widget();
    if (!node) {
      toast('她还在加载，稍等一下。');
      return;
    }
    if (widgetSleeping(node)) {
      toast('现在是她的睡觉时间（02:00–05:00），早上再来。');
      return;
    }

    var pet = node.querySelector('.wg-pet');
    if (!pet) return;

    var shiftBefore = (node.querySelector('.wg-shift') || {}).textContent;
    pet.click();

    window.setTimeout(function () {
      var shiftAfter = (node.querySelector('.wg-shift') || {}).textContent;
      if (isMobile()) {
        var open = node.getAttribute('data-open') === 'on';
        toast(open ? '她的卡片展开了，再点一下收起。' : '卡片已收起。');
      } else if (node.getAttribute('data-angry') === 'on') {
        toast('她急了：停手 10 秒，她会自己消气。');
      } else if (shiftBefore && shiftAfter && shiftBefore !== shiftAfter) {
        toast('鱼币罐攒满了，她直接换到下一班。');
      } else {
        toast(source === 'hero' ? '投喂成功 +8 鱼币，左下角的她也在吃。' : '投喂 +8 鱼币。');
      }
    }, 90);
  }

  if (heroFeed) heroFeed.addEventListener('click', function () { petWidget('hero'); });
  if (btnFeed) btnFeed.addEventListener('click', function () { petWidget('feed'); });

  if (btnBoss) {
    btnBoss.addEventListener('click', function () {
      var node = widget();
      if (!node) { toast('她还在加载，稍等一下。'); return; }
      if (widgetSleeping(node)) { toast('她睡着了，龙虾娘今天也下班了。'); return; }
      if (node.getAttribute('data-angry') === 'on') { toast('她还在气头上，先等她消气。'); return; }

      document.dispatchEvent(new CustomEvent('wg:boss'));
      toast(isMobile()
        ? '龙虾娘来了。点开卡片点「打赏」，试试 15% 的逃脱概率。'
        : '龙虾娘来了。演示窗口 30 秒，点她试试 15% 的逃脱概率。');
    });
  }

  if (btnAngry) {
    btnAngry.addEventListener('click', function () {
      var node = widget();
      if (!node) { toast('她还在加载，稍等一下。'); return; }
      if (widgetSleeping(node)) { toast('她睡着了，戳了也不理你。'); return; }

      // 窄屏点鱼身只会展开卡片，连戳走卡片里的打赏按钮
      var compact = isMobile();
      if (compact && node.getAttribute('data-open') !== 'on') {
        var petBtn = node.querySelector('.wg-pet');
        if (petBtn) petBtn.click();
      }

      var pet = node.querySelector(compact ? '.wg-tip' : '.wg-pet');
      if (!pet) return;

      var count = 0;
      var timer = window.setInterval(function () {
        pet.click();
        count += 1;
        if (count < 5) return;
        window.clearInterval(timer);
        window.setTimeout(function () {
          toast(node.getAttribute('data-angry') === 'on'
            ? '连戳 5 次，她生气了。停手 10 秒会自动消气。'
            : '戳完了，她好像还没反应过来。');
        }, 120);
      }, 90);
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', function () {
      ['wg-pos', 'wg-coins', 'wg-cap'].forEach(function (key) {
        try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
      });
      toast('已清空位置和鱼币，正在重新加载…');
      window.setTimeout(function () { window.location.reload(); }, 600);
    });
  }

  /* ---------- danmaku ---------- */
  var band = $('danmaku-band');
  var danmakuForm = $('danmaku-form');
  var danmakuInput = $('danmaku-input');
  var lane = 0;

  function spawnDanmaku(text) {
    if (!band) return;

    var el = document.createElement('span');
    el.className = 'dm';
    el.textContent = text;
    el.style.top = (lane % 3) * 28 + 'px';
    lane += 1;
    band.appendChild(el);

    var dist = band.clientWidth + el.offsetWidth + 60;
    el.style.setProperty('--dm-dist', '-' + dist + 'px');

    while (band.children.length > 8) band.removeChild(band.firstElementChild);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 9600);
  }

  function sendDanmaku(text) {
    var value = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 28);
    if (!value) {
      toast('先写一句再发。');
      if (danmakuInput) danmakuInput.focus();
      return;
    }

    document.dispatchEvent(new CustomEvent('wg:danmaku', {
      detail: { name: '', text: value }
    }));
    spawnDanmaku(value);
    toast(isMobile() ? '弹幕已飘过观测窗（手机端她不回话）。' : '弹幕已飘过观测窗，她会读。');
  }

  if (danmakuForm) {
    danmakuForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var value = danmakuInput ? danmakuInput.value : '';
      sendDanmaku(value);
      if (danmakuInput) danmakuInput.value = '';
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.quick-lines button[data-line]'), function (button) {
    button.addEventListener('click', function () {
      sendDanmaku(button.getAttribute('data-line'));
    });
  });

  document.addEventListener('click', function (event) {
    var link = event.target.closest ? event.target.closest('.wg-msg') : null;
    if (!link) return;
    event.preventDefault();
    var live = $('live');
    if (live) live.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (danmakuInput) {
      window.setTimeout(function () {
        danmakuInput.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 420);
    }
    toast('在观测窗里写一句，她会读弹幕。');
  });

  /* ---------- customizer ---------- */
  var form = $('customizer');
  var inputs = {
    slackEvery: $('opt-slack'),
    bossChance: $('opt-boss'),
    penalty: $('opt-penalty'),
    capStep: $('opt-cap')
  };
  var outputs = {
    slackEvery: $('out-slack'),
    bossChance: $('out-boss'),
    penalty: $('out-penalty'),
    capStep: $('out-cap')
  };
  var configCode = $('config-code');
  var embedCode = $('embed-html');
  var customStatus = $('custom-status');
  var resetConfig = $('reset-config');
  var copyConfig = $('copy-config');
  var badge = $('config-badge');

  var applied = (function () {
    var src = window.WG_CONFIG || {};
    return {
      slackEvery: clamp(isNumber(src.slackEvery) ? Math.round(src.slackEvery) : DEFAULTS.slackEvery, 10, 60),
      bossChance: clamp(isNumber(src.bossChance) ? src.bossChance : DEFAULTS.bossChance, 0.2, 1),
      penalty: clamp(isNumber(src.penalty) ? Math.round(src.penalty) : DEFAULTS.penalty, 2, 12),
      capStep: clamp(isNumber(src.capStep) ? Math.round(src.capStep) : DEFAULTS.capStep, 0, 12)
    };
  })();

  function currentConfig() {
    return {
      slackEvery: parseInt(inputs.slackEvery.value, 10),
      bossChance: parseInt(inputs.bossChance.value, 10) / 100,
      penalty: parseInt(inputs.penalty.value, 10),
      capStep: parseInt(inputs.capStep.value, 10)
    };
  }

  function formatChance(value) {
    return String(Math.round(value * 100) / 100);
  }

  function configObject(cfg, indent) {
    var pad = indent || '';
    return '{\n' +
      pad + '  slackEvery: ' + cfg.slackEvery + ',\n' +
      pad + '  bossChance: ' + formatChance(cfg.bossChance) + ',\n' +
      pad + '  penalty: ' + cfg.penalty + ',\n' +
      pad + '  capStep: ' + cfg.capStep + '\n' +
      pad + '}';
  }

  function updateOutputs() {
    var cfg = currentConfig();
    outputs.slackEvery.textContent = cfg.slackEvery + 's';
    outputs.bossChance.textContent = Math.round(cfg.bossChance * 100) + '%';
    outputs.penalty.textContent = cfg.penalty + ' 鱼币';
    outputs.capStep.textContent = '+' + cfg.capStep;
    return cfg;
  }

  function setSliders(cfg) {
    inputs.slackEvery.value = String(cfg.slackEvery);
    inputs.bossChance.value = String(Math.round(cfg.bossChance * 100));
    inputs.penalty.value = String(cfg.penalty);
    inputs.capStep.value = String(cfg.capStep);
    updateOutputs();
  }

  function updateStatus(cfg) {
    if (!customStatus) return;
    var same = cfg.slackEvery === applied.slackEvery &&
      Math.abs(cfg.bossChance - applied.bossChance) < 0.001 &&
      cfg.penalty === applied.penalty &&
      cfg.capStep === applied.capStep;

    customStatus.textContent = same
      ? (window.WG_CONFIG ? '当前使用地址栏里的自定义参数。' : '当前使用原版参数。')
      : '有未应用的修改：点「应用配置」后，她会换一套作息。';
  }

  function baseUrl() {
    var path = window.location.pathname;
    if (/\/index\.html$/.test(path)) path = path.replace(/index\.html$/, '');
    if (!/\/$/.test(path)) path += '/';
    return window.location.origin + path;
  }

  function embedSnippet(cfg) {
    var base = baseUrl();
    return '<!-- 大肥鱼：网页左下角的看板娘 -->\n' +
      '<link rel="stylesheet" href="' + base + 'src/whale-girl.css">\n' +
      '<script>\n' +
      "  window.WG_BOSS_IMG = '" + base + "img/lobster.svg';\n" +
      '  window.WG_CONFIG = ' + configObject(cfg, '  ') + ';\n' +
      '<' + '/script>\n' +
      '<script src="' + base + 'src/whale-girl.js" defer><' + '/script>';
  }

  function renderCode(cfg) {
    if (configCode) {
      configCode.textContent = 'window.WG_CONFIG = ' + configObject(cfg) + ';';
    }
    if (embedCode) embedCode.textContent = embedSnippet(cfg);
    updateStatus(cfg);
  }

  if (form && inputs.slackEvery) {
    setSliders(applied);
    renderCode(applied);

    Object.keys(inputs).forEach(function (key) {
      inputs[key].addEventListener('input', function () {
        renderCode(updateOutputs());
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var cfg = currentConfig();
      var params = new URLSearchParams(window.location.search);
      params.set('slack', String(cfg.slackEvery));
      params.set('boss', formatChance(cfg.bossChance));
      params.set('penalty', String(cfg.penalty));
      params.set('cap', String(cfg.capStep));
      toast('参数已应用，正在让她重新上班…');
      window.setTimeout(function () {
        window.location.href = window.location.pathname + '?' + params.toString() + '#live';
      }, 350);
    });

    if (copyConfig) {
      copyConfig.addEventListener('click', function () {
        copyText(configCode ? configCode.textContent : '', '配置代码已复制。');
      });
    }

    if (resetConfig) {
      resetConfig.addEventListener('click', function () {
        setSliders(DEFAULTS);
        renderCode(updateOutputs());
        toast('已恢复默认值，点「应用配置」后生效。');
      });
    }
  }

  if (badge) badge.hidden = !(window.WG_CONFIG && Object.keys(window.WG_CONFIG).length);

  /* ---------- copy ---------- */
  function copyText(text, message) {
    var done = function () { toast(message); };
    var fallback = function () {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '0';
      area.style.left = '0';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(area);
      if (ok) done();
      else toast('复制失败，请手动选中代码。');
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('[data-copy]') : null;
    if (!button) return;
    var target = $(button.getAttribute('data-copy'));
    if (!target) return;

    var label = button.textContent;
    copyText(target.textContent || '', '代码已复制。');
    button.textContent = '已复制';
    window.setTimeout(function () { button.textContent = label; }, 1400);
  });

  /* ---------- responsive labels ---------- */
  function applyResponsive() {
    var mobile = isMobile();

    if (heroFeed) {
      var extra = heroFeed.querySelector('.btn-extra');
      if (heroFeed.childNodes[0] && heroFeed.childNodes[0].nodeType === 3) {
        heroFeed.childNodes[0].nodeValue = mobile ? '看看她 ' : '摸摸她 ';
      }
      if (extra) extra.textContent = mobile ? '点开卡片' : '+8 鱼币';
    }
    if (btnFeed) btnFeed.textContent = mobile ? '展开卡片' : '投喂 +8';

    if (btnBoss) {
      btnBoss.disabled = false;
      btnBoss.title = mobile ? '窄屏也会查岗：被抓了点开卡片点打赏，试试溜掉' : '';
    }
    if (btnAngry) {
      btnAngry.disabled = false;
      btnAngry.title = mobile ? '窄屏会先展开卡片，再连点 5 次打赏' : '';
    }
    if (consoleNote && consoleNote.childNodes[0] && consoleNote.childNodes[0].nodeType === 3) {
      consoleNote.childNodes[0].nodeValue = mobile
        ? '手机端她收成头像：点开卡片能投喂、能点词接话，查岗与生气照常 · '
        : '遥控的是左下角的真身 · ';
    }
  }

  applyResponsive();
  if (mqMobile) {
    if (typeof mqMobile.addEventListener === 'function') mqMobile.addEventListener('change', applyResponsive);
    else if (typeof mqMobile.addListener === 'function') mqMobile.addListener(applyResponsive);
  }
})();
