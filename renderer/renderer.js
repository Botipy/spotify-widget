const $ = (id) => document.getElementById(id);
const L = I18N.t;

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
    libContains: noop, libSet: noop, lyricsGet: noop, relogin: noop, playlistTracks: noop,
    pomoGet: async () => null, pomoCmd: noop, pomoSet: noop, pomoSuggest: async () => [], onPomo() {}, onPomoSound() {},
    playlists: async () => ({ ok: true, items: [] }), playPlaylist: noop, hide: noop, quit: noop, openUrl: noop,
  };
}

// ---------- Wygląd: preset (data-theme) + układ (data-layout) ----------
const COVER_ACCENT = new Set(['liquid', 'glass']); // te presety biorą kolor akcentu z okładki
function relocalize() { // po zmianie języka: odśwież teksty dynamiczne
  try {
    $('plBtn').title = plOpen ? L('backToPlayer') : L('playlistsT');
    render(); renderPlaylists(); paintHeart(); if (pomoSt) applyPomoState(pomoSt);
    if (trOpen) renderTracks();
    resetPlName();
  } catch {}
}
function applyLook(s) {
  const root = document.documentElement;
  if (s.lang && s.lang !== I18N.getLang()) { I18N.setLang(s.lang); I18N.apply(); relocalize(); }
  if (typeof s.lyrics === 'boolean' && s.lyrics !== lyricsOn) { lyricsOn = s.lyrics; if (lyricsOn) ensureLyrics(); }
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
  $('pomo').hidden = view !== 'pomo';
}

// Powiadomienia (polubienia, aktualizacje, błędy) nie zasłaniają przycisków: na kilka sekund podmieniają linię
// wykonawcy w playerze, a w widoku playlist linię z nazwą pod okładkami.
let flashTimer = null, noticeText = '', noticeBad = false;
function applyNotice() {
  const a = $('artist');
  const on = !!noticeText;
  a.classList.toggle('notice', on);
  a.classList.toggle('bad', on && noticeBad);
  if (on || !lyShown) { // gdy leci linijka napisów, nie nadpisujemy jej (pętla napisów sama przywróci wykonawcę)
    a.classList.remove('ly');
    a.textContent = on ? noticeText : (st ? st.artist : L('idleArtist'));
  }
  if (plOpen) {
    const n = $('plName');
    n.textContent = on ? noticeText : nameHint();
    n.classList.toggle('on', on);
    n.classList.toggle('bad', on && noticeBad);
  }
}
function flash(msg, good) {
  clearTimeout(flashTimer);
  noticeText = msg || '';
  noticeBad = !good;
  applyNotice();
  if (msg) flashTimer = setTimeout(() => { noticeText = ''; applyNotice(); }, 3800);
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

$('redirect').onclick = () => { navigator.clipboard.writeText($('redirect').textContent); $('redirect').textContent = L('copied'); setTimeout(async () => { $('redirect').textContent = (await sp.authStatus()).redirectUri; }, 1200); };
$('login').addEventListener('click', (e) => { if (e.target.id === 'devlink') { e.preventDefault(); sp.openUrl('https://developer.spotify.com/dashboard'); } });
$('close1').onclick = () => sp.hide();
$('close2').onclick = () => sp.hide();
$('setBtn').onclick = () => sp.openSettings();
sp.onSettings(applyLook);

$('loginBtn').onclick = async () => {
  const id = $('clientId').value.trim();
  if (!id) { $('loginErr').textContent = L('enterClientId'); return; }
  $('loginErr').textContent = L('waitingBrowser');
  $('loginBtn').disabled = true;
  const r = await sp.login(id);
  $('loginBtn').disabled = false;
  if (r.ok) { $('loginErr').textContent = ''; startPlayer(); }
  else $('loginErr').textContent = r.error || L('signInFailed');
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
    setTitle(L('nothingPlaying'));
    applyNotice();
    $('art').removeAttribute('src');
    delete $('art').dataset.src;
    $('bg').style.backgroundImage = '';
    card.classList.remove('has-art', 'playing');
    paintHeart();
    setAccent(30, 215, 96);
    $('fill').style.width = '0';
    $('tcur').textContent = '0:00';
    $('tdur').textContent = '0:00';
    return;
  }
  setTitle(st.title);
  applyNotice();
  ensureLyrics();
  $('card').title = st.device ? L('deviceLbl', { d: st.device }) : '';
  if (st.art && $('art').dataset.src !== st.art) {
    $('art').src = st.art;
    $('art').dataset.src = st.art;
    $('bg').style.backgroundImage = `url("${st.art}")`;
    accentFrom(st.art);
  }
  card.classList.toggle('has-art', !!st.art);
  card.classList.toggle('playing', st.playing);
  paintHeart();
  ensureSavedKnown();
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
  if (!open && trOpen) hideTracks();
  $('player').classList.toggle('pl-mode', open);   // playlisty zastępują playera, okno bez zmian
  $('plBtn').classList.toggle('on', open);
  $('plBtn').title = open ? L('backToPlayer') : L('playlistsT');
  if (open) applyNotice();
  // odśwież listę, gdy się nie wczytała albo jest starsza niż 3 minuty (nowe playlisty pojawiają się same)
  if (open) { $('filter').focus(); if (!PREVIEW && (!plLoaded || Date.now() - plAt > 3 * 60 * 1000)) loadPlaylists(); }
  else { $('filter').value = ''; $('filter').blur(); renderPlaylists(); }
}
$('plBtn').onclick = () => { if (trOpen) hideTracks(); else setPlaylists(!plOpen); };
document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (trOpen) hideTracks(); else if (plOpen) setPlaylists(false); });
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
  try { r = await sp.playlists(); } catch { r = { ok: false, items: [], error: L('noConn') }; }
  plLoading = false;
  // DJ (AI) nie jest zwracany przez API listy playlist, więc przypinamy go ręcznie
  playlists = [LIKED, DJ, ...(r.items || []).filter((p) => p.uri !== DJ.uri)];
  plLoaded = !!r.ok;
  plErr = r.ok ? '' : (r.error || L('unknownErr'));
  clearTimeout(plRetry);
  if (r.ok) { plAt = Date.now(); plAttempt = 0; }
  else { const delays = [3000, 8000, 20000, 60000]; plRetry = setTimeout(loadPlaylists, delays[Math.min(plAttempt++, delays.length - 1)]); }
  renderPlaylists();
}

