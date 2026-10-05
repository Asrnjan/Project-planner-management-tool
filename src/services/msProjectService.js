// Native .mpp files are binary, so they are converted by the optional
// backend (backend/server.js + java-mpxj). MS Project XML needs no server.

const API_BASE_URL =
  import.meta.env.VITE_MSPROJECT_BACKEND_URL || "http://localhost:5050";

const XML_TIP =
  "Tip: in Microsoft Project choose File > Save As > XML Format (*.xml) and import that file instead; it needs no server.";

export async function importMsProjectFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/import/msproject`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(`The .mpp converter server is not reachable. ${XML_TIP}`);
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${result.error || "MS Project import failed."} ${XML_TIP}`);
  }

  return result.plannerData;
}
