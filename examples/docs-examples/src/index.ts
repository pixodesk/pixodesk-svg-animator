// The case browser. Reads the manifest, renders the sidebar, and shows the
// selected case in an iframe. The selection lives in the URL hash —
// `#react/autoplay` — so every case has an address the docs can link to, and
// the page can be reloaded or shared on that case.
import { CASES, GROUPS, casePath } from '../cases.mjs';

const DOCS = 'https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/';

const nav = document.getElementById('nav')!;
const frame = document.getElementById('frame') as HTMLIFrameElement;
const crumb = document.getElementById('crumb')!;
const open = document.getElementById('open') as HTMLAnchorElement;
const doc = document.getElementById('doc') as HTMLAnchorElement;

const links = new Map<string, HTMLAnchorElement>();
const key = (c: { group: string; id: string }) => `${c.group}/${c.id}`;

for (const g of GROUPS) {
  const h = document.createElement('h2');
  h.textContent = g.title;
  nav.appendChild(h);
  for (const c of CASES.filter(c => c.group === g.id)) {
    const a = document.createElement('a');
    a.href = '#' + key(c);
    a.innerHTML = `${c.title}<small>${c.summary}</small>`;
    nav.appendChild(a);
    links.set(key(c), a);
  }
}

function show(): void {
  const k = location.hash.slice(1) || key(CASES[0]);
  const c = CASES.find(c => key(c) === k) ?? CASES[0];
  const g = GROUPS.find(g => g.id === c.group)!;
  for (const [id, a] of links) a.classList.toggle('active', id === key(c));
  // Relative to this page, so it works in dev, in dist/, and from a sub-folder.
  frame.src = './' + casePath(c);
  open.href = frame.src;
  doc.href = DOCS + g.doc + (c.anchor ? '#' + c.anchor : '');
  crumb.textContent = `${g.title} › ${c.title}`;
  document.title = `${c.title} — Pixodesk SVG Animator examples`;
  links.get(key(c))?.scrollIntoView({ block: 'nearest' });
}

addEventListener('hashchange', show);
show();
