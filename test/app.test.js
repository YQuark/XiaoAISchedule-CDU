import test from "node:test";
import assert from "node:assert/strict";
import { createImportRunner } from "../src/app.js";

test("导入运行期间忽略重复执行", async () => {
  let contextReads = 0;
  let releaseContext;
  const contextPromise = new Promise((resolve) => {
    releaseContext = resolve;
  });
  const ui = {
    setBusy() {},
    setIdle() {},
    selectSemester: async () => null,
    showError: async () => {},
  };
  const run = createImportRunner({
    ui,
    readScheduleContext: async () => {
      contextReads += 1;
      return contextPromise;
    },
  });

  const first = run();
  await run();
  assert.equal(contextReads, 1);
  releaseContext({ semesters: [], currentSemester: "" });
  await first;
});
