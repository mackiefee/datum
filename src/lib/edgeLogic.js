// Shared pure-JS Edge logic (Web Standard safe — runs in Next.js Edge Runtime and browser fallback)

const tokenize = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

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

export function runAiEdgeLogic(payload) {
  const {
    action = "qa",
    query = "",
    userRole = "Member",
    userName = "",
    allowedCategories = [],
    directShareIds = [],
    items = [],
    targetItem = null,
    today = "2026-10-22",
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

  const qTokens = tokenize(query);
  const ranked = authorized
    .map((r) => {
      const hay = `${r.title} ${r.desc || ""} ${r.body || ""} ${(r.tags || []).join(" ")} ${r.author || ""}`;
      const hTokens = tokenize(hay);
      let score = 0;
      qTokens.forEach((wt) => {
        const stem = wt.slice(0, Math.max(3, wt.length - 2));
        if (r.title.toLowerCase().includes(wt)) score += 4;
        hTokens.forEach((ht) => {
          if (ht.startsWith(stem)) score += 1;
        });
      });
      return { item: r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!ranked.length) {
    return {
      answer: "This topic is not covered in the current published library accessible to your role.",
      sources: [],
      authorizedCount: authorized.length,
    };
  }

  const sources = ranked.map((x, idx) => {
    const cycle = x.item.reviewDays || 90;
    const age = daysSince(x.item.verified || x.item.upd, today);
    const bodyExcerpt = plainText(x.item.body || "").slice(0, 160);
    return {
      index: idx + 1,
      id: x.item.id,
      title: x.item.title,
      stale: age > cycle,
      ageDays: age,
      excerpt: (bodyExcerpt || x.item.desc || "").trim(),
    };
  });

  const answer = sources
    .map((s) => `${s.excerpt}${s.excerpt.endsWith(".") ? "" : "."} [${s.index}]`)
    .join(" ");

  return {
    answer,
    sources,
    authorizedCount: authorized.length,
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
