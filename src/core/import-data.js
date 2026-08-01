import { XIAOAI_PAGE } from "../constants.js";

export function buildPresetData(semester, courses, timer, now = Date.now()) {
  const timestamp = String(now);
  const importData = {
    isV2: true,
    t: timestamp,
    parserRes: { courseInfos: courses },
    timerRes: timer,
    schoolName: "成都大学",
    feedbackId: `cdu_${semester}_${timestamp}`,
    id: `cdu_${semester}_${timestamp}`,
  };
  return JSON.stringify({ importData: JSON.stringify(importData) });
}

export function buildDeepLink(presetData) {
  return (
    "voiceassist://aiweb/?source=widget" +
    "&flag=268468224" +
    `&url=${encodeURIComponent(XIAOAI_PAGE)}` +
    `&presetData=${encodeURIComponent(presetData)}`
  );
}
