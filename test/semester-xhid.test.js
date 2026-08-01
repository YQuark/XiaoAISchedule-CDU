import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  collectSemesters,
  isSemester,
  normalizeSemester,
  sortedSemesters,
} from "../src/core/semester.js";
import {
  chooseXhidByPriority,
  collectValuesFromHtml,
  isShortInternalXhid,
  isValidEncryptedXhid,
} from "../src/core/xhid.js";

test("规范化并按新到旧排列学期", () => {
  const dom = new JSDOM(`
    <select id="xnxq">
      <option value="2024_2025_2">旧学期</option>
      <option value="2025-2026-1" selected>当前学期</option>
    </select>
  `);
  const map = collectSemesters(dom.window.document);
  assert.equal(normalizeSemester(" 2024_2025_2 "), "2024-2025-2");
  assert.equal(isSemester("2025-2026-1"), true);
  assert.deepEqual(
    sortedSemesters(map).map((item) => item.value),
    ["2025-2026-1", "2024-2025-2"],
  );
});

test("拒绝短内部 ID 并优先使用所选学期的 xhid", () => {
  const shortId = "caef6254394a422195c936ceb166a0c5";
  const selected = "A".repeat(64);
  const currentLonger = "B".repeat(96);
  assert.equal(isShortInternalXhid(shortId), true);
  assert.equal(isValidEncryptedXhid(shortId), false);
  assert.equal(chooseXhidByPriority([[shortId, selected], [currentLonger]]), selected);
  assert.throws(() => chooseXhidByPriority([[shortId], ["bad value"]]), /长加密 xhid/);
});

test("可从两种属性顺序及脚本变量中提取参数", () => {
  const xhid = "C".repeat(64);
  const html = `<input name="xhid" value="${xhid}"><script>var data={"xhid":"${xhid}"}</script>`;
  assert.deepEqual(collectValuesFromHtml(html, "xhid"), [xhid, xhid]);
});
