const $ = (id) => document.getElementById(id);

// ---------- Tryb podglądu (iframe w oknie ustawień, bez API) ----------
const qs = new URLSearchParams(location.search);
const PREVIEW = qs.get('preview') === '1';
if (!window.sp) {
  const noop = async () => ({});
  window.sp = {
    authStatus: async () => ({ loggedIn: false, redirectUri: '', clientId: '' }), login: noop, logout: noop,
    onLoggedOut() {}, onUpdate() {}, onSettings() {},
    getSettings: async () => ({ theme: 'liquid', layout: 'standard' }), setSettings: noop, openSettings: noop,
    state: async () => ({ auth: true, state: null }), toggle: noop, next: noop, prev: noop, shuffle: noop, seek: noop, volume: noop,
    playlists: async () => ({ ok: true, items: [] }), playPlaylist: noop, hide: noop, quit: noop, openUrl: noop,
  };
}

// ---------- Wygląd: preset (data-theme) + układ (data-layout) ----------
const COVER_ACCENT = new Set(['liquid', 'glass']); // te presety biorą kolor akcentu z okładki
function applyLook(s) {
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.layout = s.layout;
  if (!COVER_ACCENT.has(s.theme)) {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-rgb');
  } else if (typeof st !== 'undefined' && st && st.art) {
    accentFrom(st.art);
  }
  requestAnimationFrame(() => { if (typeof st !== 'undefined' && st) setTitle(st.title, true); }); // przelicz przewijanie tytułu po zmianie układu
}

let st = null;            // ostatni stan z API
let stAt = 0;             // kiedy go dostaliśmy (do interpolacji postępu)
let playlists = [];
let plOpen = false;
let pollTimer = null;
let volTimer = null;
let volDragging = false;

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

function show(view) {
  $('login').hidden = view !== 'login';
  $('player').hidden = view !== 'player';
}

let flashTimer = null;
function flash(msg, good) {
  const t = $('status');
  clearTimeout(flashTimer);
  if (!msg) { t.classList.remove('show'); return; }
  t.textContent = msg;
  t.classList.toggle('bad', !good);
  t.classList.add('show');
  flashTimer = setTimeout(() => t.classList.remove('show'), 3800);
}

// ---------- Kolor akcentu z okładki ----------
function setAccent(r, g, b) {
  if (!COVER_ACCENT.has(document.documentElement.dataset.theme)) return; // inne presety mają stały akcent
  const root = document.documentElement.style;
  root.setProperty('--accent', `rgb(${r}, ${g}, ${b})`);
  root.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
}
function accentFrom(src) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, 32, 32);
      const d = x.getImageData(0, 0, 32, 32).data;
      let R = 0, G = 0, B = 0, W = 0;
      for (let i = 0; i < d.length; i += 4) {
        const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2]);
        const sat = max ? (max - min) / max : 0;
        const w = Math.pow(sat, 2) * (max / 255) + 0.0001;
        R += d[i] * w; G += d[i + 1] * w; B += d[i + 2] * w; W += w;
      }
      if (W < 1) return setAccent(30, 215, 96); // okładka szara -> zieleń Spotify
      let r = R / W, g = G / W, b = B / W;
      const m = Math.max(r, g, b);
      const k = m < 200 ? 215 / m : 1; // rozjaśnij, żeby akcent był czytelny
      setAccent(Math.min(255, Math.round(r * k)), Math.min(255, Math.round(g * k)), Math.min(255, Math.round(b * k)));
    } catch { setAccent(30, 215, 96); }
  };
  img.onerror = () => setAccent(30, 215, 96);
  img.src = src;
}

// ---------- Tytuł: przewijanie, gdy się nie mieści ----------
function setTitle(text, force) {
  const t = $('title');
  const span = t.firstElementChild;
  if (!force && span.textContent === text) return;
  span.textContent = text;
  t.classList.remove('marq', 'fits');
  requestAnimationFrame(() => {
    const over = span.scrollWidth - t.clientWidth;
    if (over > 4) { t.style.setProperty('--d', `-${over + 18}px`); t.classList.add('marq'); }
    else t.classList.add('fits');
  });
}

// ---------- Logowanie ----------
async function init() {
  applyLook(await sp.getSettings());
  const a = await sp.authStatus();
  $('redirect').textContent = a.redirectUri;
  $('clientId').value = a.clientId;
  if (a.loggedIn) startPlayer(); else show('login');
}

