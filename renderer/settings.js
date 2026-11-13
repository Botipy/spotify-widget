const THEMES = [
  ['liquid', 'Liquid Glass'], ['retro', 'Retro'], ['terminal', 'Terminal'], ['gameboy', 'Game Boy'], ['neon', 'Neon'],
  ['vaporwave', 'Vaporwave'], ['win98', 'Win98'], ['winamp', 'Winamp'], ['glass', 'Glass'], ['y2k', 'Y2K'], ['sakura', 'Sakura'], ['higanbana', 'Higanbana'],
];
const SIZES = { standard: { w: 300, h: 168 }, compact: { w: 340, h: 112 } };

let cur = { theme: 'liquid', layout: 'standard' };
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
    ifr.src = `index.html?preview=1&theme=${id}&layout=${cur.layout}&mode=${mode}` +
      (extra.get('title') ? '&title=' + encodeURIComponent(extra.get('title')) : '') +
      (extra.get('artist') ? '&artist=' + encodeURIComponent(extra.get('artist')) : '');
    ifr.tabIndex = -1;
    frame.appendChild(ifr);
    stage.appendChild(frame);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<span class="name"></span><span class="badge">Wybrany</span>`;
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
}

document.querySelectorAll('#layoutSeg button').forEach((b) => { b.onclick = () => sp.setSettings({ layout: b.dataset.layout }); });
document.querySelectorAll('#modeSeg button').forEach((b) => { b.onclick = () => { mode = b.dataset.mode; build(); markSelection(); }; });

sp.onSettings((s) => {
  const layoutChanged = s.layout !== cur.layout;
  cur = s;
  if (layoutChanged) build();
  markSelection();
});

(async () => {
  cur = await sp.getSettings();
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
  $('verTitle').textContent = 'Wersja ' + appState.version;
  // autostart i aktualizacje działają tylko w zainstalowanej wersji (nie przy uruchomieniu z folderu projektu)
  document.querySelector('.sw[data-app="openAtLogin"]').disabled = !appState.packaged;
  $('loginNote').textContent = appState.packaged ? 'Widget startuje razem z systemem.' : 'Dostępne tylko w zainstalowanej wersji.';
  $('updBtn').disabled = !appState.packaged;
  $('updBtn').textContent = appState.updateReady ? 'Zainstaluj i zrestartuj' : 'Sprawdź aktualizacje';
  $('updBtn').classList.toggle('go', !!appState.updateReady);
  if (!appState.packaged) $('updMsg').textContent = 'Aktualizacje działają tylko w zainstalowanej wersji.';
  else if (appState.updateReady) $('updMsg').textContent = 'Nowa wersja jest pobrana i gotowa do instalacji.';
  $('accMsg').textContent = appState.loggedIn ? 'Zalogowano. Wylogowanie wyczyści zapisany dostęp do konta.' : 'Niezalogowano.';
  $('logoutBtn').disabled = !appState.loggedIn;
}
document.querySelectorAll('.sw[data-app]').forEach((c) => { c.onchange = () => sp.appSet(c.dataset.app, c.checked); });
$('updBtn').onclick = async () => {
  if (appState && appState.updateReady) { sp.appInstallUpdate(); return; }
  $('updMsg').textContent = 'Sprawdzam…';
  const r = await sp.appCheckUpdates();
  if (!r.ok) $('updMsg').textContent = r.error;
};
$('logoutBtn').onclick = async () => { await sp.appLogout(); await loadApp(); $('accMsg').textContent = 'Wylogowano.'; };
sp.onUpdate((msg) => { $('updMsg').textContent = msg; if (/gotowa|instaluję/i.test(msg)) loadApp(); });
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
    sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Zaloguj się do Spotify, aby wybrać' }));
    sel.disabled = true;
    $('musicNow').textContent = 'Wymaga zalogowania do Spotify.';
    return;
  }
  sel.disabled = false;
  sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Domyślnie: oficjalna playlista Spotify do pracy' }));
  const addGroup = (label, items) => {
    if (!items.length) return;
    const g = document.createElement('optgroup'); g.label = label;
    for (const p of items) g.appendChild(Object.assign(document.createElement('option'), { value: p.uri, textContent: p.name }));
    sel.appendChild(g);
  };
  const [sugg, mine] = await Promise.all([sp.pomoSuggest().catch(() => []), sp.playlists().then((r) => r.items || []).catch(() => [])]);
  addGroup('Spokojna muzyka do pracy (propozycje Spotify)', sugg);
  addGroup('Moje playlisty', mine);
  if (s.musicUri && ![...sel.options].some((o) => o.value === s.musicUri)) {
    sel.appendChild(Object.assign(document.createElement('option'), { value: s.musicUri, textContent: s.musicName || 'Wybrana playlista' }));
  }
  sel.value = s.musicUri || '';
  $('musicNow').textContent = s.musicUri ? ('Wybrana: ' + (s.musicName || 'playlista')) : 'Gdy nic nie wybierzesz, gra oficjalna playlista Spotify do pracy.';
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
  $('musicNow').textContent = uri ? ('Wybrana: ' + o.textContent) : 'Gdy nic nie wybierzesz, gra oficjalna playlista Spotify do pracy.';
  paintPomo(st.settings);
};
$('soundWork').onclick = () => playPomoSound('work');
$('soundBreak').onclick = () => playPomoSound('break');
sp.onPomo((st) => { if (!$('tab-pomodoro').hidden) paintPomo(st.settings); });
let lastTab = 'style';
try { lastTab = localStorage.getItem('settingsTab') || 'style'; } catch {}
showTab(lastTab);
