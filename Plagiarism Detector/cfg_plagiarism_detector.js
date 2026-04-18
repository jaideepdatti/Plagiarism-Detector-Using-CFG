// =========================================================
// ORIGINAL ENGINE — PRESERVED (No logic changes)
// =========================================================

// 1. TOKENIZER
const KEYWORDS = new Set(['if', 'else', 'while', 'for', 'return', 'int', 'float', 'var', 'let', 'const', 'true', 'false', 'null']);

function tokenize(src) {
  const tokens = [];
  let i = 0;
  src = src.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    if (/[0-9]/.test(src[i])) {
      let num = '';
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      tokens.push({ type: 'NUM', val: num }); continue;
    }
    if (/[a-zA-Z_]/.test(src[i])) {
      let id = '';
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) id += src[i++];
      tokens.push({ type: KEYWORDS.has(id) ? 'KW' : 'ID', val: id }); continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '++', '--'].includes(two)) { tokens.push({ type: 'OP', val: two }); i += 2; continue; }
    if ('+-*/%=<>!'.includes(src[i])) { tokens.push({ type: 'OP', val: src[i++] }); continue; }
    if (';,'.includes(src[i])) { tokens.push({ type: 'DELIM', val: src[i++] }); continue; }
    if ('(){}'.includes(src[i])) { tokens.push({ type: 'DELIM', val: src[i++] }); continue; }
    i++;
  }
  return tokens;
}

function normalize(tokens) {
  return tokens.map(t => {
    if (t.type === 'ID') return { type: 'NORM', val: 'ID' };
    if (t.type === 'NUM') return { type: 'NORM', val: 'NUM' };
    return t;
  });
}

// 2. CFG GRAMMAR DEFINITION
const CFG_RULES = [
  { lhs: 'program', rhs: 'stmt*' },
  { lhs: 'stmt', rhs: 'assign | ifStmt | whileStmt | block' },
  { lhs: 'assign', rhs: '<id> = expr ;' },
  { lhs: 'ifStmt', rhs: '<if> ( expr ) stmt [ <else> stmt ]' },
  { lhs: 'whileStmt', rhs: '<while> ( expr ) stmt' },
  { lhs: 'block', rhs: '{ stmt* }' },
  { lhs: 'expr', rhs: 'term ( op term )*' },
  { lhs: 'term', rhs: '<id> | <num> | ( expr )' },
  { lhs: 'op', rhs: '+ | - | * | / | < | > | == | != | <= | >=' },
];

// 3. RECURSIVE DESCENT PARSER → AST
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.trace = [];
  }
  peek() { return this.tokens[this.pos] || { type: 'EOF', val: '' }; }
  consume() { return this.tokens[this.pos++] || { type: 'EOF', val: '' }; }
  expect(type, val) {
    const t = this.peek();
    if (val ? (t.val === val) : (t.type === type)) return this.consume();
    return null;
  }
  log(rule, tok) { this.trace.push({ rule, token: tok ? tok.val : '—', action: `Matched ${rule}` }); }

  parseProgram() {
    const node = { type: 'program', children: [] };
    while (this.peek().type !== 'EOF') {
      const s = this.parseStmt();
      if (s) node.children.push(s);
      else { this.consume(); }
    }
    this.log('program', null);
    return node;
  }
  parseStmt() {
    const t = this.peek();
    if (t.type === 'KW' && t.val === 'if') return this.parseIf();
    if (t.type === 'KW' && t.val === 'while') return this.parseWhile();
    if (t.val === '{') return this.parseBlock();
    if (t.type === 'ID') return this.parseAssign();
    return null;
  }
  parseAssign() {
    const id = this.consume();
    const eq = this.expect('OP', '=');
    if (!eq) return { type: 'assign', children: [], label: `ID=?` };
    const expr = this.parseExpr();
    this.expect('DELIM', ';');
    this.log('assign', id);
    return { type: 'assign', children: [{ type: 'id', val: 'ID', children: [], label: 'ID' }, expr], label: 'assign' };
  }
  parseIf() {
    this.consume();
    this.expect('DELIM', '(');
    const cond = this.parseExpr();
    this.expect('DELIM', ')');
    const then = this.parseStmtOrBlock();
    const node = { type: 'ifStmt', children: [cond, then], label: 'if' };
    if (this.peek().val === 'else') {
      this.consume();
      node.children.push(this.parseStmtOrBlock());
      node.label = 'if-else';
    }
    this.log('ifStmt', null);
    return node;
  }
  parseWhile() {
    this.consume();
    this.expect('DELIM', '(');
    const cond = this.parseExpr();
    this.expect('DELIM', ')');
    const body = this.parseStmtOrBlock();
    this.log('whileStmt', null);
    return { type: 'whileStmt', children: [cond, body], label: 'while' };
  }
  parseBlock() {
    this.expect('DELIM', '{');
    const node = { type: 'block', children: [], label: 'block' };
    while (this.peek().type !== 'EOF' && this.peek().val !== '}') {
      const s = this.parseStmt();
      if (s) node.children.push(s);
      else this.consume();
    }
    this.expect('DELIM', '}');
    this.log('block', null);
    return node;
  }
  parseStmtOrBlock() {
    if (this.peek().val === '{') return this.parseBlock();
    return this.parseStmt() || { type: 'empty', children: [], label: 'ε' };
  }
  parseExpr() {
    const left = this.parseTerm();
    const ops = ['+', '-', '*', '/', '>', '<', '==', '!=', '<=', '>=', '&&', '||'];
    if (ops.includes(this.peek().val)) {
      const op = this.consume();
      const right = this.parseTerm();
      this.log('expr', op);
      return { type: 'expr', children: [left, { type: 'op', val: 'OP', children: [], label: op.val }, right], label: 'expr' };
    }
    return left;
  }
  parseTerm() {
    const t = this.peek();
    if (t.type === 'ID') { this.consume(); this.log('term(ID)', t); return { type: 'term', val: 'ID', children: [], label: 'ID' }; }
    if (t.type === 'NUM') { this.consume(); this.log('term(NUM)', t); return { type: 'term', val: 'NUM', children: [], label: 'NUM' }; }
    if (t.val === '(') {
      this.consume();
      const e = this.parseExpr();
      this.expect('DELIM', ')');
      return e;
    }
    this.consume();
    return { type: 'term', val: '?', children: [], label: '?' };
  }
}

