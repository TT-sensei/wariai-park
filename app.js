'use strict';
/* 割合ステップ（小学5年・算数）
   - 割合＝比べる量÷もとにする量 を、二重数直線とステップ式で練習する。
   - 図の肝：もとにする量の位置に「1」を置く。矢印は双方向で、
     比べる量を求めるときは「1」から比べる量へ伸びる（ラベル「×割合」）、
     割合を求めるときは比べる量から「1」へ向かう（ラベル「÷もとにする量」）、
     もとにする量を求めるときは比べる量から「1」へ戻る（ラベル「÷割合」）。
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
  m5: { id: 'm5', title: 'くらべる', navi: 'nami', color: 'var(--m5)', desc: 'AとB、どちらの割合が大きいかな（5問）' },
  m6: { id: 'm6', title: '3つの用法ミックス', navi: 'saku', color: 'var(--m6, #6476b8)', desc: '何を求める問題か、自分で見分けて解こう（6問）' }
};
const MODE_ORDER = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];

// ================= 保存 =================
const LS_MISTAKES = 'wariaiPark.mistakes.v1';
const LS_STATS = 'wariaiPark.stats.v1';
const LS_SETTINGS = 'wariaiPark.settings.v1';
const LS_RECENT = 'wariaiPark.recent.v1';

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
if (!stats.modes || typeof stats.modes !== 'object' || Array.isArray(stats.modes)) stats.modes = {};
for (const m of MODE_ORDER) {
  if (!stats.modes[m]) stats.modes[m] = { played: 0, answered: 0, correct: 0, mastered: false };
  if (typeof stats.modes[m].mastered !== 'boolean') stats.modes[m].mastered = false;
  if (!Number.isFinite(stats.modes[m].played)) stats.modes[m].played = 0;
  if (!Number.isFinite(stats.modes[m].answered)) stats.modes[m].answered = 0;
  if (!Number.isFinite(stats.modes[m].correct)) stats.modes[m].correct = 0;
}
if (!Number.isFinite(stats.totalCorrect)) stats.totalCorrect = 0;
if (!Number.isFinite(stats.tokkonClearedTotal)) stats.tokkonClearedTotal = 0;
let settings = loadJSON(LS_SETTINGS, { sound: true });
if (typeof settings.sound !== 'boolean') settings.sound = true;
let recentQuestions = loadJSON(LS_RECENT, {});
if (!recentQuestions || typeof recentQuestions !== 'object' || Array.isArray(recentQuestions)) recentQuestions = {};
for (const m of MODE_ORDER) {
  if (!Array.isArray(recentQuestions[m])) recentQuestions[m] = [];
}

function saveAll() {
  saveJSON(LS_MISTAKES, mistakes);
  saveJSON(LS_STATS, stats);
  saveJSON(LS_SETTINGS, settings);
  saveJSON(LS_RECENT, recentQuestions);
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
   矢印はアニメーションで描かれる。arrow: 'mul'（「1」から比べる量へ・×割合）|
   'divBase'（比べる量から「1」へ・÷もとにする量）| 'divRate'（比べる量から「1」へ・÷割合）。
   割合>1 では矢印が「1」を越えて伸びる。
   hide: 'rate' | 'comp' | 'base' | null（解いている間、答えを隠す） */
function numLineSVG(o) {
  const compact = !!o.compact;
  const W = 560, H = compact ? 158 : 174;
  const L = 66, R = 538, span = R - L;
  const topY = compact ? 42 : 50;
  const botY = compact ? 108 : 126;
  const ratio = o.comp / o.base;
  const samePosition = Math.abs(ratio - 1) < 1e-9;
  const scaleMax = ratio > 1 ? ratio * 1.14 + 0.06 : 1.2;
  const X = (f) => L + (f / scaleMax) * span;
  const x0 = X(0), x1 = X(1), xr = X(ratio);
  const midY = (topY + botY) / 2;
  // 矢印は双方向。mul:「1」から比べる量へ。divBase / divRate: 比べる量から「1」へ。
  const arrowKind = o.arrow || 'mul';
  const aStart = arrowKind === 'mul' ? x1 : xr;
  const aEnd = arrowKind === 'mul' ? xr : x1;
  const mx = (aStart + aEnd) / 2;
  const hdir = aEnd >= aStart ? 1 : -1;
  const headPts = `${aEnd},${midY} ${aEnd - hdir * 11},${midY - 6} ${aEnd - hdir * 11},${midY + 6}`;
  const suppressRelation = !!o.suppressRelation;
  const rateBottom = o.hide === 'rate' ? '？' : decText(o.P);
  const compTop = o.hide === 'comp' ? '？' : (o.comp + o.unit);
  const baseTop = o.hide === 'base' ? '？' : (o.base + o.unit);
  const arrowLabel = arrowKind === 'divBase' ? '÷もとにする量'
    : arrowKind === 'divRate' ? (o.hide === 'rate' ? '÷？' : '÷' + decText(o.P))
    : (o.hide === 'rate' ? '×？' : '×' + decText(o.P));
  const labelW = [...arrowLabel].reduce((w, ch) => w + (ch.charCodeAt(0) > 0xFF ? 15.5 : 9.5), 0) + 18;
  let s = '';
  s += `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="二重数直線">`;
  // 割合1では同じ位置のガイドや目盛りを重ねない。
  s += `<line x1="${x0}" y1="${topY}" x2="${x0}" y2="${botY}" stroke="#d8e6e1" stroke-width="1.5" stroke-dasharray="3 4"/>`;
  s += `<line x1="${x1}" y1="${topY - 16}" x2="${x1}" y2="${botY}" stroke="#7fc4b8" stroke-width="1.5" stroke-dasharray="3 4"/>`;
  if (!suppressRelation && !samePosition) s += `<line x1="${xr}" y1="${topY}" x2="${xr}" y2="${botY}" stroke="#d8e6e1" stroke-width="1.5" stroke-dasharray="3 4"/>`;
  s += `<line x1="${L - 8}" y1="${topY}" x2="${R + 8}" y2="${topY}" stroke="#8a8172" stroke-width="2.5"/>`;
  s += `<line x1="${L - 8}" y1="${botY}" x2="${R + 8}" y2="${botY}" stroke="#8a8172" stroke-width="2.5"/>`;
  s += `<text x="8" y="${topY + 5}" font-size="13" fill="#8a8172" font-weight="700">量</text>`;
  s += `<text x="8" y="${botY + 5}" font-size="13" fill="#8a8172" font-weight="700">割合</text>`;
  const tick = (x) => `<line x1="${x}" y1="${topY - 5}" x2="${x}" y2="${topY + 5}" stroke="#8a8172" stroke-width="2"/><line x1="${x}" y1="${botY - 5}" x2="${x}" y2="${botY + 5}" stroke="#8a8172" stroke-width="2"/>`;
  s += tick(x0); s += tick(x1);
  if (!suppressRelation && !samePosition) s += tick(xr);
  s += `<text x="${x0}" y="${topY - 12}" font-size="13" fill="#8a8172" text-anchor="middle">0</text>`;
  if (samePosition && !suppressRelation) {
    s += `<text x="${x1}" y="${topY - 26}" font-size="11.5" fill="#0a6b5e" text-anchor="middle" font-weight="700">もとにする量・比べる量</text>`;
    s += `<text x="${x1}" y="${topY - 8}" font-size="15" fill="#33302b" text-anchor="middle" font-weight="800">${esc(baseTop)} ＝ ${esc(compTop)}</text>`;
  } else {
    s += `<text x="${x1}" y="${topY - 26}" font-size="11.5" fill="#0a6b5e" text-anchor="middle" font-weight="700">もとにする量</text>`;
    s += `<text x="${x1}" y="${topY - 10}" font-size="16.5" fill="#33302b" text-anchor="middle" font-weight="800">${esc(baseTop)}</text>`;
    if (!suppressRelation) s += `<text x="${xr}" y="${topY - 10}" font-size="16.5" fill="#0a6b5e" text-anchor="middle" font-weight="800">${esc(compTop)}</text>`;
  }
  s += `<text x="${x0}" y="${botY + 20}" font-size="13" fill="#8a8172" text-anchor="middle">0</text>`;
  s += `<circle cx="${x1}" cy="${botY + 14}" r="13.5" fill="#e2f4f0" stroke="#0e8a7a" stroke-width="2.5"/>`;
  s += `<text x="${x1}" y="${botY + 20}" font-size="17" fill="#0a6b5e" text-anchor="middle" font-weight="800">1</text>`;
  if (!suppressRelation && samePosition) {
    s += `<text x="${x1}" y="${botY + 39}" font-size="13" fill="#0a6b5e" text-anchor="middle" font-weight="700">100％</text>`;
  } else if (!suppressRelation) {
    s += `<text x="${xr}" y="${botY + 20}" font-size="16.5" fill="#0a6b5e" text-anchor="middle" font-weight="800">${esc(rateBottom)}</text>`;
  }
  if (!suppressRelation && !samePosition) {
    s += `<path class="nl-arrow-path" pathLength="100" d="M ${aStart} ${midY} Q ${mx} ${midY - 16} ${aEnd} ${midY}" fill="none" stroke="#0e8a7a" stroke-width="4" stroke-linecap="round"/>`;
    s += `<polygon class="nl-head" points="${headPts}" fill="#0e8a7a"/>`;
    s += `<g class="nl-pop"><rect x="${mx - labelW / 2}" y="${topY + 4}" width="${labelW}" height="24" rx="12" fill="#0e8a7a"/><text x="${mx}" y="${topY + 21}" font-size="15" fill="#ffffff" text-anchor="middle" font-weight="800">${esc(arrowLabel)}</text></g>`;
  }
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
  { base: 200, comp: 300, unit: '人', baseName: '去年の来場者数', compName: '今年の来場者数', text: 'お祭りの来場者は、去年は {B}人でした。今年は {C}人でした。今年の来場者数は、去年のどれだけの割合ですか。' },
  { base: 100, comp: 100, unit: 'kg', baseName: '去年の収穫量', compName: '今年の収穫量', text: '去年の米の収穫量は {B}kgでした。今年も {C}kgでした。今年の収穫量は、去年のどれだけの割合ですか。' }
];

