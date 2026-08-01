import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCourseRows,
  parseCourses,
  parseSections,
  parseWeeks,
  stripHtml,
} from "../src/core/courses.js";

test("解析单双周、混合范围和中文分隔符", () => {
  assert.deepEqual(parseWeeks("1-8周(单),10-14周(双)"), [1, 3, 5, 7, 10, 12, 14]);
  assert.deepEqual(parseWeeks("第1、3、5周"), [1, 3, 5]);
});

test("解析直接节次和起止节次", () => {
  assert.deepEqual(parseSections({ djc: "1-2" }), [1, 2]);
  assert.deepEqual(parseSections({ ksjc: 3, jsjc: 4 }), [3, 4]);
  assert.deepEqual(parseSections({ startSection: 5, sectionCount: 2 }), [5, 6]);
});

test("清理 HTML 并保留大学英语课程", () => {
  assert.equal(stripHtml("<b>大学英语&amp;听说</b>"), "大学英语&听说");
  const courses = parseCourses([
    {
      kcmc: "<b>大学英语</b>",
      tmc: "张老师",
      croommc: "一教101",
      xingqi: "星期一",
      djc: 1,
      zcstr: "1-4",
    },
  ]);
  assert.equal(courses.length, 1);
  assert.equal(courses[0].name, "大学英语");
});

test("合并相同课程的周次和节次并跳过无效记录", () => {
  const invalid = [];
  const courses = parseCourses(
    [
      { kcmc: "高等数学", tmc: "李老师", croommc: "A101", xingqi: 2, djc: 1, zcstr: "1-2" },
      { kcmc: "高等数学", tmc: "李老师", croommc: "A101", xingqi: 2, djc: 1, zcstr: "3-4" },
      { kcmc: "高等数学", tmc: "李老师", croommc: "A101", xingqi: 2, djc: 2, zcstr: "1-4" },
      { kcmc: "", xingqi: 2, djc: 3, zcstr: "1-4" },
    ],
    (row) => invalid.push(row),
  );
  assert.equal(invalid.length, 1);
  assert.deepEqual(courses, [
    {
      name: "高等数学",
      teacher: "李老师",
      position: "A101",
      day: 2,
      sections: [1, 2],
      weeks: [1, 2, 3, 4],
    },
  ]);
});

test("只接受明确的课表数组包装", () => {
  const rows = [{ kcmc: "课程" }];
  assert.equal(extractCourseRows({ data: rows }), rows);
  assert.throws(() => extractCourseRows({ data: { unrelated: [] } }), /数据结构/);
});