const LIKED = { id: 'liked', get name() { return L('likedSongs'); }, uri: 'spotify:collection:tracks', liked: true };
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
  else if (r.opened) flash(L('openedInSpotify'), true);
  setTimeout(poll, 500);
}

const nameHint = () => L('nameHint');
// po zjechaniu z okładki wracamy do powiadomienia (jeśli trwa) albo do podpowiedzi
function resetPlName() { const n = $('plName'); n.textContent = noticeText || nameHint(); n.classList.toggle('on', !!noticeText); n.classList.toggle('bad', !!noticeText && noticeBad); }
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
  if (!list.length) { box.innerHTML = '<div class="empty">' + L('noPlaylists') + '</div>'; return; }
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
    el.onmouseleave = resetPlName;
    el.onclick = () => playUri(p.uri);
    el.oncontextmenu = (e) => { e.preventDefault(); showTracks(p); };
    const pk = document.createElement('button');
    pk.className = 'peek'; pk.title = L('showTracks');
    pk.innerHTML = '<svg><use href="#i-list"/></svg>';
    pk.onclick = (e) => { e.stopPropagation(); showTracks(p); };
    el.append(pk);
    box.appendChild(el);
  }
  if (!plLoaded && !q) { // lista nie wczytała się: kafelek „ponów” zamiast cichego braku playlist
    const el = document.createElement('div');
    el.className = 'pl';
    const ph = Object.assign(document.createElement('div'), { className: 'ph retry', textContent: '↻' });
    el.append(ph);
    el.onmouseenter = () => { $('plName').textContent = L('plFail', { e: plErr }); $('plName').classList.add('on'); };
    el.onmouseleave = resetPlName;
    el.onclick = () => { plAttempt = 0; loadPlaylists(); };
    box.appendChild(el);
  }
  markCurrent();
}