M1_SMALL.push(
  { base: 36, comp: 27, unit: '人', baseName: '学年の人数', compName: '参加した人', text: '学年は {B}人です。そのうち {C}人が行事に参加しました。参加した人は、全体のどれだけの割合ですか。' },
  { base: 48, comp: 12, unit: 'こ', baseName: '箱の中のボールの数', compName: '赤いボールの数', text: '箱にはボールが {B}こ入っています。そのうち赤いボールは {C}こです。赤いボールは、全体のどれだけの割合ですか。' },
  { base: 75, comp: 45, unit: 'ページ', baseName: '本のページ数', compName: '読んだページ数', text: '{B}ページの本のうち、{C}ページを読みました。読んだページ数は、全体のどれだけの割合ですか。' },
  { base: 90, comp: 72, unit: '点', baseName: 'テストの満点', compName: '取れた点数', text: '{B}点満点のテストで、{C}点取れました。取れた点数は、満点のどれだけの割合ですか。' },
  { base: 160, comp: 120, unit: 'mL', baseName: '水そうの水の量', compName: '使った水の量', text: '水そうに水が {B}mLあります。そのうち {C}mL使いました。使った量は、全体のどれだけの割合ですか。' },
  { base: 40, comp: 16, unit: '本', baseName: 'シュートした本数', compName: '成功した本数', text: 'シュートを {B}本しました。そのうち {C}本成功しました。成功した割合はどれだけですか。' },
  { base: 72, comp: 54, unit: 'こ', baseName: '折り紙の枚数', compName: '使った枚数', text: '折り紙が {B}枚あります。そのうち {C}枚使いました。使った枚数は、全体のどれだけの割合ですか。' },
  { base: 240, comp: 180, unit: 'g', baseName: '材料の重さ', compName: '使った重さ', text: '材料が {B}gあります。そのうち {C}g使いました。使った重さは、全体のどれだけの割合ですか。' },
  { base: 35, comp: 21, unit: '人', baseName: 'グループの人数', compName: '係になった人', text: 'グループは {B}人です。そのうち {C}人が係になりました。係になった人は、全体のどれだけの割合ですか。' },
  { base: 60, comp: 15, unit: '分', baseName: '活動した時間', compName: '片付けに使った時間', text: '活動時間は {B}分です。そのうち {C}分を片付けに使いました。片付けの時間は、全体のどれだけの割合ですか。' },
  { base: 80, comp: 60, unit: 'さつ', baseName: '図書室の本の数', compName: '貸し出されている本の数', text: '図書室に本が {B}さつあります。そのうち {C}さつが貸し出されています。貸し出されている本は、全体のどれだけの割合ですか。' },
  { base: 40, comp: 34, unit: '本', baseName: '牛乳の本数', compName: '飲んだ本数', text: '給食の牛乳は {B}本あります。そのうち {C}本が飲まれました。飲まれた牛乳は、全体のどれだけの割合ですか。' },
  { base: 20, comp: 7, unit: '回', baseName: '投げた回数', compName: '当たった回数', text: '的当てで {B}回投げて、そのうち {C}回当たりました。当たった回数は、投げた回数のどれだけの割合ですか。' },
  { base: 5000, comp: 3500, unit: '円', baseName: '貯金の目標額', compName: '貯まった金額', text: '貯金の目標は {B}円です。今までに {C}円貯まりました。貯まった金額は、目標のどれだけの割合ですか。' },
  { base: 30, comp: 9, unit: '日', baseName: '1か月の日数', compName: '雨が降った日数', text: '1か月は {B}日ありました。そのうち雨が降ったのは {C}日でした。雨の日は、1か月のどれだけの割合ですか。' }
);
M1_BIG.push(
  { base: 60, comp: 90, unit: 'こ', baseName: '目標の数', compName: 'できた数', text: '工作の目標は {B}こです。実際には {C}こできました。できた数は、目標のどれだけの割合ですか。' },
  { base: 120, comp: 150, unit: 'kg', baseName: '去年の収穫量', compName: '今年の収穫量', text: '去年の収穫量は {B}kgでした。今年は {C}kgでした。今年の収穫量は、去年のどれだけの割合ですか。' },
  { base: 100, comp: 110, unit: 'cm', baseName: '先月の長さ', compName: '今月の長さ', text: '先月の長さは {B}cmでした。今月は {C}cmになりました。今月の長さは、先月のどれだけの割合ですか。' },
  { base: 80, comp: 120, unit: '人', baseName: '去年の来場者数', compName: '今年の来場者数', text: '去年の来場者は {B}人でした。今年は {C}人でした。今年の来場者数は、去年のどれだけの割合ですか。' },
  { base: 200, comp: 180, unit: 'ページ', baseName: '目標のページ数', compName: '読んだページ数', text: '読書の目標は {B}ページです。{C}ページ読みました。読んだページ数は、目標のどれだけの割合ですか。' },
  { base: 250, comp: 300, unit: '人', baseName: '去年の利用者数', compName: '今年の利用者数', text: 'プールの利用者は、去年は {B}人でした。今年は {C}人でした。今年の利用者数は、去年のどれだけの割合ですか。' },
  { base: 140, comp: 147, unit: 'cm', baseName: '去年の身長', compName: '今年の身長', text: '去年の身長は {B}cmでした。今年は {C}cmになりました。今年の身長は、去年のどれだけの割合ですか。' },
  { base: 8000, comp: 10000, unit: '歩', baseName: '1日の目標の歩数', compName: '歩いた歩数', text: '1日の目標は {B}歩です。今日は {C}歩、歩きました。歩いた歩数は、目標のどれだけの割合ですか。' },
  { base: 40, comp: 48, unit: '人', baseName: '定員', compName: '応募した人数', text: '委員会の定員は {B}人です。応募したのは {C}人でした。応募した人数は、定員のどれだけの割合ですか。' }
);

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
const M23_PS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 100, 110, 120, 125, 150, 175, 200];
const M23_SCENES = [
  {
    unit: '人',
    baseName: '去年の来場者', compName: '今年の来場者',
    m2: (b, r) => '去年のお祭りの来場者は ' + b + '人でした。今年は去年の ' + r + ' です。今年の来場者は何人ですか。',
    m3: (c, r) => '今年のお祭りの来場者は ' + c + '人で、去年の来場者数の ' + r + ' です。去年は何人でしたか。'
  },
  {
    unit: 'kg',
    baseName: '去年の収穫量', compName: '今年の収穫量',
    m2: (b, r) => '去年の米の収穫量は ' + b + 'kgでした。今年は去年の ' + r + ' です。今年の収穫量は何kgですか。',
    m3: (c, r) => '今年の米の収穫量は ' + c + 'kgで、去年の収穫量の ' + r + ' です。去年は何kgでしたか。'
  },
  {
    unit: 'こ',
    baseName: '工作の目標', compName: 'できた数',
    m2: (b, r) => '工作の目標は ' + b + 'こです。できた数は目標の ' + r + ' でした。できた数は何こですか。',
    m3: (c, r) => '工作で ' + c + 'こできました。これは目標の ' + r + ' です。目標は何こでしたか。'
  },
  {
    unit: '万円',
    baseName: '先月の売上', compName: '今月の売上',
    m2: (b, r) => '先月の売上は ' + b + '万円でした。今月は先月の ' + r + ' です。今月の売上は何万円ですか。',
    m3: (c, r) => '今月の売上は ' + c + '万円で、先月の売上の ' + r + ' です。先月は何万円でしたか。'
  },
  {
    unit: 'ページ',
    baseName: '先月に読んだページ数', compName: '今月に読んだページ数',
    m2: (b, r) => '先月に読んだページ数は ' + b + 'ページでした。今月は先月の ' + r + ' です。今月は何ページ読みましたか。',
    m3: (c, r) => '今月に読んだページ数は ' + c + 'ページで、先月の ' + r + ' です。先月は何ページ読みましたか。'
  },
  {
    unit: 'm',
    baseName: '道のり全体', compName: '進んだ道のり',
    m2: (b, r) => '道のりは全部で ' + b + 'mです。進んだ道のりは全体の ' + r + ' です。進んだ道のりは何mですか。',
    m3: (c, r) => '進んだ道のりは ' + c + 'mで、道のり全体の ' + r + ' です。道のり全体は何mですか。'
  },
  {
    unit: 'L',
    baseName: 'はじめに入っていた水', compName: '使った水',
    m2: (b, r) => 'タンクには水が ' + b + 'L入っています。そのうち全体の ' + r + ' にあたる量を使いました。使った水は何Lですか。',
    m3: (c, r) => '水を ' + c + 'L使いました。これはタンクにはじめに入っていた水の ' + r + ' です。はじめの水は何Lでしたか。'
  },
  {
    unit: '円',
    baseName: 'もとのねだん', compName: 'ねびき額',
    m2: (b, r) => '品物のもとのねだんは ' + b + '円です。ねびき額はもとのねだんの ' + r + ' です。ねびき額は何円ですか。',
    m3: (c, r) => 'ねびき額は ' + c + '円で、もとのねだんの ' + r + ' です。もとのねだんは何円ですか。'
  },
  {
    unit: '人',
    baseName: '答えた人全体', compName: '「はい」と答えた人',
    m2: (b, r) => 'アンケートに ' + b + '人が答えました。「はい」と答えた人は全体の ' + r + ' にあたります。「はい」は何人ですか。',
    m3: (c, r) => 'アンケートで「はい」と答えた人は ' + c + '人です。これは答えた人全体の ' + r + ' です。答えた人は何人ですか。'
  },
  {
    unit: 'kg',
    baseName: '荷物全体の重さ', compName: '運んだ荷物の重さ',
    m2: (b, r) => '荷物の重さは ' + b + 'kgです。運んだ重さは全体の ' + r + ' です。運んだ荷物は何kgですか。',
    m3: (c, r) => '運んだ荷物は ' + c + 'kgで、荷物全体の ' + r + ' です。荷物全体は何kgですか。'
  },
  {
    unit: '円',
    baseName: '貯金の目標額', compName: '貯まった金額',
    m2: (b, r) => '貯金の目標は ' + b + '円です。貯まった金額は目標の ' + r + ' です。貯まった金額は何円ですか。',
    m3: (c, r) => '貯まった金額は ' + c + '円で、貯金の目標額の ' + r + ' です。目標額は何円でしたか。'
  },
  {
    unit: '円',
    baseName: 'もとのねだん', compName: '割引後のねだん',
    m2: (b, r) => '品物のもとのねだんは ' + b + '円です。割引後のねだんは、もとのねだんの ' + r + ' です。割引後のねだんは何円ですか。',
    m3: (c, r) => '割引後のねだんは ' + c + '円で、もとのねだんの ' + r + ' です。もとのねだんは何円でしたか。'
  },
  {
    unit: 'さつ',
    baseName: '図書室の本全体', compName: '貸し出されている本',
    m2: (b, r) => '図書室には本が ' + b + 'さつあります。貸し出されている本は全体の ' + r + ' です。貸し出されている本は何さつですか。',
    m3: (c, r) => '貸し出されている本は ' + c + 'さつで、図書室の本全体の ' + r + ' です。本全体は何さつでしたか。'
  },
  {
    unit: '本',
    baseName: '牛乳全体の本数', compName: '飲まれた本数',
    m2: (b, r) => '給食の牛乳は ' + b + '本あります。飲まれた本数は全体の ' + r + ' です。飲まれた牛乳は何本ですか。',
    m3: (c, r) => '飲まれた牛乳は ' + c + '本で、牛乳全体の本数の ' + r + ' です。牛乳全体は何本でしたか。'
  },
  {
    unit: '回',
    baseName: '練習の目標回数', compName: 'できた回数',
    m2: (b, r) => 'なわとび練習の目標は ' + b + '回です。できた回数は目標の ' + r + ' でした。できた回数は何回ですか。',
    m3: (c, r) => 'なわとびで ' + c + '回できました。これは練習の目標回数の ' + r + ' です。目標は何回でしたか。'
  }
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
      mode: 'm2', key: 'm2-' + c.base + '-' + c.P,
      base: c.base, comp: c.comp, P: c.P, unit: sc.unit, rep, baseName: sc.baseName, compName: sc.compName,
      text: sc.m2(c.base, rep.text)
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
      mode: 'm3', key: 'm3-' + c.comp + '-' + c.P,
      base: c.base, comp: c.comp, P: c.P, unit: sc.unit, rep, baseName: sc.baseName, compName: sc.compName,
      text: sc.m3(c.comp, rep.text)
    };
  });
}
// ---- モード4：読み替え ----
function makeThreeChoices(correct, candidates) {
  const labels = [String(correct)];
  for (const candidate of candidates) {
    const value = String(candidate);
    if (!labels.includes(value)) labels.push(value);
    if (labels.length === 3) break;
  }
  if (labels.length !== 3) throw new Error('読み替え問題の選択肢を3つ作れませんでした。');
  return shuffle(labels.map((t, i) => ({ t, ok: i === 0 })));
}
function genM4() {
  const kinds = shuffle(['d2p', 'p2d', 'w2p', 'd2w', 'd2p', 'p2d', 'w2p', 'd2w']);
  const pools = {
    d2p: shuffle([35, 8, 100, 120, 45, 3, 65, 90, 125, 15, 25, 55, 75, 85, 105, 135, 150, 175, 200, 225, 250, 12, 18, 28]),
    p2d: shuffle([45, 100, 120, 6, 70, 35, 250, 90, 15, 25, 55, 75, 85, 105, 135, 150, 175, 200, 225, 12, 18, 28, 320, 5]),
    w2p: shuffle([35, 70, 5, 45, 100, 120, 25, 80, 15, 2, 8, 12, 18, 22, 33, 55, 65, 95, 105, 135, 150, 175, 200, 250]),
    d2w: shuffle([70, 45, 100, 120, 5, 35, 90, 25, 60, 2, 8, 12, 18, 22, 33, 55, 65, 95, 105, 135, 150, 175, 200, 250])
  };
  const used = { d2p: 0, p2d: 0, w2p: 0, d2w: 0 };
  return kinds.map((kind) => {
    const V = pools[kind][used[kind]++];
    let prompt, options, explain, hint;
    if (kind === 'd2p') {
      prompt = '小数 ' + decText(V) + ' は、何％ですか。';
      options = makeThreeChoices(V + '%', [(V * 10) + '%', Math.max(1, Math.round(V / 10)) + '%']);
      explain = decText(V) + ' は100分の' + V + '。だから ' + V + '% です。小数から％にするときは100倍します。';
      hint = '1は100％。小数を％に直すときは、100倍することを思い出そう。';
    } else if (kind === 'p2d') {
      prompt = V + '％ は、小数ではいくつですか。';
      options = makeThreeChoices(decText(V), [decText(V * 10), decText(Math.max(1, Math.round(V / 10)))]);
      explain = V + '% は100分の' + V + '。小数では ' + decText(V) + ' です。％から小数にするときは100で割ります。';
      hint = '％は「100分のいくつ」という意味。100で割って小数にしよう。';
    } else if (kind === 'w2p') {
      prompt = wariText(V) + ' は、何％ですか。';
      options = makeThreeChoices(V + '%', [(V + 10) + '%', Math.max(1, V - 10) + '%']);
      explain = '1割は10％、1分は1％です。だから ' + wariText(V) + ' は ' + V + '% です。';
      hint = '1割＝10％、1分＝1％。割と分を分けて考えよう。';
    } else {
      prompt = '小数 ' + decText(V) + ' は、歩合では何ですか。';
      options = makeThreeChoices(wariText(V), [wariText(V + 10), wariText(V > 10 ? V - 10 : V + 20)]);
      explain = decText(V) + ' は ' + V + '% です。10％が1割、1％が1分なので ' + wariText(V) + ' です。';
      hint = 'まず小数を％に直し、10％を1割、1％を1分として考えよう。';
    }
    return {
      mode: 'm4', key: 'm4-' + kind + '-' + V, kind, V,
      prompt, options, explain, hint
    };
  });
}
// ---- モード5：くらべる ----
const M5_BANK = [
  { id: 'juice', title: '砂糖水の こさ', askCount: '砂糖の重さが大きいのはどちらですか。', ask: '砂糖の割合が 大きいのは どちらですか。', baseName: '砂糖水全体の重さ', compName: '砂糖の重さ', aLabel: 'Aの砂糖水', bLabel: 'Bの砂糖水',
    A: { base: 200, comp: 40, unit: 'g', text: '水160gに さとう40g（全体200g）' }, B: { base: 250, comp: 75, unit: 'g', text: '水175gに さとう75g（全体250g）' }, bigger: 'B' },
  { id: 'shoot', title: 'シュートの 成功率', askCount: '成功した本数が多いのはどちらですか。', ask: '成功率が 高いのは どちらですか。', baseName: '投げた本数', compName: '成功した本数', aLabel: 'Aさん', bLabel: 'Bさん',
    A: { base: 20, comp: 12, unit: '本', text: '20本のうち 12本成功' }, B: { base: 25, comp: 10, unit: '本', text: '25本のうち 10本成功' }, bigger: 'A' },
  { id: 'discount', title: '割引率', askCount: '割引金額が大きいのはどちらですか。', ask: '割引率が 高いのは どちらですか。', baseName: 'もとのねだん', compName: '割引金額', aLabel: 'Aの店', bLabel: 'Bの店',
    A: { base: 1000, comp: 200, unit: '円', text: '1000円の品物が 200円引き' }, B: { base: 800, comp: 240, unit: '円', text: '800円の品物が 240円引き' }, bigger: 'B' },
  { id: 'book', title: '本の 読み進み', askCount: '読んだページ数が多いのはどちらですか。', ask: '読み進んだ割合が 大きいのは どちらですか。', baseName: '本全体のページ数', compName: '読んだページ数', aLabel: 'Aの本', bLabel: 'Bの本',
    A: { base: 150, comp: 90, unit: 'ページ', text: '150ページのうち 90ページ読んだ' }, B: { base: 200, comp: 100, unit: 'ページ', text: '200ページのうち 100ページ読んだ' }, bigger: 'A' },
  { id: 'kuji', title: 'くじの あたり率', askCount: '当たりくじの本数が多いのはどちらですか。', ask: 'あたり率が 高いのは どちらですか。', baseName: 'くじ全体の本数', compName: '当たりくじの本数', aLabel: 'Aのくじ', bLabel: 'Bのくじ',
    A: { base: 40, comp: 8, unit: '本', text: '40本のうち あたり8本' }, B: { base: 30, comp: 9, unit: '本', text: '30本のうち あたり9本' }, bigger: 'B' },
  { id: 'test', title: 'テストの 取れた割合', askCount: '取れた点数が多いのはどちらですか。', ask: '取れた割合が 大きいのは どちらですか。', baseName: 'テストの満点', compName: '取れた点数', aLabel: 'Aのテスト', bLabel: 'Bのテスト',
    A: { base: 50, comp: 40, unit: '点', text: '50点満点で 40点' }, B: { base: 40, comp: 28, unit: '点', text: '40点満点で 28点' }, bigger: 'A' },
  { id: 'attendance', title: '参加した割合', askCount: '参加した人数が多いのはどちらですか。', ask: '参加した割合が 大きいのは どちらですか。', baseName: '学年全体の人数', compName: '参加した人数', aLabel: 'Aの学年', bLabel: 'Bの学年',
    A: { base: 40, comp: 30, unit: '人', text: '40人のうち 30人が参加' }, B: { base: 30, comp: 24, unit: '人', text: '30人のうち 24人が参加' }, bigger: 'B' },
  { id: 'target', title: '目標の達成率', askCount: '作れた数が多いのはどちらですか。', ask: '目標に対する達成率が 高いのは どちらですか。', baseName: '目標の数', compName: '作れた数', aLabel: 'Aさん', bLabel: 'Bさん',
    A: { base: 40, comp: 36, unit: 'こ', text: '目標40こに対して 36こできた' }, B: { base: 50, comp: 40, unit: 'こ', text: '目標50こに対して 40こできた' }, bigger: 'A' },
  { id: 'sales', title: '売上ののび', askCount: '今年の売上金額が大きいのはどちらですか。', ask: '去年に対する今年の売上の割合が 大きいのは どちらですか。', baseName: '去年の売上', compName: '今年の売上', aLabel: 'A店', bLabel: 'B店',
    A: { base: 200, comp: 260, unit: '万円', text: '去年200万円、今年260万円' }, B: { base: 150, comp: 180, unit: '万円', text: '去年150万円、今年180万円' }, bigger: 'A' },
  { id: 'distance', title: '進んだ道のり', askCount: '進んだ道のりが長いのはどちらですか。', ask: '進んだ割合が大きいのはどちらですか。', baseName: '道のり全体の長さ', compName: '進んだ道のり', aLabel: 'Aさん', bLabel: 'Bさん',
    A: { base: 500, comp: 400, unit: 'm', text: '500mの道のりのうち 400m進んだ' }, B: { base: 1000, comp: 600, unit: 'm', text: '1000mの道のりのうち 600m進んだ' }, bigger: 'A' },
  { id: 'survey', title: 'アンケート', askCount: '「はい」と答えた人数が多いのはどちらですか。', ask: '「はい」と答えた割合が大きいのはどちらですか。', baseName: '答えた人全体の人数', compName: '「はい」と答えた人数', aLabel: 'Aグループ', bLabel: 'Bグループ',
    A: { base: 40, comp: 28, unit: '人', text: '40人のうち 28人が「はい」' }, B: { base: 60, comp: 36, unit: '人', text: '60人のうち 36人が「はい」' }, bigger: 'A' },
  { id: 'plants', title: '発芽した種', askCount: '芽が出た種が多いのはどちらですか。', ask: '芽が出た割合が大きいのはどちらですか。', baseName: '種全体の数', compName: '芽が出た種の数', aLabel: 'Aの箱', bLabel: 'Bの箱',
    A: { base: 80, comp: 40, unit: 'こ', text: '80このうち 40こに芽が出た' }, B: { base: 50, comp: 35, unit: 'こ', text: '50このうち 35こに芽が出た' }, bigger: 'B' },
  { id: 'classvote', title: '学級の投票', askCount: '賛成した人数が多いのはどちらですか。', ask: '賛成した割合が大きいのはどちらですか。', baseName: 'クラス全体の人数', compName: '賛成した人数', aLabel: 'Aクラス', bLabel: 'Bクラス',
    A: { base: 30, comp: 24, unit: '人', text: '30人のうち 24人が賛成' }, B: { base: 50, comp: 35, unit: '人', text: '50人のうち 35人が賛成' }, bigger: 'A' },
  { id: 'recycle', title: 'リサイクル', askCount: '集めたペットボトルが多いのはどちらですか。', ask: '集めた割合が大きいのはどちらですか。', baseName: 'ペットボトル全体の本数', compName: '回収した本数', aLabel: 'A地区', bLabel: 'B地区',
    A: { base: 40, comp: 30, unit: '本', text: '40本のうち 30本を回収' }, B: { base: 60, comp: 36, unit: '本', text: '60本のうち 36本を回収' }, bigger: 'A' },
  { id: 'water', title: '使った水の量', askCount: '使った水の量が多いのはどちらですか。', ask: '使った割合が大きいのはどちらですか。', baseName: 'タンクの水全体の量', compName: '使った水の量', aLabel: 'Aのタンク', bLabel: 'Bのタンク',
    A: { base: 200, comp: 100, unit: 'L', text: '200Lのうち 100Lを使った' }, B: { base: 150, comp: 90, unit: 'L', text: '150Lのうち 90Lを使った' }, bigger: 'B' },
  { id: 'reading', title: '本の読み進み', askCount: '読んだページ数が多いのはどちらですか。', ask: '読み進んだ割合が大きいのはどちらですか。', baseName: '本全体のページ数', compName: '読んだページ数', aLabel: 'Aの本', bLabel: 'Bの本',
    A: { base: 20, comp: 16, unit: 'ページ', text: '20ページのうち 16ページ読んだ' }, B: { base: 60, comp: 42, unit: 'ページ', text: '60ページのうち 42ページ読んだ' }, bigger: 'A' },
  { id: 'race', title: 'マラソンの道のり', askCount: '進んだ距離が長いのはどちらですか。', ask: '進んだ割合が大きいのはどちらですか。', baseName: 'コース全体の長さ', compName: '進んだ距離', aLabel: 'Aさん', bLabel: 'Bさん',
    A: { base: 400, comp: 320, unit: 'm', text: '400mのコースのうち 320m進んだ' }, B: { base: 1000, comp: 600, unit: 'm', text: '1000mのコースのうち 600m進んだ' }, bigger: 'A' },
  { id: 'library', title: '本の貸出率', askCount: '貸し出されている本が多いのはどちらですか。', ask: '貸し出されている割合が大きいのはどちらですか。', baseName: '本全体のさつ数', compName: '貸し出されている本のさつ数', aLabel: 'A学級の本棚', bLabel: 'B学級の本棚',
    A: { base: 80, comp: 56, unit: 'さつ', text: '80さつのうち 56さつ貸出中' }, B: { base: 50, comp: 40, unit: 'さつ', text: '50さつのうち 40さつ貸出中' }, bigger: 'B' },
  { id: 'milk', title: '牛乳を飲んだ割合', askCount: '飲んだ本数が多いのはどちらですか。', ask: '飲んだ割合が大きいのはどちらですか。', baseName: '牛乳全体の本数', compName: '飲んだ本数', aLabel: 'Aクラス', bLabel: 'Bクラス',
    A: { base: 40, comp: 36, unit: '本', text: '40本のうち 36本飲んだ' }, B: { base: 30, comp: 24, unit: '本', text: '30本のうち 24本飲んだ' }, bigger: 'A' },
  { id: 'mato', title: '的当ての命中率', askCount: '当たった回数が多いのはどちらですか。', ask: '当たった割合が大きいのはどちらですか。', baseName: '投げた回数', compName: '当たった回数', aLabel: 'Aさん', bLabel: 'Bさん',
    A: { base: 30, comp: 21, unit: '回', text: '30回投げて 21回当たった' }, B: { base: 20, comp: 16, unit: '回', text: '20回投げて 16回当たった' }, bigger: 'B' },
  { id: 'saving', title: '貯金の達成率', askCount: '貯まった金額が大きいのはどちらですか。', ask: '目標に対する達成率が高いのはどちらですか。', baseName: '貯金の目標額', compName: '貯まった金額', aLabel: 'Aさん', bLabel: 'Bさん',
    A: { base: 2000, comp: 1600, unit: '円', text: '目標2000円に対して 1600円貯まった' }, B: { base: 3000, comp: 2100, unit: '円', text: '目標3000円に対して 2100円貯まった' }, bigger: 'A' },
  { id: 'homework', title: '問題集の進み', askCount: '終わったページ数が多いのはどちらですか。', ask: '終わった割合が大きいのはどちらですか。', baseName: '問題集全体のページ数', compName: '終わったページ数', aLabel: 'Aさん', bLabel: 'Bさん',
    A: { base: 60, comp: 45, unit: 'ページ', text: '60ページのうち 45ページ終わった' }, B: { base: 40, comp: 32, unit: 'ページ', text: '40ページのうち 32ページ終わった' }, bigger: 'B' },
];
function genM5() {
  // 5問の中に「実際の数と割合で結果が逆になる場面」を必ず1問入れる
  const contrast = M5_BANK.filter((it) => {
    const countA = it.A.comp > it.B.comp;
    const rateA = it.A.comp * it.B.base > it.B.comp * it.A.base;
    return countA !== rateA;
  });
  const seed = contrast[Math.floor(Math.random() * contrast.length)];
  const chosen = [seed, ...shuffle(M5_BANK.filter((it) => it.id !== seed.id)).slice(0, 4)];
  return shuffle(chosen).map((it) => {
    const A = Object.assign({}, it.A, { P: (it.A.comp * 100) / it.A.base });
    const B = Object.assign({}, it.B, { P: (it.B.comp * 100) / it.B.base });
    return {
      mode: 'm5', key: 'm5-' + it.id, id: it.id, title: it.title,
      askCount: it.askCount, ask: it.ask, aLabel: it.aLabel, bLabel: it.bLabel, baseName: it.baseName, compName: it.compName,
      A, B, bigger: A.P > B.P ? 'A' : 'B',
      countBigger: A.comp > B.comp ? 'A' : 'B'
    };
  });
}
function genM6() {
  const asMix = (source, target) => Object.assign({}, source, {
    mode: 'm6', key: 'm6-' + target + '-' + source.key, target
  });
  return shuffle([
    ...genM1().slice(0, 2).map(q => asMix(q, 'rate')),
    ...genM2().slice(0, 2).map(q => asMix(q, 'comp')),
    ...genM3().slice(0, 2).map(q => asMix(q, 'base'))
  ]);
}
const GENERATORS = { m1: genM1, m2: genM2, m3: genM3, m4: genM4, m5: genM5, m6: genM6 };

