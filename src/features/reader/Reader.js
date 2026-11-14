import { createPortal } from 'react-dom';
import { html, Fragment, useState, useMemo, useEffect, useRef } from '../../lib/react.js';
import { ST, TY, STG, DC, can, normRole } from '../../config/constants.js';
import { byId } from '../../data/spaces.js';
import { TPL } from '../../data/templates.js';
import { fmt, days } from '../../utils/format.js';
import { esc, plain, md, ewTx, ewMd } from '../../utils/markdown.js';
import { shrink, docxImport } from '../../utils/docx.js';
import { Ic } from '../../components/Icon.js';
import { Pill, VisPill } from '../../components/Badge.js';
import { db } from '../../lib/db.js';
import { EW_TBL, EW_SL, EW_CL, TURN, BLOCK_LABELS, TEXT_COLORS, HL_COLORS, AI_ACTIONS, BlockGlyph } from '../editor/editorConfig.js';
import { createDocCollabSession } from '../../lib/realtimeCollab.js';
import { LocalImpactGraph } from '../graph/LocalImpactGraph.js';

function clampMenuPos(x, y, width, estHeight) {
  if (typeof window === 'undefined') return { left: x, top: y };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(10, Math.min(x, vw - width - 10));
  const fitsBelow = y + estHeight <= vh - 12;
  if (fitsBelow) return { left, top: Math.max(10, y) };
  const above = y - estHeight - 10;
  return { left, top: Math.max(10, above > 10 ? above : vh - Math.min(estHeight, vh - 20) - 10) };
}