function markCurrent() {
  document.querySelectorAll('.tr').forEach((el) => el.classList.toggle('cur', !!st && el.dataset.uri === st.uri));
  document.querySelectorAll('.pl').forEach((el) => el.classList.toggle('cur', !!st && !!st.context && (el.dataset.uri === st.context || (!!el.dataset.liked && /:collection$/.test(st.context)))));
}

$('filter').oninput = renderPlaylists;

// ---------- Wybór utworu z playlisty ----------
// Wejście: ikona ≡ na kafelku albo prawy klik. Playlisty tylko własne/współdzielone (ograniczenie Spotify od 2026).
let trOpen = false, trPl = null, trItems = [], trOffset = 0, trMore = false, trLoading = false, trErr = '';

function showTracks(p) {
  trOpen = true; trPl = p; trItems = []; trOffset = 0; trMore = false; trErr = '';
  $('player').classList.add('tr-mode');          // pl-mode zostaje (okno i układ bez zmian), tr-mode podmienia zawartość
  $('trTitle').hidden = false;
  $('trTitle').textContent = p.name;
  $('filter').blur();
  renderTracks();
  loadTracks();
}
function hideTracks() {
  trOpen = false; trPl = null;
  $('player').classList.remove('tr-mode');
  $('trTitle').hidden = true;
  $('trList').scrollTop = 0;
}
async function loadTracks() {
  if (trLoading || !trPl) return;
  trLoading = true; renderTracks();
  const pl = trPl;
  let r;
  try { r = await sp.playlistTracks(pl.uri, trOffset); } catch { r = { ok: false, error: L('noConn') }; }
  trLoading = false;
  if (trPl !== pl || !trOpen) return; // użytkownik zdążył wyjść
  if (r.ok) { trItems = trItems.concat(r.items); trOffset += 50; trMore = r.more; trErr = ''; }
  else trErr = r.needScope ? L('needPlScope') : (r.error || L('tracksFail'));
  renderTracks();
}
function renderTracks() {
  const box = $('trList');
  const keep = box.scrollTop;
  box.innerHTML = '';
  trItems.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'tr' + (st && st.uri === t.uri ? ' cur' : '');
    el.dataset.uri = t.uri;
    const n = Object.assign(document.createElement('span'), { className: 'n', textContent: i + 1 });
    const tt = document.createElement('span');
    tt.className = 'tt';
    const b = Object.assign(document.createElement('b'), { textContent: t.name });
    const a = Object.assign(document.createElement('i'), { textContent: t.artist });
    tt.append(b, a);
    const d = Object.assign(document.createElement('span'), { className: 'd', textContent: fmt(t.ms) });
    el.append(n, tt, d);
    el.onclick = () => playTrack(i);
    box.appendChild(el);
  });
  const note = (msg) => box.appendChild(Object.assign(document.createElement('div'), { className: 'empty', textContent: msg }));
  if (trLoading) note(L('loading'));
  else if (trErr) note(trErr);
  else if (!trItems.length) note(L('noTracks'));
  box.scrollTop = keep;
}
$('trList').addEventListener('scroll', () => {
  const b = $('trList');
  if (trMore && !trLoading && b.scrollTop + b.clientHeight > b.scrollHeight - 40) loadTracks(); // dociągnij kolejną stronę
});
async function playTrack(i) {
  const t = trItems[i], pl = trPl;
  if (!t || !pl) return;
  flash('');
  // Kontekst + start od wybranego utworu (też dla Polubionych). Wariant z listą uris Spotify potwierdza (204), ale nic nie gra.
  const opts = { offsetUri: t.uri };
  setPlaylists(false); // wracamy do playera
  const r = await sp.playPlaylist(pl.uri, opts);
  if (!r.ok) flash(r.error);
  else if (r.opened) flash(L('openedInSpotify'), true);
  setTimeout(poll, 500);
}
// ---------- Serduszko: dodaj/usuń bieżący utwór z polubionych ----------
const savedCache = new Map();   // uri utworu -> czy polubiony
let heartChecking = null, heartBusy = false;