function generateFresh(mode) {
  const recent = recentQuestions[mode] || [];
  const keepCounts = { m1: 18, m2: 30, m3: 30, m4: 32, m5: 10, m6: 24 };
  let bestList = null;
  let bestOverlap = Infinity;
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = GENERATORS[mode]();
    const overlap = candidate.reduce((n, q) => n + (recent.includes(q.key) ? 1 : 0), 0);
    if (overlap < bestOverlap) {
      bestList = candidate;
      bestOverlap = overlap;
    }
    if (overlap === 0) break;
  }
  if (!bestList) return GENERATORS[mode]();
  recentQuestions[mode] = Array.from(new Set([...bestList.map((q) => q.key), ...recent]))
    .slice(0, keepCounts[mode] || 24);
  saveJSON(LS_RECENT, recentQuestions);
  return bestList;
}

// ================= ステップ構築 =================
function choiceStep(prompt, pairs, hint) {
  return { type: 'choice', prompt, hint: hint || '',
    choices: shuffle(pairs.map((p) => ({ label: p[0], ok: !!p[1] }))), pickedWrong: [] };
}
function inputStep(prompt, expectedH, expectedText, hint) {
  return { type: 'input', prompt, hint: hint || '', expectedH, expectedText };
}
// 入口ステップ：「1とみる量（もとにする量）」を自分で選ぶ。
// 間違えたら、その場で理由のヒントを見て選び直せる（考えるためのステップ）。
function baseChoiceStep(q, opts) {
  const o = opts || {};
  const bLabel = o.nums ? `${q.baseName}（${q.base}${q.unit}）` : q.baseName;
  const cLabel = o.nums ? `${q.compName}（${q.comp}${q.unit}）` : q.compName;
  return choiceStep(o.prompt || 'まず、「1とみる量（もとにする量）」は、どちらかな？',
    [[bLabel, true], [cLabel, false]],
    o.hint || `「${q.compName}」は、「${q.baseName}」を基準にして考える量だよ。1とみるのは、基準になる「${q.baseName}」の方だね。`);
}
function baseChoiceStepM5(q, sideKey) {
  const side = q[sideKey];
  const lbl = sideKey === 'A' ? q.aLabel : q.bLabel;
  return choiceStep(`${lbl} の割合を考えるとき、「1とみる量」はどちらかな？`,
    [[`${q.baseName}（${side.base}${side.unit}）`, true], [`${q.compName}（${side.comp}${side.unit}）`, false]],
    `「${q.compName}」は、「${q.baseName}」の中でどれだけの割合かを考える量だよ。1とみるのは「${q.baseName}」の方だね。`);
}
function buildSteps(q) {
  if (q.mode === 'm1') {
    return [
      baseChoiceStep(q, { nums: true,
        prompt: 'まず、はじめに決めるのは「もとにする量」。1とみるのは、どちらかな？',
        hint: '問題文で「何と比べているか」を示す量が、もとにする量だよ。基準を探そう。' }),
      choiceStep('比べる量の印は、数直線の「1」の印と比べてどこにくるかな？',
        [['左側（0と1の間）', q.P < 100], ['同じ位置', q.P === 100], ['右側（1より大きい）', q.P > 100]],
        '下の数直線の「1」を基準に、比べる量の印の位置を予想しよう。'),
      choiceStep('割合を求める式は、どちらかな？',
        [[`${q.comp} ÷ ${q.base}`, true], [`${q.base} ÷ ${q.comp}`, false]],
        '「比べる量」を「もとにする量」で割る順番だよ。二重数直線の下の段も見てみよう。'),
      inputStep('割合を、小数で入力しよう。', q.P, decText(q.P),
        '割合は、もとにする量を1とみたときの大きさ。1より小さいか、大きいかも確かめよう。')
    ];
  }
  if (q.mode === 'm2') {
    const d = decText(q.P);
    return [
      ...(q.baseName ? [baseChoiceStep(q)] : []),
      choiceStep('比べる量の印は、数直線の「1」の印と比べてどこにくるかな？',
        [['左側（0と1の間）', q.P < 100], ['同じ位置', q.P === 100], ['右側（1より大きい）', q.P > 100]],
        '割合が1より小さいなら左側、1より大きいなら右側。図の「1」を基準にしよう。'),
      choiceStep('比べる量を求める式は、どれかな？',
        [[`${q.base} × ${d}`, true], [`${q.base} ÷ ${d}`, false], [`${d} ÷ ${q.base}`, false]],
        'もとにする量を1とみると、比べる量はその何倍かな。矢印の「×割合」に注目しよう。'),
      inputStep(`比べる量は、何${q.unit}ですか。`, q.comp * 100, String(q.comp),
        '割合をかけると、1より小さい割合ならもとの量より小さく、1より大きければ大きくなるよ。')
    ];
  }
  if (q.mode === 'm3') {
    const d = decText(q.P);
    return [
      ...(q.baseName ? [baseChoiceStep(q)] : []),
      choiceStep('もとにする量の印は、比べる量の印と比べてどこにくるかな？',
        [['左側', q.P > 100], ['同じ位置', q.P === 100], ['右側', q.P < 100]],
        'もとにする量は「1」の位置。比べる量の印と、左右の位置関係を考えよう。'),
      choiceStep('もとにする量を求める式は、どれかな？',
        [[`${q.comp} ÷ ${d}`, true], [`${q.comp} × ${d}`, false], [`${d} ÷ ${q.comp}`, false]],
        'もとにする量 × 割合 ＝ 比べる量。□をもとにする量にして、式を逆にたどろう。'),
      inputStep(`もとにする量は、何${q.unit}ですか。`, q.base * 100, String(q.base),
        '求めたいのは「1」にあたる量。比べる量を割合で割ると、もとにする量に戻れるよ。')
    ];
  }
  if (q.mode === 'm4') {
    return [{ type: 'choice', prompt: '', hint: q.hint, choices: q.options.map((o) => ({ label: o.t, ok: o.ok })), pickedWrong: [] }];
  }
  if (q.mode === 'm6') {
    const targetStep = choiceStep('この問題で、求めるものは何かな？',
      [['割合', q.target === 'rate'], ['比べる量', q.target === 'comp'], ['もとにする量', q.target === 'base']],
      '問題文の最後を読み、まだ分かっていない量に注目しよう。');
    const relationStep = choiceStep('比べる量の印は、数直線の「1」の印と比べてどこにくるかな？',
      [['左側（0と1の間）', q.P < 100], ['同じ位置', q.P === 100], ['右側（1より大きい）', q.P > 100]],
      '下の数直線の「1」を基準に、比べる量の印の位置を予想しよう。');
    const d = decText(q.P);
    let formulaPairs, answer, prompt, hint;
    if (q.target === 'rate') {
      formulaPairs = [[q.comp + ' ÷ ' + q.base, true], [q.base + ' ÷ ' + q.comp, false], [q.comp + ' × ' + q.base, false]];
      answer = q.P; prompt = '割合を小数で入力しよう。';
      hint = '割合は、比べる量をもとにする量で割って求めるよ。';
    } else if (q.target === 'comp') {
      formulaPairs = [[q.base + ' × ' + d, true], [q.base + ' ÷ ' + d, false], [d + ' ÷ ' + q.base, false]];
      answer = q.comp; prompt = '比べる量を' + q.unit + 'で入力しよう。';
      hint = 'もとにする量を1とみたときの何倍かが割合。もとにする量に割合をかけよう。';
    } else {
      formulaPairs = [[q.comp + ' ÷ ' + d, true], [q.comp + ' × ' + d, false], [d + ' ÷ ' + q.comp, false]];
      answer = q.base; prompt = 'もとにする量を' + q.unit + 'で入力しよう。';
      hint = 'もとにする量は1にあたる量。比べる量を割合で割って戻そう。';
    }
    const formulaStep = choiceStep('関係を式に表すと、どれかな？', formulaPairs, hint);
    const valueStep = inputStep(prompt, q.target === 'rate' ? q.P : answer * 100,
      q.target === 'rate' ? decText(q.P) : String(answer),
      '入力した答えを、もとの場面に戻して確かめよう。');
    const steps = q.baseName ? [baseChoiceStep(q)] : [];
    steps.push(targetStep, relationStep, formulaStep, valueStep);
    return steps;
  }
  // m5
  const rawCompare = choiceStep(q.askCount,
    [[q.aLabel, q.countBigger === 'A'], [q.bLabel, q.countBigger === 'B']],
    'まずは実際の数を比べるよ。このあと、もとにする量が違うときは割合でも比べてみよう。');
  const fA = choiceStep(`${q.aLabel} の割合を求める式は、どちらかな？`,
    [[`${q.A.comp} ÷ ${q.A.base}`, true], [`${q.A.base} ÷ ${q.A.comp}`, false]], 'まず、それぞれの「もとにする量」を見つけよう。分母にくる量を取り違えないでね。');
  const iA = inputStep(`${q.aLabel} の割合を、小数で入力しよう。`, q.A.P, decText(q.A.P),
    'もとにする量を1とみたときの大きさを、小数で表そう。1より大きいか小さいかも確かめてね。');
  const fB = choiceStep(`${q.bLabel} の割合を求める式は、どちらかな？`,
    [[`${q.B.comp} ÷ ${q.B.base}`, true], [`${q.B.base} ÷ ${q.B.comp}`, false]], 'Aと同じように「比べる量 ÷ もとにする量」。2つの式を同じ向きでそろえよう。');
  const iB = inputStep(`${q.bLabel} の割合を、小数で入力しよう。`, q.B.P, decText(q.B.P),
    'もとにする量を1とみたときの大きさを、小数で表そう。Aと同じ位取りでそろえてね。');
  const cmp = choiceStep(q.ask,
    [[q.aLabel, q.bigger === 'A'], [q.bLabel, q.bigger === 'B']],
    '同じ1を基準にそろえて、割合を比べよう。量そのものの大きさだけで決めないことがポイントだよ。');
  const steps = [rawCompare];
  if (q.baseName) steps.push(baseChoiceStepM5(q, 'A'));
  steps.push(fA, iA);
  if (q.baseName) steps.push(baseChoiceStepM5(q, 'B'));
  steps.push(fB, iB, cmp);
  return steps;
}

