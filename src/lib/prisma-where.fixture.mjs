export function matchesWhere(where, row) {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") return condition.some((part) => matchesWhere(part, row));
    if (condition !== null && typeof condition === "object") {
      if ("contains" in condition) return String(row[key] ?? "").includes(condition.contains);
      if ("in" in condition) return condition.in.includes(row[key]);
    }
    return row[key] === condition;
  });
}