function paintHeart() {
  const b = $('heart');
  const ok = !!(st && st.kind === 'track' && st.uri);
  const saved = ok && savedCache.get(st.uri) === true;
  b.disabled = !ok;
  b.classList.toggle('on', saved);
  b.title = !ok ? L('heartOnlyTracks') : saved ? L('heartRemove') : L('heartAdd');
}
async function ensureSavedKnown() {
  if (!st || st.kind !== 'track' || !st.uri || savedCache.has(st.uri) || heartChecking === st.uri) return;
  const uri = st.uri;
  heartChecking = uri;
  const r = await sp.libContains(uri);
  heartChecking = null;
  if (r.ok) savedCache.set(uri, r.saved); // przy braku zgody (needScope) poprosimy dopiero po kliknięciu serca
  paintHeart();
}
$('heart').onclick = async () => {
  if (!st || st.kind !== 'track' || !st.uri || heartBusy) return;
  const uri = st.uri;
  const want = savedCache.get(uri) !== true;
  heartBusy = true;
  savedCache.set(uri, want); paintHeart(); // od razu pokazujemy zmianę, w razie błędu cofniemy
  let r = await sp.libSet(uri, want);
  if (r.needScope) { // stary token nie ma uprawnień do biblioteki: jednorazowa ponowna zgoda
    flash(L('consent'), true);
    const a = await sp.relogin();
    r = a.ok ? await sp.libSet(uri, want) : { ok: false, error: a.error || L('consentFail') };
  }
  heartBusy = false;
  if (!r.ok) { savedCache.set(uri, !want); paintHeart(); flash(r.error || L('likeFail')); return; }
  paintHeart();
  flash(want ? L('likedAdded') : L('likedRemoved'), true);
};