// ================= バッジ =================
const BADGES = [
  { id: 'clear-m1', label: 'わりあいマスター', test: () => stats.modes.m1.mastered },
  { id: 'clear-m2', label: 'くらべる量マスター', test: () => stats.modes.m2.mastered },
  { id: 'clear-m3', label: 'もとにする量マスター', test: () => stats.modes.m3.mastered },
  { id: 'clear-m4', label: 'よみかえマスター', test: () => stats.modes.m4.mastered },
  { id: 'clear-m5', label: 'くらべるマスター', test: () => stats.modes.m5.mastered },
  { id: 'clear-m6', label: '3つの用法マスター', test: () => stats.modes.m6.mastered },
  { id: 'clear-all', label: '全モードマスター', test: () => MODE_ORDER.every((m) => stats.modes[m].mastered) },
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
let advanceTimer = null;

function cancelAdvanceTimer() {
  if (advanceTimer !== null) clearTimeout(advanceTimer);
  advanceTimer = null;
  if (session) session.advancePending = false;
}
function scheduleAdvance() {
  if (!session || session.advancePending) return;
  session.advancePending = true;
  const targetSession = session;
  const targetIdx = session.idx;
  const targetStepIdx = session.stepIdx;
  advanceTimer = setTimeout(() => {
    advanceTimer = null;
    if (session !== targetSession || !session ||
        session.idx !== targetIdx || session.stepIdx !== targetStepIdx ||
        session.phase !== 'steps') return;
    session.advancePending = false;
    advanceStep();
  }, 620);
}

function startSession(mode, list) {
  cancelAdvanceTimer();
  // 旧バージョンで保存されたM5の誤答記録を、現在の比較データへ更新する
  if (mode === 'tokkon') {
    list = list.map((q) => {
      if (!q || q.mode !== 'm5' || !q.id) return q;
      const current = M5_BANK.find((item) => item.id === q.id);
      if (!current) return q;
      const A = Object.assign({}, current.A, { P: (current.A.comp * 100) / current.A.base });
      const B = Object.assign({}, current.B, { P: (current.B.comp * 100) / current.B.base });
      return Object.assign({}, q, {
        title: current.title, askCount: current.askCount, ask: current.ask,
        aLabel: current.aLabel, bLabel: current.bLabel, baseName: current.baseName, compName: current.compName, A, B,
        bigger: current.bigger,
        countBigger: current.A.comp > current.B.comp ? 'A' : 'B'
      });
    });
  }
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
    advancePending: false,
    correctCount: 0,
    clearedCount: 0,
    badgesBefore: earnedBadgeIds()
  };
  setupQuestion();
  screen = 'solve';
  playSound('start');
  render(true);
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
  cancelAdvanceTimer();
  session.miniMsg = null;
  session.inputStr = '';
  if (session.stepIdx + 1 >= session.steps.length) finishQuestion();
  else { session.stepIdx += 1; render(); }
}
function pickChoice(i) {
  if (!session || session.phase !== 'steps' || session.advancePending) return;
  const step = currentStep();
  if (!step || step.type !== 'choice') return;
  const c = step.choices[i];
  if (!c || step.pickedWrong.includes(i)) return;
  playSound('click');
  if (c.ok) {
    session.miniMsg = { kind: 'ok', text: 'せいかい！' };
    scheduleAdvance();
    render();
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
  if (!session || session.phase !== 'steps' || session.advancePending) return;
  const step = currentStep();
  if (!step || step.type !== 'input') return;
  if (!session.inputStr.trim()) {
    session.miniMsg = { kind: 'notice', text: 'まずは数字を入力してから、答え合わせをしよう。' };
    render();
    return;
  }
  playSound('decide');
  const v = parseInputHundredths(session.inputStr);
  if (v !== null && v === step.expectedH) {
    session.miniMsg = { kind: 'ok', text: 'せいかい！' };
    scheduleAdvance();
    render();
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
      const required = Math.ceil(session.list.length * 0.8);
      const passed = session.correctCount >= required;
      const st = stats.modes[session.mode];
      st.played += 1;
      st.mastered = st.mastered || passed;
      st.lastCorrect = session.correctCount;
      st.lastTotal = session.list.length;
      st.lastPassed = passed;
      session.requiredCorrect = required;
      session.passed = passed;
      saveAll();
    }
    screen = 'result';
    playSound('clear');
    render(true);
  } else {
    session.idx += 1;
    setupQuestion();
    render();
  }
}

