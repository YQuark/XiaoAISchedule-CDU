import { UI_HOST_ID } from "../constants.js";
import { isSemester } from "../core/semester.js";
import { styles } from "./styles.js";

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function isAndroid(doc) {
  return /Android/i.test(doc.defaultView?.navigator?.userAgent ?? "");
}

export function createUi({ onImport, doc = document } = {}) {
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
          },
        };
      },
    });
  }

  function showPreview(semester, courses, timer) {
    return openDialog({
      title: `${semester} 学期课程预览`,
      description: "请核对课程、周次和节次后再导入。",
      primaryText: "导入小爱课程表",
      render(dialog) {
        const date = new Date(Number(timer.startSemester));
        const dateText = Number.isFinite(date.getTime())
          ? date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })
          : timer.startSemester;
        const summary = element(
          doc,
          "div",
          "summary",
          `共 ${courses.length} 门课程，${timer.totalWeek} 周，开学日期 ${dateText}`,
        );
        dialog.appendChild(summary);
        if (!isAndroid(doc)) {
          dialog.appendChild(
            element(doc, "div", "notice", "当前不是安卓环境；可预览数据，但最终需在小米手机上唤起小爱课程表。"),
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
            [course.teacher, course.position].filter(Boolean).join(" / "),
          ];
          for (const value of values) row.appendChild(element(doc, "td", "", value));
          body.appendChild(row);
        }
        table.appendChild(body);
        wrap.appendChild(table);
        dialog.appendChild(wrap);
        return { value: () => true };
      },
    });
  }

  function showError(error) {
    return openDialog({
      title: "导入失败",
      description: error?.message || String(error),
      small: true,
      primaryText: "知道了",
      render: () => ({ value: () => true }),
    });
  }

  const api = { host, shadow, entry, setBusy, setIdle, selectSemester, showPreview, showError };
  host.__xiaoaiUi = api;
  return api;
}
