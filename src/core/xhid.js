const SHORT_INTERNAL_ID = /^[a-f0-9]{32}$/i;
const ENCRYPTED_ID = /^[A-Za-z0-9+/_=-]{48,512}$/;

export function normalizeParameter(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

export function isShortInternalXhid(value) {
  return SHORT_INTERNAL_ID.test(normalizeParameter(value));
}

export function isValidEncryptedXhid(value) {
  const normalized = normalizeParameter(value);
  return !isShortInternalXhid(normalized) && ENCRYPTED_ID.test(normalized);
}

export function chooseXhid(candidates) {
  const unique = [...new Set(candidates.map(normalizeParameter).filter(Boolean))];
  const valid = unique.filter(isValidEncryptedXhid);
  if (!valid.length) {
    throw new Error("没有从所选学期课表页面获取到有效的长加密 xhid");
  }
  valid.sort((left, right) => right.length - left.length);
  return valid[0];
}

export function chooseXhidByPriority(sourceGroups) {
  for (const candidates of sourceGroups) {
    if (candidates.some(isValidEncryptedXhid)) {
      return chooseXhid(candidates);
    }
  }
  throw new Error("没有从所选学期课表页面获取到有效的长加密 xhid");
}

export function collectNamedValues(doc, parameterName) {
  if (!doc) return [];
  const result = [];
  for (const element of doc.querySelectorAll("[id], [name], [data-name]")) {
    if (
      element.id !== parameterName &&
      element.getAttribute("name") !== parameterName &&
      element.getAttribute("data-name") !== parameterName
    ) {
      continue;
    }
    const value = normalizeParameter(
      element.value ?? element.getAttribute("value") ?? element.textContent,
    );
    if (value) result.push(value);
  }
  return result;
}

export function collectValuesFromHtml(html, parameterName) {
  const result = [];
  const escapedName = parameterName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`(?:id|name)=["']${escapedName}["'][^>]*value=["']([^"']+)`, "gi"),
    new RegExp(`value=["']([^"']+)["'][^>]*(?:id|name)=["']${escapedName}["']`, "gi"),
    new RegExp(`["']${escapedName}["']\\s*[:=]\\s*["']([^"']+)`, "gi"),
  ];
  for (const pattern of patterns) {
    for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
      const value = normalizeParameter(match[1]);
      if (value) result.push(value);
    }
  }
  return result;
}
