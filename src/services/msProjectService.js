const API_BASE_URL =
  import.meta.env.VITE_MSPROJECT_BACKEND_URL || "http://localhost:5050";

export async function importMsProjectFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/import/msproject`, {
    method: "POST",
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "MS Project import failed.");
  }

  return result.plannerData;
}

export async function exportMsProjectXml(exportData) {
  const response = await fetch(`${API_BASE_URL}/api/export/msproject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(exportData),
  });

  if (!response.ok) {
    let message = "MS Project export failed.";

    try {
      const result = await response.json();
      message = result.error || message;
    } catch {
      // Ignore JSON parse failure
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";

  const filenameMatch = contentDisposition.match(/filename="(.+)"/);
  const filename = filenameMatch?.[1] || "planner-export.xml";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}