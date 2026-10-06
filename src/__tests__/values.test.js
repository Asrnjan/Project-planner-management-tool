import { describe, expect, it } from "vitest";
import {
  detectDateOrder,
  excelSerialToIso,
  parseBoolean,
  parseDate,
  parseDurationDays,
  parsePercent,
} from "../services/importExport/values";
import { normalizePriority, normalizeTaskStatus } from "../domain/vocabulary";

describe("parseDate", () => {
  it.each([
    ["2025-03-04", "2025-03-04"],
    ["2025/3/4", "2025-03-04"],
    ["2025-03-04T10:00:00Z", "2025-03-04"],
    ["5 Jan 2025", "2025-01-05"],
    ["05-Jan-25", "2025-01-05"],
    ["05/Jan/25 10:00 AM", "2025-01-05"],
    ["Jan 5, 2025", "2025-01-05"],
    ["Sunday, January 5 2025", "2025-01-05"],
    ["31/12/2025", "2025-12-31"],
    ["12/31/2025", "2025-12-31"],
    ["45658", "2025-01-01"],
    ["", ""],
    ["TBD", ""],
    ["not a date", ""],
    ["2025-02-30", ""],
  ])("%s -> %s", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it("uses the requested order for ambiguous dates", () => {
    expect(parseDate("03/04/2025", "dmy")).toBe("2025-04-03");
    expect(parseDate("03/04/2025", "mdy")).toBe("2025-03-04");
  });

  it("reads Excel serial numbers", () => {
    expect(parseDate(45658)).toBe("2025-01-01");
    expect(excelSerialToIso(1)).toBe("1899-12-31");
  });
});

describe("detectDateOrder", () => {
  it("detects month-first and day-first columns", () => {
    expect(detectDateOrder(["12/31/2025", "01/02/2025"])).toBe("mdy");
    expect(detectDateOrder(["31/12/2025", "01/02/2025"])).toBe("dmy");
  });
});

describe("value parsers", () => {
  it("parses percentages in every common shape", () => {
    expect(parsePercent("45%")).toBe(45);
    expect(parsePercent(0.45)).toBe(45);
    expect(parsePercent("0.5")).toBe(50);
    expect(parsePercent("80")).toBe(80);
    expect(parsePercent("150")).toBe(100);
    expect(parsePercent("")).toBe(0);
  });

  it("parses durations", () => {
    expect(parseDurationDays("5")).toBe(5);
    expect(parseDurationDays("3 days")).toBe(3);
    expect(parseDurationDays("2w")).toBe(10);
    expect(parseDurationDays("16h")).toBe(2);
    expect(parseDurationDays("PT40H0M0S")).toBe(5);
    expect(parseDurationDays("")).toBe(0);
  });

  it("parses booleans", () => {
    expect(parseBoolean("Yes")).toBe(true);
    expect(parseBoolean("TRUE")).toBe(true);
    expect(parseBoolean("x")).toBe(true);
    expect(parseBoolean("no")).toBe(false);
  });
});

describe("vocabulary", () => {
  it.each([
    ["To Do", "Not Started"],
    ["backlog", "Not Started"],
    ["In Review", "In Progress"],
    ["Doing", "In Progress"],
    ["Closed", "Done"],
    ["Completed", "Done"],
    ["On Hold", "Blocked"],
    ["Waiting for vendor", "Blocked"],
    ["Something odd", "Not Started"],
  ])("status %s -> %s", (input, expected) => {
    expect(normalizeTaskStatus(input)).toBe(expected);
  });

  it("falls back to progress for unknown statuses", () => {
    expect(normalizeTaskStatus("", 100)).toBe("Done");
    expect(normalizeTaskStatus("", 30)).toBe("In Progress");
  });

  it("normalises priorities", () => {
    expect(normalizePriority("Highest")).toBe("Critical");
    expect(normalizePriority("P2")).toBe("High");
    expect(normalizePriority("minor")).toBe("Low");
    expect(normalizePriority("")).toBe("Medium");
  });
});
