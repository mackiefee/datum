// Planit Data Library — Supabase Edge Function: Content Governance Scanner
// Detects stale items, missing summaries, duplicate URLs/titles, broken hard dependencies, and reading compliance.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const daysBetween = (dateStr: string, refDateStr: string) =>
  Math.round((new Date(refDateStr).getTime() - new Date(dateStr).getTime()) / 86400000);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      items = [],
      categories = [],
      today = new Date().toISOString().slice(0, 10),
      requiredIds = [],
      acks = {},
    } = await req.json();

    const catMap = new Map(categories.map((c: { id: string; reviewDays?: number }) => [c.id, c]));
    const itemMap = new Map(items.map((r: { id: number }) => [r.id, r]));

    const staleItems = [];
    const missingSummaryItems = [];
    const brokenDependencies = [];
    const urlBuckets: Record<string, number[]> = {};
    const titleBuckets: Record<string, number[]> = {};

    for (const r of items) {
      if (r.status === "Archived" || r.status === "Deleted") continue;
      const cat = catMap.get(r.node) as { reviewDays?: number } | undefined;
      const reviewDays = r.reviewDays || (cat && cat.reviewDays) || 90;
      const age = daysBetween(r.verified || r.upd || today, today);

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
          const target = itemMap.get(targetId) as { id: number; title: string; status: string } | undefined;
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

    const duplicateUrls = Object.entries(urlBuckets)
      .filter(([, ids]) => ids.length > 1)
      .map(([url, ids]) => ({ url, ids }));

    const duplicateTitles = Object.entries(titleBuckets)
      .filter(([, ids]) => ids.length > 1)
      .map(([title, ids]) => ({ title, ids }));

    const acknowledgedCount = requiredIds.filter((id: number) => Boolean(acks[id])).length;

    return new Response(
      JSON.stringify({
        scannedAt: new Date().toISOString(),
        totalActive: items.filter((r: { status: string }) => r.status !== "Archived").length,
        staleItems,
        missingSummaryItems,
        brokenDependencies,
        duplicateUrls,
        duplicateTitles,
        requiredCompliance: {
          requiredCount: requiredIds.length,
          acknowledgedCount,
        },
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
