// Parsers for messy cell values from spreadsheets and other tools.

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function validYmd(year, month, day) {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return "";
  return `${year}-${pad(month)}-${pad(day)}`;
}

function fullYear(year) {
  const value = Number(year);
  if (value >= 100) return value;
  return value + (value < 70 ? 2000 : 1900);
}

/** Excel stores dates as days since 1899-12-30. */
export function excelSerialToIso(serial) {
  const value = Number(serial);
  if (!Number.isFinite(value) || value < 1 || value > 2958465) return "";
  const ms = Math.round((value - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Converts a date in almost any common format to yyyy-mm-dd.
 * @param {*} value
 * @param {"dmy"|"mdy"} order how to read ambiguous dates like 03/04/2025
 */
export function parseDate(value, order = "dmy") {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return validYmd(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number") return excelSerialToIso(value);

  const text = String(value).trim();
  if (!text || /^(n\/?a|none|null|-|tbd|tba)$/i.test(text)) return "";

  // ISO and ISO-like: 2025-03-04, 2025/03/04, 2025-03-04T10:00:00Z
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return validYmd(Number(match[1]), Number(match[2]), Number(match[3]));

  // Excel serial number stored as text
  if (/^\d{5}(\.\d+)?$/.test(text)) return excelSerialToIso(Number(text));

  // 04/03/2025, 4-3-25, 04.03.2025
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const year = fullYear(match[3]);
    if (a > 12) return validYmd(year, b, a);
    if (b > 12) return validYmd(year, a, b);
    return order === "mdy" ? validYmd(year, a, b) : validYmd(year, b, a);
  }

  // 5 Jan 2025, 05-Jan-25, 05/Jan/25 10:00 AM (Jira)
  match = text.match(/^(\d{1,2})[\s\-/.]+([a-z]{3,9})\.?[\s\-/.,]+(\d{2,4})/i);
  if (match && MONTHS[match[2].toLowerCase()]) {
    return validYmd(fullYear(match[3]), MONTHS[match[2].toLowerCase()], Number(match[1]));
  }

  // Jan 5, 2025 / January 5 2025 / Mon Jan 05 2025
  match = text.match(/^(?:[a-z]{3,9},?\s+)?([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})/i);
  if (match && MONTHS[match[1].toLowerCase()]) {
    return validYmd(fullYear(match[3]), MONTHS[match[1].toLowerCase()], Number(match[2]));
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(text)) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

/**
 * Looks at a column of date strings and decides whether ambiguous values
 * like 03/04/2025 are day-first or month-first.
 */
export function detectDateOrder(values) {
  let dayFirst = 0;
  let monthFirst = 0;
  values.forEach((value) => {
    const match = String(value ?? "").trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!match) return;
    if (Number(match[1]) > 12) dayFirst += 1;
    if (Number(match[2]) > 12) monthFirst += 1;
  });
  if (monthFirst > dayFirst) return "mdy";
  if (dayFirst > monthFirst) return "dmy";
  // No evidence either way: follow the browser's locale.
  try {
    const sample = new Date(Date.UTC(2001, 10, 22)).toLocaleDateString(undefined, { timeZone: "UTC" });
    return sample.indexOf("11") < sample.indexOf("22") ? "mdy" : "dmy";
  } catch {
    return "dmy";
  }
}

/** "45%", "45", 0.45, "0.45" -> 45 (0-100). */
export function parsePercent(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    const pct = value > 0 && value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }
  const text = String(value).trim();
  const number = Number(text.replace(/[%\s,]/g, ""));
  if (!Number.isFinite(number)) return 0;
  const pct = !text.includes("%") && number > 0 && number <= 1 && text.includes(".") ? number * 100 : number;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return ["true", "yes", "y", "1", "x", "✓", "✔", "milestone"].includes(text);
}

/** "5", "5d", "5 days", "2w", "16h", "1.5 wks", "PT40H0M0S" -> working days. */
export function parseDurationDays(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.max(0, Math.round(value));
  const text = String(value).trim().toLowerCase();

  const iso = text.match(/^pt(\d+(?:\.\d+)?)h/);
  if (iso) return Math.max(0, Math.round(Number(iso[1]) / 8));

  const match = text.match(/^(\d+(?:\.\d+)?)\s*([a-z]*)/);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2];
  if (/^(h|hr|hrs|hour|hours)$/.test(unit)) return Math.max(1, Math.round(amount / 8));
  if (/^(w|wk|wks|week|weeks)$/.test(unit)) return Math.round(amount * 5);
  if (/^(mo|mon|month|months)$/.test(unit)) return Math.round(amount * 20);
  if (/^(m|min|mins|minute|minutes)$/.test(unit)) return 1;
  return Math.round(amount);
}

export function cleanText(value, max = 500) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

export function splitList(value) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  return String(value ?? "")
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
