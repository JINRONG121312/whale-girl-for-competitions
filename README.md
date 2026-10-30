# whale-in-my-web

> 一只住在网页左下角的鲸鱼娘：会游、会摸鱼、会被老板查岗、会记得你的名字。

纯前端、零依赖、零图片请求的看板娘挂件。原本是给我自己那个 2 核 2G、3M 带宽的小博客写的，但代码不绑定任何框架——任何静态页面引两个文件就能用。

- 逻辑约 **10KB（gzip 后）**
- 手绘 **SVG**，不是 Live2D，任意分辨率都不糊
- 有完整的小情绪：投喂、摸鱼、被查岗、连点生气、深夜打瞌睡
- 会读页面上的弹幕，按关键词和人名接话
- 可拖动、会记住位置、跟着暗色模式走

![鲸鱼娘](assets/whale.svg)

---

## 特性

| 能力 | 说明 |
|---|---|
| 状态机 | 写代码 → 摸鱼（每 20s，持续 4s）→ 可能被查岗 |
| 经济系统 | 打赏 +8，被抓 −6，但**上限 +6**（越被抓罐子越大） |
| 换班 | 攒满一罐直接开下一班，没有"下班" |
| 互动 | 点它 = 投喂并甩尾游开；连点 5 次 = 生气；停手 10 秒 = 自己消气 |
| 作息 | 23 点后换困倦台词，凌晨 2–5 点打瞌睡，谁都不理 |
| 弹幕联动 | 监听 `wg:danmaku` 事件，按关键词 + 昵称回话 |
| 拖动 | 按住鲸鱼或气泡拖到任意位置，位置记在 `localStorage` |
| 移动端 | 收成圆形头像，点一下展开卡片，且不参与金币玩法 |
| 暗色模式 | 跟随 `html[data-theme="dark"]` |

## 快速使用

```html
<link rel="stylesheet" href="src/whale-girl.css">
<script defer src="src/whale-girl.js"></script>
```

打开页面，左下角就有它了。

想先看看效果：直接用浏览器打开 `demo/index.html`（双击即可，不需要起服务器）。

### Hexo + Butterfly

在 `_config.butterfly.yml` 里注入：

```yaml
inject:
  head:
    - <link rel="stylesheet" href="/css/whale-girl.css?v=1">
  bottom:
    - <script defer src="/js/whale-girl.js?v=1"></script>
```

把 `src/whale-girl.*` 和 `assets/*.svg` 放到 `source/` 对应目录即可。

> 地址后面的 `?v=` 别省。静态资源一般带强缓存，改完代码不带版本号的话，浏览器根本不会重新下载——我自己被这个坑骗了一整天。

## 让它回弹幕

挂件自己不产生数据，只监听事件：

```js
document.dispatchEvent(new CustomEvent('wg:danmaku', {
  detail: { name: '前端小李', text: '这个 bug 又出现了' }
}));
```

它会按关键词（bug / 摸鱼 / 老板 / 代码 / 工资 / 产品 / 夸夸）挑一句回，偶尔还会把昵称带在前面。

`src/danmaku.js` 是一个配套的弹幕组件（从 `/api/messages` 拉留言横向飘过），可以一起用，也可以换成你自己的数据源——只要最后发同样的 `wg:danmaku` 事件。

## 可调参数

全部在 `src/whale-girl.js` 顶部：

```js
var SLACK_EVERY = 20;     // 多久摸一次鱼
var SLACK_LEN = 4;        // 摸鱼持续
var BOSS_CHANCE = 0.7;    // 每秒被查岗的概率
var BOSS_LEN = 3;         // 查岗持续
var ESCAPE_CHANCE = 0.15; // 被抓时点一下能溜掉的概率
var PENALTY = 6;          // 被抓扣多少
var CAP_STEP = 6;         // 被抓后上限涨多少
```

## 目录

```
src/whale-girl.js    挂件逻辑（状态机 + 渲染 + 拖动 + 弹幕回复）
src/whale-girl.css   挂件样式（暗色模式、移动端、动效）
src/danmaku.js       可选：配套弹幕组件
src/danmaku.css
assets/whale.svg     鲸鱼娘立绘（也是侧边栏头像）
assets/lobster.svg   龙虾娘老板
demo/index.html      双击就能看的演示页
docs/report.md       技术报告（学术体例：摘要/相关工作/形式化/评估）
docs/post.md         项目复盘：可直接当博客文章发
CHANGELOG.md         版本记录
LICENSE              PolyForm Noncommercial 1.0.0（非商业）
COMMERCIAL.md        商业授权说明（分成方式、报价区间、申请流程）
```

## 许可

本项目采用 **[PolyForm Noncommercial License 1.0.0](LICENSE)**。

| 用途 | 是否需要授权 | 费用 |
|---|---|---|
| 个人博客、作品集、学习研究、公益与教育机构 | 不需要 | 免费 |
| 公司官网、付费产品、SaaS、外包交付、广告变现站点 | **需要** | 年费 + 营收分成 |

商业授权按「年费 + 营收分成（参考 3%–10%）」协商，也可以一次性买断。细则见 **[COMMERCIAL.md](COMMERCIAL.md)**，申请请开一个以 `[Commercial]` 开头的 Issue。

> ⚠️ 严格来说，这不是 OSI 定义的开源许可（"开源"通常允许商业使用），而是**源码公开的非商业许可**（source-available, noncommercial）。请按这个理解使用。

思路和设计可以随便借鉴——**思想不受版权保护，欢迎你做一个更好的**。

## 说明

配色、文案、数值都是为一个具体的小站点调的，把它当成一个有性格的小玩具，而不是通用组件库。改坏了 Ctrl+Z 就好。
