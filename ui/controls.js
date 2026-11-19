import { TABS, PALETTES } from './schema.js';
import { DEFAULTS } from '../engine/state.js';
import { VARIATIONS } from '../engine/glsl.js';
import { PRESETS } from '../engine/presets.js';

const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fmt = (v, step) => { const d = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 4; return Number(v).toFixed(d); };

// Builds the sidebar. api: {changed(key), loadPreset(i), openExport(), pickImage(), setImgMode(m), saveFile(), loadFile()}
export function buildUI(root, S, api) {
  const rows = [];            // {node, when, sync}
  const tabsBar = el('div', 'tabs'), panes = el('div', 'panes');
  root.append(tabsBar, panes);

  TABS.forEach((tab, ti) => {
    const btn = el('button', 'tab', tab.title); btn.dataset.tab = tab.id;
    const pane = el('div', 'pane'); pane.dataset.pane = tab.id;
    btn.onclick = () => { activate(tab.id); try { localStorage.setItem('gnarl.tab', tab.id); } catch (e) {} };
    tabsBar.append(btn); panes.append(pane);
    for (const it of tab.items) { const r = makeRow(it); if (r) { pane.append(r.node); rows.push(r); } }
  });
  function activate(id) {
    tabsBar.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
    panes.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === id));
  }
  let saved = 'shape'; try { saved = localStorage.getItem('gnarl.tab') || 'shape'; } catch (e) {}
  activate(TABS.some(t => t.id === saved) ? saved : 'shape');

  function reset(key) { S[key] = DEFAULTS[key]; api.changed(key); refresh(); }

  function makeRow(it) {
    const node = el('div', 'row ' + it.t); let sync = () => {};
    if (it.t === 'head') { node.textContent = it.label; node.className = 'head'; }
    else if (it.t === 'info') { sync = () => { node.textContent = VARIATIONS[S.fold].desc; }; node.className = 'info'; }
    else if (it.t === 's') {
      const lab = el('label', null, it.label), rng = el('input'), num = el('span', 'val'), rst = el('button', 'rst', '⟲');
      rng.type = 'range'; rng.min = it.min; rng.max = it.max; rng.step = it.step; rst.title = 'Reset to default (' + DEFAULTS[it.key] + ')';
      rng.oninput = () => { S[it.key] = parseFloat(rng.value); num.textContent = fmt(S[it.key], it.step); api.changed(it.key); refreshVis(); rows.forEach(r => r !== self && r.key === it.key && r.sync()); };
      rst.onclick = () => reset(it.key);
      sync = () => { rng.value = S[it.key]; num.textContent = fmt(S[it.key], it.step); rst.classList.toggle('dim', S[it.key] === DEFAULTS[it.key]); };
      node.append(lab, rst, rng, num);
    } else if (it.t === 'select') {
      const lab = el('label', null, it.label), sel = el('select'), rst = el('button', 'rst', '⟲');
      for (const [v, t] of it.opts) { const o = el('option', null, t); o.value = v; sel.append(o); }
      sel.onchange = () => { S[it.key] = parseInt(sel.value, 10); api.changed(it.key); refresh(); };
      rst.onclick = () => reset(it.key);
      sync = () => { sel.value = S[it.key]; rst.classList.toggle('dim', S[it.key] === DEFAULTS[it.key]); };
      node.append(lab, rst, sel);
    } else if (it.t === 'toggle') {
      const lab = el('label', 'tg'), cb = el('input'); cb.type = 'checkbox';
      lab.append(cb, document.createTextNode(' ' + it.label));
      cb.onchange = () => { S[it.key] = cb.checked ? 1 : 0; api.changed(it.key); refresh(); };
      sync = () => { cb.checked = !!S[it.key]; };
      node.append(lab);
    } else if (it.t === 'color') {
      const lab = el('label', null, it.label), c = el('input'), rst = el('button', 'rst', '⟲'); c.type = 'color';
      c.oninput = () => { S[it.key] = c.value; api.changed(it.key); };
      rst.onclick = () => reset(it.key);
      sync = () => { c.value = S[it.key]; rst.classList.toggle('dim', S[it.key] === DEFAULTS[it.key]); };
      node.append(lab, rst, c);
    } else if (it.t === 'pal') {
      const g = el('div', 'pals');
      PALETTES.forEach((p, i) => { const b = el('button', 'pal'); b.style.background = p.g; b.title = p.n; b.onclick = () => { S.pal = i; api.changed('pal'); refresh(); }; g.append(b); });
      sync = () => g.childNodes.forEach((b, i) => b.classList.toggle('on', S.pal === i));
      node.append(g);
    } else if (it.t === 'image') {
      const up = el('button', 'btn', 'Load image…'), modes = el('div', 'seg');
      up.onclick = () => api.pickImage();
      [['Off', 0], ['Colour ramp', 1], ['Surface map', 2]].forEach(([t, m]) => { const b = el('button', null, t); b.onclick = () => api.setImgMode(m); b.dataset.m = m; modes.append(b); });
      sync = () => modes.childNodes.forEach(b => b.classList.toggle('on', +b.dataset.m === S.useimg));
      node.append(up, modes);
    } else if (it.t === 'export') {
      const b = el('button', 'btn primary', 'HQ export…'); b.onclick = () => api.openExport(); node.append(b);
    } else if (it.t === 'presets') {
      const g = el('div', 'plist');
      PRESETS.forEach((p, i) => { const b = el('button', 'preset', p.n); b.onclick = () => { api.loadPreset(i); g.childNodes.forEach(x => x.classList.remove('on')); b.classList.add('on'); }; g.append(b); });
      node.append(g);
    } else if (it.t === 'files') {
      const a = el('button', 'btn', 'Save settings (.json)'), b = el('button', 'btn', 'Load settings…');
      a.onclick = () => api.saveFile(); b.onclick = () => api.loadFile(); node.append(a, b);
    } else return null;
    const self = { node, when: it.when, sync, key: it.key };
    return self;
  }
  function refreshVis() { for (const r of rows) r.node.classList.toggle('hide', !!(r.when && !r.when(S))); }
  function refresh() { for (const r of rows) r.sync(); refreshVis(); }
  refresh();
  return { refresh };
}
