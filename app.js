'use strict';
/* 割合パーク（小学5年・算数）
   - 割合＝比べる量÷もとにする量 を、二重数直線とステップ式で練習する。
   - 図の肝：もとにする量の位置に「1」を置き、そこから比べる量の位置まで
     矢印がアニメーションで伸びる（ラベルは「×割合」）。
     割合が1より大きいときは、矢印が「1」を越えて伸びる。
   - 記録（間違い・成績・設定）は localStorage にだけ保存する。
   - 外部読み込みは自前基盤（ナビキャラ画像・効果音）だけ。 */

// ================= 効果音（自前基盤・失敗しても無音で続行） =================
let soundModule = null;
import('https://tt-sensei.github.io/sounds-recipe-/sounds.js')
  .then((m) => { soundModule = m; })
  .catch(() => { soundModule = null; });
let audioCtx = null;
function playSound(id) {
  if (!settings.sound) return;
  try {
    if (!soundModule) return;
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (typeof soundModule.playSound === 'function') {
      soundModule.playSound(audioCtx, id, 0.8);
    } else if (Array.isArray(soundModule.soundList)) {
      const r = soundModule.soundList.find((s) => s.id === id);
      if (r && typeof r.play === 'function') r.play(audioCtx, 0.8);
    }
  } catch (e) { /* 音が出なくても学習は続ける */ }
}

// ================= 画像（自前基盤） =================
const NAVI_BASE = 'https://tt-sensei.github.io/navi-character-/assets/web/characters';
const GROUP_IMG = 'https://tt-sensei.github.io/navi-character-/assets/web/groups/group-standing.webp';
const NAVI = {
  sora:  { name: 'そら',   hint: `${NAVI_BASE}/sora/expressions/01-normal-smile.webp`,  happy: `${NAVI_BASE}/sora/expressions/02-happy.webp`,  troubled: `${NAVI_BASE}/sora/expressions/06-troubled.webp`,  full: `${NAVI_BASE}/sora/fullbody/complete.webp` },
  riku:  { name: 'りく',   hint: `${NAVI_BASE}/riku/expressions/01-normal-smile.webp`,  happy: `${NAVI_BASE}/riku/expressions/02-happy.webp`,  troubled: `${NAVI_BASE}/riku/expressions/06-troubled.webp`,  full: `${NAVI_BASE}/riku/fullbody/complete.webp` },
  kai:   { name: 'かい',   hint: `${NAVI_BASE}/kai/expressions/01-normal-smile.webp`,   happy: `${NAVI_BASE}/kai/expressions/02-happy.webp`,   troubled: `${NAVI_BASE}/kai/expressions/06-troubled.webp`,   full: `${NAVI_BASE}/kai/fullbody/complete.webp` },
  tsuki: { name: 'つき',   hint: `${NAVI_BASE}/tsuki/expressions/01-normal-smile.webp`, happy: `${NAVI_BASE}/tsuki/expressions/02-happy.webp`, troubled: `${NAVI_BASE}/tsuki/expressions/06-troubled.webp`, full: `${NAVI_BASE}/tsuki/fullbody/complete.webp` },
  nami:  { name: 'なみ',   hint: `${NAVI_BASE}/nami/expressions/01-normal-smile.webp`,  happy: `${NAVI_BASE}/nami/expressions/02-happy.webp`,  troubled: `${NAVI_BASE}/nami/expressions/06-troubled.webp`,  full: `${NAVI_BASE}/nami/fullbody/complete.webp` },
  saku:  { name: 'さく',   hint: `${NAVI_BASE}/saku/expressions/01-normal-smile.webp`,  happy: `${NAVI_BASE}/saku/expressions/02-happy.webp`,  troubled: `${NAVI_BASE}/saku/expressions/06-troubled.webp`,  full: `${NAVI_BASE}/saku/fullbody/complete.webp` }
};

// ================= モード定義 =================
const MODES = {
  m1: { id: 'm1', title: 'わりあいを もとめる', navi: 'sora',  color: 'var(--m1)', desc: 'もとにする量を決めて、式を選んで、割合を求めよう（5問）' },
  m2: { id: 'm2', title: 'くらべる量を もとめる', navi: 'riku', color: 'var(--m2)', desc: '割合をかけると、比べる量が分かるよ（5問）' },
  m3: { id: 'm3', title: 'もとにする量を もとめる', navi: 'kai', color: 'var(--m3)', desc: '比べる量と割合から、全体をさかのぼろう（5問）' },
  m4: { id: 'm4', title: 'よみかえ', navi: 'tsuki', color: 'var(--m4)', desc: '小数・％・歩合を読み替えよう（8問）' },
  m5: { id: 'm5', title: 'くらべる', navi: 'nami', color: 'var(--m5)', desc: 'AとB、どちらの割合が大きいかな（5問）' }
};
const MODE_ORDER = ['m1', 'm2', 'm3', 'm4', 'm5'];

// ================= 保存 =================
const LS_MISTAKES = 'wariaiPark.mistakes.v1';
const LS_STATS = 'wariaiPark.stats.v1';
const LS_SETTINGS = 'wariaiPark.settings.v1';

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v === null || v === undefined ? fallback : v;
  } catch (e) { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 保存できなくても続ける */ }
}

let mistakes = loadJSON(LS_MISTAKES, []);
if (!Array.isArray(mistakes)) mistakes = [];
let stats = loadJSON(LS_STATS, null);
if (!stats || typeof stats !== 'object') {
  stats = { modes: {}, totalCorrect: 0, tokkonClearedTotal: 0 };
}
for (const m of MODE_ORDER) {
  if (!stats.modes[m]) stats.modes[m] = { played: 0, answered: 0, correct: 0, cleared: false };
}
let settings = loadJSON(LS_SETTINGS, { sound: true });
if (typeof settings.sound !== 'boolean') settings.sound = true;

function saveAll() {
  saveJSON(LS_MISTAKES, mistakes);
  saveJSON(LS_STATS, stats);
  saveJSON(LS_SETTINGS, settings);
}
function addMistake(q) {
  if (!mistakes.some((x) => x.key === q.key)) {
    mistakes.push(q);
    saveJSON(LS_MISTAKES, mistakes);
  }
}
function removeMistake(key) {
  const i = mistakes.findIndex((x) => x.key === key);
  if (i >= 0) {
    mistakes.splice(i, 1);
    saveJSON(LS_MISTAKES, mistakes);
    return true;
  }
  return false;
}