// ---------- Napisy: zsynchronizowane teksty (opcjonalne, domyślnie wyłączone) ----------
// Linijka napisów zastępuje wykonawcę: wjeżdża z rozmyciem, wypełnia się kolorem akcentu w rytm utworu,
// a zbyt długa linijka sama się przesuwa. Gdy utwór nie ma napisów, widać wykonawcę jak zwykle.
let lyricsOn = false, lyrics = { uri: null, lines: null }, lyShown = false, lyIdx = -2, lyEl = null, lyLit = -1, lyScroll = false;
const LY_DEMO_TEXT = ['Synced lyrics, line by line', 'Words light up one by one in time with the song', 'Long lines wrap onto two rows instead of being cut', '', 'Works in every style and layout'];
const LY_DEMO = Array.from({ length: 60 }, (_, i) => ({ t: i * 4000, text: LY_DEMO_TEXT[i % LY_DEMO_TEXT.length] }));
function curPos() { return Math.min(st.duration, st.progress + (st.playing ? Date.now() - stAt : 0)); }
async function ensureLyrics() {
  if (!lyricsOn || !st || st.kind !== 'track' || !st.uri || lyrics.uri === st.uri) return;
  const uri = st.uri;
  lyrics = { uri, lines: null };
  let r = null;
  try { r = await sp.lyricsGet({ uri, title: st.title, artist: st.artist, artist1: st.artist1, album: st.album, durationMs: st.duration }); } catch {}
  if (lyrics.uri === uri) lyrics.lines = r && r.ok && r.lines && r.lines.length ? r.lines : null;
}
function lyIndexAt(lines, pos) { // ostatnia linijka z czasem <= pos (wyszukiwanie binarne)
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (lines[m].t <= pos) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}
// Dopasowanie rozmiaru: linijka może zająć 2 wiersze; jeśli się nie mieści, zmniejszamy czcionkę (nigdy nie ucinamy po cichu).
function fitLyric(el) {
  for (const px of [11.5, 10.5, 9.8]) {
    el.style.fontSize = px + 'px';
    if (el.scrollHeight <= el.clientHeight + 1) return 0;
  }
  return el.scrollHeight - el.clientHeight; // dalej za długie: linijka przewinie się w pionie w rytm utworu
}
function lyricLoop() {
  requestAnimationFrame(lyricLoop);
  if (!lyricsOn && !lyShown) return;
  const a = $('artist');
  const lines = lyrics.lines;
  let want = lyricsOn && !noticeText && !!st && !!lines && lyrics.uri === st.uri;
  let pos = 0, idx = -1;
  if (want) { pos = curPos() + 200; idx = lyIndexAt(lines, pos); if (idx < 0) want = false; }
  if (!want) {
    if (lyShown) { lyShown = false; lyIdx = -2; lyEl = null; a.style.fontSize = ''; $('card').classList.remove('ly-on'); applyNotice(); }
    return;
  }
  if (!lyShown || idx !== lyIdx || !lyEl || !lyEl.isConnected) {
    lyShown = true; lyIdx = idx; lyLit = -1;
    const ln = lines[idx];
    const el = document.createElement('span');
    el.className = 'ly-line' + (ln.text ? '' : ' gap');
    if (ln.text) {
      ln.text.split(/\s+/).forEach((w, i, arr) => {
        const sp = document.createElement('span');
        sp.className = 'w';
        sp.textContent = w;
        el.append(sp);
        if (i < arr.length - 1) el.append(' ');
      });
    } else el.textContent = '♪';
    a.classList.add('ly'); a.classList.remove('notice', 'bad');
    $('card').classList.add('ly-on');
    a.style.fontSize = '';
    a.replaceChildren(el);
    lyEl = el;
    const over = fitLyric(a);
    el.style.setProperty('--oy', (over > 1 ? -over : 0) + 'px');
    lyScroll = over > 1;
  }
  const ln = lines[idx], next = lines[idx + 1];
  const span = next ? Math.min(next.t - ln.t, Math.max(1800, ln.text.length * 85)) : 4000;
  const p = Math.max(0, Math.min(1, (pos - ln.t) / span));
  if (lyScroll) lyEl.style.setProperty('--p', String(p));
  const words = lyEl.querySelectorAll('.w');
  const lit = words.length ? Math.min(words.length, Math.floor(p * words.length) + 1) : 0;
  if (lit !== lyLit) { lyLit = lit; words.forEach((w, i) => w.classList.toggle('on', i < lit)); }
}
requestAnimationFrame(lyricLoop);