export function Reader(p) {
  const { r, res, imgs, tree, userName } = p;
  const isGuest = normRole(p.role) === 'Guest';
  const cat = byId(r.node, tree);
  const canEditItem = Boolean(can.edit(p.role, r, cat, userName));
  const [readLock, setReadLock] = useState(false);
  const isEditing = canEditItem && !readLock;
  const canPublishCat = can.status(p.role, cat, userName);

  // Guest redaction for internal attachments
  const bodyToRender = useMemo(() => {
    if (!isGuest) return r.body || '';
    return (r.body || '').replace(/!\[([^\]]*)\]\(img:(\w+)\)/g, (full, caption, id) =>
      (r.publicAttachments || []).includes(id) ? full : `> [!note] Internal attachment omitted (${caption || id})`
    );
  }, [r.body, isGuest, r.publicAttachments]);

  const m = useMemo(() => md(bodyToRender, imgs, (p.chk && p.chk[r.id]) || []), [bodyToRender, imgs, p.chk, r.id]);

  // Unified page states
  const [titleVal, setTitleVal] = useState(r.title || '');
  const [descVal, setDescVal] = useState(r.desc || '');
  const [urlVal, setUrlVal] = useState(r.url || '');
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceText, setSourceText] = useState(r.body || '');
  const [emp, setEmp] = useState(!(r.body || '').trim());
  const [liveToc, setLiveToc] = useState(m.toc);

  // Editor floating UI states (all portaled to document.body)
  const [fb, setFb] = useState(null);
  const [fbPop, setFbPop] = useState(null);
  const [fa, setFa] = useState({});
  const [curBlkLabel, setCurBlkLabel] = useState('Text');
  const [curBlkKey, setCurBlkKey] = useState('p');
  const [sl, setSl] = useState(null);
  const [hd, setHd] = useState(null);
  const [bm, setBm] = useState(null);
  const [dp, setDp] = useState(null);
  const [tb, setTb] = useState(null);
  const [lk, setLk] = useState(null);
  const [ib, setIb] = useState(false);
  const [lasso, setLasso] = useState(null);
  const [selCount, setSelCount] = useState(0);
  const [figAct, setFigAct] = useState(null);

  // Reading / scroll states
  const [pg, setPg] = useState(0);
  const [act, setAct] = useState('');
  const [zm, setZm] = useState(null);

  // Collaboration states
  const [peers, setPeers] = useState([]);
  const [collabStatus, setCollabStatus] = useState('connecting');
  const [syncState, setSyncState] = useState('Saved');
  const [simOn, setSimOn] = useState(false);
  const [peerBoxes, setPeerBoxes] = useState([]);

  // Refs
  const root = useRef(null);
  const wrap = useRef(null);
  const titleRef = useRef(null);
  const drag = useRef(null);
  const lt = useRef(0);
  const selR = useRef(null);
  const tocK = useRef('');
  const fi = useRef(null);
  const dx = useRef(null);
  const loc = useRef({});
  const clickLockRef = useRef(0);
  const lastRecBucketRef = useRef({ key: '' });
  const collabRef = useRef(null);
  const lastBodyRef = useRef(r.body || '');
  const autoSaveTimerRef = useRef(null);
  const applyingRemoteRef = useRef(false);
  const activeFieldRef = useRef(null);
  const rRef = useRef(r);
  rRef.current = r;
  const peersRef = useRef(peers);
  peersRef.current = peers;

  const closeMenus = (except) => {
    if (except !== 'sl') setSl(null);
    if (except !== 'bm') setBm(null);
    if (except !== 'lk') setLk(null);
    if (except !== 'fbPop') setFbPop(null);
    if (except !== 'figAct') setFigAct(null);
  };

  // Reset local buffers when switching document id
  useEffect(() => {
    setTitleVal(r.title || '');
    setDescVal(r.desc || '');
    setUrlVal(r.url || '');
    setSourceText(r.body || '');
    setSourceMode(false);
    setReadLock(false);
    closeMenus();
    setFb(null);
    setSimOn(false);
    setSelCount(0);
    setSyncState('Saved');
    lastBodyRef.current = r.body || '';
    if (canEditItem && !(r.title || '').trim() && !(r.body || '').trim()) {
      setTimeout(() => titleRef.current && titleRef.current.focus(), 40);
    }
  }, [r.id]);

  useEffect(() => {
    if (activeFieldRef.current !== 'title') setTitleVal(r.title || '');
  }, [r.title]);
  useEffect(() => {
    if (activeFieldRef.current !== 'desc') setDescVal(r.desc || '');
  }, [r.desc]);
  useEffect(() => {
    if (activeFieldRef.current !== 'url') setUrlVal(r.url || '');
  }, [r.url]);

  const blockTypeOf = (el) => {
    if (!el) return 'p';
    const tag = el.tagName;
    if (tag === 'H1') return 'h1';
    if (tag === 'H2') return 'h2';
    if (tag === 'H3') return 'h3';
    if (tag === 'PRE') return 'code';
    if (tag === 'DETAILS') return 'tgl';
    if (tag === 'OL') return 'ol';
    if (tag === 'UL') return el.querySelector('li.ck') ? 'ck' : 'ul';
    if (tag === 'BLOCKQUOTE') {
      const k = ['note', 'tip', 'warn'].find((c) => el.classList.contains(c));
      return k || 'quote';
    }
    return 'p';
  };

  const toDom = (s) => {
    const d = document.createElement('div');
    d.innerHTML = md(s || '', { ...imgs, ...loc.current }).h || '<p><br></p>';
    // Ensure accidental literal leading # prefixes on headings are stripped cleanly
    d.querySelectorAll('h1,h2,h3').forEach((h) => {
      if (h.firstChild && h.firstChild.nodeType === 3) {
        h.firstChild.data = h.firstChild.data.replace(/^#{1,3}\s+/, '');
      }
    });
    d.querySelectorAll('figure').forEach((f) => {
      f.contentEditable = 'false';
      const im = f.querySelector('img');
      if (im) im.draggable = false;
      let c = f.querySelector('figcaption');
      if (!c) {
        c = document.createElement('figcaption');
        f.appendChild(c);
      }
      c.contentEditable = 'true';
    });
    d.querySelectorAll('blockquote').forEach((q) => {
      const b = q.querySelector('b');
      b && (b.contentEditable = 'false');
      const x = document.createElement('div');
      [...q.childNodes].forEach((c) => {
        if (c !== b) x.appendChild(c);
      });
      if (!x.textContent) x.innerHTML = '<br>';
      q.appendChild(x);
    });
    d.querySelectorAll('details.tgl').forEach((dt) => {
      const sm = dt.querySelector('summary');
      const dv = dt.querySelector('.tgl-b');
      if (sm) sm.contentEditable = 'true';
      if (dv) dv.contentEditable = 'true';
    });
    d.querySelectorAll('td,th').forEach((c) => {
      if (!c.textContent) c.textContent = '\u200b';
    });
    return d;
  };

  const refreshTocFromDom = (elRoot) => {
    if (!elRoot) return;
    const hs = [...elRoot.querySelectorAll('h1,h2,h3')];
    const tc = hs
      .map((h, idx) => {
        const sid = 's' + idx;
        if (h.id !== sid) h.id = sid;
        return {
          id: sid,
          t: h.textContent.replace(/^#{1,3}\s+/, '').trim(),
          l: h.tagName === 'H3' ? 3 : 2,
        };
      })
      .filter((x) => x.t);
    const k = JSON.stringify(tc);
    if (k !== tocK.current) {
      tocK.current = k;
      setLiveToc(tc);
    }
  };

  const computePeerBoxes = () => {
    const elRoot = root.current;
    const elWrap = wrap.current;
    if (!elRoot || !elWrap) {
      setPeerBoxes([]);
      return;
    }
    const wRect = elWrap.getBoundingClientRect();
    const list = [];
    (peersRef.current || []).forEach((peer) => {
      if (peer.activeField === 'block' && peer.activeBlock !== null && peer.activeBlock !== undefined) {
        const blk = elRoot.children[peer.activeBlock] || elRoot.lastElementChild;
        if (blk) {
          const bRect = blk.getBoundingClientRect();
          list.push({
            clientId: peer.clientId,
            name: peer.name,
            color: peer.color,
            isTyping: peer.isTyping,
            top: bRect.top - wRect.top,
            height: Math.max(26, bRect.height),
          });
        }
      }
    });
    setPeerBoxes(list);
  };

  useEffect(() => {
    computePeerBoxes();
  }, [peers, liveToc, r.id, sourceMode]);

  const up = (sel) => {
    const s = getSelection();
    if (!s || !s.rangeCount) return null;
    const n = s.anchorNode;
    const e = n && (n.nodeType === 1 ? n : n.parentElement);
    const rEl = root.current;
    return e && rEl && rEl.contains(e) ? e.closest(sel) : null;
  };

  const blockOf = () => {
    const s = getSelection();
    const rEl = root.current;
    if (!s || !s.rangeCount || !rEl) return null;
    let n = s.anchorNode;
    while (n && n.parentNode !== rEl) n = n.parentNode;
    return n && n.nodeType === 1 ? n : null;
  };

  const blockIndexOf = (el) => {
    const rEl = root.current;
    if (!rEl || !el) return -1;
    return [...rEl.children].indexOf(el);
  };

  const caret = (e, end) => {
    if (!e) return;
    try {
      const rg = document.createRange();
      rg.selectNodeContents(e);
      rg.collapse(!end);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(rg);
      root.current && root.current.focus();
    } catch (err) {}
  };

  const commitInlinePatch = (patch, options = {}) => {
    if (!p.onInlineUpdate || !rRef.current) return;
    if (patch.body !== undefined) {
      lastBodyRef.current = patch.body;
      setSourceText(patch.body);
    }
    p.onInlineUpdate(rRef.current.id, patch, options);
  };

  const scheduleAutoSave = (nextBody) => {
    setSyncState('Saving…');
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      commitInlinePatch({ body: nextBody }, { silent: true });
      setSyncState('Saved');
    }, 220);
  };

  const broadcastCurrentBlock = (bEl, isTyping = false) => {
    if (!collabRef.current || !root.current || !bEl) return;
    const idx = blockIndexOf(bEl);
    if (idx < 0) return;
    collabRef.current.broadcastCursor({
      activeField: 'block',
      activeBlock: idx,
      blockPreview: (bEl.textContent || '').trim().slice(0, 40),
      isTyping,
    });
  };

  const sync = (isTyping = true) => {
    const rEl = root.current;
    if (!rEl) return;
    const last = rEl.lastElementChild;
    if (!last || /^(FIGURE|TABLE|HR|PRE|BLOCKQUOTE|DETAILS)$/.test(last.tagName) || last.classList.contains('tw')) {
      rEl.insertAdjacentHTML('beforeend', '<p><br></p>');
    }
    refreshTocFromDom(rEl);
    setEmp(!rEl.textContent.trim() && !rEl.querySelector('img,table,hr,details'));
    const nextMd = ewMd(rEl, { ...imgs, ...loc.current });
    if (nextMd !== lastBodyRef.current) {
      lastBodyRef.current = nextMd;
      setSourceText(nextMd);
      scheduleAutoSave(nextMd);
      const cb = blockOf();
      const idx = blockIndexOf(cb);
      if (collabRef.current && !applyingRemoteRef.current) {
        if (idx >= 0 && cb) {
          const clone = cb.cloneNode(true);
          clone.classList && clone.classList.remove('ewc');
          collabRef.current.broadcastPatch({
            kind: 'block',
            blockIndex: idx,
            blockHtml: clone.outerHTML,
            totalBlocks: rEl.children.length,
            fullBody: nextMd,
          });
        } else {
          collabRef.current.broadcastPatch({ kind: 'full_body', fullBody: nextMd });
        }
      }
    }
    const cb = blockOf();
    if (cb) broadcastCurrentBlock(cb, isTyping);
    computePeerBoxes();
  };

  const loadDom = (s) => {
    const rEl = root.current;
    if (!rEl) return;
    applyingRemoteRef.current = true;
    rEl.innerHTML = toDom(s).innerHTML;
    refreshTocFromDom(rEl);
    setEmp(!rEl.textContent.trim() && !rEl.querySelector('img,table,hr,details'));
    applyingRemoteRef.current = false;
    computePeerBoxes();
  };

  useEffect(() => {
    if (!isEditing || sourceMode) return;
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch (e) {}
    loadDom(rRef.current.body || '');
  }, [r.id, isEditing, sourceMode]);

  useEffect(() => {
    if (!isEditing || sourceMode) return;
    if ((r.body || '') !== lastBodyRef.current && root.current) {
      lastBodyRef.current = r.body || '';
      setSourceText(r.body || '');
      loadDom(r.body || '');
    }
  }, [r.body, isEditing, sourceMode]);

  // Real-Time Collaboration Session
  useEffect(() => {
    const session = createDocCollabSession({
      docId: r.id,
      user: { name: userName, role: p.role, avatar: p.userAvatar || '' },
      onPresenceChange: setPeers,
      onStatusChange: setCollabStatus,
      onRemotePatch: (patch) => {
        if (!patch) return;
        setSyncState(`Synced · ${patch.by || 'Peer'}`);
        setTimeout(() => setSyncState('Saved'), 2200);

        if (patch.kind === 'field' && patch.field) {
          if (patch.field === 'title') {
            if (activeFieldRef.current !== 'title') setTitleVal(patch.value || '');
            p.onInlineUpdate && p.onInlineUpdate(rRef.current.id, { title: patch.value || '' }, { silent: true });
          } else if (patch.field === 'desc') {
            if (activeFieldRef.current !== 'desc') setDescVal(patch.value || '');
            p.onInlineUpdate && p.onInlineUpdate(rRef.current.id, { desc: patch.value || '' }, { silent: true });
          } else if (patch.field === 'meta' && patch.meta) {
            p.onInlineUpdate && p.onInlineUpdate(rRef.current.id, patch.meta, { silent: true });
          }
          return;
        }

        if (patch.kind === 'block' && root.current && isEditing && !sourceMode) {
          const rEl = root.current;
          const activeBlk = blockOf();
          const activeIdx = blockIndexOf(activeBlk);
          applyingRemoteRef.current = true;
          if (patch.blockIndex !== activeIdx && patch.blockHtml) {
            const tpl = document.createElement('template');
            tpl.innerHTML = patch.blockHtml;
            const newNode = tpl.content.firstElementChild;
            if (newNode) {
              const target = rEl.children[patch.blockIndex];
              if (target) target.replaceWith(newNode);
              else rEl.appendChild(newNode);
              newNode.classList.add('block-remote-flash');
              setTimeout(() => newNode.classList && newNode.classList.remove('block-remote-flash'), 1200);
            }
            refreshTocFromDom(rEl);
            const mergedMd = ewMd(rEl, { ...imgs, ...loc.current });
            lastBodyRef.current = mergedMd;
            setSourceText(mergedMd);
            p.onInlineUpdate && p.onInlineUpdate(rRef.current.id, { body: mergedMd }, { silent: true });
          }
          applyingRemoteRef.current = false;
          computePeerBoxes();
          return;
        }

        if (patch.fullBody !== undefined) {
          const nextBody = patch.fullBody;
          if (isEditing && !sourceMode && root.current) {
            const curFocused = document.activeElement && root.current.contains(document.activeElement);
            if (!curFocused) loadDom(nextBody);
          }
          lastBodyRef.current = nextBody;
          setSourceText(nextBody);
          p.onInlineUpdate && p.onInlineUpdate(rRef.current.id, { body: nextBody }, { silent: true });
        }
      },
      onSimEditAction: (step) => {
        const rEl = root.current;
        if (!rEl || !rEl.children.length) {
          return { activeField: 'desc', activeBlock: 0, blockPreview: 'Reviewing summary…', isTyping: true };
        }
        const total = rEl.children.length;
        if (step === 1) {
          return { activeField: 'block', activeBlock: 0, blockPreview: 'Reading intro section…', isTyping: false };
        }
        if (step === 2) {
          const idx = Math.min(total - 1, 1);
          return { activeField: 'block', activeBlock: idx, blockPreview: 'Checking requirements…', isTyping: true };
        }
        if (step === 3 && isEditing && !sourceMode) {
          const existingNote = rEl.querySelector('[data-sim-peer="elena"]');
          if (!existingNote) {
            const q = document.createElement('blockquote');
            q.className = 'tip';
            q.setAttribute('data-sim-peer', 'elena');
            q.innerHTML =
              '<b contenteditable="false">Tip</b><div><b>Elena (Live Review):</b> Confirmed Revit 2025 shared parameters &amp; sheet tags match current BIM Execution Plan.</div>';
            const insertAt = Math.min(2, Math.max(0, rEl.children.length - 1));
            const refNode = rEl.children[insertAt];
            if (refNode) refNode.after(q);
            else rEl.appendChild(q);
            q.classList.add('block-remote-flash');
            setTimeout(() => q.classList && q.classList.remove('block-remote-flash'), 1400);
            refreshTocFromDom(rEl);
            const nextMd = ewMd(rEl, { ...imgs, ...loc.current });
            commitInlinePatch({ body: nextMd }, { silent: true });
            setSyncState('Synced · Elena');
            setTimeout(() => setSyncState('Saved'), 2000);
          }
          const simIdx = existingNote ? blockIndexOf(existingNote) : Math.min(rEl.children.length - 1, 3);
          return {
            activeField: 'block',
            activeBlock: Math.max(0, simIdx),
            blockPreview: 'Added BIM review tip',
            isTyping: false,
          };
        }
        const loopIdx = step % Math.max(1, total);
        return {
          activeField: 'block',
          activeBlock: loopIdx,
          blockPreview: (rEl.children[loopIdx]?.textContent || '').trim().slice(0, 32) || 'Inspecting block…',
          isTyping: step % 2 === 0,
        };
      },
    });
    collabRef.current = session;
    return () => {
      clearTimeout(autoSaveTimerRef.current);
      session.destroy();
      collabRef.current = null;
    };
  }, [r.id, userName, p.role]);

  const topBlockOf = (node) => {
    const rEl = root.current;
    if (!rEl || !node) return null;
    let n = node.nodeType === 1 ? node : node.parentNode;
    while (n && n.parentNode !== rEl) n = n.parentNode;
    return n && n.parentNode === rEl && n.nodeType === 1 ? n : null;
  };

  const getSelBlocks = () => {
    const rEl = root.current;
    return rEl ? [...rEl.querySelectorAll(':scope > .ewb-sel')] : [];
  };

  const clearSelBlocks = () => {
    const rEl = root.current;
    if (!rEl) return;
    const els = rEl.querySelectorAll(':scope > .ewb-sel');
    if (els.length) {
      els.forEach((x) => x.classList.remove('ewb-sel'));
      setSelCount(0);
    }
  };

  const applySelRange = (blocks) => {
    const rEl = root.current;
    if (!rEl) return;
    const set = new Set(blocks);
    [...rEl.children].forEach((ch) => {
      if (set.has(ch)) ch.classList.add('ewb-sel');
      else ch.classList.remove('ewb-sel');
    });
    setSelCount(set.size);
    if (set.size >= 1) {
      const first = [...set][0];
      const bRect = first.getBoundingClientRect();
      setFb({
        x: Math.min(Math.max(bRect.left + bRect.width / 2, 180), innerWidth - 180),
        y: Math.max(bRect.top - 48, 56),
        multi: true,
        count: set.size,
      });
    } else {
      setFb(null);
    }
  };

  // Selectionchange for floating Bubble Toolbar, Multi-Block Selection & Table Toolbar
  useEffect(() => {
    if (!isEditing || sourceMode) {
      setFb(null);
      setFbPop(null);
      setTb(null);
      setFigAct(null);
      clearSelBlocks();
      return;
    }
    const f = () => {
      const rEl = root.current;
      const s = getSelection();
      if (!rEl || !s || !s.rangeCount || !rEl.contains(s.anchorNode)) {
        if (!getSelBlocks().length) setFb(null);
        setTb(null);
        return;
      }
      rEl.querySelectorAll('.ewc').forEach((x) => x.classList.remove('ewc'));
      const cb = blockOf();
      cb && /^(P|H[1-3])$/.test(cb.tagName) && cb.classList.add('ewc');
      if (cb) {
        const bk = blockTypeOf(cb);
        setCurBlkKey(bk);
        setCurBlkLabel(BLOCK_LABELS[bk] || 'Text');
        broadcastCurrentBlock(cb, false);
      }

      const tt = up('table');
      if (tt) {
        const q = tt.getBoundingClientRect();
        setTb({
          x: Math.min(Math.max(q.left + q.width / 2, 190), innerWidth - 190),
          y: Math.max(q.top - 46, 56),
        });
      } else {
        setTb(null);
      }

      if (s.isCollapsed || up('figure')) {
        if (!getSelBlocks().length) setFb(null);
        return;
      }

      // Cross-block mouse drag detection -> highlight entire spanned blocks cleanly
      const bA = topBlockOf(s.anchorNode);
      const bF = topBlockOf(s.focusNode);
      if (bA && bF && bA !== bF) {
        const ch = [...rEl.children];
        const i1 = ch.indexOf(bA);
        const i2 = ch.indexOf(bF);
        if (i1 >= 0 && i2 >= 0) {
          applySelRange(ch.slice(Math.min(i1, i2), Math.max(i1, i2) + 1));
          return;
        }
      }
      clearSelBlocks();

      const qs = (c) => {
        try {
          return document.queryCommandState(c);
        } catch (e) {
          return false;
        }
      };
      const mk = up('mark');
      const spC = up('span[data-c]');
      const nf = {
        b: qs('bold'),
        i: qs('italic'),
        u: qs('underline'),
        s: qs('strikeThrough'),
        c: !!up('code'),
        h: mk ? mk.getAttribute('data-hl') || 'yellow' : '',
        tc: spC ? spC.getAttribute('data-c') || 'default' : 'default',
        al: (cb && cb.style && cb.style.textAlign) || 'left',
        a: !!up('a'),
      };
      setFa((o) => (JSON.stringify(o) === JSON.stringify(nf) ? o : nf));
      const rg = s.getRangeAt(0);
      selR.current = rg.cloneRange();
      const b = rg.getBoundingClientRect();
      const half = Math.min(285, Math.floor(innerWidth / 2) - 10);
      b.width || b.height
        ? setFb({
            x: Math.min(Math.max(b.left + b.width / 2, half), innerWidth - half),
            y: Math.max(b.top - 48, 56),
            multi: false,
          })
        : setFb(null);
    };
    document.addEventListener('selectionchange', f);
    return () => document.removeEventListener('selectionchange', f);
  }, [isEditing, sourceMode, r.id]);

  // Dismiss portaled menus & multi-block selection on outside click
  useEffect(() => {
    if (!lk) return;
    const f = (e) => {
      if (!e.target.closest || !e.target.closest('.ewlk')) setLk(null);
    };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [!!lk]);

  useEffect(() => {
    if (!bm) return;
    const f = (e) => {
      if (!e.target.closest || !e.target.closest('.ewbm')) setBm(null);
    };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [bm]);

  useEffect(() => {
    if (!fbPop) return;
    const f = (e) => {
      if (!e.target.closest || (!e.target.closest('.ewf-pop') && !e.target.closest('.ewf'))) setFbPop(null);
    };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [fbPop]);

  useEffect(() => {
    if (!figAct) return;
    const f = (e) => {
      if (!e.target.closest || (!e.target.closest('.ew-figbar') && !e.target.closest('figure'))) setFigAct(null);
    };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [figAct]);

  useEffect(() => {
    if (!selCount) return;
    const f = (e) => {
      if (
        e.target.closest &&
        (e.target.closest('.ewf') || e.target.closest('.ewbm') || e.target.closest('.ewh') || e.target.closest('.ew-lasso'))
      ) {
        return;
      }
      if (!e.shiftKey) {
        clearSelBlocks();
        setFb(null);
      }
    };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [selCount]);

  useEffect(() => {
    const e = document.querySelector('.ewsl button.on');
    e && e.scrollIntoView({ block: 'nearest' });
  }, [sl && sl.i]);

  // Editor commands
  const exec = (c, v) => {
    root.current && root.current.focus();
    document.execCommand(c, false, v);
    sync();
  };
  const put = (h, sel) => {
    const rEl = root.current;
    const b = blockOf();
    const tp = document.createElement('template');
    tp.innerHTML = h;
    const f = tp.content;
    const first = f.firstElementChild;
    if (b && /^(P|DIV)$/.test(b.tagName) && !b.textContent.trim() && !b.querySelector('img')) b.replaceWith(f);
    else if (b) b.after(f);
    else rEl.appendChild(f);
    sync();
    if (first) {
      if (first.tagName === 'HR' && first.nextElementSibling) caret(first.nextElementSibling);
      else caret((sel && first.querySelector(sel)) || first);
    }
  };
  const fmtBlock = (k) => {
    const b = blockOf();
    if (b && b.tagName.toLowerCase() === k && k !== 'p') k = 'p';
    exec('formatBlock', '<' + k + '>');
  };
  const list = (k) => {
    root.current && root.current.focus();
    const li = up('li');
    const T = k === 'ol' ? 'OL' : 'UL';
    const c = k === 'ol' ? 'insertOrderedList' : 'insertUnorderedList';
    if (li && li.parentNode.tagName === T) {
      k === 'ck' ? li.classList.toggle('ck') : document.execCommand(c);
    } else {
      document.execCommand(c);
      const l2 = up('li');
      k === 'ck' && l2 && l2.classList.add('ck');
    }
    sync();
  };
  const call = (k) => {
    const b = blockOf();
    if (!b) return;
    if (b.tagName === 'BLOCKQUOTE') {
      if (b.classList.contains(k)) {
        const x = document.createElement('p');
        x.textContent = [...b.childNodes]
          .filter((n) => !(n.nodeType === 1 && n.tagName === 'B'))
          .map((n) => n.textContent)
          .join(' ')
          .replace(/\u200b/g, '');
        if (!x.textContent) x.innerHTML = '<br>';
        b.replaceWith(x);
        caret(x, true);
      } else {
        b.className = k;
        const bTag = b.querySelector('b');
        if (bTag) bTag.textContent = EW_CL[k];
      }
      sync();
      return;
    }
    if (!/^(P|DIV|H\d)$/.test(b.tagName)) return;
    const q = document.createElement('blockquote');
    q.className = k;
    q.innerHTML = '<b contenteditable="false">' + EW_CL[k] + '</b><div></div>';
    const d = q.lastChild;
    d.textContent = b.textContent;
    if (!d.textContent) d.innerHTML = '<br>';
    b.replaceWith(q);
    caret(d, true);
    sync();
  };
  const toggleB = () => {
    const b = blockOf();
    const dt = b && b.closest ? b.closest('details.tgl') : null;
    if (dt) {
      const pNode = document.createElement('p');
      pNode.textContent = dt.textContent.replace(/\u200b/g, '').trim() || '';
      if (!pNode.textContent) pNode.innerHTML = '<br>';
      dt.replaceWith(pNode);
      caret(pNode, true);
      sync();
      return;
    }
    const seed = b && /^(P|DIV|H\d)$/.test(b.tagName) ? b.textContent.trim() : '';
    const htmlStr = `<details class="tgl" open><summary contenteditable="true">${esc(seed || 'Toggle section title')}</summary><div class="tgl-b" contenteditable="true">Details hidden inside toggle…</div></details>`;
    if (b && /^(P|DIV|H\d)$/.test(b.tagName)) {
      const tp = document.createElement('template');
      tp.innerHTML = htmlStr;
      const node = tp.content.firstElementChild;
      b.replaceWith(node);
      caret(node.querySelector('summary'), true);
      sync();
    } else {
      put(htmlStr, 'summary');
    }
  };
  const codeB = () => {
    const b = blockOf();
    if (!b) return;
    if (b.tagName === 'PRE') {
      const x = document.createElement('p');
      x.textContent = ewTx(b);
      b.replaceWith(x);
      caret(x, true);
      sync();
      return;
    }
    const pr = document.createElement('pre');
    const c = document.createElement('code');
    c.textContent = b.textContent || '\n';
    pr.appendChild(c);
    b.replaceWith(pr);
    caret(c, true);
    sync();
  };
  const restoreRange = () => {
    const s = getSelection();
    if (s && s.rangeCount && !s.isCollapsed && root.current && root.current.contains(s.anchorNode)) {
      selR.current = s.getRangeAt(0).cloneRange();
      return s.getRangeAt(0);
    }
    const rg = selR.current;
    if (!rg || !root.current || rg.collapsed) return null;
    root.current.focus();
    s.removeAllRanges();
    s.addRange(rg);
    return rg;
  };
  const wrapSelectionTag = (tagName) => {
    const rg = restoreRange();
    if (!rg) return;
    const existing = up(tagName);
    if (existing) existing.replaceWith(...existing.childNodes);
    else {
      const e = document.createElement(tagName);
      e.appendChild(rg.extractContents());
      rg.insertNode(e);
      selR.current = document.createRange();
      selR.current.selectNodeContents(e);
    }
    sync();
  };
  const applySpanAttr = (tag, attr, val, offVal) => {
    const rg = restoreRange();
    if (!rg) return;
    const s = getSelection();
    const frag = rg.extractContents();
    frag.querySelectorAll(tag).forEach((el) => el.replaceWith(...el.childNodes));
    const anc = up(tag);
    if (val === offVal && anc) {
      rg.insertNode(frag);
      if (!anc.textContent) anc.remove();
    } else if (val === offVal) {
      rg.insertNode(frag);
    } else {
      const el = document.createElement(tag);
      el.setAttribute(attr, val);
      el.appendChild(frag);
      rg.insertNode(el);
      const nr = document.createRange();
      nr.selectNodeContents(el);
      s.removeAllRanges();
      s.addRange(nr);
      selR.current = nr.cloneRange();
    }
    sync();
  };
  const applyTextColor = (colorKey) => {
    applySpanAttr('span', 'data-c', colorKey, 'default');
    setFa((o) => ({ ...o, tc: colorKey }));
  };
  const applyHighlight = (hlKey) => {
    applySpanAttr('mark', 'data-hl', hlKey, 'none');
    setFa((o) => ({ ...o, h: hlKey === 'none' ? '' : hlKey }));
  };
  const applyAlign = (al) => {
    const b = blockOf();
    if (!b || !/^(P|H[1-3])$/.test(b.tagName)) return;
    b.style.textAlign = al === 'left' ? '' : al;
    setFa((o) => ({ ...o, al }));
    sync();
  };
  const clearFormatting = () => {
    const rg = restoreRange();
    if (!rg) return;
    document.execCommand('removeFormat');
    const s = getSelection();
    if (s && s.rangeCount && !s.isCollapsed) {
      const r2 = s.getRangeAt(0);
      const frag = r2.extractContents();
      frag.querySelectorAll('code,mark,span[data-c],b,strong,i,em,u,s,strike,del').forEach((n) => n.replaceWith(...n.childNodes));
      r2.insertNode(frag);
    }
    const b = blockOf();
    if (b && b.style) b.style.textAlign = '';
    setFbPop(null);
    sync();
  };
  const applyAiAction = (key) => {
    const rg = restoreRange();
    if (!rg) return;
    const raw = rg.toString();
    const txt = raw.trim();
    if (!txt) return;
    setFbPop(null);
    if (key === 'code') {
      const el = document.createElement('code');
      el.textContent = txt;
      rg.deleteContents();
      rg.insertNode(el);
      sync();
      p.flash && p.flash('Formatted as inline code');
      return;
    }
    let out = txt;
    if (key === 'improve') {
      out = txt
        .replace(/\s+/g, ' ')
        .replace(/\bshall be\b/gi, 'must be')
        .replace(/\bshould make sure to\b/gi, 'must')
        .replace(/^([a-z])/, (m, c) => c.toUpperCase());
      if (out.length > 25 && !/[.!?]$/.test(out)) out += '.';
    } else if (key === 'concise') {
      out = txt
        .replace(/\b(in order to|for the purpose of)\b/gi, 'to')
        .replace(/\b(please make sure that|please note that|it is recommended that|make sure that)\s+/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^([a-z])/, (m, c) => c.toUpperCase());
    } else if (key === 'action') {
      out = txt.replace(/^(we need to|users should|you should|please)\s+/i, '').trim();
      out = out.replace(/^([a-z])/, (m, c) => c.toUpperCase());
      if (!/^(Verify|Confirm|Check|Ensure|Submit|Review|Audit|Export|Configure|Run|Update)\b/.test(out)) {
        out = 'Verify ' + out.charAt(0).toLowerCase() + out.slice(1);
      }
    }
    rg.deleteContents();
    rg.insertNode(document.createTextNode(out));
    sync();
    p.flash && p.flash('AI applied to selection');
  };
  const link = () => {
    closeMenus('lk');
    if (up('a')) {
      exec('unlink');
      return;
    }
    const rg = restoreRange();
    if (!rg) return;
    selR.current = rg.cloneRange();
    const b = rg.getBoundingClientRect();
    setLk({ x: Math.min(Math.max(b.left + b.width / 2, 180), innerWidth - 180), y: Math.max(b.top - 52, 56), v: '' });
  };
  const applyLink = (v) => {
    let u = (v || '').trim();
    if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
    const rg = selR.current;
    setLk(null);
    if (!rg || !/^https?:\/\/[^\s.\/]+\.\S+/.test(u)) return;
    const s = getSelection();
    root.current && root.current.focus();
    s.removeAllRanges();
    s.addRange(rg);
    exec('createLink', u);
  };
  const addRow = (c) => {
    const tr = c.parentNode;
    const n = document.createElement('tr');
    [...tr.cells].forEach(() => {
      const d = document.createElement('td');
      d.textContent = '\u200b';
      n.appendChild(d);
    });
    tr.after(n);
    sync();
    return n;
  };
  const addCol = () => {
    const c = up('td,th');
    if (!c) return;
    const k = c.cellIndex;
    [...c.closest('table').rows].forEach((row) => {
      const x = row.cells[k];
      if (!x) return;
      const d = document.createElement(x.tagName);
      d.textContent = '\u200b';
      x.after(d);
    });
    sync();
  };
  const delRow = () => {
    const c = up('td,th');
    if (!c) return;
    const tEl = c.closest('table');
    tEl.rows.length < 2 ? delTbl() : (c.parentNode.remove(), sync());
  };
  const delCol = () => {
    const c = up('td,th');
    if (!c) return;
    const k = c.cellIndex;
    const tEl = c.closest('table');
    tEl.rows[0].cells.length < 2 ? delTbl() : ([...tEl.rows].forEach((row) => row.cells[k] && row.cells[k].remove()), sync());
  };
  const delTbl = () => {
    const c = up('table');
    if (!c) return;
    const w = c.closest('.tw') || c;
    const x = document.createElement('p');
    x.innerHTML = '<br>';
    w.replaceWith(x);
    caret(x);
    sync();
  };
  const quoteB = () => {
    const b = blockOf();
    if (!b) return;
    if (b.tagName === 'BLOCKQUOTE' && !/\b(note|tip|warn)\b/.test(b.className)) {
      const x = document.createElement('p');
      x.textContent = b.textContent.replace(/\u200b/g, '');
      if (!x.textContent) x.innerHTML = '<br>';
      b.replaceWith(x);
      caret(x, true);
      sync();
      return;
    }
    if (!/^(P|DIV|H\d)$/.test(b.tagName)) return;
    const q = document.createElement('blockquote');
    const d = document.createElement('div');
    d.textContent = b.textContent;
    if (!d.textContent) d.innerHTML = '<br>';
    q.appendChild(d);
    b.replaceWith(q);
    caret(d, true);
    sync();
  };
  const dateI = () => {
    const d = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    root.current && root.current.focus();
    document.execCommand('insertText', false, d);
    sync();
  };
  const inlMd = () => {
    const s = getSelection();
    if (!s || !s.rangeCount || !s.isCollapsed) return false;
    const n = s.anchorNode;
    if (!n || n.nodeType !== 3 || (n.parentElement && n.parentElement.closest('code,pre'))) return false;
    const o = s.anchorOffset;
    const bf = n.data.slice(0, o);
    const P = [
      [/(^|[^*\w])\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, 'b'],
      [/(^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*$/, 'i'],
      [/(^|[^`])`([^`\s](?:[^`]*[^`\s])?)`$/, 'code'],
      [/(^|[^~])~~([^~\s](?:[^~]*[^~\s])?)~~$/, 's'],
      [/(^|[^=])==([^=\s](?:[^=]*[^=\s])?)==$/, 'mark'],
    ];
    for (const [re, tag] of P) {
      const mm = bf.match(re);
      if (!mm) continue;
      const stIdx = o - mm[0].length + mm[1].length;
      const el = document.createElement(tag);
      el.textContent = mm[2];
      const aft = n.data.slice(o);
      n.data = n.data.slice(0, stIdx);
      const z = document.createTextNode('\u200b' + aft);
      n.after(el);
      el.after(z);
      const rg = document.createRange();
      rg.setStart(z, 1);
      rg.collapse(true);
      s.removeAllRanges();
      s.addRange(rg);
      return true;
    }
    return false;
  };

  const A = {
    p: () => fmtBlock('p'),
    h1: () => fmtBlock('h1'),
    h2: () => fmtBlock('h2'),
    h3: () => fmtBlock('h3'),
    ul: () => list('ul'),
    ol: () => list('ol'),
    ck: () => list('ck'),
    tgl: toggleB,
    quote: quoteB,
    date: dateI,
    note: () => call('note'),
    tip: () => call('tip'),
    warn: () => call('warn'),
    code: codeB,
    tbl: () => put(EW_TBL, 'th'),
    img: () => fi.current && fi.current.click(),
    hr: () => put('<hr>'),
  };

  const addImgs = async (fs) => {
    for (const f of fs) {
      if (!/^image\//.test(f.type)) continue;
      const u = await shrink(f);
      if (!u) continue;
      const id = 'i' + Math.random().toString(36).slice(2, 8);
      loc.current[id] = u;
      p.setImgs && p.setImgs((o) => ({ ...o, [id]: u }));
      const im = document.createElement('img');
      im.src = u;
      im.setAttribute('data-id', id);
      im.alt = '';
      const fg = document.createElement('figure');
      fg.contentEditable = 'false';
      fg.appendChild(im);
      const c = document.createElement('figcaption');
      c.contentEditable = 'true';
      fg.appendChild(c);
      put(fg.outerHTML, 'figcaption');
      db.uploadImage(id, u).then((remoteUrl) => {
        if (remoteUrl && remoteUrl !== u) {
          loc.current[id] = remoteUrl;
          p.setImgs && p.setImgs((o) => ({ ...o, [id]: remoteUrl }));
          const liveImg = root.current && root.current.querySelector('img[data-id="' + id + '"]');
          if (liveImg) liveImg.setAttribute('src', remoteUrl);
        }
      });
    }
  };

  const impDocx = async (f) => {
    if (!f || ib) return;
    if (!/\.docx$/i.test(f.name)) {
      p.flash && p.flash('A .docx file is required');
      return;
    }
    if (lastBodyRef.current.trim() && !confirm('Replace the current content with the imported document?')) return;
    setIb(true);
    try {
      const imp = await docxImport(f);
      loc.current = { ...loc.current, ...imp.imgs };
      p.setImgs && p.setImgs((o) => ({ ...o, ...imp.imgs }));
      const patch = {};
      if (!titleVal.trim() && imp.title) {
        setTitleVal(imp.title);
        patch.title = imp.title;
      }
      if (!descVal.trim() && imp.desc) {
        setDescVal(imp.desc);
        patch.desc = imp.desc;
      }
      const nextBody = titleVal.trim() && imp.h1 ? '## ' + imp.h1 + '\n\n' + imp.body : imp.body;
      patch.body = nextBody;
      loadDom(nextBody);
      commitInlinePatch(patch);
      collabRef.current && collabRef.current.broadcastPatch({ kind: 'full_body', fullBody: nextBody });
      p.flash && p.flash('Document imported into page');
      db.uploadImagesMap(imp.imgs).then((uploaded) => {
        if (!uploaded || !Object.keys(uploaded).length) return;
        loc.current = { ...loc.current, ...uploaded };
        p.setImgs && p.setImgs((o) => ({ ...o, ...uploaded }));
        if (root.current) {
          Object.entries(uploaded).forEach(([id, u]) => {
            const liveImg = root.current.querySelector('img[data-id="' + id + '"]');
            if (liveImg && u) liveImg.setAttribute('src', u);
          });
        }
      });
    } catch (e) {
      p.flash && p.flash('Could not read the .docx file');
    }
    setIb(false);
  };

  const flt = sl ? EW_SL.filter((x) => !sl.q || (x[1] + ' ' + x[4]).toLowerCase().includes(sl.q)) : [];
  const cTxt = () => {
    const s = getSelection();
    if (!s || !s.rangeCount || !s.isCollapsed) return null;
    let n = s.anchorNode;
    let o = s.anchorOffset;
    if (n && n.nodeType === 1 && o > 0 && n.childNodes[o - 1] && n.childNodes[o - 1].nodeType === 3) {
      n = n.childNodes[o - 1];
      o = n.data.length;
    }
    return n && n.nodeType === 3 ? [n, o] : null;
  };
  const pickCmd = (k) => {
    const plusMode = sl && sl.mode === 'plus';
    const plusTarget = sl && sl.targetEl;
    if (plusMode && plusTarget && plusTarget.isConnected) {
      caret(plusTarget);
    } else {
      const c = cTxt();
      if (c) {
        const [n, o] = c;
        const mm = n.data.slice(0, o).replace(/\u00a0/g, ' ').match(/(^|\s)\/\S*$/);
        if (mm) {
          const stIdx = o - mm[0].length + mm[1].length;
          n.data = n.data.slice(0, stIdx) + n.data.slice(o);
          const rg = document.createRange();
          rg.setStart(n, stIdx);
          rg.collapse(true);
          const s = getSelection();
          s.removeAllRanges();
          s.addRange(rg);
        }
      }
      const b = blockOf();
      if (b && /^(P|H[1-3])$/.test(b.tagName) && !b.textContent.replace(/\u200b/g, '').trim()) {
        b.innerHTML = '<br>';
        caret(b);
      }
    }
    setSl(null);
    A[k] && A[k]();
  };
  const slash = (b) => {
    const c = cTxt();
    if (!b || !c || !/^(P|H[1-3])$/.test(b.tagName)) {
      setSl(null);
      return;
    }
    const [n, o] = c;
    const mm = n.data.slice(0, o).replace(/\u00a0/g, ' ').match(/(?:^|\s)\/(\S*)$/);
    if (!mm) {
      setSl(null);
      return;
    }
    const sr = getSelection().rangeCount ? getSelection().getRangeAt(0).getBoundingClientRect() : null;
    const bb = b.getBoundingClientRect();
    const rawX = (sr && sr.left) || bb.left;
    const rawY = ((sr && sr.bottom) || bb.bottom) + 6;
    const pos = clampMenuPos(rawX, rawY, 254, 340);
    closeMenus('sl');
    setSl({
      x: pos.left,
      y: pos.top,
      q: mm[1].toLowerCase(),
      i: 0,
      mode: 'slash',
    });
  };

  const blkAt = (y) => {
    const rEl = root.current;
    if (!rEl) return null;
    for (const c of rEl.children) {
      const b = c.getBoundingClientRect();
      if (y >= b.top - 6 && y <= b.bottom + 6) return c;
    }
    return null;
  };
  const onMove = (e) => {
    if (!isEditing || sourceMode || drag.current) return;
    const b = blkAt(e.clientY);
    const w = wrap.current;
    if (!b || !w) return;
    const top = b.getBoundingClientRect().top - w.getBoundingClientRect().top + (b.tagName === 'H2' ? 8 : b.tagName === 'H3' ? 4 : 2);
    if (!hd || hd.el !== b || Math.abs(hd.top - top) > 1) setHd({ el: b, top });
  };
  const plus = (e) => {
    if (!hd) return;
    closeMenus('sl');
    const b = hd.el;
    let n = b;
    if (!(b.tagName === 'P' && !b.textContent.trim())) {
      n = document.createElement('p');
      n.innerHTML = '<br>';
      b.after(n);
    }
    caret(n);
    const rect = (e && e.currentTarget && e.currentTarget.getBoundingClientRect()) || n.getBoundingClientRect();
    const pos = clampMenuPos(rect.left + 26, rect.bottom + 6, 254, 360);
    setSl({ x: pos.left, y: pos.top, q: '', i: 0, mode: 'plus', targetEl: n });
    sync(false);
  };
  const grip = (e) => {
    if (!hd) return;
    closeMenus('bm');
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = clampMenuPos(rect.left, rect.bottom + 6, 248, 420);
    const batch = getSelBlocks();
    const targets = batch.length > 1 && batch.includes(hd.el) ? batch : [hd.el];
    setBm({ el: hd.el, targets, x: pos.left, y: pos.top, mode: 'all', curType: blockTypeOf(hd.el) });
  };
  const into = (el) => {
    let target = el;
    if (el.tagName === 'BLOCKQUOTE') target = el.lastElementChild;
    else if (el.tagName === 'UL' || el.tagName === 'OL') target = el.querySelector('li');
    else if (el.tagName === 'PRE') target = el.querySelector('code') || el;
    else if (el.tagName === 'DETAILS') target = el.querySelector('summary') || el;
    caret(target || el);
  };
  const turnSingle = (el, k) => {
    if (!el || !el.isConnected) return;
    into(el);
    const c = el.tagName === 'BLOCKQUOTE' && ['note', 'tip', 'warn'].find((x) => el.classList.contains(x));
    if (el.tagName === 'BLOCKQUOTE' && !c) {
      if (k === 'quote') return;
      quoteB();
      k !== 'p' && A[k] && A[k]();
      return;
    }
    if (c) {
      if (EW_CL[k]) call(k);
      else {
        call(c);
        k !== 'p' && A[k] && A[k]();
      }
      return;
    }
    if (el.tagName === 'PRE') {
      if (k === 'code') return;
      codeB();
      k !== 'p' && A[k] && A[k]();
      return;
    }
    if (el.tagName === 'DETAILS') {
      if (k === 'tgl') return;
      toggleB();
      k !== 'p' && A[k] && A[k]();
      return;
    }
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      if (k === 'p') {
        exec(el.tagName === 'UL' ? 'insertUnorderedList' : 'insertOrderedList');
        return;
      }
      if (k === 'ul' && el.tagName === 'UL') {
        el.querySelectorAll('li').forEach((l) => l.classList.remove('ck'));
        sync();
        return;
      }
    }
    if (k === 'p') fmtBlock('p');
    else A[k] && A[k]();
  };
  const turn = (k) => {
    const targets = (bm && bm.targets && bm.targets.length) ? bm.targets : bm && bm.el ? [bm.el] : [];
    setBm(null);
    targets.forEach((el) => turnSingle(el, k));
    clearSelBlocks();
  };
  const dup = (el) => {
    const batch = getSelBlocks();
    const list = batch.length > 1 ? batch : [el];
    let anchor = list[list.length - 1];
    list.forEach((item) => {
      if (!item || !item.isConnected) return;
      const c = item.cloneNode(true);
      c.classList && c.classList.remove('ewc', 'ewb-sel');
      anchor.after(c);
      anchor = c;
    });
    sync();
  };
  const mv = (el, d) => {
    const target = d < 0 ? el.previousElementSibling : el.nextElementSibling;
    if (!target) return;
    d < 0 ? target.before(el) : target.after(el);
    sync();
  };
  const rm = (el) => {
    const batch = getSelBlocks();
    const list = batch.length > 0 ? batch : el ? [el] : [];
    list.forEach((item) => item && item.isConnected && item.remove());
    if (root.current && !root.current.children.length) root.current.innerHTML = '<p><br></p>';
    clearSelBlocks();
    setFb(null);
    setHd(null);
    const first = root.current && root.current.firstElementChild;
    first && caret(first);
    sync();
  };
  const dStart = (e) => {
    if (!hd) return;
    drag.current = hd.el;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ' ');
    e.dataTransfer.setDragImage(hd.el, 0, 0);
  };
  const dOver = (e) => {
    if (!isEditing || sourceMode) return;
    e.preventDefault();
    if (!drag.current) return;
    const target = blkAt(e.clientY);
    if (!target) return;
    const b = target.getBoundingClientRect();
    const after = e.clientY > b.top + b.height / 2;
    setDp({ el: target, after, y: (after ? b.bottom : b.top) - wrap.current.getBoundingClientRect().top });
  };
  const dEnd = () => {
    drag.current = null;
    setDp(null);
  };
  const dDrop = (e) => {
    if (!isEditing || sourceMode) return;
    const d = drag.current;
    if (d) {
      e.preventDefault();
      if (dp && dp.el !== d) {
        dp.after ? dp.el.after(d) : dp.el.before(d);
        sync();
      }
      dEnd();
      return;
    }
    if (e.dataTransfer.files.length) {
      e.preventDefault();
      const fs = [...e.dataTransfer.files];
      const dcFile = fs.find((x) => /\.docx$/i.test(x.name));
      if (dcFile) impDocx(dcFile);
      else addImgs(fs);
    }
  };

  // Marquee / gutter mouse drag block selection (Notion-style lasso across any blocks)
  const onWrapMouseDown = (e) => {
    if (!isEditing || sourceMode || e.button !== 0 || drag.current) return;
    if (e.target.closest && e.target.closest('.ewh,.ew-starter,button,a,input,textarea,figcaption')) return;
    const rEl = root.current;
    if (!rEl) return;
    const rRect = rEl.getBoundingClientRect();
    const inMargin = e.clientX < rRect.left + 2 || e.clientX > rRect.right - 2;
    const onNonText =
      e.target === wrap.current ||
      e.target === rEl ||
      e.target.tagName === 'IMG' ||
      e.target.tagName === 'FIGURE' ||
      e.target.tagName === 'HR';
    if (!inMargin && !onNonText) return;

    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;

    const onWinMove = (me) => {
      if (!moved && Math.hypot(me.clientX - sx, me.clientY - sy) < 6) return;
      moved = true;
      me.preventDefault();
      const left = Math.min(sx, me.clientX);
      const top = Math.min(sy, me.clientY);
      const width = Math.max(4, Math.abs(me.clientX - sx));
      const height = Math.max(4, Math.abs(me.clientY - sy));
      setLasso({ left, top, width, height });
      const hits = [...rEl.children].filter((ch) => {
        const cr = ch.getBoundingClientRect();
        return cr.bottom >= top && cr.top <= top + height;
      });
      applySelRange(hits);
    };

    const onWinUp = () => {
      window.removeEventListener('mousemove', onWinMove);
      window.removeEventListener('mouseup', onWinUp);
      setLasso(null);
      if (moved) {
        const s = getSelection();
        s && s.removeAllRanges();
        setFigAct(null);
      }
    };

    window.addEventListener('mousemove', onWinMove);
    window.addEventListener('mouseup', onWinUp);
  };

  const onInput = (e) => {
    const ne = e && e.nativeEvent;
    const b = blockOf();
    // Clean accidental leading ## inside H1-H3 headings
    if (b && /^H[1-3]$/.test(b.tagName) && /^#{1,3}\s+/.test(b.textContent)) {
      const rest = b.textContent.replace(/^#{1,3}\s+/, '');
      b.textContent = rest;
      caret(b, true);
      sync();
      return;
    }
    const tx = b && b.tagName === 'P' ? b.textContent.replace(/\u00a0/g, ' ') : '';
    const mm = tx.match(/^(#{1,3}|-|\*|\+|1\.|>|"|\[ ?\]|▸)\s(.*)$/);
    if (mm) {
      const trailing = mm[2] || '';
      if (trailing) b.textContent = trailing;
      else b.innerHTML = '<br>';
      caret(b, Boolean(trailing));
      const mp = { '#': 'h1', '##': 'h2', '###': 'h3', '-': 'ul', '*': 'ul', '+': 'ul', '1.': 'ol', '>': 'quote', '"': 'quote', '▸': 'tgl' };
      const actKey = mp[mm[1]] || 'ck';
      A[actKey] && A[actKey]();
      return;
    }
    if (b && b.tagName === 'P' && (tx === '---' || tx === '___')) {
      b.innerHTML = '<br>';
      caret(b);
      A.hr();
      return;
    }
    if (b && b.tagName === 'P' && tx === '```') {
      b.innerHTML = '<br>';
      caret(b);
      A.code();
      return;
    }
    if (ne && ne.inputType === 'insertText' && /[*`~=]/.test(ne.data || '') && inlMd()) {
      sync();
      return;
    }
    slash(b);
    sync();
  };

  const bkp = (e) => {
    const s = getSelection();
    if (!s || !s.rangeCount || !s.isCollapsed) return false;
    const b = blockOf();
    if (!b) return false;
    let el = null;
    if (/^H[1-3]$/.test(b.tagName)) el = b;
    else if (b.tagName === 'BLOCKQUOTE') {
      let c = s.anchorNode;
      while (c && c.parentNode !== b) c = c.parentNode;
      if (c && c.nodeType === 1 && c.tagName === 'DIV') el = c;
    }
    if (!el) return false;
    const r0 = document.createRange();
    r0.selectNodeContents(el);
    r0.setEnd(s.anchorNode, s.anchorOffset);
    if (r0.toString().replace(/\u200b/g, '')) return false;
    e.preventDefault();
    if (el === b) fmtBlock('p');
    else {
      const x = document.createElement('p');
      x.innerHTML = el.innerHTML || '<br>';
      if (b.querySelectorAll(':scope>div').length > 1) {
        el.remove();
        b.before(x);
      } else b.replaceWith(x);
      caret(x);
    }
    sync();
    return true;
  };

  const onKey = (e) => {
    const mod = e.metaKey || e.ctrlKey;
    const selBlks = getSelBlocks();
    if (selBlks.length) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        rm();
        return;
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        dup(selBlks[0]);
        clearSelBlocks();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelBlocks();
        setFb(null);
        return;
      }
    }
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a' && root.current) {
      const b = blockOf();
      const s = getSelection();
      const curSelected = s && !s.isCollapsed ? s.toString().replace(/\u200b/g, '').trim() : '';
      const blkText = b ? b.textContent.replace(/\u200b/g, '').trim() : '';
      if (!blkText || curSelected === blkText) {
        e.preventDefault();
        applySelRange([...root.current.children]);
        return;
      }
    }
    if (e.key === 'Backspace' && !sl && bkp(e)) return;
    if (mod && e.altKey && /^Digit[0-3]$/.test(e.code)) {
      e.preventDefault();
      A[['p', 'h1', 'h2', 'h3'][+e.code.slice(5)]]();
      return;
    }
    if (mod && e.shiftKey && !e.altKey && /^Digit[789]$/.test(e.code)) {
      e.preventDefault();
      A[{ Digit7: 'ol', Digit8: 'ul', Digit9: 'ck' }[e.code]]();
      return;
    }
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      wrapSelectionTag('code');
      return;
    }
    if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      wrapSelectionTag('mark');
      return;
    }
    if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      exec('strikeThrough');
      return;
    }
    if (sl && flt.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSl({ ...sl, i: (sl.i + (e.key === 'ArrowDown' ? 1 : -1) + flt.length) % flt.length });
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        pickCmd(flt[sl.i][0]);
        return;
      }
    }
    if (sl && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setSl(null);
      return;
    }
    if (e.key === 'Tab') {
      const c = up('td,th');
      if (c) {
        e.preventDefault();
        const n = c.nextElementSibling || (c.parentNode.nextElementSibling && c.parentNode.nextElementSibling.cells[0]);
        caret(n || addRow(c).cells[0]);
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !sl) {
      const b = blockOf();
      if (b && /^H[1-3]$/.test(b.tagName)) {
        const s = getSelection();
        if (s && s.rangeCount && s.isCollapsed) {
          const aft = document.createRange();
          aft.selectNodeContents(b);
          aft.setStart(s.anchorNode, s.anchorOffset);
          if (!aft.toString().replace(/\u200b/g, '').trim()) {
            e.preventDefault();
            const x = document.createElement('p');
            x.innerHTML = '<br>';
            b.after(x);
            caret(x);
            sync();
            return;
          }
        }
      }
      const q = up('blockquote');
      if (q) {
        let c = getSelection().anchorNode;
        while (c && c.parentNode !== q) c = c.parentNode;
        if (c && c.nodeType === 1 && c.tagName === 'DIV' && !c.textContent.trim()) {
          e.preventDefault();
          c.remove();
          const x = document.createElement('p');
          x.innerHTML = '<br>';
          q.after(x);
          caret(x);
          sync();
        }
      }
    }
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      link();
    }
    if (mod && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const b = blockOf();
      if (b) {
        mv(b, e.key === 'ArrowUp' ? -1 : 1);
        caret(b, true);
      }
    }
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      const b = blockOf();
      b && dup(b);
    }
  };

  const onCanvasClick = (e) => {
    const tEl = e.target;
    if (tEl === root.current) {
      const last = root.current.lastElementChild;
      if (last && last.tagName === 'P' && !last.textContent.trim()) caret(last);
      else {
        const n = document.createElement('p');
        n.innerHTML = '<br>';
        root.current.appendChild(n);
        caret(n);
      }
      return;
    }
    const li = tEl.closest && tEl.closest('li.ck');
    if (li && e.clientX - li.getBoundingClientRect().left < 28) {
      e.preventDefault();
      li.classList.toggle('on');
      sync();
      return;
    }
    if (tEl.tagName === 'IMG') {
      if (e.detail === 2 || !isEditing) {
        setFigAct(null);
        setZm(tEl.src);
      } else {
        const fig = tEl.closest('figure');
        if (fig) {
          closeMenus('figAct');
          const rF = fig.getBoundingClientRect();
          setFigAct({
            fig,
            src: tEl.src,
            w: fig.getAttribute('data-w') || '100',
            x: Math.min(Math.max(rF.left + rF.width / 2, 140), innerWidth - 140),
            y: Math.max(rF.top + 10, 64),
          });
        }
      }
    }
  };

  // Reading progress tracking
  useEffect(() => {
    const bucket = Math.round(pg * 10);
    const sig = `${r.id}:${bucket}`;
    if (lastRecBucketRef.current.key === sig) return;
    lastRecBucketRef.current.key = sig;
    p.rec && p.rec(r.id, pg);
  }, [r.id, Math.round(pg * 10)]);

  const reviewDays = (cat && cat.reviewDays) || 90;
  const ageDays = days(r.verified || r.upd);
  const isStale = ageDays > reviewDays;
  const min = Math.max(1, Math.round(plain(r.body || '').split(' ').length / 170));

  const breadcrumb =
    cat && cat.vis === 'Restricted' && !can.viewCat(cat, p.role, userName)
      ? 'Restricted Space'
      : cat
      ? cat.path.join(' › ')
      : 'Knowledge Library';

  const hasImpact = useMemo(() => {
    if ((r.links || []).some(([toId]) => toId !== r.id && res.some((x) => x.id === toId))) return true;
    return res.some(
      (x) =>
        x.id !== r.id &&
        ((x.links || []).some(([toId]) => toId === r.id) ||
          x.node === r.node ||
          (x.tags || []).some((t) => (r.tags || []).includes(t)))
    );
  }, [r, res]);

  const activeHeadingList = isEditing && !sourceMode ? liveToc : m.toc;
  const tocItems = useMemo(
    () => (hasImpact ? [...activeHeadingList, { id: 'impact-graph', t: 'Dependency & Impact Map', l: 2 }] : activeHeadingList),
    [activeHeadingList, hasImpact]
  );

  // Deterministic scroll-spy & top reading bar
  useEffect(() => {
    const updateScroll = () => {
      const d = document.documentElement;
      const maxScroll = d.scrollHeight - d.clientHeight;
      const nextPg = maxScroll > 20 ? Math.min(1, Math.max(0, d.scrollTop / maxScroll)) : 1;
      setPg(nextPg);

      if (!tocItems.length) {
        setAct('');
        return;
      }
      if (Date.now() < clickLockRef.current) return;

      if (maxScroll > 20 && d.scrollTop + d.clientHeight >= d.scrollHeight - 24) {
        setAct(tocItems[tocItems.length - 1].id);
        return;
      }

      let currentId = tocItems[0].id;
      for (const t of tocItems) {
        const el = document.getElementById(t.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 145) currentId = t.id;
        else break;
      }
      setAct(currentId);
    };

    const rafId = requestAnimationFrame(updateScroll);
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll, { passive: true });
    const k = (e) => {
      if (e.key === 'Escape') {
        if (fbPop) setFbPop(null);
        else if (figAct) setFigAct(null);
        else if (sl) setSl(null);
        else if (bm) setBm(null);
        else if (lk) setLk(null);
        else if (zm) setZm(null);
        else if (selCount) {
          clearSelBlocks();
          setFb(null);
        } else if (!document.activeElement || !wrap.current || !wrap.current.contains(document.activeElement)) {
          p.back && p.back();
        }
      }
    };
    document.addEventListener('keydown', k);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
      document.removeEventListener('keydown', k);
    };
  }, [r.id, zm, sl, bm, lk, fbPop, figAct, selCount, tocItems]);

  const goToId = (id) => {
    const e = document.getElementById(id);
    if (!e) return;
    clickLockRef.current = Date.now() + 650;
    setAct(id);
    e.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updateMetaField = (patch) => {
    commitInlinePatch(patch);
    collabRef.current && collabRef.current.broadcastPatch({ kind: 'field', field: 'meta', meta: patch });
  };

  const applyTemplate = (tplKey) => {
    if (!tplKey || !TPL[tplKey]) return;
    if (lastBodyRef.current.trim() && !confirm(`Replace current body with the “${tplKey}” template?`)) return;
    const tplBody = TPL[tplKey];
    loadDom(tplBody);
    commitInlinePatch({ body: tplBody });
    collabRef.current && collabRef.current.broadcastPatch({ kind: 'full_body', fullBody: tplBody });
    p.flash && p.flash(`Applied “${tplKey}” template`);
  };

  const commitNewTag = () => {
    const clean = newTag.trim().replace(/^#+/, '');
    if (clean && !(r.tags || []).includes(clean)) {
      updateMetaField({ tags: [...(r.tags || []), clean] });
    }
    setNewTag('');
    setAddingTag(false);
  };

  if (p.bridgeRef) {
    p.bridgeRef.current = {
      docId: r.id,
      sourceMode,
      simOn,
      ib,
      applyTemplate,
      triggerDocx: () => dx.current && dx.current.click(),
      toggleSourceMode: () => {
        if (!sourceMode && root.current) {
          setSourceText(ewMd(root.current, { ...imgs, ...loc.current }));
        } else if (sourceMode) {
          commitInlinePatch({ body: sourceText });
          collabRef.current && collabRef.current.broadcastPatch({ kind: 'full_body', fullBody: sourceText });
        }
        setSourceMode((v) => !v);
      },
      saveSnapshot: () => {
        const curBody = sourceMode ? sourceText : root.current ? ewMd(root.current, { ...imgs, ...loc.current }) : r.body;
        p.onSaveSnapshot && p.onSaveSnapshot(r.id, curBody);
      },
      toggleSim: () => {
        if (!collabRef.current) return;
        if (simOn) {
          collabRef.current.stopSimulatedPeer();
          setSimOn(false);
        } else {
          collabRef.current.startSimulatedPeer();
          setSimOn(true);
        }
      },
    };
  }

  const Bt = (l, fn, tt, on, cls) =>
    html`<button
      key=${(typeof l === 'string' ? l : '') + (tt || '')}
      type="button"
      className=${[on ? 'on' : '', cls || ''].filter(Boolean).join(' ')}
      title=${tt || (typeof l === 'string' ? l : '')}
      onMouseDown=${(e) => e.preventDefault()}
      onClick=${fn}
    >
      ${l}
    </button>`;
  const V = (k) => html`<i key=${k} className="ewv"></i>`;
  const pct = Math.round(pg * 100);

  const TL = (t) =>
    html`<a
      key=${t.id}
      href=${'#' + t.id}
      className=${(t.l === 3 ? 'l3 ' : '') + (act === t.id ? 'on' : '')}
      onClick=${(e) => {
        e.preventDefault();
        goToId(t.id);
      }}
    >
      ${t.t}
    </a>`;

  const dupMatch = useMemo(() => {
    if (!canEditItem || titleVal.trim().length <= 5) return null;
    return (res || []).find(
      (x) =>
        x.id !== r.id &&
        ((urlVal.trim() && x.url && x.url.trim().toLowerCase() === urlVal.trim().toLowerCase()) ||
          x.title.trim().toLowerCase() === titleVal.trim().toLowerCase())
    );
  }, [res, r.id, titleVal, urlVal, canEditItem]);

  const titlePeer = peers.find((x) => x.activeField === 'title');
  const descPeer = peers.find((x) => x.activeField === 'desc');

  const portalRoot = typeof document !== 'undefined' ? document.body : null;
  const tplKeys = Object.keys(TPL);

  return html`<article className="rd">
    ${portalRoot &&
    createPortal(
      html`<div className="rd-prog-track" aria-hidden="true">
        <div className="rd-prog-fill" style=${{ width: pct + '%' }}></div>
      </div>`,
      portalRoot
    )}

    <header className="rdh">
      <div className="rd-topbar">
        <div className="rd-topbar-l">
          <button type="button" className="rd-back" onClick=${p.back}>
            <${Ic} n="chev" s=${14} /><span>Back</span>
          </button>
          <span className="rd-crumb" title=${breadcrumb}>
            <span className="rd-crumb-dot" style=${{ background: DC[r.disc] || 'var(--blue)' }}></span>
            <b>${breadcrumb}</b>
            <span className="rd-crumb-sep">·</span>
            <span>${TY[r.type] || 'Document'}</span>
          </span>
        </div>

        <div className="rd-topbar-r">
          <div className="collab-bar">
            <span className="collab-status" title=${collabStatus === 'live' ? 'Supabase Realtime connected + local multi-tab sync' : 'Local multi-tab sync active'}>
              <span className=${'collab-dot ' + (collabStatus === 'live' ? 'live' : 'local')}></span>
              <span>${syncState}</span>
            </span>

            <div className="collab-avs" aria-label="Active collaborators">
              <span className="collab-av self" title=${`${userName} (You)`} style=${{ '--pc': 'var(--blue)' }}>
                ${p.userAvatar ? html`<img src=${p.userAvatar} alt="" />` : userName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </span>
              ${peers.map(
                (peer) => html`<span
                  key=${peer.clientId}
                  className="collab-av peer"
                  title=${`${peer.name} · ${peer.blockPreview || 'Viewing'}`}
                  style=${{ '--pc': peer.color }}
                >
                  ${peer.avatar ? html`<img src=${peer.avatar} alt="" />` : peer.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                </span>`
              )}
            </div>
          </div>

          ${canEditItem &&
          html`<div className="rd-mode-pill" role="group" aria-label="Page mode">
            <button type="button" className=${!readLock ? 'on' : ''} onClick=${() => setReadLock(false)}>Edit</button>
            <button type="button" className=${readLock ? 'on' : ''} onClick=${() => {
              closeMenus();
              setFb(null);
              clearSelBlocks();
              setReadLock(true);
            }}>Read</button>
          </div>`}

          ${r.url &&
          html`<a className="btn sm p" href=${r.url} target="_blank" rel="noopener noreferrer">
            <${Ic} n="openx" s=${13} /> Open
          </a>`}

          ${canEditItem &&
          canPublishCat &&
          (r.status === 'Draft' || r.status === 'Review') &&
          html`<button
            type="button"
            className="btn sm p"
            disabled=${!titleVal.trim()}
            onClick=${() => updateMetaField({ status: 'Approved' })}
          >
            Publish
          </button>`}

          ${canEditItem &&
          !canPublishCat &&
          r.status === 'Draft' &&
          html`<button
            type="button"
            className="btn sm p"
            disabled=${!titleVal.trim() || descVal.trim().length < 5}
            onClick=${() => updateMetaField({ status: 'Review' })}
          >
            Submit
          </button>`}

          ${!isGuest &&
          html`<button
            type="button"
            className=${'rd-icon-btn' + (p.fav ? ' on' : '')}
            title=${p.fav ? 'Remove bookmark' : 'Bookmark'}
            aria-label="Bookmark"
            onClick=${() => p.tf(r.id)}
          >
            <${Ic} n="star" s=${15} f=${p.fav} />
          </button>`}

          ${!isGuest &&
          html`<button
            type="button"
            className="rd-icon-btn rd-insp-btn"
            title="Inspector & page settings"
            aria-label="Inspector & page settings"
            onClick=${() => p.info(r.id)}
          >
            <${Ic} n="sliders" s=${15} />
          </button>`}
        </div>
      </div>

      ${isEditing
        ? html`<div className=${'rd-title-wrap' + (titlePeer ? ' has-peer' : '')} style=${titlePeer ? { '--pc': titlePeer.color } : undefined}>
            ${titlePeer && html`<span className="field-peer-tag" style=${{ '--pc': titlePeer.color }}>${titlePeer.name} editing title</span>`}
            <h1>
              <textarea
                className="rd-title-input"
                rows="1"
                placeholder="Untitled standard…"
                value=${titleVal}
                ref=${(el) => {
                  titleRef.current = el;
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = el.scrollHeight + 'px';
                  }
                }}
                onFocus=${() => {
                  activeFieldRef.current = 'title';
                  collabRef.current && collabRef.current.broadcastCursor({ activeField: 'title', activeBlock: -1, blockPreview: 'Editing title', isTyping: true });
                }}
                onBlur=${() => {
                  activeFieldRef.current = null;
                  collabRef.current && collabRef.current.broadcastCursor({ activeField: null, activeBlock: null, blockPreview: '', isTyping: false });
                }}
                onChange=${(e) => {
                  const val = e.target.value.replace(/\r?\n/g, '');
                  setTitleVal(val);
                  commitInlinePatch({ title: val }, { silent: true });
                  collabRef.current && collabRef.current.broadcastPatch({ kind: 'field', field: 'title', value: val });
                }}
                onKeyDown=${(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    root.current && caret(root.current.firstElementChild || root.current);
                  }
                }}
              />
            </h1>
          </div>`
        : html`<h1>${r.title || 'Untitled standard'}</h1>`}

      ${isEditing
        ? html`<div className=${'rd-desc-wrap' + (descPeer ? ' has-peer' : '')} style=${descPeer ? { '--pc': descPeer.color } : undefined}>
            ${descPeer && html`<span className="field-peer-tag" style=${{ '--pc': descPeer.color }}>${descPeer.name} editing summary</span>`}
            <p className="lead">
              <textarea
                className="rd-desc-input"
                rows="1"
                placeholder="Add a concise summary…"
                value=${descVal}
                ref=${(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = el.scrollHeight + 'px';
                  }
                }}
                onFocus=${() => {
                  activeFieldRef.current = 'desc';
                  collabRef.current && collabRef.current.broadcastCursor({ activeField: 'desc', activeBlock: -2, blockPreview: 'Editing summary', isTyping: true });
                }}
                onBlur=${() => {
                  activeFieldRef.current = null;
                  collabRef.current && collabRef.current.broadcastCursor({ activeField: null, activeBlock: null, blockPreview: '', isTyping: false });
                }}
                onChange=${(e) => {
                  const val = e.target.value;
                  setDescVal(val);
                  commitInlinePatch({ desc: val }, { silent: true });
                  collabRef.current && collabRef.current.broadcastPatch({ kind: 'field', field: 'desc', value: val });
                }}
                onKeyDown=${(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    root.current && caret(root.current.firstElementChild || root.current);
                  }
                }}
              />
            </p>
          </div>`
        : r.desc && html`<p className="lead">${r.desc}</p>`}

      ${dupMatch &&
      html`<div className="box" style=${{ marginTop: 10 }}>
        <b>Possible Duplicate Detected</b> Matches existing item: “${dupMatch.title}” (${dupMatch.url || dupMatch.author}).
      </div>`}

      <div className="row rd-meta">
        <${Pill} s=${r.status} />
        ${r.vis && r.vis !== 'Internal' && html`<${VisPill} v=${r.vis} />`}
        <span className="rd-meta-disc"><i className="dd" style=${{ background: DC[r.disc] }}></i> ${r.disc || 'VDC'}</span>
        <span>·</span>
        <span>${r.stage || STG[0]}</span>
        <span>·</span>
        <span>${r.author}</span>
        <span>·</span>
        <span>Updated ${fmt(r.upd)}</span>
        <span>·</span>
        <span>v${(r.v || []).length || 1}</span>
        <span>·</span>
        <span>${min} min</span>
        <span>·</span>
        <span className=${isStale ? 'stale' : 'fresh'}>${isStale ? `Review (${ageDays}d)` : 'Up to date'}</span>
        ${p.req.includes(r.id) && html`<span className="pill" style=${{ '--c': '#ff3b30' }}>Required</span>`}
        ${!isGuest &&
        html`<button type="button" className="rd-meta-props" onClick=${() => p.info(r.id)}>
          <${Ic} n="sliders" s=${12} />
          <span>Properties</span>
        </button>`}
      </div>

      ${r.status === 'Archived' &&
      html`<div className="box" style=${{ marginTop: 14 }}>
        <b>Archived Content</b>This item is archived and kept only for historical reference.
      </div>`}
    </header>

    <div className=${'rdl' + (tocItems.length > 1 ? '' : ' one')}>
      <div className="rd-main">
        ${tocItems.length > 1 && html`<details className="mtoc"><summary>Contents</summary>${tocItems.map(TL)}</details>`}

        ${isEditing
          ? html`<div
              className="ewbw notion-wrap"
              ref=${wrap}
              onMouseDown=${onWrapMouseDown}
              onMouseMove=${onMove}
              onMouseEnter=${() => clearTimeout(lt.current)}
              onMouseLeave=${() => {
                lt.current = setTimeout(() => setHd(null), 260);
              }}
              onDragOver=${dOver}
              onDrop=${dDrop}
              onDragEnd=${dEnd}
            >
              ${sourceMode
                ? html`<textarea
                    key="src"
                    className="ewsrc"
                    value=${sourceText}
                    onChange=${(e) => {
                      const v = e.target.value;
                      setSourceText(v);
                      scheduleAutoSave(v);
                      collabRef.current && collabRef.current.broadcastPatch({ kind: 'full_body', fullBody: v });
                    }}
                    spellCheck="false"
                  />`
                : html`<${Fragment}>
                    <div
                      ref=${root}
                      className="prose ewb notion-canvas"
                      contentEditable="true"
                      suppressContentEditableWarning=${true}
                      spellCheck="true"
                      role="textbox"
                      aria-multiline="true"
                      aria-label="Document body"
                      onInput=${onInput}
                      onKeyDown=${onKey}
                      onClick=${onCanvasClick}
                      onBlur=${() => {
                        setTimeout(() => {
                          if (!root.current || !root.current.contains(document.activeElement)) {
                            collabRef.current &&
                              collabRef.current.broadcastCursor({ activeField: null, activeBlock: null, blockPreview: '', isTyping: false });
                          }
                        }, 80);
                      }}
                      onPaste=${(e) => {
                        const fs = [...e.clipboardData.files];
                        e.preventDefault();
                        if (fs.length) {
                          addImgs(fs);
                          return;
                        }
                        const tx = e.clipboardData.getData('text/plain');
                        if (!tx) return;
                        const u = tx.trim();
                        if (/^https?:\/\/\S+$/.test(u)) {
                          const s = getSelection();
                          if (s.rangeCount && !s.isCollapsed) document.execCommand('createLink', false, u);
                          else document.execCommand('insertHTML', false, '<a href="' + esc(u) + '">' + esc(u) + '</a>');
                          sync();
                          return;
                        }
                        if (/\n/.test(u) && /^(#{1,3} |[-*] |\d+\. |> |```|\|)/m.test(u)) {
                          put(toDom(u).innerHTML);
                          return;
                        }
                        document.execCommand('insertText', false, tx);
                      }}
                    ></div>

                    ${peerBoxes.map(
                      (pb) => html`<div
                        key=${pb.clientId}
                        className="block-remote-peer"
                        style=${{ top: pb.top + 'px', height: pb.height + 'px', '--pc': pb.color }}
                      >
                        <span className="block-remote-tag">
                          <span className="block-remote-dot"></span>
                          ${pb.name}${pb.isTyping ? ' · typing' : ''}
                        </span>
                      </div>`
                    )}

                    ${hd &&
                    html`<div className="ewh" style=${{ top: hd.top }}>
                      <button type="button" title="Add block below" onClick=${plus}>+</button>
                      <button
                        type="button"
                        title="Drag to move · click for menu"
                        draggable="true"
                        onDragStart=${dStart}
                        onDragEnd=${dEnd}
                        onClick=${grip}
                      >
                        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                          <circle cx="2.5" cy="2.5" r="1.2" />
                          <circle cx="7.5" cy="2.5" r="1.2" />
                          <circle cx="2.5" cy="7" r="1.2" />
                          <circle cx="7.5" cy="7" r="1.2" />
                          <circle cx="2.5" cy="11.5" r="1.2" />
                          <circle cx="7.5" cy="11.5" r="1.2" />
                        </svg>
                      </button>
                    </div>`}
                    ${dp && html`<div className="ewdp" style=${{ top: dp.y - 1 }}></div>`}
                    ${emp && html`<div className="notion-hint">Start writing, or type <code>/</code> for blocks…</div>`}
                    ${emp &&
                    html`<div className="ew-starter" onMouseDown=${(e) => e.stopPropagation()}>
                      <span>Quick start:</span>
                      ${tplKeys.slice(0, 3).map(
                        (tk) => html`<button type="button" key=${tk} onClick=${() => applyTemplate(tk)}>${tk}</button>`
                      )}
                      <button type="button" onClick=${() => dx.current && dx.current.click()}>Import .docx</button>
                    </div>`}
                  </${Fragment}>`}
            </div>`
          : m.h
          ? html`<div
              className="prose"
              onClick=${(e) => {
                const tEl = e.target;
                if (tEl.tagName === 'IMG') setZm(tEl.src);
                else {
                  const li = tEl.closest && tEl.closest('li.ck');
                  li && p.togChk && p.togChk(r.id, +li.dataset.k);
                }
              }}
              dangerouslySetInnerHTML=${{ __html: m.h }}
            ></div>`
          : html`<div className="empty"><b>Document is empty</b><span>Ask an author or Category Owner to populate content.</span></div>`}

        ${!isGuest &&
        p.req.includes(r.id) &&
        html`<div className="ackb">
          ${p.acks[r.id]
            ? html`<span className="okk"><${Ic} n="check" s=${18} /> Read & confirmed ${fmt(p.acks[r.id])}</span>`
            : html`<span>This document is marked as mandatory reading.</span>
                <button type="button" className="btn p" onClick=${() => p.ack(r.id)}>Confirm I have read it</button>`}
        </div>`}

        <div className="row rd-tags-row" style=${{ marginTop: 28 }}>
          ${(r.tags || []).map(
            (t) => html`<span key=${t} className="rd-tag">
              #${t}
              ${isEditing &&
              html`<button
                type="button"
                className="rd-tag-x"
                aria-label=${`Remove tag ${t}`}
                onClick=${() => updateMetaField({ tags: (r.tags || []).filter((x) => x !== t) })}
              >
                ×
              </button>`}
            </span>`
          )}
          ${isEditing &&
          (addingTag
            ? html`<input
                autoFocus
                className="rd-tag-inp"
                placeholder="tag + Enter"
                value=${newTag}
                onChange=${(e) => setNewTag(e.target.value)}
                onBlur=${commitNewTag}
                onKeyDown=${(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    commitNewTag();
                  } else if (e.key === 'Escape') {
                    setNewTag('');
                    setAddingTag(false);
                  }
                }}
              />`
            : html`<button type="button" className="rd-tag-add" onClick=${() => setAddingTag(true)}>+ Tag</button>`)}
        </div>

        <${LocalImpactGraph} item=${r} res=${res} onRead=${p.go} onInfo=${p.info} />
      </div>

      ${tocItems.length > 1 &&
      html`<nav className="toc" aria-label="Contents">
        <b>Contents</b>
        ${tocItems.map(TL)}
      </nav>`}
    </div>

    ${canEditItem &&
    html`<${Fragment}>
      <input
        ref=${dx}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange=${(e) => {
          impDocx(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <input
        ref=${fi}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange=${(e) => {
          addImgs([...e.target.files]);
          e.target.value = '';
        }}
      />
    </${Fragment}>`}

    ${portalRoot &&
    isEditing &&
    fb &&
    !sourceMode &&
    createPortal(
      fb.multi
        ? html`<div className="ewf" style=${{ left: fb.x + 'px', top: fb.y + 'px' }} onMouseDown=${(e) => e.preventDefault()}>
            <span className="ewf-count">${fb.count} blocks</span>
            ${V('m0')}
            ${Bt(
              html`<span className="ewf-turn">Turn into <span className="ewf-chv">▾</span></span>`,
              () => {
                const batch = getSelBlocks();
                if (!batch.length) return;
                closeMenus('bm');
                const pos = clampMenuPos(fb.x - 124, fb.y + 44, 248, 360);
                setBm({ el: batch[0], targets: batch, x: pos.left, y: pos.top, mode: 'turn', curType: blockTypeOf(batch[0]) });
              },
              'Turn selected blocks into…'
            )}
            ${Bt(
              'Duplicate',
              () => {
                const batch = getSelBlocks();
                batch.length && dup(batch[0]);
                clearSelBlocks();
                setFb(null);
              },
              'Duplicate blocks (Ctrl+D)'
            )}
            ${V('m1')}
            ${Bt(
              html`<span style=${{ color: '#ff453a', fontWeight: 600 }}>Delete</span>`,
              () => rm(),
              'Delete selected blocks (Backspace)'
            )}
          </div>`
        : html`<div className="ewf" style=${{ left: fb.x + 'px', top: fb.y + 'px' }}>
            ${Bt(
              html`<span className="ewf-turn"><${BlockGlyph} type="spark" size=${13} /> AI <span className="ewf-chv">▾</span></span>`,
              (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setFbPop((o) =>
                  o && o.kind === 'ai'
                    ? null
                    : {
                        kind: 'ai',
                        x: Math.min(Math.max(rect.left + rect.width / 2, 124), innerWidth - 124),
                        y: Math.min(rect.bottom + 8, innerHeight - 210),
                      }
                );
              },
              'AI writing tools',
              fbPop && fbPop.kind === 'ai',
              'ewf-ai'
            )}
            ${V('a')}
            ${Bt(
              html`<span className="ewf-turn">${curBlkLabel} <span className="ewf-chv">▾</span></span>`,
              () => {
                const b = blockOf();
                if (!b) return;
                closeMenus('bm');
                const pos = clampMenuPos(fb.x - 124, fb.y + 44, 248, 360);
                setBm({ el: b, targets: [b], x: pos.left, y: pos.top, mode: 'turn', curType: curBlkKey });
              },
              'Turn into'
            )}
            ${V(0)}
            ${Bt(html`<b>B</b>`, () => exec('bold'), 'Bold (Ctrl+B)', fa.b)}
            ${Bt(html`<i style=${{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>I</i>`, () => exec('italic'), 'Italic (Ctrl+I)', fa.i)}
            ${Bt(html`<u>U</u>`, () => exec('underline'), 'Underline (Ctrl+U)', fa.u)}
            ${Bt(html`<s>S</s>`, () => exec('strikeThrough'), 'Strikethrough (Ctrl+Shift+S)', fa.s)}
            ${Bt(html`<span style=${{ fontFamily: 'ui-monospace,monospace', fontSize: 12.5 }}>${'<>'}</span>`, () => wrapSelectionTag('code'), 'Inline Code (Ctrl+E)', fa.c)}
            ${Bt(
              html`<span className="ewf-clr-a"><span>A</span><i className="ewf-clr-bar" style=${{ background: (TEXT_COLORS.find((x) => x[0] === fa.tc) || [])[2] || 'var(--blue)' }}></i></span>`,
              (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setFbPop((o) =>
                  o && o.kind === 'color'
                    ? null
                    : {
                        kind: 'color',
                        x: Math.min(Math.max(rect.left + rect.width / 2, 124), innerWidth - 124),
                        y: Math.min(rect.bottom + 8, innerHeight - 200),
                      }
                );
              },
              'Text color & highlight',
              Boolean(fa.h || (fa.tc && fa.tc !== 'default') || (fbPop && fbPop.kind === 'color'))
            )}
            ${V('al')}
            ${Bt(html`<${BlockGlyph} type="alL" size=${13} />`, () => applyAlign('left'), 'Align left', fa.al === 'left' || !fa.al)}
            ${Bt(html`<${BlockGlyph} type="alC" size=${13} />`, () => applyAlign('center'), 'Align center', fa.al === 'center')}
            ${Bt(html`<${BlockGlyph} type="alR" size=${13} />`, () => applyAlign('right'), 'Align right', fa.al === 'right')}
            ${V(1)}
            ${Bt(fa.a ? 'Unlink' : 'Link', link, 'Link (Ctrl+K)', fa.a)}
            ${Bt(html`<${BlockGlyph} type="clearfmt" size=${13} />`, clearFormatting, 'Clear formatting')}
          </div>`,
      portalRoot
    )}

    ${portalRoot &&
    isEditing &&
    fbPop &&
    !sourceMode &&
    createPortal(
      html`<div className="ewf-pop" style=${{ left: fbPop.x + 'px', top: fbPop.y + 'px' }} onMouseDown=${(e) => e.preventDefault()}>
        ${fbPop.kind === 'ai'
          ? html`<div className="ewf-pop-list">
              <div className="ewf-pop-hdr">Ask AI</div>
              ${AI_ACTIONS.map(
                ([ak, albl]) => html`<button type="button" key=${ak} onClick=${() => applyAiAction(ak)}>
                  <span className="ew-ico"><${BlockGlyph} type="spark" size=${13} /></span>
                  <span className="ew-lbl">${albl}</span>
                </button>`
              )}
            </div>`
          : html`<div>
              <div className="ewf-pop-hdr">Text color</div>
              <div className="ewf-swatches">
                ${TEXT_COLORS.map(
                  ([ck, clbl, cval]) => html`<button
                    type="button"
                    key=${ck}
                    title=${clbl}
                    className=${'ewf-sw' + ((fa.tc || 'default') === ck ? ' on' : '')}
                    style=${{ color: cval === 'inherit' ? 'var(--text)' : cval }}
                    onClick=${() => applyTextColor(ck)}
                  >
                    A
                  </button>`
                )}
              </div>
              <div className="ewf-pop-hdr">Highlight</div>
              <div className="ewf-swatches">
                ${HL_COLORS.map(
                  ([hk, hlbl, hbg]) => html`<button
                    type="button"
                    key=${hk}
                    title=${hlbl}
                    className=${'ewf-sw' + ((fa.h || 'none') === hk ? ' on' : '')}
                    style=${{ background: hbg }}
                    onClick=${() => applyHighlight(hk)}
                  >
                    ${hk === 'none' ? '∅' : ''}
                  </button>`
                )}
              </div>
            </div>`}
      </div>`,
      portalRoot
    )}

    ${portalRoot &&
    isEditing &&
    figAct &&
    !sourceMode &&
    createPortal(
      html`<div className="ew-figbar" style=${{ left: figAct.x + 'px', top: figAct.y + 'px' }} onMouseDown=${(e) => e.preventDefault()}>
        ${['50', '75', '100'].map(
          (w) => html`<button
            type="button"
            key=${w}
            className=${figAct.w === w ? 'on' : ''}
            onClick=${() => {
              const fg = figAct.fig;
              if (!fg || !fg.isConnected) return;
              if (w === '100') fg.removeAttribute('data-w');
              else fg.setAttribute('data-w', w);
              setFigAct({ ...figAct, w });
              sync();
            }}
          >
            ${w}%
          </button>`
        )}
        <button
          type="button"
          onClick=${() => {
            setZm(figAct.src);
            setFigAct(null);
          }}
        >
          Zoom
        </button>
        <button
          type="button"
          className="dng"
          onClick=${() => {
            const fg = figAct.fig;
            setFigAct(null);
            fg && fg.isConnected && rm(fg);
          }}
        >
          Delete
        </button>
      </div>`,
      portalRoot
    )}

    ${portalRoot && lasso && createPortal(html`<div className="ew-lasso" style=${{ left: lasso.left + 'px', top: lasso.top + 'px', width: lasso.width + 'px', height: lasso.height + 'px' }}></div>`, portalRoot)}

    ${portalRoot &&
    isEditing &&
    lk &&
    createPortal(
      html`<div className="ewf ewlk" style=${{ left: lk.x + 'px', top: lk.y + 'px' }}>
        <input
          autoFocus
          placeholder="Paste link & press Enter…"
          value=${lk.v}
          onChange=${(e) => setLk({ ...lk, v: e.target.value })}
          onKeyDown=${(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyLink(lk.v);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setLk(null);
              const rg = selR.current;
              if (rg && root.current) {
                root.current.focus();
                const s = getSelection();
                s.removeAllRanges();
                s.addRange(rg);
              }
            }
          }}
        />
        <button type="button" className="ewlk-btn" onClick=${() => applyLink(lk.v)}>Apply</button>
      </div>`,
      portalRoot
    )}

    ${portalRoot &&
    isEditing &&
    tb &&
    !sourceMode &&
    createPortal(
      html`<div className="ewf" style=${{ left: tb.x + 'px', top: tb.y + 'px' }}>
        ${Bt('+ Row', () => {
          const c = up('td,th');
          c && caret(addRow(c).cells[0]);
        })}
        ${Bt('+ Column', addCol)}
        ${V(1)}
        ${Bt('− Row', delRow)}
        ${Bt('− Column', delCol)}
        ${V(2)}
        ${Bt('Delete', delTbl)}
      </div>`,
      portalRoot
    )}

    ${portalRoot &&
    isEditing &&
    bm &&
    createPortal(
      html`<div className="ewbm" style=${{ left: bm.x + 'px', top: bm.y + 'px' }} onMouseDown=${(e) => e.preventDefault()}>
        <div className="ew-scroll">
          <div className="ew-mhdr">Turn into</div>
          ${TURN.map(
            (x) => html`<button type="button" key=${x[0]} onClick=${() => turn(x[0])}>
              <span className="ew-ico"><${BlockGlyph} type=${x[0]} size=${14} /></span>
              <span className="ew-lbl">${x[1]}</span>
              ${bm.curType === x[0] && html`<span className="ew-chk">✓</span>`}
            </button>`
          )}
          ${bm.mode === 'all' &&
          html`<div className="ew-mdiv"></div>
            <button
              type="button"
              onClick=${() => {
                dup(bm.el);
                setBm(null);
              }}
            >
              <span className="ew-ico"><${BlockGlyph} type="dup" size=${14} /></span>
              <span className="ew-lbl">Duplicate</span>
              <span className="ew-mk">Ctrl+D</span>
            </button>
            <button
              type="button"
              onClick=${() => {
                mv(bm.el, -1);
                setBm(null);
              }}
            >
              <span className="ew-ico"><${BlockGlyph} type="up" size=${14} /></span>
              <span className="ew-lbl">Move up</span>
            </button>
            <button
              type="button"
              onClick=${() => {
                mv(bm.el, 1);
                setBm(null);
              }}
            >
              <span className="ew-ico"><${BlockGlyph} type="down" size=${14} /></span>
              <span className="ew-lbl">Move down</span>
            </button>
            <button
              type="button"
              className="dng"
              onClick=${() => {
                rm(bm.el);
                setBm(null);
              }}
            >
              <span className="ew-ico"><${BlockGlyph} type="del" size=${14} /></span>
              <span className="ew-lbl">Delete block</span>
            </button>`}
        </div>
      </div>`,
      portalRoot
    )}

    ${portalRoot &&
    isEditing &&
    sl &&
    createPortal(
      html`<div className="ewsl" style=${{ left: sl.x + 'px', top: sl.y + 'px' }} onMouseDown=${(e) => e.preventDefault()}>
        <div className="ew-scroll">
          ${flt.length
            ? flt.map(
                (x, k) => html`<${Fragment} key=${x[0]}>
                  ${!sl.q && (k === 0 || flt[k - 1][3] !== x[3]) && html`<div className="ew-mhdr">${x[3]}</div>`}
                  <button
                    type="button"
                    className=${k === sl.i ? 'on' : ''}
                    onMouseEnter=${() => setSl((o) => (o && o.i !== k ? { ...o, i: k } : o))}
                    onClick=${() => pickCmd(x[0])}
                  >
                    <span className="ew-ico"><${BlockGlyph} type=${x[0]} size=${14} /></span>
                    <span className="ew-lbl">${x[1]}</span>
                    ${x[5] && html`<span className="ew-mk">${x[5]}</span>`}
                  </button>
                </${Fragment}>`
              )
            : html`<div className="ewno">No matching blocks</div>`}
        </div>
      </div>`,
      portalRoot
    )}

    ${zm &&
    portalRoot &&
    createPortal(
      html`<div className="zoom" onClick=${() => setZm(null)}><img src=${zm} alt="" decoding="async" /></div>`,
      portalRoot
    )}
  </article>`;
}
