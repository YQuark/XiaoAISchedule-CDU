import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const userscript = await readFile(
  resolve(root, "xiaoai-schedule-cdu.user.js"),
  "utf8",
);
const readme = await readFile(resolve(root, "README.md"), "utf8");

const requiredLines = [
  `// @version      ${packageJson.version}`,
  "// @match        https://szjw.cdu.edu.cn/*",
  "// @grant        none",
  "// @noframes",
];

for (const line of requiredLines) {
  if (!userscript.includes(line)) {
    throw new Error(`构建产物缺少元数据：${line}`);
  }
}

if (!readme.includes(`v${packageJson.version}`)) {
  throw new Error("README 未声明当前正式版本");
}

if (userscript.includes("@version      5.0.0")) {
  throw new Error("构建产物仍包含原型版本号 5.0.0");
}