// ---------- Pomodoro: widok timera ----------
let pomoSt = null, pomoAt = 0, pomoView = false;
const RING_C = 2 * Math.PI * 44;
const pomoFmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function pomoRemain() {
  if (!pomoSt) return 0;
  return pomoSt.running ? Math.max(0, pomoSt.remainMs - (performance.now() - pomoAt)) : pomoSt.remainMs;
}
function paintPomoView() {
  if (!pomoSt || $('pomo').hidden) return;
  const r = pomoRemain(), total = pomoSt.totalMs || 1;
  $('pomoTime').textContent = pomoFmt(r);
  $('ringFg').style.strokeDashoffset = String(RING_C * (1 - Math.min(1, r / total))); // pierścień „opróżnia się" wraz z upływem czasu
}
function showPomo(on) {
  pomoView = on;
  if (on) { setPlaylists(false); show('pomo'); paintPomoView(); } else show('player');
}
function applyPomoState(st) {
  if (!st) return;
  pomoSt = st; pomoAt = performance.now();
  const on = !!st.settings.enabled;
  document.documentElement.classList.toggle('pomo-on', on);
  $('pomoBtn').hidden = !on;
  if (!on && pomoView) showPomo(false); // Pomodoro wyłączone w ustawieniach: wracamy do muzyki
  const pv = $('pomo');
  pv.classList.toggle('running', st.running);
  pv.dataset.mode = st.mode;
  document.querySelectorAll('.pm').forEach((b) => b.classList.toggle('on', b.dataset.mode === st.mode));
  const box = $('pomoDots');
  if (box.children.length !== st.sessions) {
    box.innerHTML = '';
    for (let i = 0; i < st.sessions; i++) box.appendChild(Object.assign(document.createElement('i'), { className: 'pdot' }));
  }
  const done = st.mode === 'focus' ? st.session - 1 : st.session; // w przerwie bieżąca sesja jest już zrobiona
  [...box.children].forEach((d, i) => { d.className = 'pdot' + (i < done ? ' done' : '') + (st.mode === 'focus' && i === st.session - 1 ? ' cur' : ''); });
  $('pomoLabel').textContent = st.mode === 'long' ? L('pomoLong') : (st.mode === 'short' ? L('pomoShort') : L('pomoSession')) + st.session + '/' + st.sessions;
  paintPomoView();
}
$('pomoBtn').onclick = () => showPomo(true);
$('pomoBack').onclick = () => showPomo(false);
$('setBtn2').onclick = () => sp.openSettings();
$('close3').onclick = () => sp.hide();
document.querySelectorAll('.pm').forEach((b) => { b.onclick = () => sp.pomoCmd('mode', b.dataset.mode); });
$('pToggle').onclick = () => sp.pomoCmd('toggle');
$('pReset').onclick = () => sp.pomoCmd('reset');
$('pSkip').onclick = () => sp.pomoCmd('skip');
sp.onPomo(applyPomoState);
sp.onPomoSound((kind) => playPomoSound(kind));
setInterval(paintPomoView, 250);
sp.pomoGet().then(applyPomoState).catch(() => {});
// Podgląd presetu w oknie ustawień: sztuczny stan odtwarzania, bez API
function startPreview() {
  if (qs.get('lang')) { I18N.setLang(qs.get('lang')); I18N.apply(); }
  applyLook({ theme: qs.get('theme') || 'liquid', layout: qs.get('layout') || 'standard' });
  document.body.classList.add('preview');
  show('player');
  if (qs.get('mode') === 'pomo') { // podgląd widoku timera (stan zamrożony)
    applyPomoState({ mode: 'focus', session: 3, sessions: 4, running: true, remainMs: 24 * 60000 + 35000, totalMs: 25 * 60000, settings: { enabled: true } });
    show('pomo');
    setInterval(() => { pomoAt = performance.now(); paintPomoView(); }, 150);
    return;
  }
  if (qs.get('mode') === 'playlists') {
    const colors = [['#ff3d81', '#7b2ff7'], ['#1ed760', '#0b3d2e'], ['#ffb347', '#ff5e62'], ['#36d1dc', '#5b86e5'], ['#f857a6', '#ff5858'], ['#8e2de2', '#4a00e0'], ['#f7971e', '#ffd200'], ['#00c6ff', '#0072ff']];
    playlists = colors.map((c, i) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const x = cv.getContext('2d'); const g = x.createLinearGradient(0, 0, 64, 64);
      g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      return { id: 'p' + i, name: L('exPlaylist', { n: i + 1 }), uri: 'x' + i, image: cv.toDataURL() };
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
  st = { playing: true, title: qs.get('title') || L('exTrack'), artist: qs.get('artist') || L('exArtist'), art: c.toDataURL(), duration: Number(qs.get('dur')) || 157000, progress: Number(qs.get('pos')) || 41000, shuffle: true, volume: 60, device: null, context: null, kind: 'track', uri: 'spotify:track:preview' };
  savedCache.set('spotify:track:preview', true); // w podglądzie serce jest wypełnione
  if (qs.get('lyrics') === '1') { lyricsOn = true; lyrics = { uri: st.uri, lines: LY_DEMO }; } // podgląd napisów (atrapa)
  stAt = Date.now();
  if (qs.get('anim') !== '1') setInterval(() => { stAt = Date.now(); }, 150); // zamrożony postęp (anim=1: postęp biegnie, do GIF-ów)
  render();
}

if (PREVIEW) startPreview(); else init();
