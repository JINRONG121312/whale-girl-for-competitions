/* 大肥鱼 · 站点挂件（vanilla，无依赖）
 * 玩法：写代码 → 每 20s 摸鱼 4s → 摸鱼时可能被龙虾娘查岗
 *      被抓扣 6 币，但同时把攒钱上限抬高 6（越被抓，罐子越大）
 *      攒满一罐 → 直接换下一班，没有"下班"
 * 气泡：说话和动作分两行；一次对话会锁定气泡，日常台词不许插嘴
 * 手机端：收成头像，点一下展开卡片，可以投喂、可以点词接话，但不查岗、不生气
 */
(function () {
  'use strict';

  if (window.__whaleGirlMounted) return;
  window.__whaleGirlMounted = true;

  var KEY_COINS = 'wg-coins';
  var KEY_CAP = 'wg-cap';
  var TICK = 1000;

  // 参赛演示版：允许在脚本加载前通过 window.WG_CONFIG 覆盖默认参数
  var CFG = window.WG_CONFIG || {};

  function num(name, fallback, min, max) {
    var v = parseFloat(CFG[name]);
    if (!isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
  }

  var SLACK_EVERY = Math.round(num('slackEvery', 20, 5, 120));
  var SLACK_LEN = Math.round(num('slackLen', 4, 2, 12));
  var TIP = Math.round(num('tip', 8, 1, 30));
  var BASE_CAP = Math.round(num('baseCap', 40, 8, 200));
  var CAP_STEP = Math.round(num('capStep', 6, 0, 30));
  var PENALTY = Math.round(num('penalty', 6, 0, 30));
  var BOSS_CHANCE = num('bossChance', 0.7, 0, 1);
  var BOSS_LEN = Math.round(num('bossLen', 3, 2, 12));
  var ESCAPE_CHANCE = num('escapeChance', 0.15, 0, 1);
  var BLINK_EVERY = 5;
  // 老板立绘路径，可被 window.WG_BOSS_IMG 覆盖（便于本地演示）
  var BOSS_IMG = window.WG_BOSS_IMG || '/img/lobster.svg';

  var LINES = {
    work: ['写代码中…这段 bug 我熟', '写完一段，下一段排队', '大肥鱼正在假装很忙', '光标在闪，我在思考',
      '把变量名改了三遍，还是很丑', '这段逻辑我自己都看不懂了', '先跑通再说，优化是明天的事', 'Ctrl+S 保平安',
      '这个函数写了 80 行，不敢再动'],
    slack: ['摸 5 分钟不过分吧…', '屏幕亮着就算在工作', '老板应该不会来吧…', '刚站起来倒杯水，真的',
      '假装在看文档，其实在看窗外', '再喝一口水就干活，真的', '这个需求我先想一想（拖延）'],
    pet: ['谢谢投喂 ♥', '金币 +8，继续加油', '再摸一下嘛', '这条鱼真好吃'],
    boss: ['老板来了！！', '龙虾娘在盯着我…'],
    caught: ['被查岗，扣了 6 鱼币…', '工位被查，钱没了'],
    caughtCap: ['被抓一次，罐子又大了点', '扣了 6 币，上限 +6', '越查越能装钱了…'],
    escape: ['溜了溜了～', '装忙成功，躲过一劫'],
    nextShift: ['下一班工作又来了…', '刚攒满，新的一班又开工', '换班中，工位重新开张', '这罐满了，下一罐开始'],
    angry: ['你再戳我试试', '鱼都被你戳没了', '再点就罢工', '手拿开！', '你这是要摸秃我'],
    calm: ['算你识相', '这还差不多', '哼，原谅你了', '下次轻点啊']
  };

  // 气泡第二行：旁白动作，和台词分开渲染
  var ACTS = {
    work: '噼里啪啦敲键盘',
    slack: '眯起眼睛，假装在看文档',
    boss: '浑身一僵',
    sleep: '翻了个身',
    pet: '甩了甩尾巴',
    tip: '伸出鱼鳍接住',
    reply: '歪头看了一眼',
    angry: '炸毛',
    calm: '撇了撇嘴',
    caught: '捂住钱罐',
    escape: '火速坐直',
    nextShift: '把工位重新摆好'
  };

  // 一次对话锁定气泡多久：期间日常台词、摸鱼、查岗都不许插嘴
  var HOLD_MS = 15000;

  // 弹幕回复规则：命中关键词就回一句
  var REPLY_RULES = [
    { keys: ['摸鱼', '划水', '咸鱼', '摆烂'], lines: ['摸鱼被你发现了', '一起摸？我请客', '小声点，别让老板听见'] },
    { keys: ['老板', '查岗', '加班', '下班'], lines: ['龙虾娘在巡，先别说话', '加班费结一下？', '下班？这个词好陌生'] },
    { keys: ['bug', '报错', '崩溃', '挂了', '异常'], lines: ['这个 bug 我看了三遍，还是不懂', '重启试试？万能的', '先复现一下，别急着改'] },
    { keys: ['代码', 'commit', 'push', '部署', '上线'], lines: ['写完记得 commit', 'push 了就睡吧', '上线前记得备份'] },
    { keys: ['工资', '钱', '穷', '涨薪', '鱼币'], lines: ['鱼币也不够花了', '谈钱伤感情', '我帮你攒，一天 40'] },
    { keys: ['产品', '需求', '甲方', '改稿'], lines: ['产品经理又来了？', '这个需求我拒接', '再改一版就真的下班'] },
    { keys: ['厉害', '牛', '强', '赞', '好'], lines: ['谢谢，你也一样', '被夸了，开心', '过奖过奖，都是抄的'] },
    { keys: ['大肥鱼', '肥鱼', '可爱'], lines: ['叫我的名字干嘛', '我在呢，说吧', '别看了，快去写代码'] }
  ];

  var GENERIC_REPLIES = ['这条弹幕我看到了', '说得对，但我先敲代码', '有道理，我记下了', '你也是这么想的吧', '嗯嗯，同意'];

  // 带昵称的回复：{name} 会被替换成弹幕里的名字
  var NAME_REPLIES = [
    '{name} 又来啦',
    '{name} 说得对',
    '{name} 也在摸鱼？',
    '听 {name} 的准没错',
    '{name}，这个我记下了',
    '{name} 今天也在卷？'
  ];

  // 深夜台词
  var NIGHT = {
    work: ['这个点还在写？', '眼睛要瞎了', '楼下的猫都睡了', '咖啡已经第三杯'],
    slack: ['凌晨摸鱼，摸的是寂寞', '再撑十分钟就睡', '困到打字都在飘'],
    sleep: ['Zzz…', '（睡着了）', '别吵，做梦呢', '呼…呼…']
  };

  function nightMode() {
    var h = new Date().getHours();
    if (h >= 2 && h < 5) return 'deep';
    if (h >= 23 || h < 2) return 'late';
    return 'none';
  }

  // 同一个人一分钟内刷屏时的回复
  var FLOOD_REPLIES = [
    '{name} 你先歇会儿',
    '{name} 别刷屏，鱼都被你吓跑了',
    '{name} 这一分钟说三句了',
    '{name} 慢点，我记不过来'
  ];

  var ART = [
    '<svg viewBox="0 0 120 120" width="64" height="64" aria-hidden="true" focusable="false">',
    '<defs>',
    '<linearGradient id="wgBodyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c6ecff"/><stop offset="55%" stop-color="#7cc4f2"/><stop offset="100%" stop-color="#3f8fd8"/></linearGradient>',
    '<linearGradient id="wgFinGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8ed2ff"/><stop offset="100%" stop-color="#3f8fd8"/></linearGradient>',
    '</defs>',
    '<g class="wg-tail">',
    '<path d="M25 62C12 57 4 45 8 31c11 9 19 15 27 16-5 6-9 11-10 15z" fill="url(#wgFinGrad)"/>',
    '<path d="M25 66C15 69 6 79 8 92c10-8 18-13 26-15-5-5-8-8-9-11z" fill="url(#wgFinGrad)" opacity="0.88"/>',
    '</g>',
    '<path d="M50 31c4-14 17-19 29-13-6 5-12 12-15 20z" fill="#5aa9e6"/>',
    '<ellipse cx="64" cy="64" rx="43" ry="37" fill="url(#wgBodyGrad)"/>',
    '<ellipse cx="66" cy="78" rx="31" ry="22" fill="#f6fcff" opacity="0.95"/>',
    '<path d="M43 72c-9 4-15 12-13 20 7-6 14-11 20-13z" fill="#5aa9e6" opacity="0.92"/>',
    '<path d="M65 29c-3-8 2-14 8-13-4 4-2 9 3 12z" fill="#7fc2f0"/>',
    '<path d="M27 58c0-24 17-35 37-35s37 11 37 35" fill="none" stroke="#2c3e5c" stroke-width="5" stroke-linecap="round"/>',
    '<rect x="19" y="51" width="14" height="23" rx="7" fill="#2c3e5c"/>',
    '<rect x="21.5" y="55" width="9" height="15" rx="4.5" fill="#ffd166"/>',
    '<rect x="95" y="51" width="14" height="23" rx="7" fill="#2c3e5c"/>',
    '<rect x="97.5" y="55" width="9" height="15" rx="4.5" fill="#ffd166"/>',
    '<path d="M33 74c3 7 8 10 14 8" fill="none" stroke="#2c3e5c" stroke-width="2.5" stroke-linecap="round"/>',
    '<circle cx="47" cy="82" r="3" fill="#ffd166"/>',
    '<g class="wg-eyes">',
    '<ellipse cx="52" cy="62" rx="6.2" ry="7.6" fill="#17304b"/>',
    '<ellipse cx="76" cy="62" rx="6.2" ry="7.6" fill="#17304b"/>',
    '<circle cx="54" cy="59.5" r="2.3" fill="#ffffff"/>',
    '<circle cx="78" cy="59.5" r="2.3" fill="#ffffff"/>',
    '<circle cx="50.5" cy="64.5" r="1" fill="#ffffff" opacity="0.8"/>',
    '<circle cx="74.5" cy="64.5" r="1" fill="#ffffff" opacity="0.8"/>',
    '</g>',
    '<ellipse cx="39" cy="72" rx="6.5" ry="3.6" fill="#ffb3c7" opacity="0.9"/>',
    '<ellipse cx="89" cy="72" rx="6.5" ry="3.6" fill="#ffb3c7" opacity="0.9"/>',
    '<path d="M61 73c2 3.5 6 3.5 8 0" fill="none" stroke="#17304b" stroke-width="2" stroke-linecap="round"/>',
    '<g><rect x="47" y="86" width="45" height="21" rx="3" fill="#21324c"/>',
    '<rect x="51" y="90" width="20" height="2.4" rx="1.2" fill="#7ee0a0"/>',
    '<rect x="51" y="94.6" width="28" height="2.4" rx="1.2" fill="#ffd166"/>',
    '<rect x="51" y="99.2" width="13" height="2.4" rx="1.2" fill="#9cc7ff"/></g>',
    '<path d="M42 87c-4 6-2 12 4 15 0-6 1-11 5-14z" fill="#5aa9e6"/>',
    '<g class="wg-fish"><ellipse cx="103" cy="38" rx="6.5" ry="4" fill="#ffb26b"/>',
    '<path d="M109 38l6-4v8z" fill="#ff9a4d"/>',
    '<circle cx="100.5" cy="37" r="0.9" fill="#21324c"/></g>',
    '<text class="wg-zzz" x="94" y="22" font-size="11" font-weight="700" fill="#8ec7f2">z z</text>',
    '<text class="wg-heart" x="92" y="26" font-size="13" fill="#ff7a9c">♥</text>',
    '</svg>'
  ].join('');

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function readNum(key) {
    try {
      var raw = window.localStorage.getItem(key);
      var n = raw === null ? NaN : parseInt(raw, 10);
      return isFinite(n) && n >= 0 ? n : null;
    } catch (e) {
      return null;
    }
  }

  function writeNum(key, n) {
    try {
      window.localStorage.setItem(key, String(n));
    } catch (e) {
      /* 隐私模式忽略 */
    }
  }

  // 窄屏（手机）收成圆形头像：点鱼身只展开卡片，打赏与点词接话走卡片里的按钮
  function isCompact() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
  }

  function mount() {
    var game = {
      phase: 'work',
      mood: 'normal',
      coins: readNum(KEY_COINS) || 0,
      cap: readNum(KEY_CAP) || BASE_CAP,
      shift: 1,
      progress: 0,
      elapsed: 0,
      slackLeft: 0,
      bossActive: false,
      checked: false,
      bossLeft: 0,
      angry: false,
      line: pick(LINES.work),
      act: ACTS.work
    };

    // 对话锁定：锁定期间主循环不改气泡文字
    var hold = { line: '', act: '', until: 0 };

    function clearHold() {
      hold.until = 0;
    }

    // 用户主动做的动作优先：清掉锁定，立刻把新台词显示出来
    function say(line, act) {
      clearHold();
      game.line = line;
      game.act = act || '';
    }

    var NIGHT_MODE = nightMode();
    var DEEP_NIGHT = NIGHT_MODE === 'deep';

    if (NIGHT_MODE === 'late') {
      // 11 点后换成困倦台词
      LINES.work = NIGHT.work;
      LINES.slack = NIGHT.slack;
      game.line = pick(LINES.work);
    }

    if (DEEP_NIGHT) {
      // 凌晨 2-5 点：直接打瞌睡，不接待
      game.phase = 'sleep';
      game.line = pick(NIGHT.sleep);
      game.act = ACTS.sleep;
    }

    var root = document.createElement('aside');
    root.className = 'wg';
    root.setAttribute('data-phase', game.phase);
    root.setAttribute('data-mood', game.mood);
    root.setAttribute('data-hearts', 'off');
    root.setAttribute('data-boss', 'off');
    root.setAttribute('data-shift', 'off');
    root.setAttribute('data-hit', 'off');
    root.setAttribute('data-blink', 'off');
    root.setAttribute('data-open', 'off');
    root.setAttribute('data-sleep', DEEP_NIGHT ? 'on' : 'off');
    root.setAttribute('data-angry', 'off');
    root.setAttribute('data-edge', 'left');
    root.setAttribute('aria-label', '大肥鱼');

    root.innerHTML =
      '<img class="wg-boss-art" src="' + BOSS_IMG + '" alt="" aria-hidden="true">' +
      '<button class="wg-pet" type="button" aria-label="摸摸大肥鱼" title="摸摸大肥鱼">' +
      ART +
      '</button>' +
      '<div class="wg-say">' +
      '<div class="wg-bubble">' +
      '<span class="wg-act"></span>' +
      '<span class="wg-line"></span></div>' +
      '</div>' +
      '<div class="wg-body">' +
      '<div class="wg-meta"><i class="wg-dot"></i><span class="wg-state">写代码中</span>' +
      '<span class="wg-chip">老板查岗</span>' +
      '<span class="wg-shift">第 1 班</span></div>' +
      '<div class="wg-foot">' +
      '<span class="wg-coins">🐟 <b>0</b>/<i>40</i></span>' +
      '<button class="wg-tip" type="button">打赏 +' + TIP + '</button>' +
      '<a class="wg-msg" href="#live">弹幕</a>' +
      '</div>' +
      '<div class="wg-quick">' +
      '<button class="wg-qk" type="button" data-say="你还在摸鱼呢">摸鱼呢？</button>' +
      '<button class="wg-qk" type="button" data-say="你真可爱">夸夸你</button>' +
      '<button class="wg-qk" type="button" data-say="老板来了">老板来了</button>' +
      '</div></div>' +
      '<button class="wg-close" type="button" aria-label="收起">×</button>';

    document.body.appendChild(root);

    var $state = root.querySelector('.wg-state');
    var $shift = root.querySelector('.wg-shift');
    var $line = root.querySelector('.wg-line');
    var $act = root.querySelector('.wg-act');
    var $coins = root.querySelector('.wg-coins b');
    var $cap = root.querySelector('.wg-coins i');

    function render() {
      root.setAttribute('data-phase', game.phase);
      root.setAttribute('data-mood', game.mood);
      root.setAttribute('data-boss', game.bossActive ? 'on' : 'off');
      $state.textContent = game.angry
        ? '生气了'
        : game.phase === 'sleep' ? '打瞌睡'
          : game.phase === 'slack' ? '摸鱼中'
            : game.phase === 'offwork' ? '下班了' : '写代码中';
      $shift.textContent = '第 ' + game.shift + ' 班';
      var held = Date.now() < hold.until;
      $line.textContent = held ? hold.line : game.line;
      var actText = held ? hold.act : game.act;
      $act.textContent = actText || '';
      $act.hidden = !actText;
      $coins.textContent = String(game.coins);
      $cap.textContent = String(game.cap);
    }

    // 飘字特效：+8 / -6
    function fx(text, tone) {
      var el = document.createElement('span');
      el.className = 'wg-fx' + (tone === 'bad' ? ' wg-fx-bad' : '');
      el.textContent = text;
      el.setAttribute('aria-hidden', 'true');
      root.appendChild(el);
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 1100);
    }

    function flash(attr, ms) {
      root.setAttribute(attr, 'on');
      window.setTimeout(function () {
        root.setAttribute(attr, 'off');
      }, ms);
    }

    function caught() {
      game.coins = Math.max(0, game.coins - PENALTY);
      writeNum(KEY_COINS, game.coins);

      // 被抓一次，攒钱上限抬高一点
      game.cap += CAP_STEP;
      writeNum(KEY_CAP, game.cap);

      game.bossActive = false;
      game.bossLeft = 0;
      game.mood = 'sad';
      game.line = Math.random() < 0.5 ? pick(LINES.caught) : pick(LINES.caughtCap);
      game.act = ACTS.caught;

      fx('-' + PENALTY, 'bad');
      flash('data-hit', 600);
    }

    // 查岗时点她：赌 15% 溜掉，没溜掉就是被抓
    function bossTap() {
      if (Math.random() < ESCAPE_CHANCE) {
        game.bossActive = false;
        game.bossLeft = 0;
        game.mood = 'happy';
        say(pick(LINES.escape), ACTS.escape);
      } else {
        caught();
        clearHold();
      }
      render();
    }

    function nextShift() {
      game.coins = 0;
      writeNum(KEY_COINS, 0);
      game.shift += 1;
      game.progress = 0;
      game.mood = 'happy';
      game.line = pick(LINES.nextShift);
      game.act = ACTS.nextShift;
      flash('data-shift', 900);
    }

    function step() {
      game.elapsed += 1;

      if (game.angry) {
        if (Date.now() - lastClickAt >= 10000) calmDown();
        return;
      }

      if (DEEP_NIGHT) {
        // 打瞌睡：不摸鱼、不查岗，偶尔换个梦话
        if (game.elapsed % 10 === 0) {
          game.line = pick(NIGHT.sleep);
          game.act = ACTS.sleep;
          render();
        }
        return;
      }

      if (game.phase === 'slack') {
        game.slackLeft -= 1;

        if (game.bossActive) {
          game.bossLeft -= 1;
          if (game.bossLeft <= 0) caught();
        } else if (!game.checked && game.slackLeft > 1 && Math.random() < BOSS_CHANCE) {
          game.bossActive = true;
          game.checked = true;
          game.bossLeft = BOSS_LEN;
          game.line = pick(LINES.boss);
          game.act = ACTS.boss;
        }

        if (game.slackLeft <= 0) {
          game.phase = 'work';
          game.bossActive = false;
          game.mood = 'normal';
          game.line = pick(LINES.work);
          game.act = ACTS.work;
        }

        render();
        return;
      }

      game.progress += 9;
      if (game.progress >= 100) {
        game.progress = 0;
        game.line = pick(LINES.work);
        game.act = ACTS.work;
      }

      if (game.elapsed % SLACK_EVERY === 0) {
        game.phase = 'slack';
        game.slackLeft = SLACK_LEN;
        game.bossActive = false;
        game.checked = false;
        game.mood = 'sly';
        game.line = pick(LINES.slack);
        game.act = ACTS.slack;
      }

      render();
    }

    // 打赏：和「摸摸」分开，手机端也能用
    function tip() {
      lastClickAt = Date.now();

      if (game.angry) {
        say(pick(LINES.angry), ACTS.angry);
        render();
        return;
      }
      if (DEEP_NIGHT) {
        say('别吵，睡着了', ACTS.sleep);
        render();
        return;
      }

      // 连点打赏一样会急眼
      if (isRapidClick()) {
        becomeAngry();
        return;
      }

      // 老板在场时递钱，先看她溜不溜得掉
      if (game.bossActive) {
        bossTap();
        return;
      }

      say(pick(LINES.pet), ACTS.tip);
      game.mood = 'happy';
      game.coins = Math.min(game.cap, game.coins + TIP);
      writeNum(KEY_COINS, game.coins);
      fx('+' + TIP);
      flash('data-hearts', 3200);
      render();

      if (game.coins >= game.cap) {
        nextShift();
        clearHold();
        render();
      }
    }

    function pet() {
      lastClickAt = Date.now();

      // 被点一下就甩尾游开
      if (!isCompact() && !DEEP_NIGHT) swimTo(true);

      if (DEEP_NIGHT) {
        say('别吵，睡着了', ACTS.sleep);
        render();
        return;
      }

      if (isCompact()) {
        // 手机端点鱼身只展开/收起卡片，投喂走打赏按钮
        root.setAttribute(
          'data-open',
          root.getAttribute('data-open') === 'on' ? 'off' : 'on'
        );
        return;
      }

      // 连着戳太多次，它就急了，先不给鱼币
      if (isRapidClick()) {
        becomeAngry();
        return;
      }

      if (game.angry) {
        say(pick(LINES.angry), ACTS.angry);
        render();
        return;
      }

      if (game.bossActive) {
        bossTap();
        return;
      }

      game.coins = Math.min(game.cap, game.coins + TIP);
      writeNum(KEY_COINS, game.coins);
      if (game.coins >= game.cap) {
        nextShift();
        clearHold();
        render();
        return;
      }

      game.mood = 'happy';
      say(pick(LINES.pet), ACTS.pet);
      fx('+' + TIP);
      flash('data-hearts', 3200);
      if (game.phase === 'slack') {
        game.slackLeft = 1;
      }
      render();
    }

    root.querySelector('.wg-pet').addEventListener('click', pet);
    root.querySelector('.wg-tip').addEventListener('click', function (event) {
      event.stopPropagation();
      tip();
    });

    // 手机端的「点词接话」：把访客的话喂给自己的回复规则，不走网络
    root.querySelector('.wg-quick').addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('.wg-qk') : null;
      if (!btn) return;
      event.stopPropagation();
      quickChat(String(btn.getAttribute('data-say') || ''));
    });

    function quickChat(text) {
      if (DEEP_NIGHT) {
        say('别吵，睡着了', ACTS.sleep);
        render();
        return;
      }
      if (game.angry) {
        say(pick(LINES.angry), ACTS.angry);
        render();
        return;
      }
      sayReply(pickReply(text) || pick(GENERIC_REPLIES), '看了看你');
    }

    // 演示页专用：外部可召唤一次查岗；正式接入时不需要
    document.addEventListener('wg:boss', function () {
      if (DEEP_NIGHT || game.angry) return;
      game.phase = 'slack';
      game.slackLeft = Math.max(SLACK_LEN, 5);
      game.bossActive = true;
      game.checked = true;
      game.bossLeft = 30;
      game.mood = 'sly';
      say(pick(LINES.boss), ACTS.boss);
      render();
    });

    root.querySelector('.wg-close').addEventListener('click', function () {
      if (isCompact()) {
        root.setAttribute('data-open', 'off');
      } else {
        root.hidden = true;
      }
    });

    function pickReply(text) {
      for (var i = 0; i < REPLY_RULES.length; i++) {
        var rule = REPLY_RULES[i];
        for (var k = 0; k < rule.keys.length; k++) {
          if (text.indexOf(rule.keys[k]) !== -1) return pick(rule.lines);
        }
      }
      return Math.random() < 0.35 ? pick(GENERIC_REPLIES) : null;
    }

    function sayReply(text, act) {
      // 对话期间气泡归这次对话：摸鱼、查岗、日常台词一律让路
      hold.line = text;
      hold.act = act || ACTS.reply;
      hold.until = Date.now() + HOLD_MS;
      game.line = text;
      game.act = hold.act;
      game.mood = 'happy';
      render();

      // 锁定到期后回到日常台词；期间若被新对话接管就不动
      window.setTimeout(function () {
        if (Date.now() < hold.until) return;
        game.mood = 'normal';
        game.line = pick(game.phase === 'slack' ? LINES.slack : LINES.work);
        game.act = game.phase === 'slack' ? ACTS.slack : ACTS.work;
        render();
      }, HOLD_MS + 200);
    }

    // 弹幕飘过时，大肥鱼接一句
    var floodMap = {};
    var floodCool = {};

    // 同一个人 1 分钟内超过 3 条 → 判定刷屏
    function hitFlood(name, now) {
      var list = floodMap[name] || (floodMap[name] = []);
      list.push(now);
      while (list.length && now - list[0] > 60000) list.shift();
      if (list.length < 3) return false;
      if (floodCool[name] && now - floodCool[name] < 15000) return false;
      floodCool[name] = now;
      floodMap[name] = [];
      return true;
    }

    var lastReplyAt = 0;
    document.addEventListener('wg:danmaku', function (event) {
      if (DEEP_NIGHT || isCompact() || game.bossActive) return;
      var detail = (event && event.detail) || {};
      var text = String(detail.text || '');

      // 取昵称：匿名的不点名
      var rawName = String(detail.name || '').replace(/\s+/g, '');
      var name = (rawName && rawName.indexOf('匿名') === -1) ? rawName.slice(0, 8) : '';

      var now = Date.now();

      // 刷屏优先级最高：不受 9 秒冷却限制，但同一个人 15 秒内只提醒一次
      if (name && hitFlood(name, now)) {
        lastReplyAt = now;
        sayReply(pick(FLOOD_REPLIES).replace('{name}', name));
        return;
      }

      if (now - lastReplyAt < 9000) return;

      var reply = null;
      if (name && Math.random() < 0.35) {
        // 直接用昵称起头
        reply = pick(NAME_REPLIES).replace('{name}', name);
      } else {
        reply = pickReply(text);
        // 命中关键词时，偶尔把昵称挂到前面（太长就不加）
        if (reply && name && reply.length < 12 && Math.random() < 0.35) {
          reply = name + '，' + reply;
        }
      }
      if (!reply) return;

      lastReplyAt = now;
      sayReply(reply);
    });

    function roamBox() {
      return {
        maxX: Math.min(130, Math.max(50, window.innerWidth * 0.1)),
        maxY: 78
      };
    }

    function swimTo(fast) {
      var box = roamBox();
      var x = Math.round((Math.random() * 2 - 1) * box.maxX);
      var y = -Math.round(Math.random() * box.maxY);
      // 往左最多挪 12px，保证整只鲸鱼不会跑出屏幕
      x = Math.max(-12, Math.min(box.maxX, x));
      y = Math.max(-box.maxY, Math.min(0, y));
      root.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
      updateEdge();
      if (!fast) return;
      root.setAttribute('data-dodge', 'on');
      window.clearTimeout(root.__dodgeTimer);
      root.__dodgeTimer = window.setTimeout(function () {
        root.removeAttribute('data-dodge');
      }, 850);
    }

    var clickTimes = [];
    var lastClickAt = 0;

    // 4 秒内点 5 次以上就急
    function isRapidClick() {
      var now = Date.now();
      clickTimes.push(now);
      clickTimes = clickTimes.filter(function (t) { return now - t < 4000; });
      return clickTimes.length >= 5;
    }

    function becomeAngry() {
      game.angry = true;
      game.mood = 'sly';
      say(pick(LINES.angry), ACTS.angry);
      root.setAttribute('data-angry', 'on');
      fx('!', 'bad');
      render();
    }

    // 停手 10 秒，自己消气
    function calmDown() {
      game.angry = false;
      root.setAttribute('data-angry', 'off');
      game.mood = 'happy';
      say(pick(LINES.calm), ACTS.calm);
      fx('♥');
      render();
    }

    // 让大肥鱼在左下角一小片水域里游来游去（被用户拖过就老实地待着）
    function roam() {
      if (isCompact() || DEEP_NIGHT || userPlaced) return;
      swimTo(false);
    }

    window.setTimeout(roam, 2200);
    window.setInterval(roam, 8000);

    // ---- 拖动换位置：拖气泡，别拖鲸鱼（鲸鱼是按钮） ----
    var POS_KEY = 'wg-pos';
    var userPlaced = false;

    function readPos() {
      try {
        var raw = window.localStorage.getItem(POS_KEY);
        if (!raw) return null;
        var p = JSON.parse(raw);
        if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
      } catch (e) {
        /* ignore */
      }
      return null;
    }

    function clampPos(left, bottom) {
      // 按控件真实尺寸夹紧，别按估算值——卡片展开后宽度差很多
      var rect = root.getBoundingClientRect();
      var w = Math.max(120, rect.width || 160);
      var h = Math.max(80, rect.height || 160);
      var pad = 8;
      return {
        x: Math.min(Math.max(pad, left), Math.max(pad, window.innerWidth - w - pad)),
        y: Math.min(Math.max(pad, bottom), Math.max(pad, window.innerHeight - h - pad))
      };
    }

    // 靠近右边时气泡换到右侧对齐，免得顶出屏幕
    function updateEdge() {
      var rect = root.getBoundingClientRect();
      root.setAttribute('data-edge', rect.left + rect.width / 2 > window.innerWidth * 0.62 ? 'right' : 'left');
    }

    var savedPos = readPos();
    if (savedPos) {
      var p0 = clampPos(savedPos.x, savedPos.y);
      root.style.left = p0.x + 'px';
      root.style.bottom = p0.y + 'px';
      userPlaced = true;
    }
    updateEdge();
    window.addEventListener('resize', updateEdge);

    var dragState = null;
    var movedEnough = false;
    var suppressClick = false;

    // 按住鲸鱼本体、气泡、整块都能拖
    root.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      var rect = root.getBoundingClientRect();
      dragState = {
        sx: event.clientX,
        sy: event.clientY,
        left: rect.left,
        bottom: window.innerHeight - rect.bottom
      };
      movedEnough = false;
      root.style.transition = 'none';
    });

    window.addEventListener('pointermove', function (event) {
      if (!dragState) return;
      var dx = event.clientX - dragState.sx;
      var dy = event.clientY - dragState.sy;

      // 移动超过 6px 才算拖动，否则当成点击
      if (!movedEnough && Math.abs(dx) + Math.abs(dy) < 6) return;
      movedEnough = true;

      var next = clampPos(dragState.left + dx, dragState.bottom - dy);
      root.style.left = next.x + 'px';
      root.style.bottom = next.y + 'px';
      root.style.transform = 'translate(0px, 0px)';
      updateEdge();
    });

    window.addEventListener('pointerup', function () {
      if (!dragState) return;
      var wasDrag = movedEnough;
      dragState = null;
      root.style.transition = '';

      if (!wasDrag) return; // 只是点了一下，交给 click 处理

      userPlaced = true;
      suppressClick = true;
      try {
        window.localStorage.setItem(
          POS_KEY,
          JSON.stringify({ x: parseFloat(root.style.left) || 0, y: parseFloat(root.style.bottom) || 0 })
        );
      } catch (e) {
        /* ignore */
      }
    });

    // 拖动结束后浏览器还会补一个 click，这里拦掉，避免误触发投喂
    root.addEventListener('click', function (event) {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    }, true);

    render();
    window.setInterval(step, TICK);

    // 眨眼
    window.setInterval(function () {
      if (game.mood === 'happy') return;
      flash('data-blink', 180);
    }, BLINK_EVERY * 1000);

    // 调试：地址后加 ?wgopen=1 强制展开卡片（看手机端布局用）
    if (window.location.search.indexOf('wgopen=1') !== -1) {
      root.setAttribute('data-open', 'on');
    }

    // 调试：地址后加 ?wgboss=1 立刻模拟一次查岗
    if (window.location.search.indexOf('wgboss=1') !== -1) {
      game.phase = 'slack';
      game.slackLeft = SLACK_LEN;
      game.bossActive = true;
      game.bossLeft = 30;
      game.line = pick(LINES.boss);
      game.act = ACTS.boss;
      render();
    }
  }

  function boot() {
    if (document.querySelector('.wg')) return;
    mount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
