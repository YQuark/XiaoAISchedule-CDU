function decodeHtmlEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, code) => {
    if (code[0] !== "#") return named[code.toLowerCase()] ?? entity;
    const radix = code[1]?.toLowerCase() === "x" ? 16 : 10;
    const digits = radix === 16 ? code.slice(2) : code.slice(1);
    const point = Number.parseInt(digits, radix);
    return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
  });
}

export function stripHtml(value) {
  return decodeHtmlEntities(String(value ?? "").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDay(value) {
  const number = Number(value);
  if (Number.isInteger(number) && number >= 1 && number <= 7) return number;
  const labels = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
  const match = String(value ?? "").match(/[一二三四五六日天]/);
  return match ? labels[match[0]] : 0;
}

export function expandNumberExpression(value) {
  const normalized = String(value ?? "")
    .replace(/[，、；;]/g, ",")
    .replace(/[—–~～至到]/g, "-")
    .replace(/\s+/g, "")
    .replace(/[^\d,-]/g, "");
  const values = [];
  for (const segment of normalized.split(",")) {
    if (!segment) continue;
    const range = segment.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (Number.isInteger(start) && start > 0 && end >= start && end - start <= 100) {
        for (let number = start; number <= end; number += 1) values.push(number);
      }
      continue;
    }
    const number = Number(segment);
    if (Number.isInteger(number) && number > 0) values.push(number);
  }
  return [...new Set(values)].sort((left, right) => left - right);
}

export function parseWeeks(value) {
  const source = String(value ?? "")
    .replace(/[，、；;]/g, ",")
    .replace(/[—–~～至到]/g, "-")
    .replace(/第/g, "")
    .replace(/周次?/g, "")
    .replace(/\s+/g, "");
  if (!source) return [];

  const weeks = [];
  for (const segment of source.split(",").filter(Boolean)) {
    const odd = /单/.test(segment);
    const even = /双/.test(segment);
    const numbers = expandNumberExpression(segment.replace(/[()（）单双]/g, ""));
    for (const week of numbers) {
      if (odd && week % 2 === 0) continue;
      if (even && week % 2 === 1) continue;
      weeks.push(week);
    }
  }
  const globalOdd = /单/.test(source) && !/双/.test(source);
  const globalEven = /双/.test(source) && !/单/.test(source);
  return [...new Set(weeks)]
    .filter((week) => (!globalOdd || week % 2 === 1) && (!globalEven || week % 2 === 0))
    .sort((left, right) => left - right);
}

export function parseSections(item) {
  const direct = item.djc ?? item.jc ?? item.sections ?? item.section ?? item.jcs;
  const directNumbers = Array.isArray(direct)
    ? direct.map(Number).filter((number) => Number.isInteger(number) && number > 0)
    : expandNumberExpression(direct);
  if (directNumbers.length) return [...new Set(directNumbers)].sort((a, b) => a - b);

  const start = Number(item.ksjc ?? item.startSection ?? item.beginNumber);
  const explicitEnd = item.jsjc ?? item.endSection;
  const end = explicitEnd == null ? Number.NaN : Number(explicitEnd);
  const length = Number(item.length ?? item.sectionCount);
  if (Number.isInteger(start) && start > 0 && Number.isInteger(length) && length > 0) {
    return Array.from({ length }, (_, index) => start + index);
  }
  if (Number.isInteger(start) && start > 0 && Number.isInteger(end) && end >= start) {
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  return [];
}

export function extractCourseRows(response) {
  const candidates = Array.isArray(response)
    ? [response]
    : [
        response?.data,
        response?.rows,
        response?.result?.data,
        response?.result?.rows,
        response?.result,
      ];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    if (
      candidate.length === 0 ||
      candidate.some(
        (row) =>
          row &&
          typeof row === "object" &&
          ["kcmc", "courseName", "name"].some((key) => key in row),
      )
    ) {
      return candidate;
    }
  }
  throw new Error("无法识别课表接口返回的数据结构");
}

export function parseCourses(rows, onInvalid = () => {}) {
  const parsed = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") {
      onInvalid(item);
      continue;
    }
    const name = stripHtml(item.kcmc ?? item.courseName ?? item.name);
    const teacher = stripHtml(item.tmc ?? item.teacherName ?? item.teacher);
    const position = stripHtml(
      item.croommc ?? item.croombh ?? item.location ?? item.classroom ?? item.position,
    );
    const day = parseDay(item.xingqi ?? item.dayOfWeek ?? item.day);
    const sections = parseSections(item);
    const weeks = Array.isArray(item.weeks)
      ? [...new Set(item.weeks.map(Number).filter((week) => Number.isInteger(week) && week > 0))].sort(
          (left, right) => left - right,
        )
      : parseWeeks(item.zcstr ?? item.zc ?? item.weekExpression);
    if (!name || !day || !sections.length || !weeks.length) {
      onInvalid(item);
      continue;
    }
    parsed.push({ name, teacher, position, day, sections, weeks });
  }

  const bySection = new Map();
  for (const course of parsed) {
    for (const section of course.sections) {
      const key = JSON.stringify([
        course.name,
        course.teacher,
        course.position,
        course.day,
        section,
      ]);
      const existing = bySection.get(key) ?? {
        name: course.name,
        teacher: course.teacher,
        position: course.position,
        day: course.day,
        sections: [section],
        weeks: [],
      };
      existing.weeks.push(...course.weeks);
      existing.weeks = [...new Set(existing.weeks)].sort((a, b) => a - b);
      bySection.set(key, existing);
    }
  }

  const merged = new Map();
  for (const course of bySection.values()) {
    const key = JSON.stringify([
      course.name,
      course.teacher,
      course.position,
      course.day,
      course.weeks,
    ]);
    const existing = merged.get(key) ?? { ...course, sections: [] };
    existing.sections.push(...course.sections);
    existing.sections = [...new Set(existing.sections)].sort((a, b) => a - b);
    merged.set(key, existing);
  }
  return [...merged.values()].sort(
    (left, right) =>
      left.day - right.day ||
      left.sections[0] - right.sections[0] ||
      left.name.localeCompare(right.name, "zh-CN"),
  );
}