// 4. TREE SERIALIZATION & EDIT DISTANCE
function treeToString(node) {
  if (!node) return '';
  const label = node.label || node.type;
  if (!node.children || node.children.length === 0) return label;
  return `${label}(${node.children.map(treeToString).join(',')})`;
}
function flattenTree(node, arr = []) {
  if (!node) return arr;
  arr.push(node.label || node.type);
  (node.children || []).forEach(c => flattenTree(c, arr));
  return arr;
}
function treeSize(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((s, c) => s + treeSize(c), 0);
}
function lcs(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
    else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
  }
  return dp[m][n];
}
function computeSimilarity(treeA, treeB, srcA, srcB) {
  const fa = flattenTree(treeA);
  const fb = flattenTree(treeB);
  const common = lcs(fa, fb);
  const editDist = fa.length + fb.length - 2 * common;
  const maxSize = Math.max(fa.length, fb.length, 1);
  let score = Math.max(0, 1 - editDist / maxSize);

  // 100% only when source code is completely identical
  // If structure is perfect but code differs, cap at 97%
  const exactMatch = (srcA && srcB) ? (srcA === srcB) : false;
  if (score === 1 && !exactMatch) {
    score = 0.97;
  }

  return { score, common, editDist, sizeA: fa.length, sizeB: fb.length, fa, fb };
}

// 5. AST DIFF VIEW
function buildAstLines(node, depth = 0, lines = []) {
  if (!node) return lines;
  const label = node.label || node.type;
  const indent = '  '.repeat(depth);
  lines.push({ label: indent + label, depth, node });
  (node.children || []).forEach(c => buildAstLines(c, depth + 1, lines));
  return lines;
}

// 6. SVG TREE RENDERER (enhanced with collapsible state)
let treeZoom = 1.0;
let collapsedNodes = new Set();

