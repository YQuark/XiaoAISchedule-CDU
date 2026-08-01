import test from "node:test";
import assert from "node:assert/strict";
import { buildDeepLink, buildPresetData } from "../src/core/import-data.js";
import { parseDateMillis, parseTimer } from "../src/core/timer.js";

const timerResponse = {
  ret: 0,
  data: {
    jcsjszList: [
      { jc: 3, kssj: "14:00", jssj: "14:45", sjd: "xw" },
      { jc: 1, kssj: "08:00", jssj: "08:45", sjd: "sw" },
      { jc: 9, kssj: "19:00", jssj: "19:45", sjd: "ws" },
    ],
    zclist: [
      { zc: "1", minrq: "2025-09-08 00:00:00" },
      { zc: "2", minrq: "2025-09-15 00:00:00" },
    ],
    jsxq: { pkzdzc: 18 },
  },
};

test("按东八区解析开学日期并统计时段", () => {
  assert.equal(parseDateMillis("2025-09-08 00:00:00"), "1757260800000");
  const timer = parseTimer(timerResponse, "2025-2026-1");
  assert.deepEqual(timer.sections.map((item) => item.section), [1, 3, 9]);
  assert.equal(timer.totalWeek, 18);
  assert.equal(timer.forenoon, 1);
  assert.equal(timer.afternoon, 1);
  assert.equal(timer.night, 1);
});

test("缺少关键时间数据时明确失败", () => {
  assert.throws(
    () => parseTimer({ data: { jcsjszList: [], zclist: [] } }, "测试"),
    /有效的节次配置/,
  );
  assert.throws(
    () =>
      parseTimer(
        { data: { jcsjszList: [{ jc: 1, kssj: "08:00", jssj: "08:45" }], zclist: [] } },
        "测试",
      ),
    /开学日期/,
  );
});

test("锁定小爱课程表导入协议与双层 JSON", () => {
  const courses = [{ name: "高等数学", teacher: "李老师", position: "A101", day: 1, sections: [1], weeks: [1] }];
  const timer = parseTimer(timerResponse, "2025-2026-1");
  const preset = buildPresetData("2025-2026-1", courses, timer, 1234567890);
  const wrapper = JSON.parse(preset);
  const importData = JSON.parse(wrapper.importData);
  assert.equal(importData.isV2, true);
  assert.equal(importData.t, "1234567890");
  assert.deepEqual(importData.parserRes.courseInfos, courses);
  assert.deepEqual(importData.timerRes, timer);
  assert.equal(importData.schoolName, "成都大学");
  assert.equal(importData.id, "cdu_2025-2026-1_1234567890");
  const link = buildDeepLink(preset);
  assert.match(link, /^voiceassist:\/\/aiweb\/\?source=widget&flag=268468224/);
  assert.equal(decodeURIComponent(new URL(link).searchParams.get("presetData")), preset);
});