// ================= 図と解説 =================
// モード（m6は求める量）ごとに、主役の矢印の向きを決める。
function arrowFor(q) {
  if (q.mode === 'm1') return 'divBase';
  if (q.mode === 'm3') return 'divRate';
  if (q.mode === 'm6') return q.target === 'rate' ? 'divBase' : q.target === 'base' ? 'divRate' : 'mul';
  return 'mul';
}
function figureFor(q, revealState) {
  if (q.mode === 'm4') return '';
  if (q.mode === 'm5') {
    const aDone = revealState === 2 || session.stepIdx >= (q.baseName ? 4 : 3);
    const bDone = revealState === 2 || session.stepIdx >= (q.baseName ? 7 : 5);
    return `<div class="fig-box fig-box-m5"><div class="fig-cap">${esc(q.aLabel)}</div>` +
      numLineSVG({ base: q.A.base, comp: q.A.comp, P: q.A.P, unit: q.A.unit, hide: aDone ? null : 'rate', suppressRelation: !aDone, compact: true, arrow: 'divBase' }) +
      `<div class="fig-cap">${esc(q.bLabel)}</div>` +
      numLineSVG({ base: q.B.base, comp: q.B.comp, P: q.B.P, unit: q.B.unit, hide: bDone ? null : 'rate', suppressRelation: !bDone, compact: true, arrow: 'divBase' }) +
      '</div>';
  }
  const hide = revealState === 2 ? null : (q.mode === 'm1' ? 'rate' : q.mode === 'm2' ? 'comp' : q.mode === 'm6' ? (q.target === 'rate' ? 'rate' : q.target === 'comp' ? 'comp' : 'base') : 'base');
  const suppressRelation = revealState === 0;
  return `<div class="fig-box">` + numLineSVG({ base: q.base, comp: q.comp, P: q.P, unit: q.unit, hide, suppressRelation, arrow: arrowFor(q) }) + '</div>';
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
  if (q.mode === 'm6') return '何を求める問題かを見きわめて、3つの関係を使い分けよう。';
  return 'AとB、それぞれ割合を出してから比べよう。';
}
function explainFor(q) {
  if (q.mode === 'm1') {
    const d = decText(q.P);
    return {
      main: '割合 ＝ 比べる量 ÷ もとにする量 だから、' + q.comp + ' ÷ ' + q.base + ' ＝ ' + d + ' です。％で表すと ' + q.P + '% です。',
      check: d + ' × ' + q.base + ' ＝ ' + q.comp + '（割合 × もとにする量 ＝ 比べる量）',
      concept: 'この問題では「' + q.baseName + '」を1とみたよ。その中の「' + q.compName + '」がどれだけにあたるかを考えたんだね。'
    };
  }
  if (q.mode === 'm2') {
    const d = decText(q.P);
    return {
      main: '比べる量 ＝ もとにする量 × 割合 だから、' + q.base + ' × ' + d + ' ＝ ' + q.comp + ' です。',
      check: q.comp + ' ÷ ' + q.base + ' ＝ ' + d + '（確かめ：比べる量 ÷ もとにする量 ＝ 割合）',
      concept: '割合は「もとにする量を1としたときの何倍か」。だから、もとにする量に割合をかけると比べる量になるよ。'
    };
  }
  if (q.mode === 'm3') {
    const d = decText(q.P);
    return {
      main: 'もとにする量 ＝ 比べる量 ÷ 割合 だから、' + q.comp + ' ÷ ' + d + ' ＝ ' + q.base + ' です。',
      check: d + ' × ' + q.base + ' ＝ ' + q.comp + '（割合 × もとにする量 ＝ 比べる量）',
      concept: 'もとにする量は「1」にあたる量。比べる量が分かっているときは、割合で割ると1にあたる量に戻れるよ。'
    };
  }
  if (q.mode === 'm4') {
    return {
      main: q.explain,
      check: '1 ＝ 100％ ＝ 10割 ／ 0.1 ＝ 10％ ＝ 1割 ／ 0.01 ＝ 1％ ＝ 1分',
      concept: '小数・百分率・歩合は、同じ割合を別の表し方にしたもの。1、0.1、0.01の関係をもとに考えよう。'
    };
  }
  if (q.mode === 'm6') {
    const d = decText(q.P);
    if (q.target === 'rate') return {
      main: '割合 ＝ 比べる量 ÷ もとにする量 だから、' + q.comp + ' ÷ ' + q.base + ' ＝ ' + d + ' です。',
      check: d + ' × ' + q.base + ' ＝ ' + q.comp,
      concept: 'もとにする量を1とみたとき、比べる量がどれだけにあたるかを求めたよ。'
    };
    if (q.target === 'comp') return {
      main: '比べる量 ＝ もとにする量 × 割合 だから、' + q.base + ' × ' + d + ' ＝ ' + q.comp + ' です。',
      check: q.comp + ' ÷ ' + q.base + ' ＝ ' + d,
      concept: 'もとにする量を1としたときの何倍かを使って、比べる量を求めたよ。'
    };
    return {
      main: 'もとにする量 ＝ 比べる量 ÷ 割合 だから、' + q.comp + ' ÷ ' + d + ' ＝ ' + q.base + ' です。',
      check: d + ' × ' + q.base + ' ＝ ' + q.comp,
      concept: '比べる量から、割合で割って「1」にあたるもとにする量へ戻ったよ。'
    };
  }
  const countWinner = q.countBigger === 'A' ? q.aLabel : q.bLabel;
  const rateWinner = q.bigger === 'A' ? q.aLabel : q.bLabel;
  return {
    main: '実際の数を比べると、' + countWinner + ' の方が多いね。一方、割合は ' + q.aLabel + ' が ' + decText(q.A.P) + '、' + q.bLabel + ' が ' + decText(q.B.P) + '。割合が大きいのは ' + rateWinner + ' です。',
    check: q.A.comp + ' と ' + q.B.comp + '（実際の数） ／ ' + decText(q.A.P) + ' と ' + decText(q.B.P) + '（割合）',
    concept: q.countBigger === q.bigger
      ? '実際の数と割合の両方で、同じ方が大きかったね。比べるものをはっきりさせることが大切だよ。'
      : '実際の数が多いことと、割合が大きいことは同じではないよ。もとにする量を1にそろえて比べる必要があるんだね。'
  };
}

