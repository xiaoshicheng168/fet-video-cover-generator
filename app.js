/* =========================================================
 * 英文说 Foshan English Talks TMC · 视频号封面生成器
 * 纯前端 Canvas 渲染，无任何依赖，支持 file:// 直接打开
 * ========================================================= */
'use strict';

/* ---------- 常量 ---------- */
const SIZES = {
  '9:16': { w: 1080, h: 1920, label: '1080 × 1920 px' },
  '3:4':  { w: 1080, h: 1440, label: '1080 × 1440 px' },
};

const FONT_CN = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const FONT_EN = 'Arial,"Helvetica Neue",Helvetica,sans-serif';
const FONT_MIX = 'Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

const TEAL = '#004165';
const BURGUNDY = '#772432';
const GOLD = '#F2B544';

/* 配色方案：奶油（浅）/ 深青 / 酒红；照片模式沿用奶油文字色 */
const PALETTES = {
  cream: {
    bgTop: '#FFFDF7', bgBottom: '#FFF6E8',
    ink: '#172A3A', sub: '#566773', accent: BURGUNDY,
    gold: GOLD, teal: TEAL,
    kwColor: TEAL, nameText: TEAL, headerSub: BURGUNDY,
    divider: 'rgba(23,42,58,0.18)',
    pillFill: BURGUNDY, pillText: '#FFFFFF',
    cardFill: '#FFFFFF', cardBorder: 'transparent',
    rowLine: 'rgba(23,42,58,0.10)',
    ring: 'rgba(242,181,68,0.55)', ring2: 'rgba(0,65,101,0.12)',
    photoOverlayTop: '255,249,239', photoOverlayBot: '0,22,36',
  },
  teal: {
    bgTop: '#00314F', bgBottom: '#004165',
    ink: '#FFF9EF', sub: 'rgba(255,249,239,0.72)', accent: GOLD,
    gold: GOLD, teal: TEAL,
    kwColor: GOLD, nameText: '#FFFFFF', headerSub: GOLD,
    divider: 'rgba(255,249,239,0.22)',
    pillFill: GOLD, pillText: TEAL,
    cardFill: 'rgba(255,255,255,0.08)', cardBorder: 'rgba(255,255,255,0.18)',
    rowLine: 'rgba(255,249,239,0.16)',
    ring: 'rgba(242,181,68,0.16)', ring2: 'rgba(242,181,68,0.10)',
    photoOverlayTop: '255,249,239', photoOverlayBot: '0,22,36',
  },
  burgundy: {
    bgTop: '#5C1B26', bgBottom: '#772432',
    ink: '#FFF9EF', sub: 'rgba(255,249,239,0.72)', accent: GOLD,
    gold: GOLD, teal: TEAL,
    kwColor: GOLD, nameText: '#FFFFFF', headerSub: GOLD,
    divider: 'rgba(255,249,239,0.22)',
    pillFill: GOLD, pillText: TEAL,
    cardFill: 'rgba(255,255,255,0.08)', cardBorder: 'rgba(255,255,255,0.18)',
    rowLine: 'rgba(255,249,239,0.16)',
    ring: 'rgba(242,181,68,0.16)', ring2: 'rgba(242,181,68,0.10)',
    photoOverlayTop: '255,249,239', photoOverlayBot: '0,22,36',
  },
};

/* ---------- 状态 ---------- */
const state = {
  tpl: 'meeting-preview',
  size: '9:16',
  theme: 'cream',
  dim: 30,
  photo: null,        // dataURL
  qr: null,           // dataURL
  showQr: true,
  qrLabel: '扫码关注',
  f: {},              // 全部文本字段，键与输入框 id 对应（去掉 f- 前缀）
};

const FIELDS = ['title','enSub','sub','date','time','venue','people','cta',
  'quote','h1','h2','h3','name','role','story',
  'kwEn','kwCn','phEn','phCn','exEn','exCn','tags','tagLabel','desc'];

const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const imageCache = new Map();

/* ---------- 工具 ---------- */
function $(id) { return document.getElementById(id); }

function roundedRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function card(c, x, y, w, h, r, p) {
  c.save();
  c.shadowColor = 'rgba(23,42,58,0.18)';
  c.shadowBlur = 36;
  c.shadowOffsetY = 14;
  c.fillStyle = p.cardFill;
  roundedRect(c, x, y, w, h, r);
  c.fill();
  c.restore();
  if (p.cardBorder !== 'transparent') {
    c.strokeStyle = p.cardBorder;
    c.lineWidth = 2;
    roundedRect(c, x, y, w, h, r);
    c.stroke();
  }
}

function font(weight, size, family) {
  return `${weight} ${size}px ${family || FONT_MIX}`;
}

/* 按字符折行（兼容中英混排） */
function wrapLines(c, text, maxW, maxLines) {
  const out = [];
  let cur = '';
  for (const ch of String(text || '')) {
    if (ch === '\n') {
      out.push(cur); cur = '';
      if (maxLines && out.length >= maxLines) return out;
      continue;
    }
    const test = cur + ch;
    if (cur && c.measureText(test).width > maxW) {
      out.push(cur); cur = ch;
      if (maxLines && out.length >= maxLines) return out;
    } else {
      cur = test;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/* 单行字号收缩适配 */
function fitSize(c, text, maxW, startSize, minSize, weight, family) {
  let size = startSize;
  c.font = font(weight, size, family);
  while (size > minSize && c.measureText(text).width > maxW) {
    size -= 2;
    c.font = font(weight, size, family);
  }
  return size;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (imageCache.has(src)) return resolve(imageCache.get(src));
    const img = new Image();
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/* ---------- 品牌基础元素 ---------- */

function drawEdgeStrips(c, W, H) {
  c.fillStyle = TEAL;
  c.fillRect(0, 0, 22, H);
  c.fillStyle = GOLD;
  c.fillRect(22, 0, 8, H);
}

function drawHeader(c, W, H, p, subText) {
  /* FET 徽章 */
  c.fillStyle = GOLD;
  c.beginPath();
  c.arc(104, 102, 48, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = TEAL;
  c.font = font(800, 34, FONT_EN);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('FET', 104, 116);

  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = p.nameText;
  c.font = font(800, 26, FONT_EN);
  c.fillText('FOSHAN ENGLISH TALKS TMC', 174, 94);
  c.fillStyle = p.headerSub;
  c.font = font(700, 25, FONT_CN);
  c.fillText(subText || '视频号 · ENGLISH TALKS', 174, 134);

  /* 分隔线 */
  c.strokeStyle = p.divider;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(76, 174);
  c.lineTo(W - 76, 174);
  c.stroke();
}

function drawPill(c, x, y, text, fillStyle, textStyle, weight) {
  c.font = font(weight || 800, 24, FONT_MIX);
  const w = c.measureText(text).width + 64;
  c.fillStyle = fillStyle;
  roundedRect(c, x, y, w, 58, 29);
  c.fill();
  c.fillStyle = textStyle;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x + w / 2, y + 30);
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  return w;
}

function drawOutlinePill(c, x, y, text, color) {
  c.font = font(700, 24, FONT_MIX);
  const w = c.measureText(text).width + 64;
  c.strokeStyle = color;
  c.lineWidth = 2;
  roundedRect(c, x, y, w, 58, 29);
  c.stroke();
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x + w / 2, y + 30);
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  return w;
}

function drawBrandBar(c, W, H, p, rightText) {
  const barH = 130;
  const y = H - barH;
  c.fillStyle = TEAL;
  c.fillRect(30, y, W - 30, barH);
  c.fillStyle = GOLD;
  c.fillRect(30, y, 12, barH);

  c.fillStyle = '#FFFFFF';
  c.font = font(800, 28, FONT_EN);
  c.fillText('FOSHAN ENGLISH TALKS TMC', 76, y + 52);
  c.fillStyle = GOLD;
  c.font = font(700, 16, FONT_EN);
  c.fillText('WHERE ENGLISH MEETS REAL BUSINESS', 76, y + 84);

  if (rightText) {
    c.fillStyle = '#FFFFFF';
    c.font = font(700, 21, FONT_CN);
    c.textAlign = 'right';
    c.fillText(rightText, W - 72, y + 70);
    c.textAlign = 'left';
  }
}

/* 大标题（1–2 行 + 金色小圆环装饰） */
function drawBigTitle(c, W, text, y0, p, opt) {
  if (!text) return y0;
  const M = 76, CW = W - 2 * M;
  const size = opt && opt.size || 80;
  const lineH = opt && opt.lineH || 104;
  const weight = opt && opt.weight || 900;
  const color = opt && opt.color || p.ink;
  const align = opt && opt.align || 'left';

  c.font = font(weight, size, FONT_MIX);
  let lines = wrapLines(c, text, CW, 2);
  if (lines.length > 1) {
    c.font = font(weight, size - 10, FONT_MIX);
    lines = wrapLines(c, text, CW, 2);
  }
  c.fillStyle = color;
  lines.forEach((ln, i) => {
    if (align === 'center') {
      c.textAlign = 'center';
      c.fillText(ln, W / 2, y0 + i * lineH);
      c.textAlign = 'left';
    } else {
      c.fillText(ln, M, y0 + i * lineH);
    }
  });

  /* 单行时在标题右侧画小圆环装饰 */
  if (lines.length === 1 && align === 'left') {
    const tw = c.measureText(lines[0]).width;
    const cx = M + tw + 46;
    if (cx + 30 < W - M) {
      c.strokeStyle = p.ring;
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(cx, y0 - size * 0.38, 24, 0, Math.PI * 2);
      c.stroke();
    }
  }
  return y0 + lines.length * lineH;
}

/* 二维码 + 报名语 */
function drawCTA(c, W, H, bottomY, d, p) {
  const M = 76;
  const caption = d.cta || '扫码报名 · 等你开口';
  let capW = W - 2 * M;

  if (d.showQr && d.qr && imageCache.has(d.qr)) {
    const cardW = 250, cardH = 306;
    const x = W - M - cardW, y = bottomY - cardH - 28;
    card(c, x, y, cardW, cardH, 30, p);
    const img = imageCache.get(d.qr);
    const size = 172;
    c.drawImage(img, x + (cardW - size) / 2, y + 22, size, size);
    c.fillStyle = p.teal;
    c.font = font(800, 22, FONT_CN);
    c.textAlign = 'center';
    c.fillText(d.qrLabel || '扫码关注', x + cardW / 2, y + 258);
    c.textAlign = 'left';
    capW = W - 2 * M - 280;
  }

  c.fillStyle = p.ink;
  c.font = font(800, 40, FONT_MIX);
  const lines = wrapLines(c, caption, capW, 2);
  const baseY = bottomY - 56;
  lines.forEach((ln, i) => {
    c.fillText(ln, M, baseY - (lines.length - 1 - i) * 52);
  });
}

/* ---------- 背景 ---------- */
function drawBackground(c, W, H, p, dim, photo) {
  if (photo) {
    const img = imageCache.get(photo);
    if (img) {
      const scale = Math.max(W / img.width, H / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    /* 顶部奶油渐隐 → 保证文字可读 */
    let g = c.createLinearGradient(0, 0, 0, H * 0.56);
    g.addColorStop(0, `rgba(${p.photoOverlayTop},0.96)`);
    g.addColorStop(0.55, `rgba(${p.photoOverlayTop},0.88)`);
    g.addColorStop(1, `rgba(${p.photoOverlayTop},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H * 0.56);
    /* 底部深色渐隐 → 品牌条融合 */
    g = c.createLinearGradient(0, H * 0.78, 0, H);
    g.addColorStop(0, `rgba(${p.photoOverlayBot},0)`);
    g.addColorStop(1, `rgba(${p.photoOverlayBot},0.72)`);
    c.fillStyle = g;
    c.fillRect(0, H * 0.78, W, H * 0.22);
    /* 整体压暗 */
    if (dim > 0) {
      c.fillStyle = `rgba(0,0,0,${dim / 100})`;
      c.fillRect(0, 0, W, H);
    }
    return;
  }

  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, p.bgTop);
  g.addColorStop(1, p.bgBottom);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  /* 装饰圆环 */
  c.strokeStyle = p.ring;
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(W - 170, 360, 62, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = p.ring2;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(W - 170, 360, 88, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = p.ring;
  c.beginPath();
  c.arc(W - 410, 250, 8, 0, Math.PI * 2);
  c.fill();
}

/* ---------- 模板 1：例会预告 ---------- */
function drawMeetingPreview(c, W, H, d, p) {
  const M = 76, CW = W - 2 * M;
  drawHeader(c, W, H, p, '视频号 · 例会预告');

  const w1 = drawPill(c, M, 206, 'NEXT MEETING · 例会预告', p.pillFill, p.pillText);
  let px = M + w1 + 18;
  if (d.date) px += drawOutlinePill(c, px, 206, d.date, p.accent) + 18;

  let y = drawBigTitle(c, W, d.title, 348, p);
  y += 22;
  if (d.enSub) {
    c.fillStyle = p.accent;
    c.font = font(700, 34, FONT_EN);
    c.fillText(String(d.enSub).toUpperCase(), M, y);
    y += 50;
  }
  if (d.sub) {
    c.fillStyle = p.ink;
    c.font = font(700, 38, FONT_MIX);
    const lines = wrapLines(c, d.sub, CW, 2);
    lines.forEach((ln, i) => c.fillText(ln, M, y + i * 52));
    y += lines.length * 52 + 30;
  }

  /* 金色分隔线 */
  c.strokeStyle = p.gold;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(M, y + 6);
  c.lineTo(W - M, y + 6);
  c.stroke();
  y += 46;

  /* 信息卡 */
  const rows = [];
  if (d.date || d.time) rows.push(['WHEN', [d.date, d.time].filter(Boolean).join(' · ')]);
  if (d.venue) rows.push(['WHERE', d.venue]);
  if (d.people) rows.push(['WHO', d.people]);

  const bottomY = H - 130;
  let rowH = 96;
  const padY = 36;
  let avail = bottomY - y - 46;
  if (rows.length) {
    if (2 * padY + rows.length * rowH > avail) {
      rowH = Math.max(70, (avail - 2 * padY) / rows.length);
    }
    const cardH = 2 * padY + rows.length * rowH;
    card(c, M, y, CW, cardH, 34, p);
    rows.forEach((row, i) => {
      const ry = y + padY + i * rowH;
      c.fillStyle = p.gold;
      c.font = font(800, 22, FONT_EN);
      c.fillText(row[0], M + 44, ry + 30);
      c.fillStyle = p.ink;
      c.font = font(700, 33, FONT_MIX);
      c.fillText(String(row[1]), M + 44, ry + 70);
      if (i < rows.length - 1) {
        c.strokeStyle = p.rowLine;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(M + 40, ry + rowH);
        c.lineTo(W - M - 40, ry + rowH);
        c.stroke();
      }
    });
    y += cardH + 46;
  }

  drawCTA(c, W, H, bottomY, d, p);
}

/* ---------- 模板 2：会议回顾 ---------- */
function drawMeetingRecap(c, W, H, d, p) {
  const M = 76, CW = W - 2 * M;
  drawHeader(c, W, H, p, '视频号 · 会议回顾');

  drawPill(c, M, 206, 'RECAP · 会议回顾', p.pillFill, p.pillText);

  let y = drawBigTitle(c, W, d.title, 340, p);
  y += 18;
  if (d.enSub) {
    c.fillStyle = p.accent;
    c.font = font(700, 30, FONT_EN);
    c.fillText(String(d.enSub).toUpperCase(), M, y);
    y += 44;
  }

  /* 金句卡 */
  if (d.quote) {
    c.font = font(700, 42, FONT_MIX);
    const lines = wrapLines(c, d.quote, CW - 130, 4);
    const cardH = 2 * 44 + lines.length * 60;
    y += 16;
    card(c, M, y, CW, cardH, 30, p);
    c.fillStyle = p.gold;
    c.fillRect(M, y, 13, cardH);
    c.fillStyle = p.gold;
    c.font = font(900, 64, FONT_MIX);
    c.fillText('“', M + 46, y + 86);
    c.fillStyle = p.ink;
    c.font = font(700, 42, FONT_MIX);
    lines.forEach((ln, i) => c.fillText(ln, M + 104, y + 78 + i * 60));
    y += cardH + 40;
  }

  /* 亮点 01/02/03 */
  const highs = [d.h1, d.h2, d.h3].filter(Boolean);
  const bottomY = H - 130;
  const reserve = 84; /* 底部日期行 */
  highs.forEach((h, i) => {
    if (y > bottomY - reserve - 70) return; /* 空间不足则跳过 */
    c.font = font(700, 32, FONT_MIX);
    const lines = wrapLines(c, h, CW - 78, 2);
    c.fillStyle = p.gold;
    c.font = font(800, 30, FONT_EN);
    c.fillText(`0${i + 1}`, M, y + 8);
    c.fillStyle = p.ink;
    c.font = font(700, 32, FONT_MIX);
    lines.forEach((ln, j) => c.fillText(ln, M + 68, y + 8 + j * 48));
    y += lines.length * 48 + 26;
  });

  /* 底部日期地点 */
  const meta = [d.date, d.venue].filter(Boolean).join(' · ');
  c.fillStyle = p.sub;
  c.font = font(500, 26, FONT_MIX);
  c.fillText(meta || '', M, bottomY - 52);
}

/* ---------- 模板 3：会员风采 ---------- */
function drawMemberStory(c, W, H, d, p) {
  const M = 76, CW = W - 2 * M;
  drawHeader(c, W, H, p, '视频号 · 会员风采');

  drawPill(c, M, 206, 'MEMBER STORY · 会员风采', p.pillFill, p.pillText);

  let y = 356;
  if (d.name) {
    const size = fitSize(c, d.name, CW, 96, 44, 900, FONT_MIX);
    c.fillStyle = p.ink;
    c.fillText(d.name, M, y);
    y += size * 1.06 + 10;
  }
  if (d.role) {
    c.fillStyle = p.accent;
    c.font = font(700, 36, FONT_MIX);
    c.fillText(d.role, M, y);
    y += 54;
  }
  if (d.sub) {
    c.fillStyle = p.ink;
    c.font = font(700, 34, FONT_MIX);
    const lines = wrapLines(c, d.sub, CW, 2);
    lines.forEach((ln, i) => c.fillText(ln, M, y + i * 48));
    y += lines.length * 48;
  }
  y += 24;

  /* 一句话故事卡 */
  const story = d.story || d.quote;
  if (story) {
    c.font = font(700, 40, FONT_MIX);
    const lines = wrapLines(c, story, CW - 120, 5);
    const cardH = 2 * 42 + lines.length * 58;
    card(c, M, y, CW, cardH, 30, p);
    c.fillStyle = p.gold;
    c.fillRect(M, y, 13, cardH);
    c.fillStyle = p.gold;
    c.font = font(900, 60, FONT_MIX);
    c.fillText('“', M + 44, y + 84);
    c.fillStyle = p.ink;
    c.font = font(700, 40, FONT_MIX);
    lines.forEach((ln, i) => c.fillText(ln, M + 100, y + 76 + i * 58));
    y += cardH + 52;
  }

  const bottomY = H - 130;
  drawCTA(c, W, H, bottomY, d, p);
}

/* ---------- 模板 4：每日一句（外贸英语） ---------- */
function drawDailyEnglish(c, W, H, d, p) {
  const M = 76, CW = W - 2 * M;
  drawHeader(c, W, H, p, '每日一句 · 地道外贸英语');

  const dateText = d.date || new Date().toISOString().slice(5, 10).replace('-', '.');
  drawPill(c, M, 206, `DAY ${dateText}`, p.pillFill, p.pillText);

  /* 关键词 */
  if (d.kwEn) {
    const kw = String(d.kwEn).toUpperCase();
    const size = fitSize(c, kw, CW, 74, 42, 900, FONT_EN);
    c.fillStyle = p.kwColor;
    c.font = font(900, size, FONT_EN);
    c.fillText(kw, M, 342);
  }
  if (d.kwCn) {
    c.fillStyle = p.accent;
    c.font = font(700, 28, FONT_CN);
    c.fillText(d.kwCn, M + 6, 386);
  }

  let y = 442;
  if (d.phEn) {
    c.fillStyle = p.ink;
    c.font = font(800, 62, FONT_EN);
    const lines = wrapLines(c, d.phEn, CW, 3);
    lines.forEach((ln, i) => c.fillText(ln, M, y + i * 78));
    y += lines.length * 78 + 26;
  }
  if (d.phCn) {
    c.fillStyle = p.accent;
    c.font = font(700, 34, FONT_CN);
    const lines = wrapLines(c, d.phCn, CW, 2);
    lines.forEach((ln, i) => c.fillText(ln, M + 4, y + i * 46));
    y += lines.length * 46 + 40;
  }

  /* 例句卡 */
  const bottomY = H - 130;
  const hasExample = d.exEn || d.exCn;
  if (hasExample) {
    let cardY = Math.max(y + 8, 830);
    let cardH = 475;
    if (cardY + cardH > bottomY - 96) cardH = Math.max(180, bottomY - 96 - cardY);
    card(c, M, cardY, CW, cardH, 34, p);
    c.fillStyle = p.gold;
    c.fillRect(M, cardY, 13, cardH);

    let ey = cardY + 78;
    c.fillStyle = p.teal;
    c.font = font(800, 25, FONT_EN);
    c.fillText('REAL-WORLD EXAMPLE', M + 50, ey);
    if (d.exEn) {
      c.fillStyle = p.ink;
      c.font = font(650, 38, FONT_EN);
      const lines = wrapLines(c, d.exEn, CW - 100, 4);
      lines.forEach((ln, i) => c.fillText(ln, M + 50, ey + 70 + i * 52));
      ey += 70 + lines.length * 52 + 24;
    }
    if (d.exCn) {
      c.fillStyle = p.sub;
      c.font = font(500, 29, FONT_CN);
      const lines = wrapLines(c, d.exCn, CW - 100, 2);
      lines.forEach((ln, i) => c.fillText(ln, M + 50, ey + i * 42));
    }
    y = cardY + cardH + 30;
  }

  /* 标签 */
  if (d.tags) {
    c.fillStyle = p.accent;
    c.font = font(700, 24, FONT_CN);
    const lines = wrapLines(c, d.tags, CW, 2);
    const tagY = Math.max(y, bottomY - 92);
    lines.forEach((ln, i) => c.fillText(ln, M, tagY + i * 32));
  }
}

/* ---------- 模板 5：通用 ---------- */
function drawGeneric(c, W, H, d, p) {
  const M = 76, CW = W - 2 * M;
  drawHeader(c, W, H, p, '视频号 · ENGLISH TALKS');

  const label = d.tagLabel || 'ENGLISH TALKS';
  drawPill(c, M, 206, label, p.pillFill, p.pillText);

  let y = drawBigTitle(c, W, d.title, 348, p);
  y += 22;
  if (d.enSub) {
    c.fillStyle = p.accent;
    c.font = font(700, 34, FONT_EN);
    c.fillText(String(d.enSub).toUpperCase(), M, y);
    y += 52;
  }
  if (d.sub) {
    c.fillStyle = p.ink;
    c.font = font(700, 38, FONT_MIX);
    const lines = wrapLines(c, d.sub, CW, 2);
    lines.forEach((ln, i) => c.fillText(ln, M, y + i * 52));
    y += lines.length * 52 + 30;
  }

  const desc = d.desc || d.quote;
  if (desc) {
    y += 10;
    c.font = font(700, 40, FONT_MIX);
    const lines = wrapLines(c, desc, CW - 120, 4);
    const cardH = 2 * 42 + lines.length * 56;
    card(c, M, y, CW, cardH, 30, p);
    c.fillStyle = p.gold;
    c.fillRect(M, y, 13, cardH);
    c.fillStyle = p.gold;
    c.font = font(900, 60, FONT_MIX);
    c.fillText('“', M + 44, y + 82);
    c.fillStyle = p.ink;
    c.font = font(700, 40, FONT_MIX);
    lines.forEach((ln, i) => c.fillText(ln, M + 100, y + 74 + i * 56));
    y += cardH + 52;
  }

  const bottomY = H - 130;
  drawCTA(c, W, H, bottomY, d, p);
}

const TEMPLATES = {
  'meeting-preview': { draw: drawMeetingPreview, right: '小而美 · 有特色' },
  'meeting-recap':  { draw: drawMeetingRecap,  right: '认真开口 · 认真倾听' },
  'member-story':   { draw: drawMemberStory,   right: '会员风采 · 不定期更新' },
  'daily-english':  { draw: drawDailyEnglish,  right: '学一句 · 用一次 · 记一天' },
  generic:          { draw: drawGeneric,       right: '小而美 · 有特色' },
};

/* ---------- 主渲染 ---------- */
async function render() {
  const size = SIZES[state.size];
  const W = size.w, H = size.h;
  canvas.width = W;
  canvas.height = H;

  let p = PALETTES[state.theme] || PALETTES.cream;
  const photoMode = state.theme === 'photo';
  if (photoMode && state.photo) {
    /* 照片模式下先预加载图片 */
    await loadImage(state.photo).catch(() => {});
    p = PALETTES.cream; /* 文字配色沿用奶油版保证可读 */
  }

  drawBackground(ctx, W, H, p, state.dim, photoMode ? state.photo : null);
  drawEdgeStrips(ctx, W, H);

  if (state.showQr && state.qr) {
    await loadImage(state.qr).catch(() => {});
  }

  const tpl = TEMPLATES[state.tpl] || TEMPLATES.generic;
  tpl.draw(ctx, W, H, state.f, p);
  drawBrandBar(ctx, W, H, p, tpl.right);

  $('sizeLabel').textContent = size.label;
  $('filenameHint').textContent = `视频号封面-${(state.f.title || state.tpl).slice(0, 20)}.png`;
}

let raf = 0;
let renderTimer = 0;
function scheduleRender() {
  cancelAnimationFrame(raf);
  clearTimeout(renderTimer);
  raf = requestAnimationFrame(render);
  /* 兜底：后台标签页 rAF 会被节流，超时后强制渲染一次 */
  renderTimer = setTimeout(() => {
    cancelAnimationFrame(raf);
    render();
  }, 150);
}

/* ---------- 示例内容 ---------- */
const SAMPLES = {
  'meeting-preview': {
    title: '你可能会射失，还会不会起脚？', enSub: 'WORLD CUP TABLE TOPICS',
    sub: '两分钟即兴演讲 × 即时互评 × 一群认真倾听的人',
    date: '2026.07.26', time: '19:30 – 21:30',
    venue: '佛山 · 英文说 TMC', people: '主持人 Jager',
    cta: '扫码报名 · 等你开口',
  },
  'meeting-recap': {
    title: '食物是时光机', enSub: 'FOOD MEETING RECAP',
    sub: '美食主题例会回顾', date: '2026.07.19', venue: '佛山 · 英文说 TMC',
    quote: '美食带来的不只是快乐，更是与家人朋友共度的重要时光。',
    h1: '一只清远白切鸡——蒜蓉香油一蘸，一口回到童年。',
    h2: '一锅小学时的花生晚餐——心疼干农活的妈妈，笨拙但滚烫。',
    h3: '奶奶的番茄炒蛋——在异乡吃到相似的味道，就被传送回家。',
  },
  'member-story': {
    name: 'Bass', role: '会长 · 会龄 2 年', date: '2026.08',
    story: '开口的勇气，是这里最珍贵的入场券。在这里，每一次上台都有人认真听。',
  },
  'daily-english': {
    kwEn: 'INQUIRY', kwCn: '询盘', date: '08.05',
    phEn: 'Thank you for your inquiry.', phCn: '感谢您的询盘。',
    exEn: 'Thank you for your inquiry about our custom gift boxes. I’ve attached the size options for your review.',
    exCn: '感谢您咨询我们的定制礼盒，我已附上尺寸选项供您查看。',
    tags: '#外贸英语 #商务英语 #外贸沟通',
  },
  generic: {
    tagLabel: 'ENGLISH TALKS', title: '小而美 · 有特色',
    enSub: 'SMALL BUT DISTINCTIVE', sub: '佛山英文说 · 两周一会，认真开口',
    desc: '不要求英语完美，只邀请你勇敢开口。',
  },
};

/* ---------- 交互绑定 ---------- */
function collectFields() {
  FIELDS.forEach((key) => {
    const el = $('f-' + key);
    if (el) state.f[key] = el.value.trim();
  });
}

function fillFields(obj) {
  FIELDS.forEach((key) => {
    const el = $('f-' + key);
    if (el) el.value = obj[key] || '';
  });
  collectFields();
}

function bindTextInputs() {
  FIELDS.forEach((key) => {
    const el = $('f-' + key);
    if (!el) return;
    el.addEventListener('input', () => {
      collectFields();
      scheduleRender();
      persist();
    });
  });
}

function bindTemplateChips() {
  document.querySelectorAll('.tpl-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.tpl = chip.dataset.tpl;
      document.querySelectorAll('.tpl-chip').forEach((c) => c.classList.toggle('active', c === chip));
      document.querySelectorAll('[data-show]').forEach((f) => {
        const show = (f.dataset.show || '').split(',').includes(state.tpl);
        f.hidden = !show;
      });
      scheduleRender();
      persist();
    });
  });
}

function bindThemes() {
  document.querySelectorAll('.theme-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.theme = chip.dataset.theme;
      document.querySelectorAll('.theme-chip').forEach((c) => c.classList.toggle('active', c === chip));
      scheduleRender();
      persist();
    });
  });
}

function bindSize() {
  document.querySelectorAll('input[name="size"]').forEach((r) => {
    r.addEventListener('change', () => {
      if (r.checked) {
        state.size = r.value;
        scheduleRender();
        persist();
      }
    });
  });
}

function bindUploads() {
  $('photoInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      state.photo = await readFileAsDataURL(file);
      scheduleRender();
    }
  });
  $('qrInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      state.qr = await readFileAsDataURL(file);
      scheduleRender();
    }
  });
  $('dimInput').addEventListener('input', (e) => {
    state.dim = Number(e.target.value);
    scheduleRender();
  });
  $('qrShow').addEventListener('change', (e) => {
    state.showQr = e.target.checked;
    scheduleRender();
  });
  $('qrLabel').addEventListener('input', (e) => {
    state.qrLabel = e.target.value.trim() || '扫码关注';
    scheduleRender();
  });
}

function bindActions() {
  $('sampleBtn').addEventListener('click', () => {
    fillFields(SAMPLES[state.tpl] || {});
    scheduleRender();
  });
  $('resetBtn').addEventListener('click', () => {
    FIELDS.forEach((key) => {
      const el = $('f-' + key);
      if (el) el.value = '';
    });
    collectFields();
    scheduleRender();
  });
  $('downloadBtn').addEventListener('click', async () => {
    await render();
    const name = state.f.title || state.tpl;
    const safe = name.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 30);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `视频号封面-${safe}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
    persist();
  });
}

/* ---------- 本地记忆（不含图片，避免超出容量） ---------- */
const LS_KEY = 'fet-video-cover-gen-v1';
function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      tpl: state.tpl, size: state.size, theme: state.theme,
      dim: state.dim, showQr: state.showQr, qrLabel: state.qrLabel,
      f: state.f,
    }));
  } catch (e) { /* 忽略 */ }
}
function restore() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.tpl && TEMPLATES[saved.tpl]) state.tpl = saved.tpl;
    if (SIZES[saved.size]) state.size = saved.size;
    if (PALETTES[saved.theme] || saved.theme === 'photo') state.theme = saved.theme;
    if (typeof saved.dim === 'number') state.dim = saved.dim;
    if (typeof saved.showQr === 'boolean') state.showQr = saved.showQr;
    if (saved.qrLabel) state.qrLabel = saved.qrLabel;
    if (saved.f) Object.assign(state.f, saved.f);
    FIELDS.forEach((key) => {
      const el = $('f-' + key);
      if (el && saved.f && saved.f[key] !== undefined) el.value = saved.f[key];
    });
  } catch (e) { /* 忽略损坏数据 */ }
}

/* 将 state 同步到界面（模板高亮 / 主题 / 尺寸 / 字段显隐） */
function syncUi() {
  document.querySelectorAll('.tpl-chip').forEach((c) =>
    c.classList.toggle('active', c.dataset.tpl === state.tpl));
  document.querySelectorAll('.theme-chip').forEach((c) =>
    c.classList.toggle('active', c.dataset.theme === state.theme));
  document.querySelectorAll('input[name="size"]').forEach((r) => {
    r.checked = r.value === state.size;
  });
  $('dimInput').value = state.dim;
  $('qrShow').checked = state.showQr;
  $('qrLabel').value = state.qrLabel;
  document.querySelectorAll('[data-show]').forEach((f) => {
    f.hidden = !(f.dataset.show || '').split(',').includes(state.tpl);
  });
}

/* ---------- 启动 ---------- */
function init() {
  collectFields();
  bindTextInputs();
  bindTemplateChips();
  bindThemes();
  bindSize();
  bindUploads();
  bindActions();
  restore();
  syncUi();
  scheduleRender();
}

init();
