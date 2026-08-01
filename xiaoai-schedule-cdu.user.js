// ==UserScript==
// @name         成都大学课表一键导入小爱课程表
// @namespace    https://github.com/Yaoser-x/XiaoAISchedule-CDU
// @version      1.0.0
// @description  选择成都大学教务系统学期，预览并导入小爱课程表
// @author       Yaoser-x
// @homepageURL  https://github.com/Yaoser-x/XiaoAISchedule-CDU
// @supportURL   https://github.com/Yaoser-x/XiaoAISchedule-CDU/issues
// @updateURL    https://raw.githubusercontent.com/Yaoser-x/XiaoAISchedule-CDU/master/xiaoai-schedule-cdu.user.js
// @downloadURL  https://raw.githubusercontent.com/Yaoser-x/XiaoAISchedule-CDU/master/xiaoai-schedule-cdu.user.js
// @match        https://szjw.cdu.edu.cn/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==
(() => {
  // src/constants.js
  var SCHOOL_ORIGIN = "https://szjw.cdu.edu.cn";
  var COURSE_API = "/admin/pkgl/xskb/sdpkkbList";
  var TIMER_API = "/admin/api/getZclistByXnxq";
  var SCHEDULE_PAGE = "/admin/pkgl/xskb/queryKbForXsd";
  var XIAOAI_PAGE = "https://i.ai.mi.com/h5/precache/ai-schedule/";
  var REQUEST_TIMEOUT_MS = 15e3;
  var UI_HOST_ID = "xiaoai-schedule-cdu-root";

  // src/core/semester.js
  function normalizeSemester(value) {
    return String(value ?? "").trim().replace(/[—–_]/g, "-").replace(/\s+/g, "");
  }
  function isSemester(value) {
    return /^\d{4}-\d{4}-[12]$/.test(normalizeSemester(value));
  }
  function semesterSortValue(value) {
    const match = normalizeSemester(value).match(/^(\d{4})-(\d{4})-([12])$/);
    if (!match) return 0;
    return Number(match[1]) * 1e5 + Number(match[2]) * 10 + Number(match[3]);
  }
  function collectSemesters(doc, semesterMap = /* @__PURE__ */ new Map()) {
    if (!doc) return semesterMap;
    for (const select of doc.querySelectorAll("select")) {
      const identity = [
        select.id,
        select.name,
        select.getAttribute("title"),
        select.previousElementSibling?.textContent
      ].filter(Boolean).join(" ");
      const likelySemesterSelect = /xnxq|学年|学期/i.test(identity);
      for (const option of select.options ?? []) {
        const value = normalizeSemester(option.value);
        if (!likelySemesterSelect && !isSemester(value) || !isSemester(value)) {
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
  function sortedSemesters(semesterMap) {
    return [...semesterMap.values()].sort(
      (left, right) => semesterSortValue(right.value) - semesterSortValue(left.value)
    );
  }
  function readElementValue(doc, idOrName) {
    if (!doc) return "";
    const byId = doc.getElementById(idOrName);
    const byName = [...doc.querySelectorAll("[name]")].find(
      (element3) => element3.getAttribute("name") === idOrName
    );
    const element2 = byId || byName;
    return String(
      element2?.value ?? element2?.getAttribute?.("value") ?? element2?.textContent ?? ""
    ).trim();
  }
  function addSemester(map, value, label, selected) {
    const text = String(label || value).trim();
    map.set(value, {
      value,
      label: text && text !== value ? `${text}（${value}）` : value,
      selected: Boolean(selected)
    });
  }

  // src/core/xhid.js
  var SHORT_INTERNAL_ID = /^[a-f0-9]{32}$/i;
  var ENCRYPTED_ID = /^[A-Za-z0-9+/_=-]{48,512}$/;
  function normalizeParameter(value) {
    return String(value ?? "").trim().replace(/^["']|["']$/g, "");
  }
  function isShortInternalXhid(value) {
    return SHORT_INTERNAL_ID.test(normalizeParameter(value));
  }
  function isValidEncryptedXhid(value) {
    const normalized = normalizeParameter(value);
    return !isShortInternalXhid(normalized) && ENCRYPTED_ID.test(normalized);
  }
  function chooseXhid(candidates) {
    const unique = [...new Set(candidates.map(normalizeParameter).filter(Boolean))];
    const valid = unique.filter(isValidEncryptedXhid);
    if (!valid.length) {
      throw new Error("没有从所选学期课表页面获取到有效的长加密 xhid");
    }
    valid.sort((left, right) => right.length - left.length);
    return valid[0];
  }
  function chooseXhidByPriority(sourceGroups) {
    for (const candidates of sourceGroups) {
      if (candidates.some(isValidEncryptedXhid)) {
        return chooseXhid(candidates);
      }
    }
    throw new Error("没有从所选学期课表页面获取到有效的长加密 xhid");
  }
  function collectNamedValues(doc, parameterName) {
    if (!doc) return [];
    const result = [];
    for (const element2 of doc.querySelectorAll("[id], [name], [data-name]")) {
      if (element2.id !== parameterName && element2.getAttribute("name") !== parameterName && element2.getAttribute("data-name") !== parameterName) {
        continue;
      }
      const value = normalizeParameter(
        element2.value ?? element2.getAttribute("value") ?? element2.textContent
      );
      if (value) result.push(value);
    }
    return result;
  }
  function collectValuesFromHtml(html, parameterName) {
    const result = [];
    const escapedName = parameterName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`(?:id|name)=["']${escapedName}["'][^>]*value=["']([^"']+)`, "gi"),
      new RegExp(`value=["']([^"']+)["'][^>]*(?:id|name)=["']${escapedName}["']`, "gi"),
      new RegExp(`["']${escapedName}["']\\s*[:=]\\s*["']([^"']+)`, "gi")
    ];
    for (const pattern of patterns) {
      for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
        const value = normalizeParameter(match[1]);
        if (value) result.push(value);
      }
    }
    return result;
  }

  // src/core/courses.js
  function decodeHtmlEntities(value) {
    const named = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: '"'
    };
    return value.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, code) => {
      if (code[0] !== "#") return named[code.toLowerCase()] ?? entity;
      const radix = code[1]?.toLowerCase() === "x" ? 16 : 10;
      const digits = radix === 16 ? code.slice(2) : code.slice(1);
      const point = Number.parseInt(digits, radix);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    });
  }
  function stripHtml(value) {
    return decodeHtmlEntities(String(value ?? "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
  }
  function parseDay(value) {
    const number = Number(value);
    if (Number.isInteger(number) && number >= 1 && number <= 7) return number;
    const labels = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
    const match = String(value ?? "").match(/[一二三四五六日天]/);
    return match ? labels[match[0]] : 0;
  }
  function expandNumberExpression(value) {
    const normalized = String(value ?? "").replace(/[，、；;]/g, ",").replace(/[—–~～至到]/g, "-").replace(/\s+/g, "").replace(/[^\d,-]/g, "");
    const values = [];
    for (const segment of normalized.split(",")) {
      if (!segment) continue;
      const range = segment.match(/^(\d+)-(\d+)$/);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        if (Number.isInteger(start) && start > 0 && end >= start && end - start <= 100) {
          for (let number2 = start; number2 <= end; number2 += 1) values.push(number2);
        }
        continue;
      }
      const number = Number(segment);
      if (Number.isInteger(number) && number > 0) values.push(number);
    }
    return [...new Set(values)].sort((left, right) => left - right);
  }
  function parseWeeks(value) {
    const source = String(value ?? "").replace(/[，、；;]/g, ",").replace(/[—–~～至到]/g, "-").replace(/第/g, "").replace(/周次?/g, "").replace(/\s+/g, "");
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
    return [...new Set(weeks)].filter((week) => (!globalOdd || week % 2 === 1) && (!globalEven || week % 2 === 0)).sort((left, right) => left - right);
  }
  function parseSections(item) {
    const direct = item.djc ?? item.jc ?? item.sections ?? item.section ?? item.jcs;
    const directNumbers = Array.isArray(direct) ? direct.map(Number).filter((number) => Number.isInteger(number) && number > 0) : expandNumberExpression(direct);
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
  function extractCourseRows(response) {
    const candidates = Array.isArray(response) ? [response] : [
      response?.data,
      response?.rows,
      response?.result?.data,
      response?.result?.rows,
      response?.result
    ];
    for (const candidate of candidates) {
      if (!Array.isArray(candidate)) continue;
      if (candidate.length === 0 || candidate.some(
        (row) => row && typeof row === "object" && ["kcmc", "courseName", "name"].some((key) => key in row)
      )) {
        return candidate;
      }
    }
    throw new Error("无法识别课表接口返回的数据结构");
  }
  function parseCourses(rows, onInvalid = () => {
  }) {
    const parsed = [];
    for (const item of rows) {
      if (!item || typeof item !== "object") {
        onInvalid(item);
        continue;
      }
      const name = stripHtml(item.kcmc ?? item.courseName ?? item.name);
      const teacher = stripHtml(item.tmc ?? item.teacherName ?? item.teacher);
      const position = stripHtml(
        item.croommc ?? item.croombh ?? item.location ?? item.classroom ?? item.position
      );
      const day = parseDay(item.xingqi ?? item.dayOfWeek ?? item.day);
      const sections = parseSections(item);
      const weeks = Array.isArray(item.weeks) ? [...new Set(item.weeks.map(Number).filter((week) => Number.isInteger(week) && week > 0))].sort(
        (left, right) => left - right
      ) : parseWeeks(item.zcstr ?? item.zc ?? item.weekExpression);
      if (!name || !day || !sections.length || !weeks.length) {
        onInvalid(item);
        continue;
      }
      parsed.push({ name, teacher, position, day, sections, weeks });
    }
    const bySection = /* @__PURE__ */ new Map();
    for (const course of parsed) {
      for (const section of course.sections) {
        const key = JSON.stringify([
          course.name,
          course.teacher,
          course.position,
          course.day,
          section
        ]);
        const existing = bySection.get(key) ?? {
          name: course.name,
          teacher: course.teacher,
          position: course.position,
          day: course.day,
          sections: [section],
          weeks: []
        };
        existing.weeks.push(...course.weeks);
        existing.weeks = [...new Set(existing.weeks)].sort((a, b) => a - b);
        bySection.set(key, existing);
      }
    }
    const merged = /* @__PURE__ */ new Map();
    for (const course of bySection.values()) {
      const key = JSON.stringify([
        course.name,
        course.teacher,
        course.position,
        course.day,
        course.weeks
      ]);
      const existing = merged.get(key) ?? { ...course, sections: [] };
      existing.sections.push(...course.sections);
      existing.sections = [...new Set(existing.sections)].sort((a, b) => a - b);
      merged.set(key, existing);
    }
    return [...merged.values()].sort(
      (left, right) => left.day - right.day || left.sections[0] - right.sections[0] || left.name.localeCompare(right.name, "zh-CN")
    );
  }

  // src/core/timer.js
  function parseDateMillis(value) {
    const match = String(value ?? "").match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) return "";
    const [, year, rawMonth, rawDay] = match;
    const month = rawMonth.padStart(2, "0");
    const day = rawDay.padStart(2, "0");
    const timestamp = (/* @__PURE__ */ new Date(`${year}-${month}-${day}T00:00:00+08:00`)).getTime();
    return Number.isFinite(timestamp) ? String(timestamp) : "";
  }
  function normalizeTimerData(response) {
    const data = response?.data ?? response?.result?.data ?? response?.result;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("无法识别时间配置接口返回的数据结构");
    }
    return data;
  }
  function parseTimer(response, semester = "所选") {
    const data = normalizeTimerData(response);
    const rawSections = data.jcsjszList ?? data.sections;
    if (!Array.isArray(rawSections)) {
      throw new Error(`${semester} 学期没有返回节次配置`);
    }
    const sections = [];
    let forenoon = 0;
    let afternoon = 0;
    let night = 0;
    for (const item of rawSections) {
      const section = Number(item.jc ?? item.section ?? item.number);
      const startTime = String(item.kssj ?? item.startTime ?? item.start ?? "").trim();
      const endTime = String(item.jssj ?? item.endTime ?? item.end ?? "").trim();
      if (!Number.isInteger(section) || section <= 0 || !startTime || !endTime) continue;
      sections.push({ section, startTime, endTime });
      const period = String(item.sjd ?? "").toLowerCase();
      if (period === "sw") forenoon += 1;
      else if (period === "xw") afternoon += 1;
      else if (period === "ws" || period === "bw") night += 1;
      else {
        const hour = Number(startTime.split(":")[0]);
        if (!Number.isFinite(hour)) continue;
        if (hour < 12) forenoon += 1;
        else if (hour < 18) afternoon += 1;
        else night += 1;
      }
    }
    sections.sort((left, right) => left.section - right.section);
    if (!sections.length) throw new Error(`${semester} 学期没有有效的节次配置`);
    const weekList = data.zclist ?? data.weekList ?? [];
    if (!Array.isArray(weekList)) throw new Error(`${semester} 学期周次配置无效`);
    const firstWeek = weekList.find(
      (week) => String(week.zc ?? week.week ?? week.weekNumber ?? "") === "1"
    );
    const startSemester = parseDateMillis(
      firstWeek?.minrq ?? firstWeek?.startDate ?? firstWeek?.date ?? data.jsxq?.xqksrq ?? data.jsxq?.startDate ?? data.startSemester ?? data.startDate
    );
    if (!startSemester) {
      throw new Error(`${semester} 学期没有返回有效的开学日期`);
    }
    const totalWeek = Number(data.jsxq?.pkzdzc ?? data.totalWeek ?? weekList.length);
    if (!Number.isInteger(totalWeek) || totalWeek <= 0) {
      throw new Error(`${semester} 学期没有返回有效的总周数`);
    }
    return {
      totalWeek,
      startSemester,
      startWithSunday: false,
      showWeekend: true,
      forenoon,
      afternoon,
      night,
      sections
    };
  }

  // src/api/cdu-client.js
  function apiUrl(path, parameters = {}) {
    const url = new URL(path, SCHOOL_ORIGIN);
    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, String(value));
    }
    url.searchParams.set("_", String(Date.now()));
    return url;
  }
  function looksLikeHtml(text) {
    const value = String(text ?? "").trim();
    return /^<!doctype\s+html/i.test(value) || /^<html/i.test(value) || /^<head/i.test(value) || /^<body/i.test(value);
  }
  function looksLikeLoginHtml(text) {
    const value = String(text ?? "");
    return /<form[^>]+login/i.test(value) || /统一身份认证/.test(value);
  }
  async function requestText(url, fetchImpl = globalThis.fetch) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json, text/plain, text/html, */*",
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`请求失败：HTTP ${response.status}`);
      return text;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("请求超时，请检查网络后重试");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function requestJson(url, fetchImpl = globalThis.fetch) {
    const text = await requestText(url, fetchImpl);
    if (looksLikeHtml(text) || looksLikeLoginHtml(text)) {
      throw new Error("接口返回了登录页或错误页面，请重新登录教务系统");
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("接口返回的内容不是有效 JSON");
    }
  }
  function collectDocuments(win, result = []) {
    try {
      if (win.document) result.push(win.document);
      for (let index = 0; index < win.frames.length; index += 1) {
        try {
          collectDocuments(win.frames[index], result);
        } catch {
        }
      }
    } catch {
    }
    return result;
  }
  function parseHtml(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }
  async function loadScheduleDocument(semester, fetchImpl) {
    const url = apiUrl(SCHEDULE_PAGE, {
      ...semester ? { xnxq: semester } : {},
      xskbxslx: "0"
    });
    const html = await requestText(url, fetchImpl);
    if (looksLikeLoginHtml(html)) {
      throw new Error("课表页面返回了登录页，请重新登录教务系统");
    }
    if (!looksLikeHtml(html)) {
      throw new Error("课表页面没有返回有效 HTML");
    }
    return { html, doc: parseHtml(html) };
  }
  async function getScheduleContext(win = window, fetchImpl = globalThis.fetch) {
    const documents = collectDocuments(win);
    try {
      const remote = await loadScheduleDocument("", fetchImpl);
      documents.push(remote.doc);
    } catch {
    }
    const semesterMap = /* @__PURE__ */ new Map();
    let currentSemester = "";
    let fallbackXqdm = "";
    for (const doc of documents) {
      collectSemesters(doc, semesterMap);
      const candidateSemester = normalizeSemester(readElementValue(doc, "xnxq"));
      if (!isSemester(currentSemester) && isSemester(candidateSemester)) {
        currentSemester = candidateSemester;
      }
      fallbackXqdm || (fallbackXqdm = normalizeParameter(readElementValue(doc, "xqdm")));
    }
    if (isSemester(currentSemester) && !semesterMap.has(currentSemester)) {
      semesterMap.set(currentSemester, {
        value: currentSemester,
        label: currentSemester,
        selected: true
      });
    }
    const semesters = sortedSemesters(semesterMap);
    if (!semesters.length) {
      throw new Error("没有检测到可选学期，请先进入“我的课表”页面");
    }
    return { currentSemester, semesters, fallbackXqdm };
  }
  function loadRuntimeSemesterDocument(semester, doc = document) {
    return new Promise((resolve, reject) => {
      const iframe = doc.createElement("iframe");
      iframe.hidden = true;
      iframe.setAttribute("aria-hidden", "true");
      const url = apiUrl(SCHEDULE_PAGE, { xnxq: semester, xskbxslx: "0" });
      const timeout = setTimeout(() => {
        iframe.remove();
        reject(new Error("加载所选学期课表页面超时"));
      }, REQUEST_TIMEOUT_MS);
      iframe.addEventListener(
        "load",
        () => {
          setTimeout(() => {
            try {
              if (!iframe.contentDocument) throw new Error("无法读取所选学期课表页面");
              clearTimeout(timeout);
              resolve({ doc: iframe.contentDocument, iframe });
            } catch (error) {
              clearTimeout(timeout);
              iframe.remove();
              reject(error);
            }
          }, 800);
        },
        { once: true }
      );
      iframe.src = url.href;
      doc.documentElement.appendChild(iframe);
    });
  }
  function valuesFor(doc, html, name) {
    return [
      ...collectNamedValues(doc, name),
      ...html ? collectValuesFromHtml(html, name) : []
    ];
  }
  async function getSemesterRequestContext(baseContext, semester, { win = window, fetchImpl = globalThis.fetch, runtimeLoader = loadRuntimeSemesterDocument } = {}) {
    const selectedPage = await loadScheduleDocument(semester, fetchImpl);
    const selectedXhid = valuesFor(selectedPage.doc, selectedPage.html, "xhid");
    const selectedXqdm = valuesFor(selectedPage.doc, selectedPage.html, "xqdm");
    const runtimeXhid = [];
    const runtimeXqdm = [];
    if (!selectedXhid.some(isValidEncryptedXhid)) {
      const runtime = await runtimeLoader(semester);
      try {
        runtimeXhid.push(...valuesFor(runtime.doc, runtime.doc.documentElement?.outerHTML, "xhid"));
        runtimeXqdm.push(...valuesFor(runtime.doc, runtime.doc.documentElement?.outerHTML, "xqdm"));
      } finally {
        runtime.iframe.remove();
      }
    }
    const currentDocuments = collectDocuments(win);
    const currentXhid = currentDocuments.flatMap((doc) => collectNamedValues(doc, "xhid"));
    const currentXqdm = currentDocuments.flatMap((doc) => collectNamedValues(doc, "xqdm"));
    const xhid = chooseXhidByPriority([selectedXhid, runtimeXhid, currentXhid]);
    const xqdm = [...selectedXqdm, ...runtimeXqdm, ...currentXqdm].map(normalizeParameter).find(Boolean) ?? baseContext.fallbackXqdm;
    if (!xqdm) throw new Error("没有获取到所选学期对应的 xqdm");
    return { semester, xhid, xqdm };
  }
  function throwBusinessError(response, fallback) {
    if (response && !Array.isArray(response) && response.ret != null && Number(response.ret) !== 0) {
      throw new Error(response.msg || response.message || fallback);
    }
  }
  async function fetchCourses(baseContext, semester, options = {}) {
    const semesterContext = await getSemesterRequestContext(baseContext, semester, options);
    const url = apiUrl(COURSE_API, {
      xnxq: semester,
      xhid: semesterContext.xhid,
      xqdm: semesterContext.xqdm,
      zdzc: "",
      zxzc: "",
      xskbxslx: "0"
    });
    const response = await requestJson(url, options.fetchImpl);
    throwBusinessError(response, `${semester} 学期课表接口请求失败`);
    const rows = extractCourseRows(response);
    if (!rows.length) throw new Error(`${semester} 学期课表为空，可能尚未发布`);
    return { rows, semesterContext };
  }
  async function fetchTimer(semesterContext, semester, fetchImpl = globalThis.fetch) {
    const url = apiUrl(TIMER_API, {
      xnxq: semester,
      role: "",
      userId: "",
      xqid: semesterContext.xqdm
    });
    const response = await requestJson(url, fetchImpl);
    throwBusinessError(response, `${semester} 学期时间配置请求失败`);
    return parseTimer(response, semester);
  }

  // src/core/import-data.js
  function buildPresetData(semester, courses, timer, now = Date.now()) {
    const timestamp = String(now);
    const importData = {
      isV2: true,
      t: timestamp,
      parserRes: { courseInfos: courses },
      timerRes: timer,
      schoolName: "成都大学",
      feedbackId: `cdu_${semester}_${timestamp}`,
      id: `cdu_${semester}_${timestamp}`
    };
    return JSON.stringify({ importData: JSON.stringify(importData) });
  }
  function buildDeepLink(presetData) {
    return `voiceassist://aiweb/?source=widget&flag=268468224&url=${encodeURIComponent(XIAOAI_PAGE)}&presetData=${encodeURIComponent(presetData)}`;
  }

  // src/app.js
  function createImportRunner({
    ui,
    readScheduleContext = getScheduleContext,
    readCourses = fetchCourses,
    readTimer = fetchTimer,
    parseCourseRows = parseCourses,
    createPresetData = buildPresetData,
    createDeepLink = buildDeepLink,
    navigate = (url) => {
      window.location.href = url;
    }
  }) {
    let running = false;
    return async function runImport() {
      if (running) return;
      running = true;
      try {
        ui.setBusy("正在读取学期……");
        const baseContext = await readScheduleContext();
        ui.setBusy("请选择学期");
        const semester = await ui.selectSemester(baseContext);
        if (!semester) return;
        ui.setBusy(`正在读取 ${semester}……`);
        const courseResult = await readCourses(baseContext, semester);
        const courses = parseCourseRows(courseResult.rows);
        if (!courses.length) throw new Error(`${semester} 学期没有解析出有效课程`);
        ui.setBusy("正在读取节次时间……");
        const timer = await readTimer(courseResult.semesterContext, semester);
        ui.setBusy("请检查课程");
        const confirmed = await ui.showPreview(semester, courses, timer);
        if (!confirmed) return;
        navigate(createDeepLink(createPresetData(semester, courses, timer)));
      } catch (error) {
        console.error("[XiaoAISchedule-CDU] 导入失败：", error?.message || String(error));
        await ui.showError(error);
      } finally {
        running = false;
        ui.setIdle();
      }
    };
  }

  // src/ui/styles.js
  var styles = `
:host {
  all: initial;
  color-scheme: light;
  font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
}
*, *::before, *::after { box-sizing: border-box; }
button, select, input { font: inherit; }
.entry {
  position: fixed; right: 18px; bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  z-index: 2147483646; border: 0; border-radius: 999px; padding: 12px 17px;
  background: #2563eb; color: #fff; font-size: 15px; font-weight: 700;
  box-shadow: 0 8px 24px rgb(37 99 235 / 35%); cursor: pointer;
}
.entry:disabled { cursor: wait; opacity: .72; }
.backdrop {
  position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center;
  padding: 14px; background: rgb(15 23 42 / 62%);
}
.dialog {
  width: min(880px, 100%); max-height: min(92dvh, 900px); overflow: auto;
  border-radius: 20px; padding: 22px; background: #fff; color: #111827;
  box-shadow: 0 24px 70px rgb(0 0 0 / 30%);
}
.dialog--small { width: min(480px, 100%); }
.title { margin: 0; font-size: 21px; line-height: 1.35; }
.description { margin: 8px 0 18px; color: #64748b; font-size: 14px; line-height: 1.6; }
.field { display: grid; gap: 7px; margin: 14px 0; color: #334155; font-size: 14px; }
.control {
  width: 100%; min-height: 44px; border: 1px solid #cbd5e1; border-radius: 11px;
  padding: 9px 11px; background: #fff; color: #0f172a;
}
.control:focus, button:focus-visible { outline: 3px solid rgb(37 99 235 / 25%); outline-offset: 2px; }
.notice { margin: 12px 0; border-radius: 10px; padding: 10px 12px; background: #eff6ff; color: #1e40af; font-size: 13px; }
.error { background: #fef2f2; color: #b91c1c; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
.button { min-height: 44px; border: 1px solid #cbd5e1; border-radius: 11px; padding: 10px 14px; background: #fff; color: #0f172a; cursor: pointer; }
.button--primary { border-color: #2563eb; background: #2563eb; color: #fff; font-weight: 700; }
.summary { margin: 10px 0 14px; color: #64748b; font-size: 13px; }
.table-wrap { max-height: 55dvh; overflow: auto; border: 1px solid #e2e8f0; border-radius: 12px; }
table { width: 100%; border-collapse: collapse; color: #1e293b; font-size: 13px; }
th { position: sticky; top: 0; background: #f8fafc; text-align: left; }
th, td { padding: 9px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
@media (max-width: 640px) {
  .entry { right: 12px; bottom: calc(64px + env(safe-area-inset-bottom, 0px)); }
  .backdrop { align-items: end; padding: 0; }
  .dialog { width: 100%; max-height: 92dvh; border-radius: 20px 20px 0 0; padding: 18px 16px calc(16px + env(safe-area-inset-bottom, 0px)); }
  th, td { min-width: 88px; }
  th:first-child, td:first-child { min-width: 130px; }
}
`;

  // src/ui/ui.js
  function element(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function isAndroid(doc) {
    return /Android/i.test(doc.defaultView?.navigator?.userAgent ?? "");
  }
  function createUi({ onImport, doc = document } = {}) {
    const existing = doc.getElementById(UI_HOST_ID);
    if (existing) return existing.__xiaoaiUi;
    const host = doc.createElement("div");
    host.id = UI_HOST_ID;
    const shadow = host.attachShadow({ mode: "open" });
    const style = doc.createElement("style");
    style.textContent = styles;
    shadow.appendChild(style);
    const entry = element(doc, "button", "entry", "导入小爱课程表");
    entry.type = "button";
    entry.addEventListener("click", () => onImport?.());
    shadow.appendChild(entry);
    doc.documentElement.appendChild(host);
    function setBusy(message = "正在处理……") {
      entry.disabled = true;
      entry.textContent = message;
    }
    function setIdle() {
      entry.disabled = false;
      entry.textContent = "导入小爱课程表";
    }
    function openDialog({ title, description, small = false, render, primaryText = "确定" }) {
      return new Promise((resolve) => {
        const previousFocus = shadow.activeElement || doc.activeElement;
        const backdrop = element(doc, "div", "backdrop");
        const dialog = element(doc, "section", `dialog${small ? " dialog--small" : ""}`);
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        const heading = element(doc, "h2", "title", title);
        const details = element(doc, "p", "description", description);
        dialog.append(heading, details);
        const state = render?.(dialog) ?? {};
        const actions = element(doc, "div", "actions");
        const cancel = element(doc, "button", "button", "返回");
        cancel.type = "button";
        const confirm = element(doc, "button", "button button--primary", primaryText);
        confirm.type = "button";
        actions.append(cancel, confirm);
        dialog.appendChild(actions);
        backdrop.appendChild(dialog);
        shadow.appendChild(backdrop);
        const close = (value) => {
          doc.removeEventListener("keydown", onKeydown);
          backdrop.remove();
          previousFocus?.focus?.();
          resolve(value);
        };
        const onKeydown = (event) => {
          if (event.key === "Escape") close(null);
        };
        cancel.addEventListener("click", () => close(null));
        confirm.addEventListener("click", () => {
          try {
            close(state.value ? state.value() : true);
          } catch (error) {
            let notice = dialog.querySelector(".error");
            if (!notice) {
              notice = element(doc, "div", "notice error");
              actions.before(notice);
            }
            notice.textContent = error.message;
          }
        });
        backdrop.addEventListener("click", (event) => {
          if (event.target === backdrop) close(null);
        });
        doc.addEventListener("keydown", onKeydown);
        queueMicrotask(() => dialog.querySelector("select, input, button")?.focus());
      });
    }
    function selectSemester(context) {
      return openDialog({
        title: "选择要导入的学期",
        description: "脚本会重新读取所选学期的课表参数，不会复用其他学期的用户标识。",
        small: true,
        primaryText: "读取课表",
        render(dialog) {
          const selectLabel = element(doc, "label", "field", "教务系统学期");
          const select = element(doc, "select", "control");
          for (const semester of context.semesters) {
            const option = element(doc, "option", "", semester.label);
            option.value = semester.value;
            option.selected = semester.value === context.currentSemester || semester.selected;
            select.appendChild(option);
          }
          selectLabel.appendChild(select);
          const manualLabel = element(doc, "label", "field", "手动输入（可选）");
          const manual = element(doc, "input", "control");
          manual.placeholder = "例如 2025-2026-1";
          manual.inputMode = "text";
          manualLabel.appendChild(manual);
          dialog.append(selectLabel, manualLabel);
          return {
            value() {
              const semester = manual.value.trim() || select.value;
              if (!isSemester(semester)) throw new Error("学期格式应为 2025-2026-1");
              return semester;
            }
          };
        }
      });
    }
    function showPreview(semester, courses, timer) {
      return openDialog({
        title: `${semester} 学期课程预览`,
        description: "请核对课程、周次和节次后再导入。",
        primaryText: "导入小爱课程表",
        render(dialog) {
          const date = new Date(Number(timer.startSemester));
          const dateText = Number.isFinite(date.getTime()) ? date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) : timer.startSemester;
          const summary = element(
            doc,
            "div",
            "summary",
            `共 ${courses.length} 门课程，${timer.totalWeek} 周，开学日期 ${dateText}`
          );
          dialog.appendChild(summary);
          if (!isAndroid(doc)) {
            dialog.appendChild(
              element(doc, "div", "notice", "当前不是安卓环境；可预览数据，但最终需在小米手机上唤起小爱课程表。")
            );
          }
          const wrap = element(doc, "div", "table-wrap");
          const table = element(doc, "table");
          const head = element(doc, "thead");
          const headRow = element(doc, "tr");
          for (const label of ["课程", "星期", "节次", "周次", "教师/地点"]) {
            headRow.appendChild(element(doc, "th", "", label));
          }
          head.appendChild(headRow);
          table.appendChild(head);
          const body = element(doc, "tbody");
          const days = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];
          for (const course of courses) {
            const row = element(doc, "tr");
            const values = [
              course.name,
              days[course.day],
              course.sections.join(","),
              course.weeks.join(","),
              [course.teacher, course.position].filter(Boolean).join(" / ")
            ];
            for (const value of values) row.appendChild(element(doc, "td", "", value));
            body.appendChild(row);
          }
          table.appendChild(body);
          wrap.appendChild(table);
          dialog.appendChild(wrap);
          return { value: () => true };
        }
      });
    }
    function showError(error) {
      return openDialog({
        title: "导入失败",
        description: error?.message || String(error),
        small: true,
        primaryText: "知道了",
        render: () => ({ value: () => true })
      });
    }
    const api = { host, shadow, entry, setBusy, setIdle, selectSemester, showPreview, showError };
    host.__xiaoaiUi = api;
    return api;
  }

  // src/main.js
  if (window.top === window.self) {
    let runImport = () => {
    };
    const ui = createUi({ onImport: () => runImport() });
    runImport = createImportRunner({ ui });
  }
})();
