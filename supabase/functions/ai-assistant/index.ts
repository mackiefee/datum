// Planit Data Library — Supabase Edge Function: AI Assistant
// Enforces pre-retrieval permission & Approved-only filtering, grounded citations, and staleness warnings.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CatalogItem {
  id: number;
  title: string;
  desc?: string;
  body?: string;
  tags?: string[];
  author?: string;
  node?: string;
  status?: string;
  vis?: string;
  upd?: string;
  verified?: string;
  reviewDays?: number;
}

const tokenize = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

const plainText = (b: string) =>
  (b || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/[#>*`|]/g, " ").replace(/\s+/g, " ").trim();

const daysSince = (d?: string) => {
  if (!d) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 86400000));
};

function canUserView(item: CatalogItem, userRole: string, userName: string, allowedCats: string[], directShares: number[]) {
  if (item.status !== "Approved") return false;
  if (userRole === "SuperAdmin" || userRole === "Admin") return true;
  if (userRole === "Guest") return item.vis === "Public" || directShares.includes(item.id);
  if (item.vis === "Public" || item.author === userName || directShares.includes(item.id)) return true;
  if (item.vis === "Restricted") return false;
  return allowedCats.length === 0 || !item.node || allowedCats.includes(item.node);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const {
      action = "qa",
      query = "",
      userRole = "Member",
      userName = "",
      allowedCategories = [],
      directShareIds = [],
      items = [],
      targetItem = null,
    } = payload;

    if (action === "summarize" && targetItem) {
      const clean = plainText(targetItem.body || "");
      const sentences = (clean.match(/[^.!?]+[.!?]/g) || [clean]).slice(0, 2).join(" ").trim();
      const freq: Record<string, number> = {};
      tokenize(`${targetItem.title} ${clean}`).forEach((w) => {
        if (w.length > 4) freq[w] = (freq[w] || 0) + 1;
      });
      const suggestedTags = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map((x) => x[0]);
      return new Response(
        JSON.stringify({
          summary: sentences.slice(0, 200) || targetItem.desc || "",
          suggestedTags,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pre-retrieval security & lifecycle gate: strictly Approved + View-permitted
    const authorized = (items as CatalogItem[]).filter((it) =>
      canUserView(it, userRole, userName, allowedCategories, directShareIds)
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
      return new Response(
        JSON.stringify({
          answer: "This topic is not covered in the current published library accessible to your role.",
          sources: [],
          authorizedCount: authorized.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sources = ranked.map((x, idx) => {
      const cycle = x.item.reviewDays || 90;
      const age = daysSince(x.item.verified || x.item.upd);
      return {
        index: idx + 1,
        id: x.item.id,
        title: x.item.title,
        stale: age > cycle,
        ageDays: age,
        excerpt: (plainText(x.item.body || "").slice(0, 180) || x.item.desc || "").trim(),
      };
    });

    const answer = sources
      .map((s) => `${s.excerpt}${s.excerpt.endsWith(".") ? "" : "."} [${s.index}]`)
      .join(" ");

    return new Response(
      JSON.stringify({
        answer,
        sources,
        authorizedCount: authorized.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