function renderTreeSVG(nodeA, nodeB, sharedLabels) {
  const nodeW = 64, nodeH = 28, vGap = 44;
  const nodesA = [], nodesB = [], edgesA = [], edgesB = [];

  function layout(node, x, y, nodes, edges, parent) {
    if (!node) return x;
    const id = nodes.length;
    const label = node.label || node.type;
    const nodeId = `n_${id}_${nodes === nodesA ? 'A' : 'B'}`;
    nodes.push({ id, x, y, label, nodeId, collapsed: collapsedNodes.has(nodeId) });
    if (parent !== null) edges.push([parent, id]);
    if (collapsedNodes.has(nodeId)) return x + nodeW + 10;
    const children = node.children || [];
    if (children.length === 0) return x + nodeW + 10;
    let cx = x;
    children.forEach(c => { cx = layout(c, cx, y + vGap, nodes, edges, id); });
    const first = nodes.find(n => n.id === id + 1);
    const last = nodes[nodes.length - 1];
    nodes[id].x = first ? (first.x + last.x) / 2 : x;
    return cx;
  }

  layout(nodeA, 10, 20, nodesA, edgesA, null);
  layout(nodeB, 10, 20, nodesB, edgesB, null);

  const shared = sharedLabels || new Set([
    ...nodesA.map(n => n.label)
  ].filter(l => nodesB.some(n => n.label === l)));

  function drawNodes(nodes, edges, offsetX) {
    let svg = '';
    edges.forEach(([p, c]) => {
      const pn = nodes[p], cn = nodes[c];
      if (!pn || !cn) return;
      svg += `<line x1="${(pn.x + offsetX + nodeW / 2) * treeZoom}" y1="${(pn.y + nodeH) * treeZoom}" x2="${(cn.x + offsetX + nodeW / 2) * treeZoom}" y2="${cn.y * treeZoom}" stroke="#C4B9A8" stroke-width="1.2"/>`;
    });
    nodes.forEach(n => {
      const inShared = shared.has(n.label);
      const fill = inShared ? '#E8F3E8' : '#F5E6E6';
      const stroke = inShared ? '#4A8B5C' : '#9B4A4A';
      const color = inShared ? '#2D6644' : '#9B3A3A';
      const nx = (n.x + offsetX) * treeZoom, ny = n.y * treeZoom;
      const w = nodeW * treeZoom, h = nodeH * treeZoom;
      const hasKids = !n.collapsed;
      svg += `<g class="tree-node-clickable" onclick="toggleNode('${n.nodeId}')">`;
      svg += `<rect x="${nx}" y="${ny}" width="${w}" height="${h}" rx="${4 * treeZoom}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
      if (n.collapsed) svg += `<rect x="${nx + w - 8}" y="${ny + 2}" width="6" height="6" rx="1" fill="${stroke}" opacity="0.8"/>`;
      svg += `<text x="${nx + w / 2}" y="${ny + h * 0.65}" text-anchor="middle" fill="${color}" font-size="${9 * treeZoom}" font-family="DM Mono">${n.label.slice(0, 10)}</text>`;
      svg += `</g>`;
    });
    return svg;
  }

  const maxH = Math.max(
    nodesA.reduce((m, n) => Math.max(m, n.y), 0),
    nodesB.reduce((m, n) => Math.max(m, n.y), 0)
  ) * treeZoom + nodeH * treeZoom + 20;
  const maxWA = (nodesA.reduce((m, n) => Math.max(m, n.x + nodeW), 0) + 20) * treeZoom;
  const maxWB = (nodesB.reduce((m, n) => Math.max(m, n.x + nodeW), 0) + 20) * treeZoom;
  const totalW = maxWA + maxWB + 40;
  const fs = 9 * treeZoom;

  let svg = `<svg viewBox="0 0 ${totalW} ${maxH}" xmlns="http://www.w3.org/2000/svg" style="background:#F8F3EB;border-radius:8px;min-width:${totalW}px;">`;
  svg += `<text x="10" y="${14 * treeZoom}" fill="#7A6F60" font-size="${fs}" font-family="Playfair Display" letter-spacing="2">SNIPPET A</text>`;
  svg += drawNodes(nodesA, edgesA, 0);
  svg += `<line x1="${maxWA + 10}" y1="0" x2="${maxWA + 10}" y2="${maxH}" stroke="#D4C9B5" stroke-width="1"/>`;
  svg += `<text x="${maxWA + 20}" y="${14 * treeZoom}" fill="#7A6F60" font-size="${fs}" font-family="Playfair Display" letter-spacing="2">SNIPPET B</text>`;
  svg += drawNodes(nodesB, edgesB, maxWA + 20);
  svg += `</svg>`;
  return svg;
}

// =========================================================
// NEW v2 — DFA TOKEN VALIDATOR
// =========================================================
// States: q0=start, q1=after_ID, q2=after_OP, q3=after_NUM, q4=after_KW, qDEAD=invalid
const DFA_STATES = ['q0', 'q1', 'q2', 'q3', 'q4', 'qDEAD'];
const DFA_TRANSITIONS = {
  //         KW      ID      NUM     OP      DELIM   EOF
  q0: { KW: 'q4', ID: 'q1', NUM: 'q3', OP: 'q2', DELIM: 'q0', EOF: 'q0' },
  q1: { KW: 'q4', ID: 'q1', NUM: 'q3', OP: 'q2', DELIM: 'q0', EOF: 'q0' },
  q2: { KW: 'q4', ID: 'q1', NUM: 'q3', OP: 'qDEAD', DELIM: 'q0', EOF: 'qDEAD' },
  q3: { KW: 'q4', ID: 'q1', NUM: 'q3', OP: 'q2', DELIM: 'q0', EOF: 'q0' },
  q4: { KW: 'q4', ID: 'q1', NUM: 'q3', OP: 'q2', DELIM: 'q0', EOF: 'q0' },
  qDEAD: { KW: 'qDEAD', ID: 'qDEAD', NUM: 'qDEAD', OP: 'qDEAD', DELIM: 'qDEAD', EOF: 'qDEAD' },
};
const DFA_ACCEPT = new Set(['q0', 'q1', 'q3', 'q4']);

function dfaValidate(tokens) {
  let state = 'q0';
  const path = [{ state, token: null }];
  let invalid = [];
  tokens.forEach((tok, i) => {
    const ttype = tok.type === 'NORM' ? 'ID' : tok.type;
    const next = (DFA_TRANSITIONS[state] || {})[ttype] || 'qDEAD';
    if (next === 'qDEAD') invalid.push({ idx: i, tok, from: state });
    state = next;
    path.push({ state, token: tok });
  });
  const accepted = DFA_ACCEPT.has(state);
  return { accepted, finalState: state, path, invalid };
}

// =========================================================
// NEW v2 — ENHANCED DETECTION
// =========================================================
function detectMatchTypes(tokA, tokB, treeA, treeB, result) {
  const reasons = [];
  const pct = Math.round(result.score * 100);

  // Exact match check (normalized token streams identical)
  const normA = normalize(tokA).map(t => t.val).join(',');
  const normB = normalize(tokB).map(t => t.val).join(',');
  if (normA === normB) {
    reasons.push({ type: 'exact', icon: '🔴', text: 'Exact structural match (after normalization)' });
  } else if (pct >= 70) {
    reasons.push({ type: 'renamed', icon: '🟡', text: `Variable renaming detected — structural identity ${pct}%` });
  }

  // Tree structure comparison
  const strA = treeToString(treeA), strB = treeToString(treeB);
  if (strA === strB) {
    reasons.push({ type: 'structural', icon: '🟢', text: 'Perfect parse tree equivalence (structural match)' });
  } else {
    const commonTypes = new Set(flattenTree(treeA).filter(n => flattenTree(treeB).includes(n)));
    if (commonTypes.size > 3) {
      reasons.push({ type: 'structural', icon: '🔵', text: `${commonTypes.size} common grammar constructs: ${[...commonTypes].slice(0, 4).join(', ')}` });
    }
  }

  // Reordering check
  const setA = new Set(flattenTree(treeA).filter(n => ['if', 'if-else', 'while', 'assign', 'block'].includes(n)));
  const setB = new Set(flattenTree(treeB).filter(n => ['if', 'if-else', 'while', 'assign', 'block'].includes(n)));
  const sameStmts = [...setA].every(s => setB.has(s)) && [...setB].every(s => setA.has(s));
  if (sameStmts && setA.size > 0 && strA !== strB) {
    reasons.push({ type: 'reorder', icon: '🔶', text: 'Same statement types — possible reordering of logic' });
  }

  if (reasons.length === 0 && pct > 0) {
    reasons.push({ type: 'partial', icon: '⬜', text: `Partial similarity ${pct}% — shared grammar patterns` });
  }

  return reasons;
}

// =========================================================
// NEW v2 — AMBIGUITY DETECTION
// =========================================================
function detectAmbiguity(src) {
  const ambiguities = [];
  const danglingElse = /if\s*\(.*\)\s*if\s*\(.*\)\s*[^{]*else/s.test(src);
  if (danglingElse) {
    ambiguities.push({
      rule: 'ifStmt',
      desc: 'Dangling Else Ambiguity',
      detail: 'The grammar allows "if(A) if(B) S else S2" to be parsed in two ways: else can attach to either if-statement.',
      trees: ['if(A) { if(B) S else S2 }', 'if(A) { if(B) S } else S2']
    });
  }
  const chainOp = /[a-zA-Z0-9_]+\s*[+\-\*\/]\s*[a-zA-Z0-9_]+\s*[+\-\*\/]\s*[a-zA-Z0-9_]+/.test(src);
  if (chainOp) {
    ambiguities.push({
      rule: 'expr',
      desc: 'Operator Associativity',
      detail: 'The grammar expr → term op term does not define associativity for chained operations (e.g. a+b+c).',
      trees: ['(a+b)+c', 'a+(b+c)']
    });
  }
  return ambiguities;
}

// =========================================================
// NEW v2 — MULTI-PANEL MANAGEMENT
// =========================================================
const PANEL_COLORS = ['#B8962E', '#9B3A3A', '#2D6644', '#5B4A8A', '#C68B2C'];
const PANEL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
let panels = [];
let panelCounter = 0;

function createPanelEl(idx) {
  const color = PANEL_COLORS[idx % PANEL_COLORS.length];
  const letter = PANEL_LETTERS[idx % PANEL_LETTERS.length];
  const id = 'panel_' + panelCounter++;
  const div = document.createElement('div');
  div.className = 'editor-panel';
  div.dataset.panelId = id;
  div.dataset.idx = idx;
  div.innerHTML = `
    <div class="panel-header">
      <div class="panel-title"><span class="panel-letter" style="color:${color}">${letter}</span> — Code Snippet ${letter}</div>
      <div class="panel-actions">
        <span class="line-count" id="lines_${id}">0 lines</span>
        ${idx >= 2 ? `<button class="btn-icon remove" onclick="removePanel('${id}')" title="Remove panel">✕</button>` : ''}
      </div>
    </div>
    <textarea id="ta_${id}" spellcheck="false" placeholder="// Paste or type code here\n// Supports: assignments, while, if/else, blocks"></textarea>
    <label class="drop-zone" for="file_${id}" id="drop_${id}">
      ⬆ Drop .txt/.js file or click to upload
      <input type="file" id="file_${id}" accept=".txt,.js,.py,.c,.cpp,.java">
    </label>
  `;
  // File input handler
  setTimeout(() => {
    const fileInput = div.querySelector(`#file_${id}`);
    const dropZone = div.querySelector(`#drop_${id}`);
    const ta = div.querySelector(`#ta_${id}`);
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => { ta.value = ev.target.result; updateLineCount(id); };
      reader.readAsText(file);
    });
    // Drag and drop
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => { ta.value = ev.target.result; updateLineCount(id); };
      reader.readAsText(file);
    });
    ta.addEventListener('input', () => updateLineCount(id));
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { e.preventDefault(); const s = this.selectionStart; this.value = this.value.slice(0, s) + '  ' + this.value.slice(this.selectionEnd); this.selectionStart = this.selectionEnd = s + 2; }
    });
  }, 0);
  return { el: div, id, letter, color };
}