$('redirect').onclick = () => { navigator.clipboard.writeText($('redirect').textContent); $('redirect').textContent = 'Skopiowano ✔'; setTimeout(async () => { $('redirect').textContent = (await sp.authStatus()).redirectUri; }, 1200); };
$('devlink').onclick = (e) => { e.preventDefault(); sp.openUrl('https://developer.spotify.com/dashboard'); };
$('close1').onclick = () => sp.hide();
$('close2').onclick = () => sp.hide();
$('setBtn').onclick = () => sp.openSettings();
sp.onSettings(applyLook);

$('loginBtn').onclick = async () => {
  const id = $('clientId').value.trim();
  if (!id) { $('loginErr').textContent = 'Podaj Client ID'; return; }
  $('loginErr').textContent = 'Czekam na logowanie w przeglądarce…';
  $('loginBtn').disabled = true;
  const r = await sp.login(id);
  $('loginBtn').disabled = false;
  if (r.ok) { $('loginErr').textContent = ''; startPlayer(); }
  else $('loginErr').textContent = r.error || 'Nie udało się zalogować';
};

sp.onLoggedOut(() => { clearInterval(pollTimer); show('login'); });
sp.onUpdate((msg) => flash(msg, true));

// ---------- Player ----------
function startPlayer() {
  show('player');
  poll();
  clearInterval(pollTimer);
  pollTimer = setInterval(poll, 2000);
  loadPlaylists();
}

async function poll() {
  const r = await sp.state();
  if (r.auth === false) { clearInterval(pollTimer); show('login'); return; }
  st = r.state;
  stAt = Date.now();
  render();
  if (r.error) flash(r.error);
}

function render() {
  const card = $('card');
  if (!st) {
    setTitle('Nic nie gra');
    $('artist').textContent = 'Włącz coś w Spotify albo wybierz playlistę';
    $('art').removeAttribute('src');
    delete $('art').dataset.src;
    $('bg').style.backgroundImage = '';
    card.classList.remove('has-art', 'playing');
    setAccent(30, 215, 96);
    $('fill').style.width = '0';
    $('tcur').textContent = '0:00';
    $('tdur').textContent = '0:00';
    return;
  }
  setTitle(st.title);
  $('artist').textContent = st.artist;
  $('card').title = st.device ? 'Urządzenie: ' + st.device : '';
  if (st.art && $('art').dataset.src !== st.art) {
    $('art').src = st.art;
    $('art').dataset.src = st.art;
    $('bg').style.backgroundImage = `url("${st.art}")`;
    accentFrom(st.art);
  }
  card.classList.toggle('has-art', !!st.art);
  card.classList.toggle('playing', st.playing);
  $('shuffle').classList.toggle('on', st.shuffle);
  if (st.volume != null && !volDragging) { $('vol').value = st.volume; $('vol').style.setProperty('--v', st.volume + '%'); }
  $('tdur').textContent = fmt(st.duration);
  markCurrent();
  tick();
}

function tick() {
  if (!st || scrubbing) return;
  const pos = Math.min(st.duration, st.progress + (st.playing ? Date.now() - stAt : 0));
  $('tcur').textContent = fmt(pos);
  $('fill').style.width = (st.duration ? (pos / st.duration) * 100 : 0) + '%';
}
setInterval(tick, 300);

async function act(fn, ...a) {
  const r = await fn(...a);
  if (r && r.ok === false && r.error) flash(r.error);
  setTimeout(poll, 350);
}

$('toggle').onclick = () => {
  if (st) { st.playing = !st.playing; stAt = Date.now(); render(); }
  act(sp.toggle, st ? !st.playing : false);
};
$('next').onclick = () => act(sp.next);
$('prev').onclick = () => act(sp.prev);
$('shuffle').onclick = () => { if (st) act(sp.shuffle, !st.shuffle); };

