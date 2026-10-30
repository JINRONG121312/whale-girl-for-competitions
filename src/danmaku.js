/* 留言弹幕：从 /api/messages 拉最新留言，从右往左飘过 */
(function () {
  'use strict';
  if (window.__dmMounted) return;
  window.__dmMounted = true;

  var API = '/api/messages?limit=30';
  var LANES = 3;

  // 手机端轨道少一条，避免最后一条被层高裁掉
  function laneCount() {
    return (window.matchMedia && window.matchMedia('(max-width: 767px)').matches) ? 2 : 3;
  }
  var GAP_MS = 5200;
  var RELOAD_MS = 120000;

  var FALLBACK = [
    '公冰蓝の小站，随便逛逛',
    '鲸鱼娘正在假装写代码',
    '留言板开了，去说两句？',
    '这条是占位弹幕'
  ];

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var layer = document.createElement('div');
  layer.id = 'dm-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  var queue = [];
  var cursor = 0;
  var lane = 0;

  function push(item) {
    var el = document.createElement('span');
    var el = document.createElement('span');
    el.textContent = (item.name ? item.name + '：' : '') + item.text;
    el.className = 'dm-item' + (el.textContent.length > 36 ? ' is-long' : '');

    var duration = Math.min(26, 12 + el.textContent.length * 0.28);
    var count = laneCount();
    var gap = count === 2 ? 38 : 42;
    el.style.top = 6 + (lane % count) * gap + 'px';
    el.style.animation = 'none';
    lane++;

    layer.appendChild(el);

    // 通知鲸鱼娘：有弹幕来了
    try {
      document.dispatchEvent(new CustomEvent('wg:danmaku', {
        detail: { name: item.name || '', text: item.text || '' }
      }));
    } catch (e) {
      /* 老浏览器忽略 */
    }

    // 先测量宽度，再按像素距离启动动画，兼容性比 calc 好
    var dist = window.innerWidth + el.offsetWidth + 60;
    el.style.setProperty('--dm-dist', '-' + dist + 'px');
    el.style.animation = 'dm-fly ' + duration + 's linear forwards';

    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, duration * 1000 + 500);
  }

  function next() {
    if (document.visibilityState === 'hidden') return;
    if (!queue.length) return;
    push(queue[cursor % queue.length]);
    cursor++;
  }

  function load() {
    fetch(API, { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && Array.isArray(data.items) && data.items.length) {
          queue = data.items.map(function (it) {
            return { name: it.name, text: it.text };
          });
        } else if (!queue.length) {
          queue = FALLBACK.map(function (t) { return { name: '', text: t }; });
        }
      })
      .catch(function () {
        if (!queue.length) {
          queue = FALLBACK.map(function (t) { return { name: '', text: t }; });
        }
      });
  }

  load();
  window.setInterval(load, RELOAD_MS);
  window.setInterval(next, GAP_MS);
  window.setTimeout(next, 1800);
})();
