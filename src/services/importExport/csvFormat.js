import Papa from "papaparse";
import {
  flattenTasksForCsv,
  convertCsvRowsToPlannerData,
} from "./mappers";

export function exportPlannerAsCsv(data) {
  const rows = flattenTasksForCsv(data);
  return Papa.unparse(rows);
}

export function importPlannerFromCsv(text, existingData) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    throw new Error(parsed.errors[0].message || "CSV parsing failed.");
  }

  return convertCsvRowsToPlannerData(parsed.data, existingData);
}