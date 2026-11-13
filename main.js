const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, screen, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

// Stały folder danych (ustawienia + logowanie), niezależny od nazwy produktu i od instalatora
app.setPath('userData', process.env.SW_DATA_DIR || path.join(app.getPath('appData'), 'spotify-widget'));

const REDIRECT_PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',    // serduszko: sprawdzenie, czy utwór jest polubiony
  'user-library-modify',  // serduszko: dodawanie/usuwanie z polubionych
].join(' ');

// Dwa układy okna: standardowy (większy) i minimalistyczny (niski, poziomy pasek)
const SIZES = { standard: { w: 300, h: 168 }, compact: { w: 340, h: 112 } };
const THEMES = ['liquid', 'retro', 'terminal', 'gameboy', 'neon', 'vaporwave', 'win98', 'winamp', 'glass', 'y2k', 'sakura', 'higanbana'];
const getSettings = () => ({ theme: 'liquid', layout: 'standard', ...((typeof store !== 'undefined' && store.settings) || {}) });
const curSize = () => SIZES[getSettings().layout] || SIZES.standard;

let win, tray;
let store = {};
const storePath = () => path.join(app.getPath('userData'), 'store.json');

function loadStore() {
  try { store = JSON.parse(fs.readFileSync(storePath(), 'utf8')); } catch { store = {}; }
}
function saveStore() {
  try { fs.writeFileSync(storePath(), JSON.stringify(store, null, 2)); } catch {}
}
function enc(s) {
  if (safeStorage.isEncryptionAvailable()) return 'enc:' + safeStorage.encryptString(s).toString('base64');
  return 'raw:' + s;
}
function dec(s) {
  if (!s) return null;
  try {
    if (s.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(s.slice(4), 'base64'));
    return s.slice(4);
  } catch { return null; }
}

// ---------- Auth (Authorization Code + PKCE) ----------
let tokens = null; // { access, refresh, expires }

function loadTokens() {
  const refresh = dec(store.refresh);
  if (refresh) tokens = { access: null, refresh, expires: 0 };
}

async function tokenRequest(params) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: store.clientId, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Błąd tokena');
    err.permanent = res.status === 400 || res.status === 401; // np. invalid_grant: token faktycznie nieważny
    throw err;
  }
  tokens = {
    access: data.access_token,
    refresh: data.refresh_token || (tokens && tokens.refresh),
    expires: Date.now() + (data.expires_in - 30) * 1000,
  };
  store.refresh = enc(tokens.refresh);
  saveStore();
}

let refreshing = null; // jedno odświeżenie naraz (start aplikacji woła API równolegle)
async function ensureToken() {
  if (!tokens) return false;
  if (tokens.access && Date.now() < tokens.expires) return true;
  if (!refreshing) {
    refreshing = tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh })
      .then(() => true)
      .catch((e) => {
        // wylogowujemy tylko, gdy token jest naprawdę nieważny; brak sieci to stan chwilowy
        if (e && e.permanent) { tokens = null; delete store.refresh; saveStore(); }
        return false;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

let loginServer = null;
function login(clientId) {
  return new Promise((resolve, reject) => {
    store.clientId = clientId.trim();
    saveStore();
    const verifier = crypto.randomBytes(64).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const state = crypto.randomBytes(8).toString('hex');

    if (loginServer) { try { loginServer.close(); } catch {} }
    const timeout = setTimeout(() => { try { server.close(); } catch {} reject(new Error('Upłynął czas logowania')); }, 180000);

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${REDIRECT_PORT}`);
      if (url.pathname !== '/callback') { res.writeHead(404); return res.end(); }
      const done = (msg) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<body style="font-family:sans-serif;background:#121212;color:#fff;text-align:center;padding-top:80px"><h2>${msg}</h2><p>Możesz zamknąć tę kartę.</p></body>`);
        clearTimeout(timeout);
        server.close();
      };
      if (url.searchParams.get('state') !== state || url.searchParams.get('error') || !url.searchParams.get('code')) {
        done('Logowanie nie powiodło się');
        return reject(new Error(url.searchParams.get('error') || 'Logowanie nie powiodło się'));
      }
      try {
        await tokenRequest({
          grant_type: 'authorization_code',
          code: url.searchParams.get('code'),
          redirect_uri: REDIRECT_URI,
          code_verifier: verifier,
        });
        done('Zalogowano w Spotify Widget ✔');
        resolve(true);
      } catch (e) {
        done('Błąd logowania');
        reject(e);
      }
    });
    loginServer = server;
    server.on('error', (e) => { clearTimeout(timeout); reject(new Error('Port 8888 zajęty: ' + e.message)); });
    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      const q = new URLSearchParams({
        client_id: store.clientId,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        state,
        code_challenge_method: 'S256',
        code_challenge: challenge,
      });
      shell.openExternal('https://accounts.spotify.com/authorize?' + q.toString());
    });
  });
}

