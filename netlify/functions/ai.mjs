// Netlify Function: POST /api/ai runs one Claude job, GET /api/ai reports
// whether Claude is configured. The API key stays on the server.
// /api/ai is rewritten to /.netlify/functions/ai in netlify.toml.
import { getAiStatus, handleAiRequest } from "../../server/ai/core.mjs";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export default async (request, context) => {
  if (request.method === "GET") {
    return new Response(JSON.stringify(getAiStatus()), { status: 200, headers: JSON_HEADERS });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...JSON_HEADERS, Allow: "GET, POST" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400, headers: JSON_HEADERS });
  }

  const { status, body: responseBody } = await handleAiRequest({
    body,
    headers: { authorization: request.headers.get("authorization") || "" },
    ip: context?.ip || request.headers.get("x-nf-client-connection-ip") || "",
  });

  return new Response(JSON.stringify(responseBody), { status, headers: JSON_HEADERS });
};
