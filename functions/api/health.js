export async function onRequestGet(context) {
  return Response.json(
    {
      ok: true,
      service: "MNOVA Localization Hub API",
      host: "cloudflare-pages",
      kvConnected: Boolean(context.env && context.env.MNOVA_FORMS),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
