import test from "node:test";
import assert from "node:assert/strict";
import {
  looksLikeHtml,
  looksLikeLoginHtml,
  requestJson,
  requestText,
} from "../src/api/cdu-client.js";

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, text: async () => body };
}

test("区分普通课表 HTML、登录页与 JSON", () => {
  assert.equal(looksLikeHtml("<!doctype html><html><body>课表</body></html>"), true);
  assert.equal(looksLikeLoginHtml("<html>统一身份认证</html>"), true);
  assert.equal(looksLikeHtml('{"data":[]}'), false);
});

test("JSON 请求拒绝登录页和无效响应", async () => {
  await assert.rejects(
    requestJson("https://szjw.cdu.edu.cn/api", async () => response("<html>统一身份认证</html>")),
    /重新登录/,
  );
  await assert.rejects(
    requestJson("https://szjw.cdu.edu.cn/api", async () => response("not json")),
    /有效 JSON/,
  );
  assert.deepEqual(
    await requestJson("https://szjw.cdu.edu.cn/api", async () => response('{"ret":0}')),
    { ret: 0 },
  );
});

test("文本请求保留 HTTP 错误，不输出响应正文", async () => {
  await assert.rejects(
    requestText("https://szjw.cdu.edu.cn/api", async () => response("secret", { ok: false, status: 403 })),
    /HTTP 403/,
  );
});
