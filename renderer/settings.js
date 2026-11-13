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

let lastTab = 'style';
try { lastTab = localStorage.getItem('settingsTab') || 'style'; } catch {}
showTab(lastTab);
