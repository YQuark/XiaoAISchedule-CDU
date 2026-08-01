export function parseDateMillis(value) {
  const match = String(value ?? "").match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return "";
  const [, year, rawMonth, rawDay] = match;
  const month = rawMonth.padStart(2, "0");
  const day = rawDay.padStart(2, "0");
  const timestamp = new Date(`${year}-${month}-${day}T00:00:00+08:00`).getTime();
  return Number.isFinite(timestamp) ? String(timestamp) : "";
}

export function normalizeTimerData(response) {
  const data = response?.data ?? response?.result?.data ?? response?.result;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("无法识别时间配置接口返回的数据结构");
  }
  return data;
}

export function parseTimer(response, semester = "所选") {
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
    (week) => String(week.zc ?? week.week ?? week.weekNumber ?? "") === "1",
  );
  const startSemester = parseDateMillis(
    firstWeek?.minrq ??
      firstWeek?.startDate ??
      firstWeek?.date ??
      data.jsxq?.xqksrq ??
      data.jsxq?.startDate ??
      data.startSemester ??
      data.startDate,
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
    sections,
  };
}