function addPanel(src) {
  const idx = panels.length;
  if (idx >= 8) return; // max 8
  const p = createPanelEl(idx);
  panels.push(p);
  const scroll = document.getElementById('editorsScroll');
  scroll.insertBefore(p.el, document.getElementById('addPanelBtn'));
  if (src) document.getElementById('ta_' + p.id).value = src;
  updateLineCount(p.id);
  updateCountPrompt();
  if (idx >= 7) document.getElementById('addPanelBtn').style.display = 'none';
}

function removePanel(id) {
  const idx = panels.findIndex(p => p.id === id);
  if (idx < 0 || panels.length <= 2) return;
  panels[idx].el.remove();
  panels.splice(idx, 1);
  // Re-index
  panels.forEach((p, i) => {
    p.el.dataset.idx = i;
    p.letter = PANEL_LETTERS[i % PANEL_LETTERS.length];
    p.color = PANEL_COLORS[i % PANEL_COLORS.length];
  });
  document.getElementById('addPanelBtn').style.display = '';
  updateCountPrompt();
}

function updateLineCount(id) {
  const ta = document.getElementById('ta_' + id);
  const el = document.getElementById('lines_' + id);
  if (!ta || !el) return;
  const lines = (ta.value.match(/\n/g) || []).length + (ta.value ? 1 : 0);
  el.textContent = ta.value ? lines + ' lines' : '0 lines';
}

function updateCountPrompt() {
  const prompt = document.getElementById('countPrompt');
  prompt.classList.toggle('visible', panels.length > 2);
}

function getPanelValues() {
  return panels.map(p => document.getElementById('ta_' + p.id).value.trim());
}

// Initialize 2 default panels
addPanel();
addPanel();

// =========================================================
// NEW v2 — HISTORY
// =========================================================
let history = [];

function addHistory(codes, results) {
  const time = new Date().toLocaleTimeString();
  const entry = { time, codes: codes.map((c, i) => PANEL_LETTERS[i]).join('+'), results };
  history.unshift(entry);
  if (history.length > 10) history.pop();
  renderHistory();
}

function renderHistory() {
  const sec = document.getElementById('historySection');
  const list = document.getElementById('historyList');
  if (!history.length) { sec.classList.remove('has-items'); return; }
  sec.classList.add('has-items');
  list.innerHTML = history.map((h, hi) => {
    if (!h.results || !h.results.length) return '';
    const r = h.results[0];
    const pct = Math.round(r.score * 100);
    const cls = pct >= 70 ? 'high' : pct >= 40 ? 'med' : 'low';
    return `<div class="history-item" onclick="recallHistory(${hi})">
      <span class="h-time">${h.time}</span>
      <span class="h-codes">Codes: ${h.codes}</span>
      <span class="h-score ${cls}">${pct}%</span>
      <span style="color:var(--text-dim);font-size:10px;">${h.results.length} pair(s)</span>
    </div>`;
  }).join('');
}

function recallHistory(idx) {
  const h = history[idx];
  if (!h) return;
  const errEl = document.getElementById('errorMsg');
  errEl.textContent = `History: Run at ${h.time} — ${h.results.length} comparisons. Load codes and re-run to see full details.`;
  errEl.style.borderColor = 'rgba(184, 150, 46, 0.3)';
  errEl.style.color = 'var(--accent)';
  errEl.style.background = 'rgba(184, 150, 46, 0.05)';
  errEl.classList.add('visible');
  setTimeout(() => { errEl.classList.remove('visible'); errEl.style = ''; }, 3000);
}

function clearHistory() {
  history = [];
  renderHistory();
}

// =========================================================
// NEW v2 — TREE ZOOM & INTERACTION
// =========================================================
function zoomTree(delta) {
  treeZoom = Math.max(0.4, Math.min(2.0, treeZoom + delta));
  document.getElementById('zoomLabel').textContent = Math.round(treeZoom * 100) + '%';
  if (lastResult) displayTreeSVG(lastResult.treeA, lastResult.treeB);
}
function resetZoom() {
  treeZoom = 1.0;
  document.getElementById('zoomLabel').textContent = '100%';
  if (lastResult) displayTreeSVG(lastResult.treeA, lastResult.treeB);
}
function toggleNode(nodeId) {
  if (collapsedNodes.has(nodeId)) collapsedNodes.delete(nodeId);
  else collapsedNodes.add(nodeId);
  if (lastResult) displayTreeSVG(lastResult.treeA, lastResult.treeB);
}