// ================= 画面 =================
const root = document.getElementById('app');
function headerHTML() {
  return `<header class="app-header">
    <button class="app-brand" data-action="home" aria-label="トップへ">
      <span class="brand-mark">％</span>
      <span><strong>割合ステップ</strong><small>TT-sensei · 小学5年 算数</small></span>
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
function render(resetScroll = false) {
  if (screen === 'home') root.innerHTML = shell(renderHome());
  else if (screen === 'solve') root.innerHTML = shell(renderSolve());
  else if (screen === 'result') root.innerHTML = shell(renderResult());
  else if (screen === 'records') root.innerHTML = shell(renderRecords());
  if (resetScroll) window.scrollTo(0, 0);
}

function renderHome() {
  const m = mistakes.length;
  const cards = MODE_ORDER.map((id) => {
    const md = MODES[id];
    const nv = NAVI[md.navi];
    const done = stats.modes[id].mastered ? '　✓ マスター' : (stats.modes[id].played ? '　挑戦済み' : '');
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
      <p>もとにする量を「1」とみるのが、割合の考え方です。1へもどす矢印は わり算、1から引っ張る矢印は かけ算。二重数直線で確かめながら進もう。</p>
      <div class="hero-tags"><span>割合</span><span>百分率（％）</span><span>歩合</span><span>二重数直線</span></div>
    </div>
  </section>
  <section class="guide-card">
    <div class="guide-copy">
      <p class="guide-kicker">割合の見方</p>
      <h2>まず「もとにする量」を1とみよう</h2>
      <p>上の数直線は「量」、下の数直線は「割合」。もとにする量の真下が「1」だよ。</p>
      <p class="guide-rule">割合 ＝ 比べる量 ÷ もとにする量</p>
      <p class="guide-note">1より小さい割合も、1より大きい割合もあるよ。割合を出すときは「÷もとにする量」、比べる量を出すときは「×割合」の矢印に注目しよう。</p>
    </div>
    <div class="guide-example">
      <p class="guide-example-title">例：100人のうち40人</p>
      ${numLineSVG({ base: 100, comp: 40, P: 40, unit: '人', compact: true, arrow: 'divBase' })}
      <p class="guide-equation">40 ÷ 100 ＝ 0.4</p>
      <p class="guide-note">100人を1とみると、40人は0.4にあたるね。</p>
    </div>
  </section>
  <h2 class="section-title">れんしゅうを選ぼう</h2>
  <div class="mode-grid">${cards}</div>
  <p class="foot-note">同じモードに何度も挑戦できます。前に出た問題をできるだけ避けて、新しい問題を中心に出題します。</p>
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
  const inFeedback = session.phase === 'feedback';
  const progress = Math.round(((session.idx + (inFeedback ? 1 : 0)) / total) * 100);
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
      ${ex.concept ? `<div class="concept-note"><strong>考え方をふり返ろう</strong><p>${esc(ex.concept)}</p></div>` : ''}
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
      ${figureFor(q, inFeedback ? 2 : (q.mode !== 'm5' && session.stepIdx >= session.steps.length - 2 ? 1 : 0))}
      ${!inFeedback && step.prompt ? `<p class="step-q">${esc(step.prompt)}</p>` : ''}
    </article>
    <div class="side-panel">${side}</div>
  </div>`;
}
function miniMsgHTML() {
  if (!session || !session.miniMsg) return '';
  const step = session.phase === 'steps' ? currentStep() : null;
  const hint = session.miniMsg.kind === 'ng' && step && step.hint
    ? `<div class="hint-box"><strong>考え方のヒント</strong><p>${esc(step.hint)}</p></div>`
    : '';
  return `<p class="mini-msg ${session.miniMsg.kind}">${esc(session.miniMsg.text)}</p>${hint}`;
}

