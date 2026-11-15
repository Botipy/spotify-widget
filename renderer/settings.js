const L = I18N.t;
const THEMES = [
  ['liquid', 'Liquid Glass'], ['retro', 'Retro'], ['terminal', 'Terminal'], ['gameboy', 'Game Boy'], ['neon', 'Neon'],
  ['vaporwave', 'Vaporwave'], ['win98', 'Win98'], ['winamp', 'Winamp'], ['glass', 'Glass'], ['y2k', 'Y2K'], ['sakura', 'Sakura'], ['higanbana', 'Higanbana'],
];
const SIZES = { standard: { w: 300, h: 168 }, compact: { w: 340, h: 112 } };

let cur = { theme: 'liquid', layout: 'standard', lang: 'en' };
let mode = 'player'; // tylko podgląd: odtwarzacz / playlisty

const grid = document.getElementById('grid');

function build() {
  grid.innerHTML = '';
  const sz = SIZES[cur.layout];
  const scale = cur.layout === 'standard' ? 0.98 : 0.92;
  for (const [id, label] of THEMES) {
    const card = document.createElement('button');
    card.className = 'card' + (id === cur.theme ? ' sel' : '');
    card.dataset.theme = id;

    const stage = document.createElement('div');
    stage.className = 'stage';
    const frame = document.createElement('div');
    frame.className = 'frame';
    frame.style.width = Math.round(sz.w * scale) + 'px';
    frame.style.height = Math.round(sz.h * scale) + 'px';
    const ifr = document.createElement('iframe');
    ifr.width = sz.w; ifr.height = sz.h;
    ifr.style.transform = `scale(${scale})`;
    const extra = new URLSearchParams(location.search); // ?title=..&artist=.. (do testów długich tekstów)
    ifr.src = `index.html?preview=1&theme=${id}&layout=${cur.layout}&mode=${mode}&lang=${cur.lang || 'en'}` +
      (extra.get('title') ? '&title=' + encodeURIComponent(extra.get('title')) : '') +
      (extra.get('artist') ? '&artist=' + encodeURIComponent(extra.get('artist')) : '') +
      (extra.get('dur') ? '&dur=' + encodeURIComponent(extra.get('dur')) : '') + (extra.get('pos') ? '&pos=' + encodeURIComponent(extra.get('pos')) : '');
    ifr.tabIndex = -1;
    frame.appendChild(ifr);
    stage.appendChild(frame);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<span class="name"></span><span class="badge">${L('selected')}</span>`;
    meta.querySelector('.name').textContent = label;

    card.append(stage, meta);
    card.onclick = () => sp.setSettings({ theme: id });
    grid.appendChild(card);
  }
}

function markSelection() {
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', c.dataset.theme === cur.theme));
  document.querySelectorAll('#layoutSeg button').forEach((b) => b.classList.toggle('on', b.dataset.layout === cur.layout));
  document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  document.querySelectorAll('#langSeg button').forEach((b) => b.classList.toggle('on', b.dataset.lang === (cur.lang || 'en')));
}

document.querySelectorAll('#layoutSeg button').forEach((b) => { b.onclick = () => sp.setSettings({ layout: b.dataset.layout }); });
document.querySelectorAll('#langSeg button').forEach((b) => { b.onclick = () => sp.setSettings({ lang: b.dataset.lang }); });
document.querySelectorAll('#modeSeg button').forEach((b) => { b.onclick = () => { mode = b.dataset.mode; build(); markSelection(); }; });

sp.onSettings((s) => {
  const layoutChanged = s.layout !== cur.layout;
  const langChanged = (s.lang || 'en') !== (cur.lang || 'en');
  cur = s;
  if (langChanged) relang();
  else if (layoutChanged) build();
  markSelection();
});

// zmiana języka: przetłumacz stronę, przebuduj podglądy i odśwież teksty dynamiczne
function relang() {
  I18N.setLang(cur.lang || 'en');
  I18N.apply();
  document.title = L('settingsTitle');
  build();
  musicOptsFor = null;
  loadApp();
  loadPomo();
}

(async () => {
  cur = await sp.getSettings();
  I18N.setLang(cur.lang || 'en');
  I18N.apply();
  document.title = L('settingsTitle');
  build();
  markSelection();
})();

// ---------- Zakładki ----------
const TABS = ['style', 'behavior', 'system', 'pomodoro'];
function showTab(name) {
  if (!TABS.includes(name)) name = 'style';
  for (const t of TABS) document.getElementById('tab-' + t).hidden = t !== name;
  document.querySelectorAll('#tabs button').forEach((b) => { b.classList.toggle('on', b.dataset.tab === name); b.setAttribute('aria-selected', b.dataset.tab === name); });
  try { localStorage.setItem('settingsTab', name); } catch {}
  if (name === 'system' || name === 'behavior') loadApp();
  if (name === 'pomodoro') loadPomo();
}
document.querySelectorAll('#tabs button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });

// ---------- Zachowanie i System (te same opcje są też w menu zasobnika) ----------
const $ = (id) => document.getElementById(id);
let appState = null;
async function loadApp() {
  appState = await sp.appGet();
  document.querySelectorAll('.sw[data-app]').forEach((c) => { c.checked = !!appState[c.dataset.app]; });
  $('verTitle').textContent = L('version', { v: appState.version });
  // autostart i aktualizacje działają tylko w zainstalowanej wersji (nie przy uruchomieniu z folderu projektu)
  document.querySelector('.sw[data-app="openAtLogin"]').disabled = !appState.packaged;
  $('loginNote').textContent = appState.packaged ? L('autostartSub') : L('autostartOnlyInst');
  $('updBtn').disabled = !appState.packaged;
  $('updBtn').textContent = appState.updateReady ? L('installRestart') : L('checkUpd');
  $('updBtn').classList.toggle('go', !!appState.updateReady);
  if (!appState.packaged) $('updMsg').textContent = L('updOnlyInstalledSub');
  else if (appState.updateReady) $('updMsg').textContent = L('updReadySub');
  else $('updMsg').textContent = L('versionSub');
  $('accMsg').textContent = appState.loggedIn ? L('accIn') : L('accOut');
  $('logoutBtn').disabled = !appState.loggedIn;
}
document.querySelectorAll('.sw[data-app]').forEach((c) => { c.onchange = () => sp.appSet(c.dataset.app, c.checked); });
$('updBtn').onclick = async () => {
  if (appState && appState.updateReady) { sp.appInstallUpdate(); return; }
  $('updMsg').textContent = L('checking');
  const r = await sp.appCheckUpdates();
  if (!r.ok) $('updMsg').textContent = r.error;
};
$('logoutBtn').onclick = async () => { await sp.appLogout(); await loadApp(); $('accMsg').textContent = L('accDone'); };
sp.onUpdate((msg) => { $('updMsg').textContent = msg; if (/ready|install|gotowa|instaluj/i.test(msg)) loadApp(); });
window.addEventListener('focus', () => { if (!$('tab-behavior').hidden || !$('tab-system').hidden) loadApp(); }); // zmiany z menu zasobnika

// ---------- Pomodoro ----------
function paintPomo(s) {
  document.querySelectorAll('[data-pomo]').forEach((el) => {
    const k = el.dataset.pomo;
    if (el.type === 'checkbox') el.checked = !!s[k];
    else if (document.activeElement !== el) el.value = s[k];
  });
  document.querySelectorAll('#presetChips button').forEach((b) => b.classList.toggle('on', b.dataset.preset === s.preset));
  document.getElementById('pomoMore').classList.toggle('off', !s.enabled);
}
let musicOptsFor = null;
async function loadMusicOptions(s) {
  const sel = $('musicSel');
  const key = s.musicUri + '|' + s.music;
  if (musicOptsFor === key && sel.options.length > 1) return;
  const acc = await sp.appGet();
  sel.innerHTML = '';
  if (!acc.loggedIn) {
    sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: L('musicNeedLogin') }));
    sel.disabled = true;
    $('musicNow').textContent = L('musicNeedLoginNote');
    return;
  }
  sel.disabled = false;
  sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: L('musicDefaultOpt') }));
  const addGroup = (label, items) => {
    if (!items.length) return;
    const g = document.createElement('optgroup'); g.label = label;
    for (const p of items) g.appendChild(Object.assign(document.createElement('option'), { value: p.uri, textContent: p.name }));
    sel.appendChild(g);
  };
  const [sugg, mine] = await Promise.all([sp.pomoSuggest().catch(() => []), sp.playlists().then((r) => r.items || []).catch(() => [])]);
  addGroup(L('musicGroupSugg'), sugg);
  addGroup(L('musicGroupMine'), mine);
  if (s.musicUri && ![...sel.options].some((o) => o.value === s.musicUri)) {
    sel.appendChild(Object.assign(document.createElement('option'), { value: s.musicUri, textContent: s.musicName || L('musicChosen') }));
  }
  sel.value = s.musicUri || '';
  $('musicNow').textContent = s.musicUri ? L('musicSelected', { n: s.musicName || L('playlistT') }) : L('musicNoneChosen');
  musicOptsFor = key;
}
async function loadPomo() {
  const st = await sp.pomoGet();
  paintPomo(st.settings);
  loadMusicOptions(st.settings);
}
document.querySelectorAll('[data-pomo]').forEach((el) => {
  el.onchange = async () => {
    const k = el.dataset.pomo;
    const v = el.type === 'checkbox' ? el.checked : el.value;
    const st = await sp.pomoSet({ [k]: v });
    paintPomo(st.settings);
  };
});
document.querySelectorAll('#presetChips button').forEach((b) => {
  b.onclick = async () => { if (b.dataset.preset === 'custom') return; paintPomo((await sp.pomoSet({ preset: b.dataset.preset })).settings); };
});
$('musicSel').onchange = async () => {
  const o = $('musicSel').selectedOptions[0];
  const uri = $('musicSel').value;
  const st = await sp.pomoSet({ musicUri: uri, musicName: uri ? o.textContent : '' });
  musicOptsFor = null;
  $('musicNow').textContent = uri ? L('musicSelected', { n: o.textContent }) : L('musicNoneChosen');
  paintPomo(st.settings);
};
$('soundWork').onclick = () => playPomoSound('work');
$('soundBreak').onclick = () => playPomoSound('break');
sp.onPomo((st) => { if (!$('tab-pomodoro').hidden) paintPomo(st.settings); });
let lastTab = 'style';
try { lastTab = localStorage.getItem('settingsTab') || 'style'; } catch {}
showTab(lastTab);
