// Three-way merge of one project's saved data, used when two people change
// the same project at the same time. `base` is the version both started
// from, `ours` has this browser's changes, `theirs` is what the server now
// holds. Items are merged by id, so two people editing different tasks never
// lose each other's work. When both changed the same task, the server's
// version wins and the clash is reported.

const COLLECTIONS = ["tasks", "sprints", "baselineSnapshots"];
const VOLATILE = new Set(["savedAt", "updatedAt", "updated_at", "cloudId", "dbId"]);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => !VOLATILE.has(key))
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export const fingerprint = stable;

const same = (a, b) => stable(a) === stable(b);

function byId(list) {
  return new Map((Array.isArray(list) ? list : []).filter((item) => item && item.id).map((item) => [item.id, item]));
}

function mergeCollection(baseList, ourList, theirList, conflicts, label) {
  const base = byId(baseList);
  const ours = byId(ourList);
  const theirs = byId(theirList);
  const ids = [...new Set([...theirs.keys(), ...ours.keys(), ...base.keys()])];
  const result = [];

  // Keep the server's order, then anything added here.
  const order = [...(theirList || []).map((item) => item?.id), ...(ourList || []).map((item) => item?.id)];
  ids.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  for (const id of ids) {
    const b = base.get(id);
    const o = ours.get(id);
    const t = theirs.get(id);
    const weChanged = !same(b, o);
    const theyChanged = !same(b, t);

    let pick;
    if (!weChanged) pick = t;
    else if (!theyChanged) pick = o;
    else if (same(o, t)) pick = t;
    else {
      // Both changed it: the saved (server) version wins.
      pick = t ?? o;
      conflicts.push({ kind: label, id, title: (t || o || b)?.title || (t || o || b)?.name || id });
    }
    if (pick) result.push(pick);
  }
  return result;
}

export function mergeProjectPayload(base, ours, theirs) {
  const conflicts = [];
  const merged = { ...theirs };

  const keys = new Set([...Object.keys(ours || {}), ...Object.keys(theirs || {})]);
  for (const key of keys) {
    if (COLLECTIONS.includes(key) || VOLATILE.has(key)) continue;
    const weChanged = !same(base?.[key], ours?.[key]);
    const theyChanged = !same(base?.[key], theirs?.[key]);
    if (weChanged && !theyChanged) merged[key] = ours[key];
    else if (weChanged && theyChanged && !same(ours[key], theirs[key])) {
      conflicts.push({ kind: "project", id: key, title: key });
    }
  }

  for (const key of COLLECTIONS) {
    merged[key] = mergeCollection(base?.[key], ours?.[key], theirs?.[key], conflicts, key);
  }

  return { merged, conflicts };
}