// ================= 数値ユーティリティ（整数で厳密に扱う） =================
/* 割合は「％の整数 P」で表す（例：0.4 → P=40、1.25 → P=125）。
   率そのものは P/100 で、100倍すると整数になるため誤差が出ない。 */
function decText(P) {           // P（％整数）→ 小数文字列 "0.4" / "1.25" / "1"
  const w = Math.floor(P / 100);
  const r = P % 100;
  if (r === 0) return String(w);
  let frac = (r < 10 ? '0' : '') + r;
  frac = frac.replace(/0$/, '');
  return w + '.' + frac;
}
function wariText(P) {          // P → 歩合 "7割5分" / "7割" / "5分" / "12割"
  const wari = Math.floor(P / 10);
  const bu = P % 10;
  if (wari === 0) return bu + '分';
  if (bu === 0) return wari + '割';
  return wari + '割' + bu + '分';
}
function parseInputHundredths(str) {
  // キーパッド入力（小数第2位まで）を「100倍した整数」に変換する。変換できなければ null。
  if (!/^\d+(\.\d{1,2})?$/.test(str)) return null;
  const parts = str.split('.');
  const w = parseInt(parts[0], 10);
  const f = parts.length > 1 ? parseInt((parts[1] + '0').slice(0, 2), 10) : 0;
  return w * 100 + f;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ================= 二重数直線（SVG） =================
/* 上段＝量、下段＝割合。もとにする量の真下に「1」。
   「1」の位置から比べる量の位置まで矢印がアニメーションで伸び、
   ラベル「×割合」が付く。割合>1 では矢印が「1」を越えて伸びる。
   hide: 'rate' | 'comp' | 'base' | null（解いている間、答えを隠す） */
function numLineSVG(o) {
  const compact = !!o.compact;
  const W = 560, H = compact ? 138 : 158;
  const L = 66, R = 538, span = R - L;
  const topY = compact ? 42 : 50;
  const botY = compact ? 108 : 126;
  const ratio = o.comp / o.base;                 // 位置計算専用（判定には使わない）
  const scaleMax = ratio > 1 ? ratio * 1.14 + 0.06 : 1.2;
  const X = (f) => L + (f / scaleMax) * span;
  const x0 = X(0), x1 = X(1), xr = X(ratio);
  const dir = ratio >= 1 ? 1 : -1;
  const midY = (topY + botY) / 2;
  const ax1 = x1, ax2 = xr;
  const mx = (ax1 + ax2) / 2;
  const headPts = dir > 0
    ? `${ax2},${midY} ${ax2 - 11},${midY - 6} ${ax2 - 11},${midY + 6}`
    : `${ax2},${midY} ${ax2 + 11},${midY - 6} ${ax2 + 11},${midY + 6}`;
  const rateBottom = o.hide === 'rate' ? '？' : decText(o.P);
  const compTop = o.hide === 'comp' ? '？' : (o.comp + o.unit);
  const baseTop = o.hide === 'base' ? '？' : (o.base + o.unit);
  const arrowLabel = o.hide === 'rate' ? '×？' : '×' + decText(o.P);
  const labelW = arrowLabel.length * 10 + 14;
  let s = '';
  s += `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="二重数直線">`;
  // ガイド（対応する位置を結ぶ破線）
  s += `<line x1="${x0}" y1="${topY}" x2="${x0}" y2="${botY}" stroke="#e8ddc9" stroke-width="1.5" stroke-dasharray="3 4"/>`;
  s += `<line x1="${x1}" y1="${topY - 16}" x2="${x1}" y2="${botY}" stroke="#f3b98a" stroke-width="1.5" stroke-dasharray="3 4"/>`;
  s += `<line x1="${xr}" y1="${topY}" x2="${xr}" y2="${botY}" stroke="#e8ddc9" stroke-width="1.5" stroke-dasharray="3 4"/>`;
  // 2本の線
  s += `<line x1="${L - 8}" y1="${topY}" x2="${R + 8}" y2="${topY}" stroke="#8a8172" stroke-width="2.5"/>`;
  s += `<line x1="${L - 8}" y1="${botY}" x2="${R + 8}" y2="${botY}" stroke="#8a8172" stroke-width="2.5"/>`;
  s += `<text x="8" y="${topY + 5}" font-size="13" fill="#8a8172" font-weight="700">量</text>`;
  s += `<text x="8" y="${botY + 5}" font-size="13" fill="#8a8172" font-weight="700">割合</text>`;
  // 目盛り
  const tick = (x, big) => `<line x1="${x}" y1="${topY - 5}" x2="${x}" y2="${topY + 5}" stroke="#8a8172" stroke-width="2"/><line x1="${x}" y1="${botY - 5}" x2="${x}" y2="${botY + 5}" stroke="#8a8172" stroke-width="2"/>`;
  s += tick(x0); s += tick(x1); s += tick(xr);
  // 上段ラベル（量）
  s += `<text x="${x0}" y="${topY - 12}" font-size="13" fill="#8a8172" text-anchor="middle">0</text>`;
  s += `<text x="${x1}" y="${topY - 26}" font-size="11.5" fill="#b0762a" text-anchor="middle" font-weight="700">もとにする量</text>`;
  s += `<text x="${x1}" y="${topY - 10}" font-size="16.5" fill="#33302b" text-anchor="middle" font-weight="800">${esc(baseTop)}</text>`;
  s += `<text x="${xr}" y="${topY - 10}" font-size="16.5" fill="#c7500f" text-anchor="middle" font-weight="800">${esc(compTop)}</text>`;
  // 下段ラベル（割合）
  s += `<text x="${x0}" y="${botY + 20}" font-size="13" fill="#8a8172" text-anchor="middle">0</text>`;
  s += `<circle cx="${x1}" cy="${botY + 14}" r="13.5" fill="#fff0df" stroke="#ef6c2a" stroke-width="2.5"/>`;
  s += `<text x="${x1}" y="${botY + 20}" font-size="17" fill="#c7500f" text-anchor="middle" font-weight="800">1</text>`;
  s += `<text x="${xr}" y="${botY + 20}" font-size="16.5" fill="#c7500f" text-anchor="middle" font-weight="800">${esc(rateBottom)}</text>`;
  // 矢印（1 の位置から比べる量の位置へ伸びる）
  s += `<path class="nl-arrow-path" pathLength="100" d="M ${ax1} ${midY} Q ${mx} ${midY - 16} ${ax2} ${midY}" fill="none" stroke="#ef6c2a" stroke-width="4" stroke-linecap="round"/>`;
  s += `<polygon class="nl-head" points="${headPts}" fill="#ef6c2a"/>`;
  s += `<g class="nl-pop"><rect x="${mx - labelW / 2}" y="${topY + 4}" width="${labelW}" height="24" rx="12" fill="#ef6c2a"/><text x="${mx}" y="${topY + 21}" font-size="15" fill="#ffffff" text-anchor="middle" font-weight="800">${esc(arrowLabel)}</text></g>`;
  s += '</svg>';
  return s;
}

// ================= 問題生成 =================
/* どの問題も「割合＝P％（整数）」で割り切れるものだけを作る。 */
// ---- モード1：割合を求める ----
const M1_SMALL = [
  { base: 20, comp: 8,   unit: '人', baseName: 'クラスの人数', compName: 'めがねをかけている人', text: 'クラスは {B}人です。そのうち、めがねをかけている人は {C}人です。めがねをかけている人は、クラス全体のどれだけの割合ですか。' },
  { base: 25, comp: 10,  unit: 'さつ', baseName: '本のさつ数', compName: '読んだ本', text: '本が {B}さつあります。そのうち {C}さつを読みました。読んだ本は、全体のどれだけの割合ですか。' },
  { base: 40, comp: 30,  unit: 'm', baseName: 'ひもの長さ', compName: '使った長さ', text: '{B}mのひもがあります。そのうち {C}mを使いました。使った長さは、全体のどれだけの割合ですか。' },
  { base: 50, comp: 35,  unit: '点', baseName: 'テストの満点', compName: '取れた点数', text: '{B}点満点のテストで、{C}点取れました。取れた点数は、満点のどれだけの割合ですか。' },
  { base: 80, comp: 20,  unit: 'ページ', baseName: '本のページ数', compName: '読んだページ数', text: '{B}ページの本があります。そのうち {C}ページ読みました。読んだページ数は、全体のどれだけの割合ですか。' },
  { base: 120, comp: 30, unit: 'mL', baseName: 'コップの水の量', compName: '飲んだ量', text: 'コップに {B}mLの水が入っています。そのうち {C}mL飲みました。飲んだ量は、全体のどれだけの割合ですか。' },
  { base: 60, comp: 45,  unit: '分', baseName: '勉強の時間', compName: '算数をした時間', text: '{B}分勉強しました。そのうち {C}分は算数をしました。算数の時間は、全体のどれだけの割合ですか。' },
  { base: 200, comp: 150, unit: 'g', baseName: '小麦粉の重さ', compName: '使った重さ', text: '小麦粉が {B}gあります。そのうち {C}gを使いました。使った重さは、全体のどれだけの割合ですか。' },
  { base: 30, comp: 12,  unit: '問', baseName: '問題の数', compName: '正解した数', text: '問題が {B}問あります。そのうち {C}問、正解しました。正解した数は、全体のどれだけの割合ですか。' },
  { base: 90, comp: 27,  unit: 'こ', baseName: '種の数', compName: '芽が出た数', text: '種を {B}こまきました。そのうち {C}こ、芽が出ました。芽が出た数は、全体のどれだけの割合ですか。' },
  { base: 16, comp: 12,  unit: '人', baseName: 'チームの人数', compName: '女子の人数', text: 'チームは {B}人です。そのうち女子は {C}人です。女子は、全体のどれだけの割合ですか。' },
  { base: 45, comp: 9,   unit: '分', baseName: '遠足の時間', compName: '歩いた時間', text: '遠足は {B}分です。そのうち {C}分、歩きました。歩いた時間は、全体のどれだけの割合ですか。' }
];
const M1_BIG = [
  { base: 100, comp: 120, unit: 'kg', baseName: '去年の収穫量', compName: '今年の収穫量', text: '去年の米の収穫量は {B}kgでした。今年は {C}kgでした。今年の収穫量は、去年のどれだけの割合ですか。' },
  { base: 80, comp: 100, unit: 'cm', baseName: '先月の高さ', compName: '今月の高さ', text: '植物の高さは、先月は {B}cmでした。今月は {C}cmになりました。今月の高さは、先月のどれだけの割合ですか。' },
  { base: 50, comp: 60,  unit: 'こ', baseName: '1日の目標の数', compName: '作れた数', text: '折り紙の1日の目標は {B}こです。今日は {C}こ作れました。作れた数は、目標のどれだけの割合ですか。' },
  { base: 200, comp: 300, unit: '人', baseName: '去年の来場者数', compName: '今年の来場者数', text: 'お祭りの来場者は、去年は {B}人でした。今年は {C}人でした。今年の来場者数は、去年のどれだけの割合ですか。' }
];
function fillText(t, b, c) { return t.replace('{B}', b).replace('{C}', c); }
function genM1() {
  const bigs = shuffle(M1_BIG).slice(0, Math.random() < 0.5 ? 1 : 2);
  const smalls = shuffle(M1_SMALL).slice(0, 5 - bigs.length);
  return shuffle(smalls.concat(bigs)).map((it) => {
    const P = (it.comp * 100) / it.base;
    return {
      mode: 'm1', key: `m1-${it.base}-${it.comp}`,
      base: it.base, comp: it.comp, P, unit: it.unit,
      baseName: it.baseName, compName: it.compName,
      text: fillText(it.text, it.base, it.comp)
    };
  });
}
// ---- モード2・3 共通の組み合わせ ----
const M23_BASES = [20, 24, 40, 50, 60, 80, 100, 120, 150, 200, 240, 300, 400];
const M23_PS = [20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 120, 150];
const M23_SCENES = [
  { unit: '人', thing: 'バスの定員', verb: '乗る' },
  { unit: 'g', thing: 'さとうの重さ', verb: '使う' },
  { unit: 'm', thing: 'リボンの長さ', verb: '使う' },
  { unit: '円', thing: 'ねだん', verb: '安く なる' },
  { unit: 'ページ', thing: '本のページ数', verb: '読む' },
  { unit: 'mL', thing: 'ジュースの量', verb: '飲む' }
];
function repOf(P, kind) {
  if (kind === 'pct') return { kind, text: P + '%', dec: decText(P) };
  if (kind === 'wari') return { kind, text: wariText(P), dec: decText(P) };
  return { kind: 'dec', text: decText(P), dec: decText(P) };
}
function genM2() {
  const combos = [];
  for (const b of M23_BASES) for (const P of M23_PS) {
    if ((b * P) % 100 === 0) combos.push({ base: b, P, comp: (b * P) / 100 });
  }
  const kinds = shuffle(['dec', 'pct', 'wari', 'dec', 'pct']);
  return shuffle(combos).slice(0, 5).map((c, i) => {
    const sc = M23_SCENES[Math.floor(Math.random() * M23_SCENES.length)];
    const rep = repOf(c.P, kinds[i]);
    return {
      mode: 'm2', key: `m2-${c.base}-${c.P}`,
      base: c.base, comp: c.comp, P: c.P, unit: sc.unit, rep,
      text: `${sc.thing}は ${c.base}${sc.unit}です。その ${rep.text} の量は、何${sc.unit}ですか。`
    };
  });
}
function genM3() {
  const combos = [];
  for (const b of M23_BASES) for (const P of M23_PS) {
    if ((b * P) % 100 === 0) combos.push({ base: b, P, comp: (b * P) / 100 });
  }
  const kinds = shuffle(['dec', 'pct', 'wari', 'pct', 'dec']);
  return shuffle(combos).slice(0, 5).map((c, i) => {
    const sc = M23_SCENES[Math.floor(Math.random() * M23_SCENES.length)];
    const rep = repOf(c.P, kinds[i]);
    return {
      mode: 'm3', key: `m3-${c.comp}-${c.P}`,
      base: c.base, comp: c.comp, P: c.P, unit: sc.unit, rep,
      text: `${c.comp}${sc.unit}は、全体（${sc.thing}）の ${rep.text} です。全体は 何${sc.unit}ですか。`
    };
  });
}
// ---- モード4：読み替え ----
function genM4() {
  const kinds = shuffle(['d2p', 'p2d', 'w2p', 'd2w', 'd2p', 'p2d', 'w2p', 'd2w']);
  const pools = {
    d2p: [35, 8, 120, 45, 3, 65, 90, 125],
    p2d: [45, 120, 6, 70, 35, 250, 90, 15],
    w2p: [35, 70, 5, 45, 120, 25, 80, 15],
    d2w: [70, 45, 120, 5, 35, 90, 25, 60]
  };
  const used = { d2p: 0, p2d: 0, w2p: 0, d2w: 0 };
  return kinds.map((kind) => {
    const pool = shuffle(pools[kind]);
    const V = pool[used[kind]++ % pool.length];
    let prompt, options, explain;
    if (kind === 'd2p') {
      prompt = `小数 ${decText(V)} は、何％ですか。`;
      options = [V + '%', (V * 10) + '%', Math.max(1, Math.round(V / 10)) + '%'];
      explain = `${decText(V)} は 100分の${V}。だから ${V}% です。割合を％で表すときは、100をかけます。`;
    } else if (kind === 'p2d') {
      prompt = `${V}％ は、小数ではいくつですか。`;
      options = [decText(V), decText(V * 10), V >= 10 ? decText(Math.round(V / 10)) : '0.0' + V];
      explain = `${V}% は 100分の${V}。小数では ${decText(V)} です。％を小数に直すときは、100でわります。`;
    } else if (kind === 'w2p') {
      prompt = `${wariText(V)} は、何％ですか。`;
      options = [V + '%', (V + 10) + '%', Math.max(1, V - 10) + '%'];
      explain = `1割は10%です。${wariText(V)} は ${V}% です。`;
    } else {
      prompt = `小数 ${decText(V)} は、歩合では何ですか。`;
      options = [wariText(V), wariText(V + 10), V > 10 ? wariText(V - 10) : wariText(V + 20)];
      explain = `${decText(V)} は ${V}% で、10%が1割だから ${wariText(V)} です。`;
    }
    const opts = shuffle(options.map((t, i) => ({ t, ok: i === 0 })));
    return {
      mode: 'm4', key: `m4-${kind}-${V}`, kind, V,
      prompt, options: opts, explain
    };
  });
}
// ---- モード5：くらべる ----
const M5_BANK = [
  { id: 'juice', title: 'ジュースの こさ', ask: 'こいのは どちらですか。', aLabel: 'Aのジュース', bLabel: 'Bのジュース',
    A: { base: 200, comp: 40, unit: 'g', text: '水200gに さとう40g' }, B: { base: 250, comp: 75, unit: 'g', text: '水250gに さとう75g' }, bigger: 'B' },
  { id: 'shoot', title: 'シュートの 成功率', ask: '成功率が 高いのは どちらですか。', aLabel: 'Aさん', bLabel: 'Bさん',
    A: { base: 20, comp: 12, unit: '本', text: '20本のうち 12本成功' }, B: { base: 25, comp: 10, unit: '本', text: '25本のうち 10本成功' }, bigger: 'A' },
  { id: 'discount', title: '割引の お得さ', ask: 'お得なのは どちらですか。', aLabel: 'Aの店', bLabel: 'Bの店',
    A: { base: 1000, comp: 200, unit: '円', text: '1000円の品物が 200円引き' }, B: { base: 800, comp: 240, unit: '円', text: '800円の品物が 240円引き' }, bigger: 'B' },
  { id: 'book', title: '本の 読み進み', ask: '読み進んだ割合が 大きいのは どちらですか。', aLabel: 'Aの本', bLabel: 'Bの本',
    A: { base: 150, comp: 90, unit: 'ページ', text: '150ページのうち 90ページ読んだ' }, B: { base: 200, comp: 100, unit: 'ページ', text: '200ページのうち 100ページ読んだ' }, bigger: 'A' },
  { id: 'kuji', title: 'くじの あたり率', ask: 'あたり率が 高いのは どちらですか。', aLabel: 'Aのくじ', bLabel: 'Bのくじ',
    A: { base: 40, comp: 8, unit: '本', text: '40本のうち あたり8本' }, B: { base: 30, comp: 9, unit: '本', text: '30本のうち あたり9本' }, bigger: 'B' },
  { id: 'test', title: 'テストの 取れた割合', ask: '取れた割合が 大きいのは どちらですか。', aLabel: 'Aのテスト', bLabel: 'Bのテスト',
    A: { base: 50, comp: 40, unit: '点', text: '50点満点で 40点' }, B: { base: 40, comp: 28, unit: '点', text: '40点満点で 28点' }, bigger: 'A' }
];
function genM5() {
  return shuffle(M5_BANK).slice(0, 5).map((it) => {
    const A = Object.assign({}, it.A, { P: (it.A.comp * 100) / it.A.base });
    const B = Object.assign({}, it.B, { P: (it.B.comp * 100) / it.B.base });
    return { mode: 'm5', key: 'm5-' + it.id, id: it.id, title: it.title, ask: it.ask, aLabel: it.aLabel, bLabel: it.bLabel, A, B, bigger: it.bigger };
  });
}
const GENERATORS = { m1: genM1, m2: genM2, m3: genM3, m4: genM4, m5: genM5 };

// ================= ステップ構築 =================
function choiceStep(prompt, pairs, hint) {
  return { type: 'choice', prompt, hint: hint || '',
    choices: shuffle(pairs.map((p) => ({ label: p[0], ok: !!p[1] }))), pickedWrong: [] };
}
function inputStep(prompt, expectedH, expectedText, hint) {
  return { type: 'input', prompt, hint: hint || '', expectedH, expectedText };
}
function buildSteps(q) {
  if (q.mode === 'm1') {
    return [
      choiceStep('まず、はじめに決めるのは「もとにする量」。1とみるのは、どちらかな？',
        [[`${q.baseName}（${q.base}${q.unit}）`, true], [`${q.compName}（${q.comp}${q.unit}）`, false]],
        '割合は、「全体や もとになる量」を1とみて考えるよ。'),
      choiceStep('割合を求める式は、どちらかな？',
        [[`${q.comp} ÷ ${q.base}`, true], [`${q.base} ÷ ${q.comp}`, false]],
        '割合 ＝ 比べる量 ÷ もとにする量 だよ。わる順番に気をつけよう。'),
      inputStep('割合を、小数で入力しよう。', q.P, decText(q.P),
        '式の答えを、小数で書いてね。')
    ];
  }
  if (q.mode === 'm2') {
    const d = decText(q.P);
    return [
      choiceStep('比べる量を求める式は、どれかな？',
        [[`${q.base} × ${d}`, true], [`${q.base} ÷ ${d}`, false], [`${d} ÷ ${q.base}`, false]],
        '二重数直線の矢印は「×割合」。比べる量 ＝ もとにする量 × 割合 だよ。'),
      inputStep(`比べる量は、何${q.unit}ですか。`, q.comp * 100, String(q.comp),
        'かけ算の答えを入力してね。')
    ];
  }
  if (q.mode === 'm3') {
    const d = decText(q.P);
    return [
      choiceStep('もとにする量を求める式は、どれかな？',
        [[`${q.comp} ÷ ${d}`, true], [`${q.comp} × ${d}`, false], [`${d} ÷ ${q.comp}`, false]],
        '比べる量 ÷ 割合 で、もとにする量にさかのぼれるよ。'),
      inputStep(`もとにする量は、何${q.unit}ですか。`, q.base * 100, String(q.base),
        'わり算の答えを入力してね。')
    ];
  }
  if (q.mode === 'm4') {
    return [{ type: 'choice', prompt: '', hint: '', choices: q.options.map((o) => ({ label: o.t, ok: o.ok })), pickedWrong: [] }];
  }
  // m5
  const fA = choiceStep(`${q.aLabel} の割合を求める式は、どちらかな？`,
    [[`${q.A.comp} ÷ ${q.A.base}`, true], [`${q.A.base} ÷ ${q.A.comp}`, false]], '割合 ＝ 比べる量 ÷ もとにする量 だよ。');
  const iA = inputStep(`${q.aLabel} の割合を、小数で入力しよう。`, q.A.P, decText(q.A.P), '');
  const fB = choiceStep(`${q.bLabel} の割合を求める式は、どちらかな？`,
    [[`${q.B.comp} ÷ ${q.B.base}`, true], [`${q.B.base} ÷ ${q.B.comp}`, false]], '割合 ＝ 比べる量 ÷ もとにする量 だよ。');
  const iB = inputStep(`${q.bLabel} の割合を、小数で入力しよう。`, q.B.P, decText(q.B.P), '');
  const cmp = choiceStep(q.ask,
    [[q.aLabel, q.bigger === 'A'], [q.bLabel, q.bigger === 'B']],
    `割合は、Aが ${decText(q.A.P)}、Bが ${decText(q.B.P)} だったね。`);
  return [fA, iA, fB, iB, cmp];
}

// ================= バッジ =================
const BADGES = [
  { id: 'clear-m1', label: 'わりあいマスター', test: () => stats.modes.m1.cleared },
  { id: 'clear-m2', label: 'くらべる量マスター', test: () => stats.modes.m2.cleared },
  { id: 'clear-m3', label: 'もとにする量マスター', test: () => stats.modes.m3.cleared },
  { id: 'clear-m4', label: 'よみかえマスター', test: () => stats.modes.m4.cleared },
  { id: 'clear-m5', label: 'くらべるマスター', test: () => stats.modes.m5.cleared },
  { id: 'clear-all', label: '全モードクリア', test: () => MODE_ORDER.every((m) => stats.modes[m].cleared) },
  { id: 'tokkon-1', label: 'とっくん克服 1件', test: () => stats.tokkonClearedTotal >= 1 },
  { id: 'tokkon-5', label: 'とっくん克服 5件', test: () => stats.tokkonClearedTotal >= 5 },
  { id: 'tokkon-10', label: 'とっくん克服 10件', test: () => stats.tokkonClearedTotal >= 10 },
  { id: 'total-10', label: '通算正解 10問', test: () => stats.totalCorrect >= 10 },
  { id: 'total-30', label: '通算正解 30問', test: () => stats.totalCorrect >= 30 },
  { id: 'total-60', label: '通算正解 60問', test: () => stats.totalCorrect >= 60 }
];
function earnedBadgeIds() { return BADGES.filter((b) => b.test()).map((b) => b.id); }

// ================= セッション =================
let screen = 'home';           // home | solve | result | records
let session = null;

function startSession(mode, list) {
  session = {
    mode,                       // 'm1'..'m5' | 'tokkon'
    list,
    idx: 0,
    stepIdx: 0,
    steps: null,
    q: null,
    qWrong: false,
    inputStr: '',
    miniMsg: null,              // {kind:'ok'|'ng', text}
    phase: 'steps',             // steps | feedback
    correctCount: 0,
    clearedCount: 0,
    badgesBefore: earnedBadgeIds()
  };
  setupQuestion();
  screen = 'solve';
  playSound('start');
  render();
}
function setupQuestion() {
  session.q = session.list[session.idx];
  session.steps = buildSteps(session.q);
  session.stepIdx = 0;
  session.qWrong = false;
  session.inputStr = '';
  session.miniMsg = null;
  session.phase = 'steps';
}
function currentStep() { return session.steps[session.stepIdx]; }

function finishQuestion() {
  const q = session.q;
  const st = stats.modes[q.mode];
  st.answered += 1;
  if (!session.qWrong) {
    st.correct += 1;
    stats.totalCorrect += 1;
    session.correctCount += 1;
  }
  if (session.mode === 'tokkon') {
    if (!session.qWrong && removeMistake(q.key)) {
      stats.tokkonClearedTotal += 1;
      session.clearedCount += 1;
    }
  } else if (session.qWrong) {
    addMistake(JSON.parse(JSON.stringify(q)));
  }
  saveAll();
  session.phase = 'feedback';
  playSound(session.qWrong ? 'clear' : 'stageClear');
  render();
}
function advanceStep() {
  session.miniMsg = null;
  session.inputStr = '';
  if (session.stepIdx + 1 >= session.steps.length) finishQuestion();
  else { session.stepIdx += 1; render(); }
}
function pickChoice(i) {
  if (!session || session.phase !== 'steps') return;
  const step = currentStep();
  if (!step || step.type !== 'choice') return;
  const c = step.choices[i];
  if (!c || step.pickedWrong.includes(i)) return;
  playSound('click');
  if (c.ok) {
    session.miniMsg = { kind: 'ok', text: 'せいかい！' };
    render();
    setTimeout(() => { if (session && session.phase === 'steps') advanceStep(); }, 620);
  } else {
    session.qWrong = true;
    step.pickedWrong.push(i);
    session.miniMsg = { kind: 'ng', text: 'おしい！もう一度 考えてみよう。' + (step.hint ? '' : '') };
    playSound('wrong');
    render();
  }
}
function pressKey(k) {
  if (!session || session.phase !== 'steps') return;
  const step = currentStep();
  if (!step || step.type !== 'input') return;
  let s = session.inputStr;
  if (k === 'bs') s = s.slice(0, -1);
  else if (k === 'clr') s = '';
  else if (k === '.') { if (!s.includes('.') && s.length < 7) s = (s === '' ? '0' : s) + '.'; }
  else if (/^\d$/.test(k)) {
    if (s.includes('.')) {
      const frac = s.split('.')[1];
      if (frac.length >= 2) return;
    }
    if (s.replace('.', '').length >= 6) return;
    s += k;
  }
  session.inputStr = s;
  session.miniMsg = null;
  render();
}
function confirmInput() {
  if (!session || session.phase !== 'steps') return;
  const step = currentStep();
  if (!step || step.type !== 'input') return;
  playSound('decide');
  const v = parseInputHundredths(session.inputStr);
  if (v !== null && v === step.expectedH) {
    session.miniMsg = { kind: 'ok', text: 'せいかい！' };
    render();
    setTimeout(() => { if (session && session.phase === 'steps') advanceStep(); }, 620);
  } else {
    session.qWrong = true;
    session.inputStr = '';
    session.miniMsg = { kind: 'ng', text: 'おしい！もう一度 考えてみよう。' };
    playSound('wrong');
    render();
  }
}
function nextQuestion() {
  if (!session) return;
  if (session.idx + 1 >= session.list.length) {
    if (session.mode !== 'tokkon') {
      stats.modes[session.mode].played += 1;
      stats.modes[session.mode].cleared = true;
      saveAll();
    }
    screen = 'result';
    playSound('clear');
    render();
  } else {
    session.idx += 1;
    setupQuestion();
    render();
  }
}

// ================= 図と解説 =================
function figureFor(q, revealed) {
  if (q.mode === 'm4') return '';
  if (q.mode === 'm5') {
    const aDone = revealed || session.stepIdx >= 2;
    const bDone = revealed || session.stepIdx >= 4;
    return `<div class="fig-box"><div class="fig-cap">${esc(q.aLabel)}</div>` +
      numLineSVG({ base: q.A.base, comp: q.A.comp, P: q.A.P, unit: q.A.unit, hide: aDone ? null : 'rate', compact: true }) +
      `<div class="fig-cap">${esc(q.bLabel)}</div>` +
      numLineSVG({ base: q.B.base, comp: q.B.comp, P: q.B.P, unit: q.B.unit, hide: bDone ? null : 'rate', compact: true }) +
      '</div>';
  }
  const hide = revealed ? null : (q.mode === 'm1' ? 'rate' : q.mode === 'm2' ? 'comp' : 'base');
  return `<div class="fig-box">` + numLineSVG({ base: q.base, comp: q.comp, P: q.P, unit: q.unit, hide }) + '</div>';
}
function questionText(q) {
  if (q.mode === 'm4') return q.prompt;
  if (q.mode === 'm5') return `${q.title}：${q.aLabel}（${q.A.text}）、${q.bLabel}（${q.B.text}）。`;
  return q.text;
}
function naviComment(q) {
  if (q.mode === 'm1') return 'まず「1とみる量」を決めるのが、割合の第一歩だよ。';
  if (q.mode === 'm2') return '矢印は「×割合」。1の位置から引っ張ってみよう。';
  if (q.mode === 'm3') return '比べる量から、わり算で さかのぼるよ。';
  if (q.mode === 'm4') return '小数も％も歩合も、もとは「100分のいくつ」だよ。';
  return 'AとB、それぞれ割合を出してから比べよう。';
}
function explainFor(q) {
  const d = decText(q.P);
  if (q.mode === 'm1') {
    return {
      main: `割合 ＝ 比べる量 ÷ もとにする量 だから、${q.comp} ÷ ${q.base} ＝ ${d} です。％で表すと ${q.P}% です。`,
      check: `${d} × ${q.base} ＝ ${q.comp}（割合 × もとにする量 ＝ 比べる量）`
    };
  }
  if (q.mode === 'm2') {
    return {
      main: `比べる量 ＝ もとにする量 × 割合 だから、${q.base} × ${d} ＝ ${q.comp} です。`,
      check: `${q.comp} ÷ ${q.base} ＝ ${d}（確かめ：比べる量 ÷ もとにする量 ＝ 割合）`
    };
  }
  if (q.mode === 'm3') {
    return {
      main: `もとにする量 ＝ 比べる量 ÷ 割合 だから、${q.comp} ÷ ${d} ＝ ${q.base} です。`,
      check: `${d} × ${q.base} ＝ ${q.comp}（割合 × もとにする量 ＝ 比べる量）`
    };
  }
  if (q.mode === 'm4') return { main: q.explain, check: '' };
  return {
    main: `${q.aLabel} の割合は ${q.A.comp} ÷ ${q.A.base} ＝ ${decText(q.A.P)}、${q.bLabel} の割合は ${q.B.comp} ÷ ${q.B.base} ＝ ${decText(q.B.P)}。だから、割合が大きいのは ${q.bigger === 'A' ? q.aLabel : q.bLabel} です。`,
    check: `比べるときは、量そのものではなく「割合」で比べるのがポイントです。`
  };
}

// ================= 画面 =================
const root = document.getElementById('app');
function headerHTML() {
  return `<header class="app-header">
    <button class="app-brand" data-action="home" aria-label="トップへ">
      <span class="brand-mark">％</span>
      <span><strong>割合パーク</strong><small>TT-sensei · 小学5年 算数</small></span>
    </button>
    <div class="header-actions">
      ${screen !== 'home' ? '<button class="pill-btn" data-action="home">トップへ</button>' : ''}
      <button class="pill-btn" data-action="sound" aria-pressed="${settings.sound}">${settings.sound ? '🔊 音 ON' : '🔇 音 OFF'}</button>
    </div>
  </header>`;
}
function shell(content) {
  return `<div class="app">${headerHTML()}<main>${content}</main><footer class="app-footer">TT-sensei　学ぶ · 挑戦する · できるようになる</footer></div>`;
}
function render() {
  if (screen === 'home') root.innerHTML = shell(renderHome());
  else if (screen === 'solve') root.innerHTML = shell(renderSolve());
  else if (screen === 'result') root.innerHTML = shell(renderResult());
  else if (screen === 'records') root.innerHTML = shell(renderRecords());
  window.scrollTo(0, 0);
}

function renderHome() {
  const m = mistakes.length;
  const cards = MODE_ORDER.map((id) => {
    const md = MODES[id];
    const nv = NAVI[md.navi];
    const done = stats.modes[id].cleared ? '　✓ クリアずみ' : '';
    return `<button class="mode-card" data-action="start" data-mode="${id}">
      <span class="mode-dot" style="background:${md.color}"></span>
      <img class="navi-face" src="${nv.hint}" alt="${nv.name}">
      <span><b>${md.title}</b><small>${md.desc}${done}</small></span>
    </button>`;
  }).join('');
  return `
  <section class="hero">
    <img class="hero-img" src="${GROUP_IMG}" alt="ナビキャラたち">
    <div class="hero-text">
      <h1>割合を、図で見て<br>ステップで解こう</h1>
      <p>もとにする量を「1」とみて、矢印を引っ張ってかける。それが割合の考え方です。二重数直線で確かめながら進もう。</p>
      <div class="hero-tags"><span>割合</span><span>百分率（％）</span><span>歩合</span><span>二重数直線</span></div>
    </div>
  </section>
  <h2 class="section-title">れんしゅうを選ぼう</h2>
  <div class="mode-grid">${cards}</div>
  <h2 class="section-title">記録と再挑戦</h2>
  <div class="tool-grid">
    <button class="tool-card" data-action="tokkon">
      <span><b>とっくん</b><small>${m ? 'まちがえた問題に 再挑戦して 克服しよう' : 'まちがえた問題は まだ ありません'}</small></span>
      <span class="count-badge ${m ? '' : 'zero'}">${m}</span>
    </button>
    <button class="tool-card" data-action="records">
      <span><b>学習の記録</b><small>解いた数や バッジを 見よう（通算正解 ${stats.totalCorrect}問）</small></span>
    </button>
  </div>
  <p class="foot-note">記録は、この端末の中にだけ保存されます。</p>`;
}

function renderSolve() {
  const q = session.q;
  const isTokkon = session.mode === 'tokkon';
  const md = MODES[q.mode];
  const nv = NAVI[md.navi];
  const total = session.list.length;
  const progress = Math.round((session.idx / total) * 100);
  const inFeedback = session.phase === 'feedback';
  const step = inFeedback ? null : currentStep();

  let side = '';
  if (inFeedback) {
    const ex = explainFor(q);
    const ok = !session.qWrong;
    side = `<div class="panel-card">
      <div class="feedback ${ok ? 'ok' : 'ng'}" style="margin-top:0">
        <img src="${ok ? nv.happy : nv.troubled}" alt="">
        <div><p class="fb-title">${ok ? '正解！' : 'がんばったね'}</p><p>${esc(ex.main)}</p></div>
      </div>
      ${ex.check ? `<div class="check-line">${esc(ex.check)}</div>` : ''}
      <div style="margin-top:12px"><button class="big-btn" data-action="next">${session.idx + 1 >= total ? '結果を見る' : 'つぎへ →'}</button></div>
    </div>`;
  } else if (step.type === 'choice') {
    const btns = step.choices.map((c, i) => {
      const picked = step.pickedWrong.includes(i);
      return `<button class="choice-btn ${picked ? 'picked-ng' : ''}" data-action="choice" data-i="${i}" ${picked ? 'disabled' : ''}>${esc(c.label)}</button>`;
    }).join('');
    side = `<div class="panel-card"><p class="panel-title">選ぼう</p><div class="choices">${btns}</div>${miniMsgHTML()}</div>`;
  } else {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'bs'];
    const pad = keys.map((k) => `<button class="key-btn ${k === 'bs' ? 'util' : ''}" data-action="key" data-k="${k}">${k === 'bs' ? '⌫ 消す' : k}</button>`).join('');
    side = `<div class="panel-card"><p class="panel-title">入力しよう</p>
      <div class="input-display">${session.inputStr ? esc(session.inputStr) : '<span class="placeholder">ここに数字が出ます</span>'}</div>
      <div class="keypad">${pad}<button class="key-btn util" data-action="key" data-k="clr">クリア</button></div>
      <div style="margin-top:10px"><button class="big-btn" data-action="confirm">こたえあわせ</button></div>
      ${miniMsgHTML()}</div>`;
  }

  return `
  <div class="session-head">
    <span class="mode-name">${isTokkon ? 'とっくん' : esc(md.title)}</span>
    <div class="progress-wrap">
      <div class="progress-head"><span>${session.idx + 1} / ${total} 問目</span><span>${progress}%</span></div>
      <div class="progress-track"><div class="progress-value" style="width:${progress}%"></div></div>
    </div>
  </div>
  <div class="solve">
    <article class="q-card">
      <div class="q-top">
        <img class="q-navi" src="${nv.hint}" alt="${nv.name}">
        <div>
          <p class="q-prompt">${esc(questionText(q))}</p>
          <p class="q-hint">${nv.name}：${esc(naviComment(q))}</p>
        </div>
      </div>
      ${figureFor(q, inFeedback)}
      ${!inFeedback && step.prompt ? `<p class="step-q">${esc(step.prompt)}</p>` : ''}
    </article>
    <div class="side-panel">${side}</div>
  </div>`;
}
function miniMsgHTML() {
  if (!session || !session.miniMsg) return '';
  return `<p class="mini-msg ${session.miniMsg.kind}">${esc(session.miniMsg.text)}</p>`;
}