function renderResult() {
  const isTokkon = session.mode === 'tokkon';
  const md = isTokkon ? null : MODES[session.mode];
  const nv = NAVI[isTokkon ? 'saku' : md.navi];
  const total = session.list.length;
  const newBadges = earnedBadgeIds().filter((id) => !session.badgesBefore.includes(id))
    .map((id) => BADGES.find((b) => b.id === id));
  const required = session.requiredCorrect || Math.ceil(total * 0.8);
  const remaining = Math.max(0, required - session.correctCount);
  return `
  <section class="result-card">
    <img class="pose" src="${nv.full}" alt="${nv.name}">
    <p class="result-score">${total}問中 ${session.correctCount}問 最初から正解</p>
    <p class="result-sub">${isTokkon
      ? `${session.clearedCount}問 克服しました。${mistakes.length ? `のこりの まちがえた問題は ${mistakes.length}問 です。` : 'まちがえた問題は 全部 克服できました！'}`
      : session.passed
        ? `合格！ ${required}問以上、最初から正解できました。続けて別の問題にも挑戦しよう。`
        : `あと ${remaining}問、最初から正解できると合格だよ。まちがえた問題は「とっくん」で考え方を確かめよう。`}</p>
    ${newBadges.length ? `<div class="new-badges">${newBadges.map((b) => `<span class="badge-chip">🏅 ${esc(b.label)}</span>`).join('')}</div>` : ''}
    <p class="foot-note">次は前に出た問題をできるだけ避けて、新しい問題を中心に出題するよ。</p>
    <div class="result-actions">
      <button class="big-btn" data-action="again">新しい問題でもう一度</button>
      <button class="big-btn sub" data-action="home">トップへ</button>
    </div>
  </section>`;
}

