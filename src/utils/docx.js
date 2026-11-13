import { ewMd } from './markdown.js';

let webpSupported = null;
function supportsWebp() {
  if (webpSupported !== null) return webpSupported;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupported = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch (e) {
    webpSupported = false;
  }
  return webpSupported;
}

function encodeImage(im, maxDim = 1200, quality = 0.78) {
  const k = Math.min(1, maxDim / Math.max(1, im.width, im.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(im.width * k));
  c.height = Math.max(1, Math.round(im.height * k));
  const x = c.getContext('2d');
  const useWebp = supportsWebp();
  if (!useWebp) {
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
  }
  x.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL(useWebp ? 'image/webp' : 'image/jpeg', quality);
}

export const shrink = (f, maxDim = 1200, quality = 0.78) =>
  new Promise((ok) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => ok(encodeImage(im, maxDim, quality));
      im.onerror = () => ok(null);
      im.src = r.result;
    };
    r.readAsDataURL(f);
  });

export const shrinkU = (u, maxDim = 1200, quality = 0.78) =>
  new Promise((ok) => {
    const im = new Image();
    im.onload = () => ok(encodeImage(im, maxDim, quality));
    im.onerror = () => ok(null);
    im.src = u;
  });

export async function docxImport(file) {
  const mod = (typeof window !== 'undefined' && window.mammoth) || (await import('mammoth/mammoth.browser'));
  const mammoth = mod.default || mod;
  const buf = await file.arrayBuffer();
  const r = await mammoth.convertToHtml(
    { arrayBuffer: buf },
    { styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Name'] => h1:fresh", "p[style-name='Subtitle'] => p:fresh"] }
  );
  const d = document.createElement('div');
  d.innerHTML = r.value;
  const imgs = {};
  for (const im of [...d.querySelectorAll('img')]) {
    const u = await shrinkU(im.getAttribute('src'));
    let t = im;
    while (t.parentNode && t.parentNode !== d) t = t.parentNode;
    if (!u) {
      im.remove();
      continue;
    }
    const id = 'i' + Math.random().toString(36).slice(2, 8);
    imgs[id] = u;
    const fg = document.createElement('figure');
    const n = document.createElement('img');
    n.src = u;
    n.setAttribute('data-id', id);
    fg.appendChild(n);
    im.remove();
    t.after(fg);
    if (t.tagName === 'P' && !t.textContent.trim()) t.remove();
  }
  d.querySelectorAll('p').forEach((x) => {
    if (!x.textContent.trim() && !x.querySelector('img')) x.remove();
  });
  let title = '';
  let h1 = '';
  const first = d.firstElementChild;
  if (first && first.tagName === 'H1') {
    title = h1 = first.textContent.trim();
    first.remove();
  }
  if (!title) title = file.name.replace(/\.docx$/i, '').replace(/[_]+/g, ' ').trim();
  const fp = [...d.children].find((x) => x.tagName === 'P' && x.textContent.trim().length > 20);
  let desc = fp ? fp.textContent.trim().replace(/\s+/g, ' ') : '';
  if (desc.length > 180) desc = desc.slice(0, 180).replace(/\s+\S*$/, '') + '…';
  const body = ewMd(d, imgs);
  return { title, h1, desc, body, imgs };
}