function renderResult() {
  const isTokkon = session.mode === 'tokkon';
  const md = isTokkon ? null : MODES[session.mode];
  const nv = NAVI[isTokkon ? 'saku' : md.navi];
  const total = session.list.length;
  const newBadges = earnedBadgeIds().filter((id) => !session.badgesBefore.includes(id))
    .map((id) => BADGES.find((b) => b.id === id));
  return `
  <section class="result-card">
    <img class="pose" src="${nv.full}" alt="${nv.name}">
    <p class="result-score">${total}問中 ${session.correctCount}問 正解</p>
    <p class="result-sub">${isTokkon
      ? `${session.clearedCount}問 克服しました。${mistakes.length ? `のこりの まちがえた問題は ${mistakes.length}問 です。` : 'まちがえた問題は 全部 克服できました！'}`
      : 'おつかれさま！ まちがえた問題は「とっくん」に記録されています。'}</p>
    ${newBadges.length ? `<div class="new-badges">${newBadges.map((b) => `<span class="badge-chip">🏅 ${esc(b.label)}</span>`).join('')}</div>` : ''}
    <div class="result-actions">
      <button class="big-btn" data-action="again">もう一度</button>
      <button class="big-btn sub" data-action="home">トップへ</button>
    </div>
  </section>`;
}