function renderRecords() {
  const rows = MODE_ORDER.map((id) => {
    const st = stats.modes[id];
    const rate = st.answered ? Math.round((st.correct / st.answered) * 100) + '%' : '—';
    const status = st.mastered ? 'マスター' : st.played ? '挑戦済み' : 'これから';
    return `<tr><th>${MODES[id].title}</th><td>${st.played}回</td><td>${st.answered}問</td><td>${st.correct}問</td><td>${rate}</td><td>${status}</td></tr>`;
  }).join('');
  const chips = BADGES.map((b) => `<span class="badge-chip ${b.test() ? '' : 'locked'}">${b.test() ? '🏅' : '・'} ${esc(b.label)}</span>`).join('');
  return `
  <div class="back-row"><button class="back-btn" data-action="home">← トップへ</button></div>
  <section class="records-card">
    <h2>学習の記録</h2>
    <p class="foot-note">正答率は、まちがえずに最初から正解できた問題の割合です。</p>
    <table class="rec-table">
      <tr><th>モード</th><th>実施回数</th><th>解いた数</th><th>最初から正解</th><th>正答率</th><th>到達</th></tr>
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
  if (a === 'home') { cancelAdvanceTimer(); screen = 'home'; session = null; render(true); }
  else if (a === 'sound') { settings.sound = !settings.sound; saveAll(); render(); }
  else if (a === 'start') { const m = el.dataset.mode; startSession(m, generateFresh(m)); }
  else if (a === 'tokkon') { if (mistakes.length) startSession('tokkon', shuffle(mistakes.slice())); }
  else if (a === 'records') { screen = 'records'; render(true); }
  else if (a === 'choice') pickChoice(Number(el.dataset.i));
  else if (a === 'key') pressKey(el.dataset.k);
  else if (a === 'confirm') confirmInput();
  else if (a === 'next') nextQuestion();
  else if (a === 'again') {
    if (!session) return;
    if (session.mode === 'tokkon') { if (mistakes.length) startSession('tokkon', shuffle(mistakes.slice())); else { screen = 'home'; render(true); } }
    else startSession(session.mode, generateFresh(session.mode));
  }
});

// ================= テスト用 API =================
window.__wariai = {
  screen: () => screen,
  mistakes: () => JSON.parse(JSON.stringify(mistakes)),
  stats: () => JSON.parse(JSON.stringify(stats)),
  settings: () => JSON.parse(JSON.stringify(settings)),
  session: () => session ? { mode: session.mode, idx: session.idx, total: session.list.length, phase: session.phase, stepIdx: session.stepIdx, advancePending: !!session.advancePending } : null,
  recent: () => JSON.parse(JSON.stringify(recentQuestions)),
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

render(true);
