const THEMES = [
  ['liquid', 'Liquid Glass'], ['retro', 'Retro'], ['terminal', 'Terminal'], ['gameboy', 'Game Boy'], ['neon', 'Neon'],
  ['vaporwave', 'Vaporwave'], ['win98', 'Win98'], ['winamp', 'Winamp'], ['glass', 'Glass'], ['y2k', 'Y2K'], ['sakura', 'Sakura'],
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


