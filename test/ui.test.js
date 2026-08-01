import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createUi } from "../src/ui/ui.js";

function setup() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://szjw.cdu.edu.cn/admin/pkgl/xskb/queryKbForXsd",
  });
  return dom;
}

test("界面根节点和入口按钮保持单例", () => {
  const dom = setup();
  const first = createUi({ doc: dom.window.document });
  const second = createUi({ doc: dom.window.document });
  assert.equal(first, second);
  assert.equal(dom.window.document.querySelectorAll("#xiaoai-schedule-cdu-root").length, 1);
  assert.equal(first.shadow.querySelectorAll(".entry").length, 1);
});

test("学期弹窗可确认、取消并校验手动输入", async () => {
  const dom = setup();
  const ui = createUi({ doc: dom.window.document });
  const selectedPromise = ui.selectSemester({
    currentSemester: "2025-2026-1",
    semesters: [{ value: "2025-2026-1", label: "当前学期", selected: true }],
  });
  ui.shadow.querySelector(".button--primary").click();
  assert.equal(await selectedPromise, "2025-2026-1");

  const cancelledPromise = ui.selectSemester({
    currentSemester: "2025-2026-1",
    semesters: [{ value: "2025-2026-1", label: "当前学期", selected: true }],
  });
  ui.shadow.querySelector(".button").click();
  assert.equal(await cancelledPromise, null);
});

test("预览使用 textContent 渲染课程并能确认", async () => {
  const dom = setup();
  const ui = createUi({ doc: dom.window.document });
  const promise = ui.showPreview(
    "2025-2026-1",
    [{ name: "<img src=x onerror=alert(1)>", teacher: "老师", position: "A101", day: 1, sections: [1], weeks: [1] }],
    { totalWeek: 18, startSemester: "1757260800000" },
  );
  assert.equal(ui.shadow.querySelector("tbody td").textContent, "<img src=x onerror=alert(1)>");
  assert.equal(ui.shadow.querySelector("tbody img"), null);
  ui.shadow.querySelector(".button--primary").click();
  assert.equal(await promise, true);
});
