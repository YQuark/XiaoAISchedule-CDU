import {
  COURSE_API,
  REQUEST_TIMEOUT_MS,
  SCHEDULE_PAGE,
  SCHOOL_ORIGIN,
  TIMER_API,
} from "../constants.js";
import {
  collectSemesters,
  isSemester,
  normalizeSemester,
  readElementValue,
  sortedSemesters,
} from "../core/semester.js";
import {
  chooseXhidByPriority,
  collectNamedValues,
  collectValuesFromHtml,
  isValidEncryptedXhid,
  normalizeParameter,
} from "../core/xhid.js";
import { extractCourseRows } from "../core/courses.js";
import { parseTimer } from "../core/timer.js";

function apiUrl(path, parameters = {}) {
  const url = new URL(path, SCHOOL_ORIGIN);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("_", String(Date.now()));
  return url;
}

export function looksLikeHtml(text) {
  const value = String(text ?? "").trim();
  return (
    /^<!doctype\s+html/i.test(value) ||
    /^<html/i.test(value) ||
    /^<head/i.test(value) ||
    /^<body/i.test(value)
  );
}

export function looksLikeLoginHtml(text) {
  const value = String(text ?? "");
  return /<form[^>]+login/i.test(value) || /统一身份认证/.test(value);
}

export async function requestText(url, fetchImpl = globalThis.fetch) {
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
        "X-Requested-With": "XMLHttpRequest",
      },
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

export async function requestJson(url, fetchImpl = globalThis.fetch) {
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

export function collectDocuments(win, result = []) {
  try {
    if (win.document) result.push(win.document);
    for (let index = 0; index < win.frames.length; index += 1) {
      try {
        collectDocuments(win.frames[index], result);
      } catch {
        // 跨域 frame 不属于成都大学教务系统上下文。
      }
    }
  } catch {
    // 不可访问的窗口不会参与参数提取。
  }
  return result;
}

function parseHtml(html) {
  return new DOMParser().parseFromString(html, "text/html");
}

async function loadScheduleDocument(semester, fetchImpl) {
  const url = apiUrl(SCHEDULE_PAGE, {
    ...(semester ? { xnxq: semester } : {}),
    xskbxslx: "0",
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

export async function getScheduleContext(win = window, fetchImpl = globalThis.fetch) {
  const documents = collectDocuments(win);
  try {
    const remote = await loadScheduleDocument("", fetchImpl);
    documents.push(remote.doc);
  } catch {
    // 当前同源页面仍可能包含完整学期信息，继续读取。
  }

  const semesterMap = new Map();
  let currentSemester = "";
  let fallbackXqdm = "";
  for (const doc of documents) {
    collectSemesters(doc, semesterMap);
    const candidateSemester = normalizeSemester(readElementValue(doc, "xnxq"));
    if (!isSemester(currentSemester) && isSemester(candidateSemester)) {
      currentSemester = candidateSemester;
    }
    fallbackXqdm ||= normalizeParameter(readElementValue(doc, "xqdm"));
  }
  if (isSemester(currentSemester) && !semesterMap.has(currentSemester)) {
    semesterMap.set(currentSemester, {
      value: currentSemester,
      label: currentSemester,
      selected: true,
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
      { once: true },
    );
    iframe.src = url.href;
    doc.documentElement.appendChild(iframe);
  });
}

function valuesFor(doc, html, name) {
  return [
    ...collectNamedValues(doc, name),
    ...(html ? collectValuesFromHtml(html, name) : []),
  ];
}

export async function getSemesterRequestContext(
  baseContext,
  semester,
  { win = window, fetchImpl = globalThis.fetch, runtimeLoader = loadRuntimeSemesterDocument } = {},
) {
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
  const xqdm = [...selectedXqdm, ...runtimeXqdm, ...currentXqdm]
    .map(normalizeParameter)
    .find(Boolean) ?? baseContext.fallbackXqdm;
  if (!xqdm) throw new Error("没有获取到所选学期对应的 xqdm");
  return { semester, xhid, xqdm };
}

function throwBusinessError(response, fallback) {
  if (
    response &&
    !Array.isArray(response) &&
    response.ret != null &&
    Number(response.ret) !== 0
  ) {
    throw new Error(response.msg || response.message || fallback);
  }
}

export async function fetchCourses(baseContext, semester, options = {}) {
  const semesterContext = await getSemesterRequestContext(baseContext, semester, options);
  const url = apiUrl(COURSE_API, {
    xnxq: semester,
    xhid: semesterContext.xhid,
    xqdm: semesterContext.xqdm,
    zdzc: "",
    zxzc: "",
    xskbxslx: "0",
  });
  const response = await requestJson(url, options.fetchImpl);
  throwBusinessError(response, `${semester} 学期课表接口请求失败`);
  const rows = extractCourseRows(response);
  if (!rows.length) throw new Error(`${semester} 学期课表为空，可能尚未发布`);
  return { rows, semesterContext };
}

export async function fetchTimer(semesterContext, semester, fetchImpl = globalThis.fetch) {
  const url = apiUrl(TIMER_API, {
    xnxq: semester,
    role: "",
    userId: "",
    xqid: semesterContext.xqdm,
  });
  const response = await requestJson(url, fetchImpl);
  throwBusinessError(response, `${semester} 学期时间配置请求失败`);
  return parseTimer(response, semester);
}
