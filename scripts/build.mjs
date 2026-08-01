import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
);
const outputFile = join(root, "xiaoai-schedule-cdu.user.js");
const rawUrl =
  "https://raw.githubusercontent.com/Yaoser-x/XiaoAISchedule-CDU/master/xiaoai-schedule-cdu.user.js";

function metadata(version) {
  return `// ==UserScript==
// @name         成都大学课表一键导入小爱课程表
// @namespace    https://github.com/Yaoser-x/XiaoAISchedule-CDU
// @version      ${version}
// @description  选择成都大学教务系统学期，预览并导入小爱课程表
// @author       Yaoser-x
// @homepageURL  https://github.com/Yaoser-x/XiaoAISchedule-CDU
// @supportURL   https://github.com/Yaoser-x/XiaoAISchedule-CDU/issues
// @updateURL    ${rawUrl}
// @downloadURL  ${rawUrl}
// @match        https://szjw.cdu.edu.cn/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==`;
}

async function compile(outfile) {
  await build({
    entryPoints: [join(root, "src", "main.js")],
    outfile,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    charset: "utf8",
    legalComments: "none",
    minify: false,
    sourcemap: false,
    banner: { js: metadata(packageJson.version) },
  });
}

if (process.argv.includes("--check")) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "xiaoai-cdu-"));
  const temporaryOutput = join(temporaryDirectory, "userscript.js");
  try {
    await compile(temporaryOutput);
    const [expected, actual] = await Promise.all([
      readFile(outputFile, "utf8"),
      readFile(temporaryOutput, "utf8"),
    ]);
    if (expected !== actual) {
      throw new Error(
        "xiaoai-schedule-cdu.user.js 与源码不一致，请运行 npm run build",
      );
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
} else {
  await compile(outputFile);
}
