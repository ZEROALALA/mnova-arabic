const ALLOWED_FORMS = new Set([
  "mnova-game-request",
  "mnova-community-submit",
  "mnova-iban-receipt",
  "mnova-custom-commission",
]);

function jsonResp(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const ct = (request.headers.get("content-type") || "").toLowerCase();

  let data = {};
  try {
    if (ct.includes("application/json")) {
      data = await request.json();
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(await request.text());
      for (const [k, v] of params.entries()) data[k] = v;
    } else if (ct.includes("multipart/form-data")) {
      const fd = await request.formData();
      for (const [k, v] of fd.entries()) {
        if (typeof v === "string") data[k] = v;
      }
    } else {
      const params = new URLSearchParams(await request.text());
      for (const [k, v] of params.entries()) data[k] = v;
    }
  } catch {
    return jsonResp({ ok: false, error: "Invalid form payload" }, 400);
  }

  // Honeypot anti-spam trap
  if (data["bot-field"] && String(data["bot-field"]).trim() !== "") {
    return jsonResp({ ok: true, id: "ignored" }, 200);
  }

  const formName = String(data["form-name"] || "").trim();
  if (!ALLOWED_FORMS.has(formName)) {
    return jsonResp({ ok: false, error: "Unknown form name" }, 400);
  }

  const cleanFields = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "bot-field" || k === "form-name") continue;
    cleanFields[String(k).slice(0, 64)] = String(v ?? "").trim().slice(0, 2000);
  }

  const now = new Date().toISOString();
  const id = `${formName}:${now}:${crypto.randomUUID().slice(0, 8)}`;
  const record = {
    id,
    formName,
    submittedAt: now,
    country: request.cf?.country || "unknown",
    fields: cleanFields,
  };

  if (env && env.MNOVA_FORMS) {
    await env.MNOVA_FORMS.put(id, JSON.stringify(record));
  }

  // Optional non-blocking email alert via free FormSubmit endpoint
  const notifyEmail = env?.NOTIFY_EMAIL || "mohamaaed1984@gmail.com";
  context.waitUntil(
    fetch(`https://formsubmit.co/ajax/${encodeURIComponent(notifyEmail)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Referer: "https://mnova-arabic.pages.dev/",
      },
      body: JSON.stringify({
        _subject: `[MNOVA] ${formName}`,
        _captcha: "false",
        form: formName,
        submittedAt: now,
        country: record.country,
        ...cleanFields,
      }),
    }).catch(() => {})
  );

  return jsonResp({ ok: true, id, stored: Boolean(env && env.MNOVA_FORMS) }, 200);
}