function renderRecords() {
  const rows = MODE_ORDER.map((id) => {
    const st = stats.modes[id];
    const rate = st.answered ? Math.round((st.correct / st.answered) * 100) + '%' : '—';
    return `<tr><th>${MODES[id].title}</th><td>${st.played}回</td><td>${st.answered}問</td><td>${st.correct}問</td><td>${rate}</td></tr>`;
  }).join('');
  const chips = BADGES.map((b) => `<span class="badge-chip ${b.test() ? '' : 'locked'}">${b.test() ? '🏅' : '・'} ${esc(b.label)}</span>`).join('');
  return `
  <div class="back-row"><button class="back-btn" data-action="home">← トップへ</button></div>
  <section class="records-card">
    <h2>学習の記録</h2>
    <table class="rec-table">
      <tr><th>モード</th><th>実施回数</th><th>解いた数</th><th>正解</th><th>正答率</th></tr>
      ${rows}
    </table>
    <p class="foot-note">通算正解 ${stats.totalCorrect}問 ・ とっくんで克服した問題 ${stats.tokkonClearedTotal}件 ・ 残っている まちがえた問題 ${mistakes.length}件</p>
    <h2 style="margin-top:18px">バッジ</h2>
    <div class="badge-grid">${chips}</div>
    <div class="result-actions">
      ${mistakes.length ? '<button class="big-btn" data-action="tokkon">とっくんに挑戦</button>' : ''}
      <button class="big-btn sub" data-action="home">トップへ</button>
    </div>
  </section>`;
}

