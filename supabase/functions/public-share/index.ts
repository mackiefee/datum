// Planit Data Library — Supabase Edge Function: Public Share Preflight & Sanitizer
// Implements Section 17 security rules: Approved-only, attachment allow-list, and internal link stripping.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action = "preflight", item, allItems = [], categoryVis = "Internal", clearedAttachmentIds = [] } =
      await req.json();

    if (!item) {
      return new Response(JSON.stringify({ error: "Missing target item" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract image/attachment references ![caption](img:id)
    const imgMatches = [...(item.body || "").matchAll(/!\[([^\]]*)\]\(img:(\w+)\)/g)].map((m) => ({
      id: m[2],
      caption: m[1] || `Attachment ${m[2]}`,
      cleared: clearedAttachmentIds.includes(m[2]),
    }));

    // Inspect outgoing links to see which point to non-public internal items
    const nonPublicLinks = (item.links || [])
      .map(([targetId, kind]: [number, string]) => {
        const target = allItems.find((x: { id: number }) => x.id === targetId);
        return target ? { id: target.id, title: target.title, kind, vis: target.vis || "Internal" } : null;
      })
      .filter((x: { vis: string } | null) => x && x.vis !== "Public");

    const blockers: string[] = [];
    if (item.status !== "Approved") {
      blockers.push(`Item status is "${item.status}". Only Published (Approved) items can be made Public.`);
    }
    if (categoryVis === "Restricted") {
      blockers.push("Item resides in a Restricted category. Move it or override via Admin before publishing.");
    }

    if (action === "render_public") {
      if (item.status !== "Approved" || item.vis !== "Public") {
        return new Response(JSON.stringify({ error: "Resource is not publicly available" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Strip non-cleared attachments from body
      const sanitizedBody = (item.body || "").replace(
        /!\[([^\]]*)\]\(img:(\w+)\)/g,
        (full: string, caption: string, id: string) =>
          clearedAttachmentIds.includes(id) ? full : `> [Internal attachment omitted: ${caption || id}]`
      );
      return new Response(
        JSON.stringify({
          id: item.id,
          title: item.title,
          desc: item.desc,
          body: sanitizedBody,
          url: item.url || "",
          upd: item.upd,
          tags: item.tags || [],
          publicLinks: (item.links || [])
            .map(([tid, kind]: [number, string]) => {
              const t = allItems.find((x: { id: number }) => x.id === tid);
              return t ? { id: t.id, title: t.title, kind, clickable: t.vis === "Public" && t.status === "Approved" } : null;
            })
            .filter(Boolean),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        eligible: blockers.length === 0,
        blockers,
        attachments: imgMatches,
        nonPublicLinks,
        strippedFields: ["Comments & @mentions", "Version history & Rollback", "Author emails", "Dependency graph"],
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
