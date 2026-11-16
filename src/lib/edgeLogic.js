// Shared pure-JS Edge logic (Web Standard safe — runs in Next.js Edge Runtime and browser fallback)

import { lookupNamingQuery } from '../features/naming/namingEngine.js';
import {
  tokenizeUnique,
  expandTokens,
  scoreDocument,
  hasCyrillic,
} from '../utils/search.js';
import {
  extractMarkdownSections,
  extractBestExcerpt,
  detectNamingCodeInText,
} from '../utils/sections.js';

const tokenize = tokenizeUnique;

const plainText = (b) =>
  (b || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/[#>*`|]/g, " ").replace(/\s+/g, " ").trim();

const daysSince = (d, ref) => {
  if (!d) return 0;
  const base = ref ? new Date(ref).getTime() : Date.now();
  return Math.max(0, Math.round((base - new Date(d).getTime()) / 86400000));
};

export function canUserViewInEdge(item, userRole, userName, allowedCategories = [], directShareIds = []) {
  if (item.status !== "Approved") return false;
  if (userRole === "SuperAdmin" || userRole === "Admin" || userRole === "Owner") return true;
  if (userRole === "Guest") return item.vis === "Public" || directShareIds.includes(item.id);
  if (item.vis === "Public" || item.author === userName || directShareIds.includes(item.id)) return true;
  if (item.vis === "Restricted") return false;
  return allowedCategories.length === 0 || !item.node || allowedCategories.includes(item.node);
}

function buildEffectiveQuery(query, history = []) {
  const q = String(query || "").trim();
  const baseTokens = tokenizeUnique(q);
  const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
  const isFollowUp =
    recentHistory.length > 0 &&
    (baseTokens.length <= 3 ||
      /\b(it|this|that|they|them|more|details|also|what about|це|цей|ця|там|ще|детальніше|також|а якщо|а для)\b/i.test(q));

  const contextDocIds = new Set();
  const extraParts = [];
  if (isFollowUp) {
    for (let i = recentHistory.length - 1; i >= 0; i--) {
      const m = recentHistory[i];
      if (!m) continue;
      if (m.role === "user" && m.text && extraParts.length < 2) {
        extraParts.push(m.text);
      }
      if (Array.isArray(m.src)) {
        m.src.forEach((s) => s && s.id && contextDocIds.add(s.id));
      }
    }
  }

  const combinedText = extraParts.length ? `${q} ${extraParts.join(" ")}` : q;
  const combinedTokens = tokenizeUnique(combinedText);
  const expanded = expandTokens(combinedTokens);
  return {
    q,
    baseTokens,
    combinedTokens,
    expandedTerms: expanded.map((x) => x.term),
    contextDocIds,
    isFollowUp,
  };
}

function pickBestSectionsForItem(item, expandedTerms, limit = 1) {
  const sections = extractMarkdownSections(item.body || "", item.title || "", item.desc || "");
  if (!sections.length) {
    return [{ id: "", title: "", text: item.desc || "" }];
  }

  const scored = sections.map((sec, idx) => {
    const titleL = (sec.title || "").toLowerCase();
    const textL = (sec.text || "").toLowerCase();
    let score = idx === 0 && sec.text.length > 30 ? 0.5 : 0;
    for (let i = 0; i < expandedTerms.length; i++) {
      const t = expandedTerms[i];
      if (!t) continue;
      if (titleL.includes(t)) score += 6;
      if (textL.includes(t)) score += 2;
    }
    return { sec, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.sec);
}

export function runAiEdgeLogic(payload) {
  const {
    action = "qa",
    query = "",
    userRole = "Member",
    userName = "",
    allowedCategories = [],
    directShareIds = [],
    items = [],
    personalTasks = [],
    personalNotes = [],
    targetItem = null,
    targetDocId = null,
    scope = "all",
    history = [],
    today = "2026-10-22",
    clientDate = "",
  } = payload || {};

  if (action === "summarize" && targetItem) {
    const clean = plainText(targetItem.body || "");
    const sentences = (clean.match(/[^.!?]+[.!?]/g) || [clean]).slice(0, 2).join(" ").trim();
    const freq = {};
    tokenize(`${targetItem.title} ${clean}`).forEach((w) => {
      if (w.length > 4) freq[w] = (freq[w] || 0) + 1;
    });
    const suggestedTags = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map((x) => x[0]);
    return {
      summary: sentences.slice(0, 200) || targetItem.desc || "",
      suggestedTags,
    };
  }

  const authorized = items.filter((it) =>
    canUserViewInEdge(it, userRole, userName, allowedCategories, directShareIds)
  );
  const scopedPool =
    scope === "doc" && targetDocId != null
      ? authorized.filter((it) => String(it.id) === String(targetDocId))
      : authorized;

  const eff = buildEffectiveQuery(query, history);
  const isUa = hasCyrillic(eff.q);
  const namingNote = lookupNamingQuery(eff.q) || (eff.isFollowUp ? lookupNamingQuery(eff.expandedTerms.join(" ")) : null);

  const rankedDocs = scopedPool
    .map((r) => {
      const primary = scoreDocument(r, eff.q, eff.baseTokens);
      let score = primary.score;
      if (eff.isFollowUp) {
        const follow = scoreDocument(r, eff.q, eff.combinedTokens);
        score = Math.max(score, follow.score * 0.72);
        if (eff.contextDocIds.has(r.id)) score += 3.5;
      }
      if (targetDocId != null && String(r.id) === String(targetDocId)) {
        score += scope === "doc" ? 20 : 6;
      }
      return { item: r, score, kind: "doc" };
    })
    .filter((x) => x.score > 0 || (scope === "doc" && targetDocId != null && String(x.item.id) === String(targetDocId)));

  const qLow = eff.q.toLowerCase();
  const realToday = clientDate || new Date().toISOString().slice(0, 10);
  const asksTasks = /(?:task|tasks|todo|to-do|urgent|deadline|overdue|today|tomorrow|таск|задач|завдан|термінов|сьогодні|завтра|справ|дедлайн|проєкт)/i.test(qLow);
  const asksUrgent = /(?:urgent|asap|priority|термінов|пріоритет|гаряч)/i.test(qLow);
  const asksToday = /(?:today|overdue|due|сьогодні|зараз|простроч)/i.test(qLow);
  const asksNotes = /(?:note|notes|memo|capture|brain|нотатк|запис|памят|іде)/i.test(qLow);

  const rankedBrain = [];
  if (scope !== "doc") {
    for (const t of personalTasks || []) {
      if (!t || !t.title) continue;
      const isDone = t.status === "done";
      if (isDone && (asksUrgent || asksToday) && !/(?:done|completed|виконан|завершен)/i.test(qLow)) continue;
      const fakeDoc = {
        id: `task:${t.id}`,
        title: t.title,
        desc: `${t.project || "General"} ${t.isUrgent ? "urgent терміново" : ""} ${t.dueDate || ""} ${t.linkedItemTitle || ""}`,
        body: t.notes || "",
        disc: t.project || "General",
        tags: [t.project || "General", t.status, t.isUrgent ? "urgent" : ""],
      };
      let score = scoreDocument(fakeDoc, eff.q, eff.baseTokens).score;
      if (asksTasks && !isDone) {
        score += 3;
        if (asksUrgent && t.isUrgent) score += 10;
        if (asksToday && t.dueDate && t.dueDate <= realToday) score += 9;
        if (!asksUrgent && !asksToday && (t.isUrgent || (t.dueDate && t.dueDate <= realToday))) score += 4;
      }
      if (t.project && qLow.includes(String(t.project).toLowerCase())) score += 7;
      if (score > 0) {
        const metaParts = [
          t.isUrgent ? "Urgent" : "",
          t.project ? `Project: ${t.project}` : "",
          t.dueDate ? `Due ${t.dueDate}` : "",
          `Status: ${t.status === "in_progress" ? "In Progress" : t.status === "done" ? "Done" : "To Do"}`,
        ].filter(Boolean);
        rankedBrain.push({
          kind: "task",
          score,
          item: {
            id: `task:${t.id}`,
            rawId: t.id,
            title: t.title,
            url: "",
            disc: t.project || "General",
            type: "doc",
            brainKind: "task",
            reviewDays: 9999,
            verified: realToday,
            upd: realToday,
            desc: `${metaParts.join(" · ")}${t.notes ? ` — ${t.notes}` : ""}`,
            body: `${metaParts.join(" · ")}${t.notes ? `\n${t.notes}` : ""}${t.linkedItemTitle ? `\nLinked standard: ${t.linkedItemTitle}` : ""}`,
          },
        });
      }
    }

    for (const n of personalNotes || []) {
      if (!n) continue;
      const fakeDoc = {
        id: `note:${n.id}`,
        title: n.title || "Private Note",
        desc: n.project || "General",
        body: n.body || "",
        disc: n.project || "General",
        tags: n.tags || [],
      };
      let score = scoreDocument(fakeDoc, eff.q, eff.baseTokens).score;
      if (asksNotes) score += n.isPinned ? 5 : 3;
      if (n.project && qLow.includes(String(n.project).toLowerCase())) score += 6;
      if (score > 0) {
        rankedBrain.push({
          kind: "note",
          score,
          item: {
            id: `note:${n.id}`,
            rawId: n.id,
            title: n.title || "Private Note",
            url: "",
            disc: n.project || "General",
            type: "doc",
            brainKind: "note",
            reviewDays: 9999,
            verified: realToday,
            upd: realToday,
            desc: plainText(n.body || "").slice(0, 220),
            body: n.body || "",
          },
        });
      }
    }
  }

  const ranked = [...rankedDocs, ...rankedBrain]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const toSource = (item, idx, secOverride = null) => {
    const cycle = item.reviewDays || 90;
    const age = daysSince(item.verified || item.upd, today);
    const sec = secOverride || pickBestSectionsForItem(item, eff.expandedTerms, 1)[0];
    const secTitle = sec && sec.title && sec.title !== item.title ? sec.title : "";
    const excerptSource = (sec && sec.text) || item.desc || plainText(item.body || "");
    return {
      index: idx + 1,
      id: item.id,
      brainKind: item.brainKind || null,
      title: item.title,
      sectionId: (sec && sec.id) || "",
      sectionTitle: secTitle,
      url: item.url || "",
      disc: item.disc || "",
      type: item.type || "doc",
      stale: age > cycle,
      ageDays: age,
      excerpt:
        item.brainKind === "task"
          ? String(item.desc || excerptSource).slice(0, 230)
          : extractBestExcerpt(excerptSource, eff.expandedTerms, 230),
    };
  };

  let sources = [];
  if (scope === "doc" && ranked.length === 1) {
    const docItem = ranked[0].item;
    const topSections = pickBestSectionsForItem(docItem, eff.expandedTerms, 3);
    sources = topSections.map((sec, idx) => toSource(docItem, idx, sec));
  } else {
    sources = ranked.map((x, idx) => toSource(x.item, idx));
  }

  const detectedCode =
    detectNamingCodeInText(eff.q) ||
    detectNamingCodeInText(namingNote || "") ||
    (sources[0] && detectNamingCodeInText(`${sources[0].title} ${sources[0].excerpt}`));

  const actions = {
    namingCode: detectedCode || null,
    suggestNamingStudio: Boolean(namingNote || detectedCode),
    noResultsGap: !sources.length && !namingNote,
    lang: isUa ? "uk" : "en",
  };

  if (!sources.length) {
    if (namingNote) {
      const namingDoc = authorized.find((r) => r.id === 137) || authorized.find((r) => r.id === 107);
      const fallbackSrc = namingDoc ? [toSource(namingDoc, 0)] : [];
      return {
        answer: `[Rule Spec${namingDoc ? ` #${namingDoc.id}` : ""}] ${namingNote}${fallbackSrc.length ? " [1]" : ""}`,
        sources: fallbackSrc,
        actions: { ...actions, noResultsGap: false },
        authorizedCount: authorized.length,
        ragChunks: fallbackSrc,
      };
    }
    return {
      answer: isUa
        ? "У доступній для твоєї ролі базі не знайдено точного стандарту за цим запитом. Ти можеш зафіксувати прогалину для BIM/VDC-ліда, щоб додати цю інструкцію."
        : "No exact published standard matched this query in your accessible library. You can flag this gap for a BIM/VDC lead.",
      sources: [],
      actions,
      authorizedCount: authorized.length,
      ragChunks: [],
    };
  }

  const bulletLines = sources.map((s) => {
    const loc = s.sectionTitle ? ` (§ ${s.sectionTitle})` : "";
    const text = s.excerpt || s.title;
    return `• ${s.title}${loc}: ${text}${/[.!?…]$/.test(text) ? "" : "."} [${s.index}]`;
  });

  const prefix = namingNote
    ? `${authorized.some((r) => r.id === 137) ? "[Rule Spec #137]" : "[Rule Spec]"} ${namingNote}\n`
    : "";

  const answer = prefix + bulletLines.join("\n");

  return {
    answer,
    sources,
    actions,
    authorizedCount: authorized.length,
    ragChunks: sources,
  };
}

export function runPublicPreflightLogic(payload) {
  const { item, allItems = [], categoryVis = "Internal", clearedAttachmentIds = [] } = payload || {};
  if (!item) return { eligible: false, blockers: ["Missing target item"], attachments: [], nonPublicLinks: [] };

  const attachments = [...(item.body || "").matchAll(/!\[([^\]]*)\]\(img:(\w+)\)/g)].map((m) => ({
    id: m[2],
    caption: m[1] || `Attachment ${m[2]}`,
    cleared: clearedAttachmentIds.includes(m[2]),
  }));

  const nonPublicLinks = (item.links || [])
    .map(([targetId, kind]) => {
      const target = allItems.find((x) => x.id === targetId);
      return target ? { id: target.id, title: target.title, kind, vis: target.vis || "Internal" } : null;
    })
    .filter((x) => x && x.vis !== "Public");

  const blockers = [];
  if (item.status !== "Approved") {
    blockers.push(`Item status is "${item.status}". Only Published (Approved) items can be made Public.`);
  }
  if (categoryVis === "Restricted") {
    blockers.push("Item belongs to a Restricted category. Move it first or override via Admin.");
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    attachments,
    nonPublicLinks,
    strippedFields: ["Comments & @mentions", "Version history & Rollback", "Author emails", "Dependency graph"],
  };
}

export function runGovernanceScanLogic(payload) {
  const { items = [], categories = [], today = "2026-10-22", requiredIds = [], acks = {} } = payload || {};
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const itemMap = new Map(items.map((r) => [r.id, r]));

  const staleItems = [];
  const missingSummaryItems = [];
  const brokenDependencies = [];
  const urlBuckets = {};
  const titleBuckets = {};

  for (const r of items) {
    if (r.status === "Archived" || r.status === "Deleted") continue;
    const cat = catMap.get(r.node);
    const reviewDays = r.reviewDays || (cat && cat.reviewDays) || 90;
    const age = daysSince(r.verified || r.upd || today, today);

    if (r.status === "Approved" && age > reviewDays) {
      staleItems.push({ id: r.id, title: r.title, owner: r.author, ageDays: age, reviewDays });
    }
    if (!r.desc || r.desc.trim().length < 10) {
      missingSummaryItems.push({ id: r.id, title: r.title, owner: r.author, status: r.status });
    }
    if (r.url && /^https?:\/\//i.test(r.url) && r.url !== "https://drive.google.com") {
      const normUrl = r.url.trim().toLowerCase().replace(/\/+$/, "");
      urlBuckets[normUrl] = urlBuckets[normUrl] || [];
      urlBuckets[normUrl].push(r.id);
    }
    const normTitle = (r.title || "").trim().toLowerCase();
    if (normTitle) {
      titleBuckets[normTitle] = titleBuckets[normTitle] || [];
      titleBuckets[normTitle].push(r.id);
    }
    for (const [targetId, kind] of r.links || []) {
      if (kind === "hard") {
        const target = itemMap.get(targetId);
        if (!target || target.status === "Archived") {
          brokenDependencies.push({
            sourceId: r.id,
            sourceTitle: r.title,
            targetId,
            reason: target ? `Depends on archived "${target.title}"` : "Target item missing",
          });
        }
      }
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    totalActive: items.filter((r) => r.status !== "Archived").length,
    staleItems,
    missingSummaryItems,
    brokenDependencies,
    duplicateUrls: Object.entries(urlBuckets).filter(([, ids]) => ids.length > 1).map(([url, ids]) => ({ url, ids })),
    duplicateTitles: Object.entries(titleBuckets).filter(([, ids]) => ids.length > 1).map(([title, ids]) => ({ title, ids })),
    requiredCompliance: {
      requiredCount: requiredIds.length,
      acknowledgedCount: requiredIds.filter((id) => Boolean(acks[id])).length,
    },
  };
}
