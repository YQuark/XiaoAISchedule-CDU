export function normalizeSemester(value) {
  return String(value ?? "")
    .trim()
    .replace(/[—–_]/g, "-")
    .replace(/\s+/g, "");
}

export function isSemester(value) {
  return /^\d{4}-\d{4}-[12]$/.test(normalizeSemester(value));
}

export function semesterSortValue(value) {
  const match = normalizeSemester(value).match(/^(\d{4})-(\d{4})-([12])$/);
  if (!match) return 0;
  return Number(match[1]) * 100_000 + Number(match[2]) * 10 + Number(match[3]);
}

export function collectSemesters(doc, semesterMap = new Map()) {
  if (!doc) return semesterMap;

  for (const select of doc.querySelectorAll("select")) {
    const identity = [
      select.id,
      select.name,
      select.getAttribute("title"),
      select.previousElementSibling?.textContent,
    ]
      .filter(Boolean)
      .join(" ");
    const likelySemesterSelect = /xnxq|学年|学期/i.test(identity);

    for (const option of select.options ?? []) {
      const value = normalizeSemester(option.value);
      if ((!likelySemesterSelect && !isSemester(value)) || !isSemester(value)) {
        continue;
      }
      addSemester(semesterMap, value, option.textContent || option.label, option.selected);
    }
  }

  for (const option of doc.querySelectorAll("option")) {
    const value = normalizeSemester(option.value);
    if (isSemester(value) && !semesterMap.has(value)) {
      addSemester(semesterMap, value, option.textContent || option.label, option.selected);
    }
  }

  const hiddenSemester = normalizeSemester(readElementValue(doc, "xnxq"));
  if (isSemester(hiddenSemester) && !semesterMap.has(hiddenSemester)) {
    addSemester(semesterMap, hiddenSemester, hiddenSemester, true);
  }
  return semesterMap;
}

export function sortedSemesters(semesterMap) {
  return [...semesterMap.values()].sort(
    (left, right) => semesterSortValue(right.value) - semesterSortValue(left.value),
  );
}

export function readElementValue(doc, idOrName) {
  if (!doc) return "";
  const byId = doc.getElementById(idOrName);
  const byName = [...doc.querySelectorAll("[name]")].find(
    (element) => element.getAttribute("name") === idOrName,
  );
  const element = byId || byName;
  return String(
    element?.value ?? element?.getAttribute?.("value") ?? element?.textContent ?? "",
  ).trim();
}

function addSemester(map, value, label, selected) {
  const text = String(label || value).trim();
  map.set(value, {
    value,
    label: text && text !== value ? `${text}（${value}）` : value,
    selected: Boolean(selected),
  });
}