// ---------- Spotify API ----------
async function api(method, endpoint, body, retry = true) {
  if (!(await ensureToken())) return { status: tokens ? 0 : 401, data: null }; // 0 = chwilowy brak połączenia, 401 = wylogowany
  let res;
  try {
    res = await fetch('https://api.spotify.com/v1' + endpoint, {
      method,
      headers: {
        Authorization: 'Bearer ' + tokens.access,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { status: 0, data: null };
  }
  if (res.status === 401 && retry) { tokens.access = null; return api(method, endpoint, body, false); }
  let data = null;
  if (res.status !== 204) { try { data = await res.json(); } catch {} }
  return { status: res.status, data };
}

const errMsg = (r) => {
  const raw = r.data && r.data.error && r.data.error.message;
  // konto spoza listy testerów aplikacji w trybie deweloperskim Spotify
  if (r.status === 403 && raw && /dashboard|not registered/i.test(raw)) return 'Twojego konta nie ma na liście testerów aplikacji. Poproś autora o dodanie Twojego e-maila w panelu Spotify.';
  if (r.status === 429) return 'Spotify chwilowo ogranicza zapytania. Spróbuj za chwilę.';
  return raw || (r.status === 0 ? 'Brak połączenia z internetem' : `Błąd ${r.status}`);
};

function simplifyState(d) {
  if (!d || !d.item) return null;
  const it = d.item;
  const imgs = (it.album && it.album.images) || (it.images) || [];
  return {
    playing: !!d.is_playing,
    title: it.name,
    artist: (it.artists || []).map((a) => a.name).join(', ') || (it.show && it.show.publisher) || '',
    art: imgs.length ? imgs[0].url : null,
    duration: it.duration_ms,
    progress: d.progress_ms || 0,
    shuffle: !!d.shuffle_state,
    volume: d.device ? d.device.volume_percent : null,
    device: d.device ? d.device.name : null,
    context: d.context ? d.context.uri : null,
    uri: it.uri || null,       // do serduszka (polubione)
    kind: it.type || 'track',  // 'track' | 'episode'
  };
}

ipcMain.handle('auth:status', async () => ({
  clientId: store.clientId || '',
  loggedIn: !!tokens && (await ensureToken()),
  redirectUri: REDIRECT_URI,
}));
ipcMain.handle('auth:login', async (_e, clientId) => {
  try { await login(clientId); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('auth:logout', () => { tokens = null; delete store.refresh; saveStore(); return true; });

// ---------- Polubione utwory (serduszko) ----------
// Od lutego 2026 Spotify zastąpiło /me/tracks endpointami /me/library (po URI). Przy 404/405 próbujemy starych.
const trackId = (uri) => (String(uri).match(/^spotify:track:([A-Za-z0-9]+)$/) || [])[1];
const needsScope = (r) => r.status === 403 && /scope/i.test(errMsg(r));

ipcMain.handle('library:contains', async (_e, uri) => {
  const id = trackId(uri);
  if (!id) return { ok: false, error: 'To nie jest utwór' };
  let r = await api('GET', `/me/library/contains?uris=${encodeURIComponent(uri)}`);
  if (r.status === 404 || r.status === 405) r = await api('GET', `/me/tracks/contains?ids=${id}`);
  if (needsScope(r)) return { ok: false, needScope: true };
  if (r.status === 200 && Array.isArray(r.data)) return { ok: true, saved: !!r.data[0] };
  return { ok: false, error: errMsg(r) };
});

ipcMain.handle('library:set', async (_e, uri, save) => {
  const id = trackId(uri);
  if (!id) return { ok: false, error: 'To nie jest utwór' };
  const method = save ? 'PUT' : 'DELETE';
  let r = await api(method, `/me/library?uris=${encodeURIComponent(uri)}`);
  if (r.status === 404 || r.status === 405) r = await api(method, `/me/tracks?ids=${id}`);
  if (needsScope(r)) return { ok: false, needScope: true };
  return r.status < 300 ? { ok: true, saved: !!save } : { ok: false, error: errMsg(r) };
});

// ponowne logowanie (nowe uprawnienia): otwiera stronę zgody Spotify, używa zapisanego Client ID
ipcMain.handle('auth:relogin', async () => {
  if (!store.clientId) return { ok: false, error: 'Brak Client ID' };
  try { await login(store.clientId); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('player:state', async () => {
  const r = await api('GET', '/me/player?additional_types=episode');
  if (r.status === 401) return { auth: false };
  if (r.status === 204 || !r.data) return { auth: true, state: null };
  if (r.status !== 200) return { auth: true, state: null, error: errMsg(r) };
  return { auth: true, state: simplifyState(r.data) };
});
ipcMain.handle('player:toggle', async (_e, playing) => {
  const r = await api('PUT', playing ? '/me/player/pause' : '/me/player/play');
  return r.status < 300 ? { ok: true } : { ok: false, error: errMsg(r) };
});
ipcMain.handle('player:next', async () => { const r = await api('POST', '/me/player/next'); return { ok: r.status < 300, error: r.status >= 300 ? errMsg(r) : null }; });
ipcMain.handle('player:prev', async () => { const r = await api('POST', '/me/player/previous'); return { ok: r.status < 300, error: r.status >= 300 ? errMsg(r) : null }; });
ipcMain.handle('player:shuffle', async (_e, on) => { const r = await api('PUT', `/me/player/shuffle?state=${on}`); return { ok: r.status < 300 }; });
ipcMain.handle('player:seek', async (_e, ms) => { const r = await api('PUT', `/me/player/seek?position_ms=${Math.round(ms)}`); return { ok: r.status < 300 }; });
ipcMain.handle('player:volume', async (_e, v) => { const r = await api('PUT', `/me/player/volume?volume_percent=${Math.round(v)}`); return { ok: r.status < 300 }; });

ipcMain.handle('playlists:get', async () => {
  const out = [];
  let url = '/me/playlists?limit=50';
  for (let i = 0; i < 6 && url; i++) {
    const r = await api('GET', url);
    if (r.status !== 200) return { ok: false, error: errMsg(r), items: out };
    for (const p of r.data.items || []) {
      if (!p) continue;
      out.push({ id: p.id, name: p.name, uri: p.uri, image: p.images && p.images.length ? p.images[p.images.length - 1].url : null });
    }
    url = r.data.next ? r.data.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return { ok: true, items: out };
});
const LIKED_URI = 'spotify:collection:tracks';
// opts (opcjonalnie): { offsetUri } = zacznij od tego utworu w playliście; { uris } = odtwórz dokładnie te utwory (Polubione)
ipcMain.handle('playlists:play', async (_e, openUri, opts = {}) => {
  let uri = openUri;
  if (openUri === LIKED_URI) {
    // Polubione utwory = kontekst "spotify:user:<id>:collection"
    const me = await api('GET', '/me');
    if (me.data && me.data.id) uri = `spotify:user:${me.data.id}:collection`;
  }
  const body = opts.uris
    ? { uris: opts.uris }
    : { context_uri: uri, ...(opts.offsetUri ? { offset: { uri: opts.offsetUri } } : {}) };
  let r = await api('PUT', '/me/player/play', body);
  if (r.status === 404) {
    // brak aktywnego urządzenia: przełącz na pierwsze dostępne (np. Spotify na PC)
    const d = await api('GET', '/me/player/devices');
    const dev = d.data && d.data.devices && d.data.devices[0];
    if (!dev) return { ok: false, error: 'Brak urządzenia. Uruchom Spotify na komputerze.' };
    r = await api('PUT', `/me/player/play?device_id=${dev.id}`, body);
  }
  if (r.status >= 300 && opts.offsetUri && /^spotify:track:[A-Za-z0-9]+$/.test(opts.offsetUri)) {
    shell.openExternal(opts.offsetUri); // wybrany utwór: otwórz w aplikacji Spotify
    return { ok: true, opened: true };
  }
  if (r.status >= 300 && (openUri === LIKED_URI || /^spotify:(playlist|album|artist|show):[A-Za-z0-9]+$/.test(openUri))) {
    // API odmówiło (np. DJ / playlisty algorytmiczne) - otwórz w aplikacji Spotify
    shell.openExternal(openUri);
    return { ok: true, opened: true };
  }
  return r.status < 300 ? { ok: true } : { ok: false, error: errMsg(r) };
});

// Utwory playlisty / Polubionych do wyboru. Od lutego 2026 lista utworów (GET /playlists/{id}/items) jest dostępna tylko
// dla playlist użytkownika lub współdzielonych (nie dla DJ-a, miksów Spotify ani cudzych), stąd komunikat „restricted”.
ipcMain.handle('playlists:tracks', async (_e, uri, offset = 0) => {
  const limit = 50;
  let r;
  if (uri === LIKED_URI) {
    for (const base of ['/me/tracks', '/me/library/tracks']) {
      r = await api('GET', `${base}?limit=${limit}&offset=${offset}`);
      if (r.status === 200) break;
    }
  } else {
    const id = (String(uri).match(/^spotify:playlist:([A-Za-z0-9]+)$/) || [])[1];
    if (!id) return { ok: false, error: 'To nie jest playlista' };
    r = await api('GET', `/playlists/${id}/items?limit=${limit}&offset=${offset}&additional_types=track`);
    if (r.status === 404 || r.status === 405) r = await api('GET', `/playlists/${id}/tracks?limit=${limit}&offset=${offset}`);
  }
  if (r.status === 403 || r.status === 404) {
    if (needsScope(r)) return { ok: false, needScope: true };
    return { ok: false, restricted: true, error: 'Spotify nie udostępnia utworów tej playlisty (tylko własne lub współdzielone). Możesz ją odtworzyć w całości.' };
  }
  if (r.status !== 200 || !r.data) return { ok: false, error: errMsg(r) };
  const items = (r.data.items || [])
    .map((e) => (e && (e.item || e.track)) || null)
    .filter((t) => t && t.uri && t.type !== 'episode' && !t.is_local)
    .map((t) => ({ uri: t.uri, name: t.name, artist: (t.artists || []).map((a) => a.name).join(', '), ms: t.duration_ms || 0 }));
  return { ok: true, items, total: r.data.total || items.length, more: !!r.data.next };
});

// ---------- Okno ----------
function applyLayoutSize() {
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  const s = curSize();
  const area = screen.getDisplayMatching(b).workArea;
  const x = Math.max(area.x, Math.min(b.x, area.x + area.width - s.w));
  const y = Math.max(area.y, Math.min(b.y, area.y + area.height - s.h)); // nie wychodź poza ekran
  win.setBounds({ x, y, width: s.w, height: s.h });
}

// ---------- Ustawienia wyglądu (preset + układ) ----------
ipcMain.handle('settings:get', () => getSettings());
ipcMain.handle('settings:set', (_e, patch) => {
  const cur = getSettings();
  const next = { ...cur };
  if (patch && THEMES.includes(patch.theme)) next.theme = patch.theme;
  if (patch && SIZES[patch.layout]) next.layout = patch.layout;
  store.settings = next;
  saveStore();
  if (next.layout !== cur.layout) applyLayoutSize();
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('settings:changed', next);
  return next;
});
ipcMain.handle('settings:open', () => openSettings());

// ---------- Ustawienia aplikacji (zakładki Zachowanie i System w panelu; te same opcje są w menu zasobnika) ----------
ipcMain.handle('app:get', () => ({
  version: app.getVersion(),
  packaged: app.isPackaged,                       // autostart i aktualizacje działają tylko w zainstalowanej wersji
  onTop: store.onTop !== false,
  openAtLogin: app.isPackaged ? app.getLoginItemSettings().openAtLogin : false,
  autoUpdateOnStart: store.autoUpdateOnStart !== false,
  updateReady,
  loggedIn: !!tokens,
}));
ipcMain.handle('app:set', (_e, key, value) => {
  const v = !!value;
  if (key === 'onTop') setOnTop(v);
  else if (key === 'openAtLogin') { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: v }); }
  else if (key === 'autoUpdateOnStart') { store.autoUpdateOnStart = v; saveStore(); }
  else return false;
  buildTrayMenu(); // synchronizuj zaznaczenia w menu zasobnika
  return true;
});
ipcMain.handle('app:checkUpdates', () => {
  if (!autoUpdater) return { ok: false, error: 'Aktualizacje działają tylko w zainstalowanej wersji.' };
  manualCheck = true;
  autoUpdater.checkForUpdates().catch(() => say('Nie udało się sprawdzić aktualizacji'));
  return { ok: true };
});
ipcMain.handle('app:installUpdate', () => { if (autoUpdater && updateReady) autoUpdater.quitAndInstall(true, true); return !!(autoUpdater && updateReady); });
ipcMain.handle('app:logout', () => {
  tokens = null; delete store.refresh; saveStore();
  if (win && !win.isDestroyed()) win.webContents.send('auth:loggedOut');
  return true;
});

let settingsWin = null;
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 720, height: 740, minWidth: 560, minHeight: 480,
    title: 'Spotify Widget – Ustawienia', backgroundColor: '#141416', autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}
ipcMain.handle('win:hide', () => win && win.hide());
ipcMain.handle('win:quit', () => app.quit());
ipcMain.handle('win:openUrl', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });

function setOnTop(on) {
  store.onTop = on;
  saveStore();
  if (win) win.setAlwaysOnTop(on, on ? 'floating' : 'normal');
  buildTrayMenu();
}

function startPosition() {
  const b = store.bounds;
  const s = curSize();
  if (b) {
    const area = screen.getDisplayMatching({ x: b.x, y: b.y, width: s.w, height: s.h }).workArea;
    if (b.x >= area.x - 50 && b.x < area.x + area.width && b.y >= area.y - 50 && b.y < area.y + area.height) return b;
  }
  const area = screen.getPrimaryDisplay().workArea;
  return { x: area.x + area.width - s.w - 20, y: area.y + area.height - s.h - 20 };
}

function createWindow() {
  const pos = startPosition();
  const s = curSize();
  win = new BrowserWindow({
    x: pos.x, y: pos.y, width: s.w, height: s.h,
    frame: false, transparent: true, resizable: false, maximizable: false,
    skipTaskbar: true, hasShadow: false, show: false,
    alwaysOnTop: store.onTop !== false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  if (store.onTop !== false) win.setAlwaysOnTop(true, 'floating');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('moved', () => { const b = win.getBounds(); store.bounds = { x: b.x, y: b.y }; saveStore(); });
}

// ---------- Autoaktualizacje (GitHub Releases) ----------
let autoUpdater = null;
let updateReady = false;
let manualCheck = false;
const say = (m) => { for (const w of [win, settingsWin]) if (w && !w.isDestroyed()) w.webContents.send('update:status', m); };

function setupUpdater() {
  if (!app.isPackaged) return; // tylko w zainstalowanej wersji
  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // Faza startowa: pierwsze sprawdzenie po uruchomieniu (np. z autostartu Windowsa).
  // Jeśli jest nowsza wersja, instalujemy ją i restartujemy automatycznie. Późniejsze sprawdzenia
  // (co 6 h) nie przerywają słuchania: instalują dopiero po zamknięciu albo z menu.
  let startupPhase = true;
  let startupTries = 0;
  setTimeout(() => { startupPhase = false; }, 10 * 60 * 1000);

  autoUpdater.on('update-available', (i) => say(`Pobieram aktualizację ${i.version}…`));
  autoUpdater.on('update-not-available', () => {
    startupPhase = false;
    // sprzątanie: pobrany wcześniej instalator (ok. 230 MB w folderze cache) nie jest już potrzebny
    if (process.env.LOCALAPPDATA) {
      fs.rm(path.join(process.env.LOCALAPPDATA, 'spotify-widget-updater'), { recursive: true, force: true }, () => {});
    }
    if (manualCheck) say(`Masz najnowszą wersję (${app.getVersion()})`);
    manualCheck = false;
  });
  autoUpdater.on('update-downloaded', (i) => {
    updateReady = true;
    buildTrayMenu();
    // bezpiecznik przed pętlą restartów: tej samej wersji nie próbujemy automatycznie częściej niż co 15 min
    const last = store.autoInstall;
    const recent = last && last.version === i.version && Date.now() - last.at < 15 * 60 * 1000;
    if (startupPhase && store.autoUpdateOnStart !== false && !recent) {
      startupPhase = false;
      store.autoInstall = { version: i.version, at: Date.now() };
      saveStore();
      say(`Aktualizacja ${i.version}: instaluję i restartuję…`);
      setTimeout(() => autoUpdater.quitAndInstall(true, true), 2500); // chwila, żeby komunikat był widoczny
    } else {
      say(`Aktualizacja ${i.version} gotowa. Zainstaluje się po zamknięciu.`);
    }
  });
  autoUpdater.on('error', () => { if (manualCheck) say('Nie udało się sprawdzić aktualizacji'); manualCheck = false; });

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  // po starcie systemu sieć bywa jeszcze niegotowa: ponawiamy sprawdzenie co 30 s (do 8 prób)
  const startupCheck = () => autoUpdater.checkForUpdates().catch(() => {
    if (startupPhase && ++startupTries < 8) setTimeout(startupCheck, 30000);
  });
  startupCheck();
  setInterval(check, 6 * 60 * 60 * 1000);
}

function buildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Pokaż / ukryj panel', click: () => (win.isVisible() ? win.hide() : win.show()) },
    { label: 'Wygląd i ustawienia…', click: () => openSettings() },
    { label: 'Zawsze na wierzchu', type: 'checkbox', checked: store.onTop !== false, click: (m) => setOnTop(m.checked) },
    { label: 'Uruchamiaj z Windowsem', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
    { type: 'separator' },
    { label: `Wersja ${app.getVersion()}`, enabled: false },
    { label: 'Aktualizuj automatycznie przy starcie', type: 'checkbox', checked: store.autoUpdateOnStart !== false,
      click: (m) => { store.autoUpdateOnStart = m.checked; saveStore(); } },
    updateReady
      ? { label: 'Zainstaluj aktualizację i zrestartuj', click: () => autoUpdater.quitAndInstall(true, true) }
      : { label: 'Sprawdź aktualizacje', enabled: !!autoUpdater, click: () => { manualCheck = true; autoUpdater.checkForUpdates().catch(() => say('Nie udało się sprawdzić aktualizacji')); } },
    { type: 'separator' },
    { label: 'Wyloguj ze Spotify', click: () => { tokens = null; delete store.refresh; saveStore(); win.webContents.send('auth:loggedOut'); } },
    { label: 'Zamknij', click: () => app.quit() },
  ]));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    loadStore();
    loadTokens();
    createWindow();
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')).resize({ width: 16, height: 16 }));
    tray.setToolTip('Spotify Widget');
    tray.on('click', () => (win.isVisible() ? win.hide() : win.show()));
    setupUpdater();
    buildTrayMenu();
  });
  app.on('window-all-closed', () => app.quit());
}