// ================= イベント =================
root.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'home') { screen = 'home'; session = null; render(); }
  else if (a === 'sound') { settings.sound = !settings.sound; saveAll(); render(); }
  else if (a === 'start') { const m = el.dataset.mode; startSession(m, GENERATORS[m]()); }
  else if (a === 'tokkon') { if (mistakes.length) startSession('tokkon', shuffle(mistakes.slice())); }
  else if (a === 'records') { screen = 'records'; render(); }
  else if (a === 'choice') pickChoice(Number(el.dataset.i));
  else if (a === 'key') pressKey(el.dataset.k);
  else if (a === 'confirm') confirmInput();
  else if (a === 'next') nextQuestion();
  else if (a === 'again') {
    if (!session) return;
    if (session.mode === 'tokkon') { if (mistakes.length) startSession('tokkon', shuffle(mistakes.slice())); else { screen = 'home'; render(); } }
    else startSession(session.mode, GENERATORS[session.mode]());
  }
});

// ================= テスト用 API =================
window.__wariai = {
  screen: () => screen,
  mistakes: () => JSON.parse(JSON.stringify(mistakes)),
  stats: () => JSON.parse(JSON.stringify(stats)),
  settings: () => JSON.parse(JSON.stringify(settings)),
  session: () => session ? { mode: session.mode, idx: session.idx, total: session.list.length, phase: session.phase, stepIdx: session.stepIdx } : null,
  current: () => {
    if (!session) return null;
    return { mode: session.q.mode, key: session.q.key, phase: session.phase, qWrong: session.qWrong };
  },
  expected: () => {
    if (!session || session.phase !== 'steps') return null;
    const step = currentStep();
    if (!step) return null;
    if (step.type === 'choice') {
      return { type: 'choice', index: step.choices.findIndex((c) => c.ok), wrongIndexes: step.choices.map((c, i) => c.ok ? -1 : i).filter((i) => i >= 0) };
    }
    return { type: 'input', text: step.expectedText };
  }
};

render();