// =========================================================
// DISPLAY FUNCTIONS (original + enhanced)
// =========================================================
function displayScore(result) {
  const pct = Math.round(result.score * 100);
  const circumference = 251.2;
  const offset = circumference - (pct / 100) * circumference;

  document.getElementById('scorePct').textContent = pct + '%';
  document.getElementById('statCommon').textContent = result.common;
  document.getElementById('statEdit').textContent = result.editDist;
  document.getElementById('statA').textContent = result.sizeA;
  document.getElementById('statB').textContent = result.sizeB;
  document.getElementById('statTokA').textContent = result.fa.length;
  document.getElementById('statTokB').textContent = result.fb.length;

  const dialFill = document.getElementById('dialFill');
  dialFill.style.strokeDashoffset = offset;
  const color = pct >= 70 ? '#9B3A3A' : pct >= 40 ? '#C68B2C' : '#2D6644';
  dialFill.style.stroke = color;

  const badge = document.getElementById('verdictBadge');
  const prog = document.getElementById('progFill');
  const progLabel = document.getElementById('progLabel');

  if (pct >= 70) {
    badge.textContent = '⚠ HIGH SIMILARITY'; badge.className = 'verdict-badge high';
  } else if (pct >= 40) {
    badge.textContent = '~ MODERATE'; badge.className = 'verdict-badge medium';
  } else {
    badge.textContent = '✓ LOW SIMILARITY'; badge.className = 'verdict-badge low';
  }
  prog.style.width = pct + '%'; prog.style.background = color;
  progLabel.textContent = pct + '%';
  document.getElementById('formulaText').textContent =
    `score = 1 − ${result.editDist} / max(${result.sizeA}, ${result.sizeB}) = ${(result.score).toFixed(3)}`;

  // Threshold cursor
  document.getElementById('thresholdCursor').style.left = pct + '%';
}