// Przewijanie: klik albo przeciąganie po pasku (wysyłamy seek dopiero po puszczeniu)
let scrubbing = false;
function scrubTo(e, commit) {
  const rect = $('bar').getBoundingClientRect();
  const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const ms = Math.min(f * st.duration, Math.max(0, st.duration - 500));
  $('fill').style.width = (f * 100) + '%';
  $('tcur').textContent = fmt(ms);
  if (commit) { st.progress = ms; stAt = Date.now(); act(sp.seek, ms); }
}
$('bar').addEventListener('pointerdown', (e) => {
  if (!st || e.button !== 0) return;
  scrubbing = true;
  $('bar').classList.add('scrub');
  $('bar').setPointerCapture(e.pointerId);
  scrubTo(e, false);
});
$('bar').addEventListener('pointermove', (e) => { if (scrubbing && st) scrubTo(e, false); });
$('bar').addEventListener('pointerup', (e) => {
  if (!scrubbing) return;
  scrubbing = false;
  $('bar').classList.remove('scrub');
  if (st) scrubTo(e, true);
});
$('bar').addEventListener('pointercancel', () => { scrubbing = false; $('bar').classList.remove('scrub'); });

$('vol').oninput = () => {
  volDragging = true;
  $('vol').style.setProperty('--v', $('vol').value + '%');
  clearTimeout(volTimer);
  volTimer = setTimeout(async () => { await sp.volume($('vol').value); volDragging = false; }, 150);
};

// ---------- Playlisty ----------
function setPlaylists(open) {
  plOpen = open;
  $('player').classList.toggle('pl-mode', open);   // playlisty zastępują playera, okno bez zmian
  $('plBtn').classList.toggle('on', open);
  $('plBtn').title = open ? 'Wróć do playera' : 'Playlisty';
  // odśwież listę, gdy się nie wczytała albo jest starsza niż 3 minuty (nowe playlisty pojawiają się same)
  if (open) { $('filter').focus(); if (!PREVIEW && (!plLoaded || Date.now() - plAt > 3 * 60 * 1000)) loadPlaylists(); }
  else { $('filter').value = ''; $('filter').blur(); renderPlaylists(); }
}
$('plBtn').onclick = () => setPlaylists(!plOpen);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && plOpen) setPlaylists(false); });
$('filter').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const uri = parseSpotifyLink($('filter').value);
  if (uri) { playUri(uri); $('filter').value = ''; renderPlaylists(); }
});

// Stan ładowania listy: przy błędzie (np. brak sieci tuż po starcie systemu) ponawiamy sami
let plLoaded = false, plAt = 0, plErr = '', plRetry = null, plAttempt = 0, plLoading = false;
async function loadPlaylists() {
  if (plLoading) return;
  plLoading = true;
  let r;
  try { r = await sp.playlists(); } catch { r = { ok: false, items: [], error: 'Brak połączenia' }; }
  plLoading = false;
  // DJ (AI) nie jest zwracany przez API listy playlist, więc przypinamy go ręcznie
  playlists = [LIKED, DJ, ...(r.items || []).filter((p) => p.uri !== DJ.uri)];
  plLoaded = !!r.ok;
  plErr = r.ok ? '' : (r.error || 'nieznany błąd');
  clearTimeout(plRetry);
  if (r.ok) { plAt = Date.now(); plAttempt = 0; }
  else { const delays = [3000, 8000, 20000, 60000]; plRetry = setTimeout(loadPlaylists, delays[Math.min(plAttempt++, delays.length - 1)]); }
  renderPlaylists();
}

const LIKED = { id: 'liked', name: 'Polubione utwory', uri: 'spotify:collection:tracks', liked: true };
const DJ = { id: 'dj', name: 'DJ (Spotify AI)', uri: 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq', dj: true };

// Wklejony link/URI Spotify -> context URI (playlist/album/artist/show)
function parseSpotifyLink(s) {
  const m = s.trim().match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|artist|show)\/([A-Za-z0-9]+)/) ||
            s.trim().match(/^spotify:(playlist|album|artist|show):([A-Za-z0-9]+)$/);
  return m ? `spotify:${m[1]}:${m[2]}` : null;
}

async function playUri(uri) {
  flash('');
  setPlaylists(false);
  const r = await sp.playPlaylist(uri);
  if (!r.ok) flash(r.error);
  else if (r.opened) flash('Otwarto w aplikacji Spotify', true);
  setTimeout(poll, 500);
}

