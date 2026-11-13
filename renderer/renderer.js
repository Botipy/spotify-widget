const $ = (id) => document.getElementById(id);

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
function setTitle(text) {
  const t = $('title');
  const span = t.firstElementChild;
  if (span.textContent === text) return;
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
  const a = await sp.authStatus();
  $('redirect').textContent = a.redirectUri;
  $('clientId').value = a.clientId;
  if (a.loggedIn) startPlayer(); else show('login');
}

$('redirect').onclick = () => { navigator.clipboard.writeText($('redirect').textContent); $('redirect').textContent = 'Skopiowano ✔'; setTimeout(async () => { $('redirect').textContent = (await sp.authStatus()).redirectUri; }, 1200); };
$('devlink').onclick = (e) => { e.preventDefault(); sp.openUrl('https://developer.spotify.com/dashboard'); };
$('close1').onclick = () => sp.hide();
$('close2').onclick = () => sp.hide();

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
  if (!st) return;
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

$('bar').onclick = (e) => {
  if (!st) return;
  const rect = $('bar').getBoundingClientRect();
  const ms = ((e.clientX - rect.left) / rect.width) * st.duration;
  st.progress = ms; stAt = Date.now(); tick();
  act(sp.seek, ms);
};

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
  if (open) { $('filter').focus(); if (playlists.length <= 1) loadPlaylists(); }
  else { $('filter').value = ''; $('filter').blur(); renderPlaylists(); }
}
$('plBtn').onclick = () => setPlaylists(!plOpen);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && plOpen) setPlaylists(false); });
$('filter').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const uri = parseSpotifyLink($('filter').value);
  if (uri) { playUri(uri); $('filter').value = ''; renderPlaylists(); }
});

async function loadPlaylists() {
  const r = await sp.playlists();
  // DJ (AI) nie jest zwracany przez API listy playlist, więc przypinamy go ręcznie
  playlists = [LIKED, DJ, ...(r.items || []).filter((p) => p.uri !== DJ.uri)];
  if (!r.ok && r.error) flash('Playlisty: ' + r.error);
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
    const name = document.createElement('span');
    name.textContent = p.name;
    el.append(img, name);
    el.onclick = () => playUri(p.uri);
    box.appendChild(el);
  }
  markCurrent();
}

function markCurrent() {
  document.querySelectorAll('.pl').forEach((el) => el.classList.toggle('cur', !!st && !!st.context && (el.dataset.uri === st.context || (!!el.dataset.liked && /:collection$/.test(st.context)))));
}

$('filter').oninput = renderPlaylists;

init();
