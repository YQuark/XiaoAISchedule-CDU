import { fetchCourses, fetchTimer, getScheduleContext } from "./api/cdu-client.js";
import { parseCourses } from "./core/courses.js";
import { buildDeepLink, buildPresetData } from "./core/import-data.js";

export function createImportRunner({
  ui,
  readScheduleContext = getScheduleContext,
  readCourses = fetchCourses,
  readTimer = fetchTimer,
  parseCourseRows = parseCourses,
  createPresetData = buildPresetData,
  createDeepLink = buildDeepLink,
  navigate = (url) => {
    window.location.href = url;
  },
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