const NAME_HINT = 'Najedź na okładkę, aby zobaczyć nazwę';
// w układzie minimalistycznym lista to poziomy rząd: kółko myszy przewija w bok
$('plList').addEventListener('wheel', (e) => {
  if (document.documentElement.dataset.layout !== 'compact') return;
  e.preventDefault();
  $('plList').scrollLeft += e.deltaY + e.deltaX;
}, { passive: false });

function renderPlaylists() {
  const q = $('filter').value.trim().toLowerCase();
  const list = playlists.filter((p) => p.name.toLowerCase().includes(q));
  const box = $('plList');
  box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="empty">Brak playlist</div>'; return; }
  for (const p of list) {
    const el = document.createElement('div');
    el.className = 'pl';
    el.dataset.uri = p.uri;
    const img = p.image ? Object.assign(document.createElement('img'), { src: p.image }) : Object.assign(document.createElement('div'), { className: 'ph' + (p.dj ? ' dj' : '') });
    if (p.dj) img.textContent = 'DJ';
    if (p.liked) { img.className = 'ph liked'; img.textContent = '♥'; }
    if (p.liked) el.dataset.liked = '1';
    el.append(img);
    el.onmouseenter = () => { $('plName').textContent = p.name; $('plName').classList.add('on'); };
    el.onmouseleave = () => { $('plName').textContent = NAME_HINT; $('plName').classList.remove('on'); };
    el.onclick = () => playUri(p.uri);
    box.appendChild(el);
  }
  if (!plLoaded && !q) { // lista nie wczytała się: kafelek „ponów” zamiast cichego braku playlist
    const el = document.createElement('div');
    el.className = 'pl';
    const ph = Object.assign(document.createElement('div'), { className: 'ph retry', textContent: '↻' });
    el.append(ph);
    el.onmouseenter = () => { $('plName').textContent = `Nie udało się pobrać playlist (${plErr}). Kliknij, aby ponowić`; $('plName').classList.add('on'); };
    el.onmouseleave = () => { $('plName').textContent = NAME_HINT; $('plName').classList.remove('on'); };
    el.onclick = () => { plAttempt = 0; loadPlaylists(); };
    box.appendChild(el);
  }
  markCurrent();
}

function markCurrent() {
  document.querySelectorAll('.pl').forEach((el) => el.classList.toggle('cur', !!st && !!st.context && (el.dataset.uri === st.context || (!!el.dataset.liked && /:collection$/.test(st.context)))));
}

$('filter').oninput = renderPlaylists;

// Podgląd presetu w oknie ustawień: sztuczny stan odtwarzania, bez API
function startPreview() {
  applyLook({ theme: qs.get('theme') || 'liquid', layout: qs.get('layout') || 'standard' });
  document.body.classList.add('preview');
  show('player');
  if (qs.get('mode') === 'playlists') {
    const colors = [['#ff3d81', '#7b2ff7'], ['#1ed760', '#0b3d2e'], ['#ffb347', '#ff5e62'], ['#36d1dc', '#5b86e5'], ['#f857a6', '#ff5858'], ['#8e2de2', '#4a00e0'], ['#f7971e', '#ffd200'], ['#00c6ff', '#0072ff']];
    playlists = colors.map((c, i) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const x = cv.getContext('2d'); const g = x.createLinearGradient(0, 0, 64, 64);
      g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      return { id: 'p' + i, name: 'Playlista ' + (i + 1), uri: 'x' + i, image: cv.toDataURL() };
    });
    playlists.unshift(LIKED);
    plLoaded = true;
    $('player').classList.add('pl-mode');
    renderPlaylists();
    return;
  }
  const c = document.createElement('canvas'); c.width = c.height = 200;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 200, 200);
  g.addColorStop(0, '#ff3d81'); g.addColorStop(.55, '#7b2ff7'); g.addColorStop(1, '#1b1464');
  x.fillStyle = g; x.fillRect(0, 0, 200, 200);
  x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.arc(100, 100, 56, 0, 7); x.fill();
  x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.arc(100, 100, 18, 0, 7); x.fill();
  st = { playing: true, title: qs.get('title') || 'Przykładowy utwór', artist: qs.get('artist') || 'Wykonawca, Gość', art: c.toDataURL(), duration: 157000, progress: 41000, shuffle: true, volume: 60, device: null, context: null };
  stAt = Date.now();
  setInterval(() => { stAt = Date.now(); }, 150); // zamrożony postęp
  render();
}

if (PREVIEW) startPreview(); else init();
