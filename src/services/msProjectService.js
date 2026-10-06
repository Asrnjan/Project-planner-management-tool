// Binary project files (.mpp, Primavera .xer, GanttProject .gan, ...) are
// converted to Microsoft Project XML by the backend converter
// (backend/converter.js). The browser then reads that XML itself.
//
// By default requests go to the same origin: in development Vite proxies
// /api to the backend. Set VITE_MSPROJECT_BACKEND_URL to use a separately
// hosted converter.

const API_BASE_URL = (import.meta.env.VITE_MSPROJECT_BACKEND_URL || "").replace(/\/$/, "");

export const CONVERTER_EXTENSIONS = [".mpp", ".mpt", ".mpx", ".xer", ".pmxml", ".gan", ".pod", ".pp"];

const XML_TIP =
  "Tip: in Microsoft Project choose File > Save As > XML Format (*.xml) and import that file instead; it needs no server.";

const IS_LOCAL_DEV =
  typeof window !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

// What to tell people when no converter answers. On a hosted site without a
// converter, developer commands mean nothing to the person importing.
const NOT_RUNNING = IS_LOCAL_DEV
  ? "The file converter isn't running. Start the app with `npm run dev` (it starts the converter too), or run `npm run dev:backend`."
  : API_BASE_URL
  ? "The file converter isn't responding. If it was idle, it may take up to a minute to wake up; try again shortly."
  : "This site can't open this file type directly yet (an administrator can enable it; see the README).";

/** Reports whether the converter is available and ready. Never throws. */
export async function getConverterStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/convert/status`);
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("json")) return { status: "unavailable" };
    return await response.json();
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * Converts a project file to Microsoft Project XML text.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function convertProjectFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/convert`, { method: "POST", body: formData });
  } catch {
    throw new Error(`${NOT_RUNNING} ${XML_TIP}`);
  }

  const type = response.headers.get("content-type") || "";

  if (response.ok && type.includes("xml")) {
    return response.text();
  }

  if (!type.includes("json")) {
    // Static hosting (no converter) answers with the app's HTML page.
    throw new Error(`${NOT_RUNNING} ${XML_TIP}`);
  }

  const result = await response.json().catch(() => ({}));
  throw new Error(`${result.error || "The file could not be converted."} ${XML_TIP}`);
}