function displayMatchExplanation(reasons) {
  const el = document.getElementById('matchExplanation');
  if (!reasons.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = '<div style="color:var(--text-dim);margin-bottom:6px;font-size:10px;letter-spacing:1px;">WHY FLAGGED:</div>' +
    reasons.map(r => `<div class="why-item"><span class="why-icon">${r.icon}</span><span>${r.text}</span></div>`).join('');
}

function displayAstDiff(treeA, treeB, fa, fb) {
  const linesA = buildAstLines(treeA);
  const linesB = buildAstLines(treeB);
  function render(lines, sharedSet, side) {
    return lines.map((l, i) => {
      const label = l.label.trim();
      const cls = sharedSet.has(label) ? 'match' : 'diff';
      return `<div class="ast-node ${cls}" style="padding-left:${l.depth * 14 + 8}px" data-label="${label}" data-side="${side}">${l.label}</div>`;
    }).join('');
  }
  document.getElementById('astDiff').innerHTML = `
    <div class="ast-col">
      <div class="ast-col-header">Snippet A — Parse Tree</div>
      <div class="ast-tree">${render(linesA, new Set(fb), 'A')}</div>
    </div>
    <div class="ast-col">
      <div class="ast-col-header">Snippet B — Parse Tree</div>
      <div class="ast-tree">${render(linesB, new Set(fa), 'B')}</div>
    </div>`;
  // Highlight on click
  document.querySelectorAll('.ast-node').forEach(el => {
    el.addEventListener('click', function () {
      const lbl = this.dataset.label;
      document.querySelectorAll('.ast-node').forEach(n => n.classList.toggle('highlighted', n.dataset.label === lbl));
    });
  });
}

function displayTokens(tokA, tokB) {
  function renderStream(toks) {
    return toks.map(t => `<span class="token ${t.type}">${escHtml(t.val)}</span>`).join('');
  }
  document.getElementById('tokenDisplay').innerHTML = `
    <div class="token-section">
      <div class="token-section-label">Snippet A — Raw Token Stream (${tokA.length} tokens)</div>
      <div class="token-stream">${renderStream(tokA)}</div>
    </div>
    <div class="token-section">
      <div class="token-section-label">Snippet B — Raw Token Stream (${tokB.length} tokens)</div>
      <div class="token-stream">${renderStream(tokB)}</div>
    </div>
    <div class="token-section" style="margin-top:16px;">
      <div class="token-section-label">Normalization Legend</div>
      <div class="token-stream">
        <span class="token KW">keyword</span>
        <span class="token ID">identifier</span>
        <span class="token NUM">number</span>
        <span class="token OP">operator</span>
        <span class="token DELIM">delimiter</span>
        <span class="token NORM">NORM (abstracted)</span>
      </div>
    </div>`;
}

function displayGrammar() {
  const kws = ['if', 'else', 'while', 'for', 'return'];
  const metas = ['*', '|', '(', ')', '[', ']', '?'];
  function colorRhs(rhs) {
    return rhs.split(' ').map(w => {
      if (kws.includes(w)) return `<span class="kw">${w}</span>`;
      if (metas.includes(w)) return `<span class="meta">${w}</span>`;
      return w;
    }).join(' ');
  }
  let html = '<div class="grammar-list">' + CFG_RULES.map(r =>
    `<div class="grammar-rule">
      <span class="lhs">${r.lhs}</span>
      <span class="arrow">→</span>
      <span class="rhs">${colorRhs(r.rhs)}</span>
    </div>`
  ).join('') + '</div>';
  html += `<div class="grammar-ambiguity-note" style="margin-top:16px;">
    ⚠ Grammar Type: <strong>Type-2 Context-Free (Chomsky Hierarchy)</strong><br>
    Recognition by: <strong>Pushdown Automaton (PDA)</strong><br>
    Parser class: <strong>LL(1) — Recursive Descent</strong><br>
    Known sources of ambiguity: <strong>Dangling Else</strong>, chained operator expressions
  </div>`;
  document.getElementById('grammarDisplay').innerHTML = html;
}

function displayTrace(trace) {
  document.getElementById('traceDisplay').innerHTML = trace.slice(0, 80).map((t, i) =>
    `<div class="trace-step" style="animation-delay:${i * 8}ms">
      <span class="step-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="step-rule">${t.rule}</span>
      <span class="step-token">↦ ${t.token}</span>
      <span class="step-action">${t.action}</span>
    </div>`
  ).join('') + (trace.length > 80 ? `<div class="trace-step" style="color:var(--text-dim)">… ${trace.length - 80} more steps</div>` : '');
}

function displayTreeSVG(treeA, treeB) {
  document.getElementById('tree-svg').innerHTML = renderTreeSVG(treeA, treeB);
}

// =========================================================
// NEW v2 — DFA DISPLAY
// =========================================================
function displayDFA(dfaA, dfaB, tokA, tokB) {
  const stateColors = { q0: '#7A6F60', q1: '#2D6644', q2: '#9B3A3A', q3: '#C68B2C', q4: '#B8962E', qDEAD: '#C44D4D' };

  function renderDFAResult(dfa, label) {
    const statusCls = dfa.accepted ? 'ok' : 'fail';
    const statusText = dfa.accepted ? '✓ ACCEPTED' : '✗ REJECTED';
    let html = `<div style="margin-bottom:16px;">
      <div class="token-section-label">${label}</div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;font-family:var(--font-code);font-size:11px;">
        <span>Final State: <strong style="color:${stateColors[dfa.finalState]}">${dfa.finalState}</strong></span>
        <span class="dfa-status ${statusCls}">${statusText}</span>
      </div>`;
    if (dfa.invalid.length) {
      html += `<div style="background:rgba(155,58,58,0.06);border:1px solid rgba(155,58,58,0.2);border-radius:4px;padding:8px 12px;font-family:var(--font-code);font-size:10px;color:var(--accent2);margin-bottom:8px;">
        ⚠ ${dfa.invalid.length} potentially invalid transition(s): ${dfa.invalid.map(x => `'${x.tok.val}'`).join(', ')}
      </div>`;
    }
    // State path visualization
    html += `<div class="dfa-states">`;
    dfa.path.slice(0, 20).forEach((step, i) => {
      const isFinal = i === dfa.path.length - 1;
      html += `<span class="dfa-state ${isFinal ? (dfa.accepted ? 'accept' : 'reject') : ''}" style="border-color:${stateColors[step.state]};color:${stateColors[step.state]}">
        ${step.state}${step.token ? '<br><span style="color:#7A6F60;font-size:9px;">' + escHtml(step.token.val) + '</span>' : ''}
      </span>`;
    });
    if (dfa.path.length > 20) html += `<span class="dfa-state" style="border-style:dashed">…+${dfa.path.length - 20}</span>`;
    html += `</div></div>`;
    return html;
  }

  // Transition table
  const symbols = ['KW', 'ID', 'NUM', 'OP', 'DELIM'];
  let table = `<div style="margin-top:16px;"><div class="token-section-label">DFA Transition Table δ(q,a)</div>
    <table class="dfa-transition-table"><thead><tr><th>State</th>${symbols.map(s => `<th>${s}</th>`).join('')}</tr></thead><tbody>`;
  DFA_STATES.filter(s => s !== 'qDEAD').forEach(st => {
    table += `<tr><td style="color:${stateColors[st]};font-weight:700;">${st}${DFA_ACCEPT.has(st) ? '*' : ''}</td>`;
    symbols.forEach(sym => {
      const next = DFA_TRANSITIONS[st][sym];
      table += `<td style="color:${stateColors[next]}">${next}</td>`;
    });
    table += `</tr>`;
  });
  table += `</tbody></table><div style="font-family:var(--font-code);font-size:10px;color:var(--text-dim);margin-top:6px;">* = accept state</div></div>`;

  document.getElementById('dfaDisplay').innerHTML =
    renderDFAResult(dfaA, 'Snippet A — DFA Trace') +
    renderDFAResult(dfaB, 'Snippet B — DFA Trace') +
    table;
}

// =========================================================
// NEW v2 — AMBIGUITY DISPLAY
// =========================================================
function displayAmbiguity(srcA, srcB) {
  const ambA = detectAmbiguity(srcA);
  const ambB = detectAmbiguity(srcB);
  const all = [
    ...ambA.map(a => ({ ...a, src: 'Snippet A' })),
    ...ambB.map(a => ({ ...a, src: 'Snippet B' }))
  ];

  if (!all.length) {
    document.getElementById('ambiguityDisplay').innerHTML = `
      <div style="background:rgba(45,102,68,0.06);border:1px solid rgba(45,102,68,0.2);border-radius:6px;padding:14px 18px;font-family:var(--font-code);font-size:12px;color:var(--accent3);">
        ✓ No ambiguity detected in either code snippet for this grammar subset.
        <br><span style="color:var(--text-dim);font-size:10px;margin-top:4px;display:block;">Checked: Dangling Else, Operator Associativity chains, Multiple derivations</span>
      </div>`;
    return;
  }

  document.getElementById('ambiguityDisplay').innerHTML = `
    <div style="font-family:var(--font-code);font-size:11px;color:var(--text-dim);margin-bottom:12px;">
      ⚠ ${all.length} ambiguity source(s) detected. A grammar is ambiguous if a string has multiple leftmost derivations (multiple parse trees).
    </div>` +
    all.map(a => `
      <div style="background:rgba(198,139,44,0.06);border:1px solid rgba(198,139,44,0.2);border-radius:6px;padding:14px 18px;margin-bottom:10px;">
        <div style="color:var(--amber);font-weight:700;font-family:var(--font-code);font-size:12px;">${a.src} — ${a.desc}</div>
        <div style="color:var(--text-dim);font-family:var(--font-code);font-size:11px;margin-top:6px;">Rule: <span style="color:var(--accent)">${a.rule}</span></div>
        <div style="color:var(--text);font-family:var(--font-code);font-size:11px;margin-top:4px;">${a.detail}</div>
        <div style="display:flex;gap:12px;margin-top:10px;">
          ${a.trees.map(t => `<div style="background:var(--surface3);border-radius:4px;padding:6px 10px;font-family:var(--font-code);font-size:11px;color:var(--accent3);">Parse 1: ${escHtml(t)}</div>`).join('')}
        </div>
      </div>`
    ).join('');
}

// =========================================================
// NEW v2 — SIMILARITY MATRIX
// =========================================================
function displayMatrix(codes, labels, colors, allParsed) {
  const n = codes.length;
  let pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const result = computeSimilarity(allParsed[i].tree, allParsed[j].tree, allParsed[i].src, allParsed[j].src);
      pairs.push({ i, j, result, pct: Math.round(result.score * 100) });
    }
  }

  // Build matrix
  let html = `<table class="matrix-table"><thead><tr><th></th>`;
  labels.forEach((l, i) => { html += `<th style="color:${colors[i]}">${l}</th>`; });
  html += `</tr></thead><tbody>`;
  for (let i = 0; i < n; i++) {
    html += `<tr><th style="color:${colors[i]}">${labels[i]}</th>`;
    for (let j = 0; j < n; j++) {
      if (i === j) { html += `<td class="self">—</td>`; continue; }
      const pair = pairs.find(p => (p.i === i && p.j === j) || (p.i === j && p.j === i));
      if (!pair) { html += `<td>?</td>`; continue; }
      const pct = pair.pct;
      const cls = pct >= 70 ? 'high-sim' : pct >= 40 ? 'med-sim' : 'low-sim';
      html += `<td class="${cls}" onclick="showMatrixPair(${pair.i},${pair.j})" title="Click for details">${pct}%</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  document.getElementById('matrixTable').innerHTML = html;
  document.getElementById('matrixSection').classList.add('visible');

  // Store pairs for click-through
  window._matrixPairs = pairs;
  window._matrixParsed = allParsed;
  window._matrixLabels = labels;
}

function showMatrixPair(i, j) {
  const pairs = window._matrixPairs || [];
  const pair = pairs.find(p => (p.i === i && p.j === j) || (p.i === j && p.j === i));
  if (!pair) return;
  const labels = window._matrixLabels || [];
  const pct = pair.pct;
  const cls = pct >= 70 ? 'high' : pct >= 40 ? 'med' : 'low';
  const clsLabel = pct >= 70 ? '⚠ HIGH' : pct >= 40 ? '~ MODERATE' : '✓ LOW';
  const detail = document.getElementById('matrixPairDetail');
  detail.innerHTML = `
    <strong style="color:var(--accent)">${labels[pair.i]} vs ${labels[pair.j]}</strong>
    &nbsp;—&nbsp; Similarity: <strong>${pct}%</strong>
    &nbsp;<span style="color:${pct >= 70 ? 'var(--accent2)' : pct >= 40 ? 'var(--amber)' : 'var(--accent3)'}">${clsLabel}</span>
    &nbsp;|&nbsp; Common nodes: <strong>${pair.result.common}</strong>
    &nbsp;|&nbsp; Edit distance: <strong>${pair.result.editDist}</strong>
    &nbsp;|&nbsp; Tree sizes: <strong>${pair.result.sizeA}</strong> vs <strong>${pair.result.sizeB}</strong>
  `;
  detail.classList.add('visible');
}

// =========================================================
// MAIN ANALYSIS (extended)
// =========================================================
let lastResult = null;

function runAnalysis() {
  const codes = getPanelValues();
  const errEl = document.getElementById('errorMsg');
  errEl.classList.remove('visible');
  errEl.style = '';

  const nonEmpty = codes.filter(c => c.length > 0);
  if (nonEmpty.length < 2) {
    errEl.textContent = 'Please enter code in at least 2 panels before analyzing.';
    errEl.classList.add('visible'); return;
  }

  // Show loading
  const bar = document.getElementById('loadingBar');
  const fill = document.getElementById('loadingFill');
  bar.classList.add('active');
  let pct = 0;
  const timer = setInterval(() => { pct = Math.min(pct + 10, 90); fill.style.width = pct + '%'; }, 60);

  setTimeout(() => {
    try {
      const useDFA = document.getElementById('dfaToggle').checked;
      const allParsed = nonEmpty.map((src, idx) => {
        const tok = tokenize(src);
        const norm = normalize(tok);
        const parser = new Parser([...norm]);
        const tree = parser.parseProgram();
        const dfa = useDFA ? dfaValidate(tok) : null;
        return { src, tok, norm, tree, trace: parser.trace, dfa, label: PANEL_LETTERS[idx], color: PANEL_COLORS[idx] };
      });

      clearInterval(timer);
      fill.style.width = '100%';
      setTimeout(() => { bar.classList.remove('active'); fill.style.width = '0%'; }, 400);

      const labels = allParsed.map(p => p.label);
      const colors = allParsed.map(p => p.color);

      if (nonEmpty.length === 2) {
        // Original 2-code flow + enhanced
        const pA = allParsed[0], pB = allParsed[1];
        const result = computeSimilarity(pA.tree, pB.tree, pA.src, pB.src);
        const reasons = detectMatchTypes(pA.tok, pB.tok, pA.tree, pB.tree, result);

        lastResult = {
          treeA: pA.tree, treeB: pB.tree, tokA: pA.tok, tokB: pB.tok, result,
          traceA: pA.trace, traceB: pB.trace, dfaA: pA.dfa, dfaB: pB.dfa,
          srcA: pA.src, srcB: pB.src
        };

        displayScore(result);
        displayMatchExplanation(reasons);
        displayAstDiff(pA.tree, pB.tree, result.fa, result.fb);
        displayTokens(pA.tok, pB.tok);
        displayGrammar();
        displayTrace([...pA.trace, ...pB.trace]);
        displayTreeSVG(pA.tree, pB.tree);
        if (useDFA && pA.dfa && pB.dfa) displayDFA(pA.dfa, pB.dfa, pA.tok, pB.tok);
        displayAmbiguity(pA.src, pB.src);

        document.getElementById('scoreSection').classList.add('visible');
        document.getElementById('matrixSection').classList.remove('visible');
        document.getElementById('resultsPanel').classList.add('visible');
        switchTab('ast');

        addHistory(nonEmpty, [result]);

      } else {
        // Multi-code: matrix mode
        displayMatrix(nonEmpty, labels, colors, allParsed);
        document.getElementById('scoreSection').classList.remove('visible');
        document.getElementById('resultsPanel').classList.add('visible');

        // Show first pair in results tabs
        const pA = allParsed[0], pB = allParsed[1];
        const result = computeSimilarity(pA.tree, pB.tree, pA.src, pB.src);
        lastResult = {
          treeA: pA.tree, treeB: pB.tree, tokA: pA.tok, tokB: pB.tok, result,
          traceA: pA.trace, traceB: pB.trace, dfaA: pA.dfa, dfaB: pB.dfa,
          srcA: pA.src, srcB: pB.src
        };

        displayAstDiff(pA.tree, pB.tree, result.fa, result.fb);
        displayTokens(pA.tok, pB.tok);
        displayGrammar();
        displayTrace([...pA.trace, ...pB.trace]);
        displayTreeSVG(pA.tree, pB.tree);
        if (useDFA && pA.dfa && pB.dfa) displayDFA(pA.dfa, pB.dfa, pA.tok, pB.tok);
        displayAmbiguity(pA.src, pB.src);
        switchTab('ast');

        const allResults = [];
        for (let i = 0; i < allParsed.length; i++) for (let j = i + 1; j < allParsed.length; j++) {
          allResults.push(computeSimilarity(allParsed[i].tree, allParsed[j].tree, allParsed[i].src, allParsed[j].src));
        }
        addHistory(nonEmpty, allResults);
      }

      // DFA status indicator
      if (useDFA && allParsed[0].dfa) {
        const ok = allParsed.every(p => p.dfa && p.dfa.accepted);
        const statusEl = document.getElementById('dfaStatus');
        statusEl.className = 'dfa-status ' + (ok ? 'ok' : 'fail');
        statusEl.textContent = ok ? '✓ All tokens validated by DFA' : '⚠ DFA found suspicious token sequences';
      }

    } catch (e) {
      clearInterval(timer);
      bar.classList.remove('active');
      errEl.textContent = 'Parse error: ' + e.message;
      errEl.classList.add('visible');
    }
  }, 600);
}

// =========================================================
// DEMOS
// =========================================================
function loadDemo(type) {
  const highA = `x = 10;\ny = 20;\nif (x < y) {\n  result = y - x;\n} else {\n  result = x - y;\n}\nwhile (result > 0) {\n  result = result - 1;\n}`;
  const highB = `a = 100;\nb = 200;\nif (a < b) {\n  diff = b - a;\n} else {\n  diff = a - b;\n}\nwhile (diff > 0) {\n  diff = diff - 1;\n}`;
  const lowA = `x = 5;\ny = x + 3;\nwhile (y > 0) {\n  y = y - 1;\n}`;
  const lowB = `if (score < 100) {\n  bonus = score + 50;\n  total = bonus * 2;\n} else {\n  total = 0;\n}`;
  const multiC = `n = 10;\nsum = 0;\nwhile (n > 0) {\n  sum = sum + n;\n  n = n - 1;\n}`;

  if (type === 'high') {
    document.getElementById('ta_' + panels[0].id).value = highA;
    document.getElementById('ta_' + panels[1].id).value = highB;
  } else if (type === 'low') {
    document.getElementById('ta_' + panels[0].id).value = lowA;
    document.getElementById('ta_' + panels[1].id).value = lowB;
  } else if (type === 'multi') {
    document.getElementById('ta_' + panels[0].id).value = highA;
    document.getElementById('ta_' + panels[1].id).value = highB;
    if (panels.length < 3) addPanel();
    document.getElementById('ta_' + panels[2].id).value = multiC;
  }
  panels.forEach(p => updateLineCount(p.id));
}

function clearAll() {
  panels.forEach(p => {
    const ta = document.getElementById('ta_' + p.id);
    if (ta) ta.value = '';
    updateLineCount(p.id);
  });
  document.getElementById('scoreSection').classList.remove('visible');
  document.getElementById('matrixSection').classList.remove('visible');
  document.getElementById('resultsPanel').classList.remove('visible');
  document.getElementById('errorMsg').classList.remove('visible');
  document.getElementById('matchExplanation').style.display = 'none';
}

// =========================================================
// EXPORT
// =========================================================
function exportJSON() {
  if (!lastResult) { alert('Run analysis first.'); return; }
  const data = {
    timestamp: new Date().toISOString(),
    similarity: Math.round(lastResult.result.score * 100) + '%',
    score: lastResult.result.score,
    common_nodes: lastResult.result.common,
    edit_distance: lastResult.result.editDist,
    tree_size_A: lastResult.result.sizeA,
    tree_size_B: lastResult.result.sizeB,
    tokens_A: lastResult.tokA.length,
    tokens_B: lastResult.tokB.length,
    treeA_string: treeToString(lastResult.treeA),
    treeB_string: treeToString(lastResult.treeB),
    dfa_A: lastResult.dfaA ? { accepted: lastResult.dfaA.accepted, finalState: lastResult.dfaA.finalState } : null,
    dfa_B: lastResult.dfaB ? { accepted: lastResult.dfaB.accepted, finalState: lastResult.dfaB.finalState } : null,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'plagiarism_results.json'; a.click();
  URL.revokeObjectURL(url);
}

function exportPDF() {
  window.print();
}

// =========================================================
// TABS & UTILS
// =========================================================
function switchTab(name) {
  const names = ['ast', 'tokens', 'grammar', 'trace', 'tree', 'dfa', 'ambiguity'];
  document.querySelectorAll('.tab').forEach((t, i) => { t.classList.toggle('active', names[i] === name); });
  document.querySelectorAll('.tab-content').forEach(c => { c.classList.toggle('active', c.id === 'tab-' + name); });
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// DFA toggle handler
document.getElementById('dfaToggle').addEventListener('change', function () {
  document.getElementById('dfaStatus').textContent = this.checked
    ? 'Enabled — tokens validated before parsing'
    : 'Disabled — skipping DFA validation';
  document.getElementById('dfaStatus').className = 'dfa-status';
});
