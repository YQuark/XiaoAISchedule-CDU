# CDU 小爱课表抓取适配器

本仓库包含三部分脚本，用于从成都大学（CDU）教务系统抓取并转换课表数据，便于第三方课表应用加载：

- `provider.js`：负责从页面或子 frame 提取学期参数并调用教务系统接口获取原始课表 JSON；返回字符串化的 `{ data: [...], meta: {...} }`。meta 中包含供 `timer.js` 使用的学期标识。
- `parser.js`：将 `provider.js` 的 data 数组解析为标准课程对象数组（课程名、教师、教室、星期、节次、周次等），并处理单双周、区间展开与去重。
- `timer.js`：使用 `provider` 返回的 `meta`（学期 id/xnxq 等）调用教务系统的周次与节次时间接口，生成可被课表应用消费的学期时间配置。

以下文档说明各文件的契约、使用方法、示例输出与注意事项，方便集成到第三方工具中。

## 文件说明

- `provider.js`
  - 输入：在浏览器环境中直接运行，脚本会从当前 window/document（及其 frames）查找隐藏字段 `xnxq`、`xhid`、`xqdm`。
  - 行为：构造查询参数并同步 GET `https://szjw.cdu.edu.cn/admin/pkgl/xskb/sdpkkbList`，返回 JSON 的 `data` 数组。
  - 输出：字符串（JSON.stringify）形式的对象：{ data: [...], meta: { xnxq, xqid } }。若无法获取关键参数或接口异常，返回字符串 "do not continue"。

- `parser.js`
  - 输入：`provider.js` 返回的字符串（即包含 data 数组 的 JSON 字符串）。
  - 行为：解析为数组后，对每条记录进行字段清洗与映射：
    - name（课程名）、teacher（教师名）、position（教室/教室编号）、day（星期 1-7）、sections（节次数组）、weeks（周数组）。
    - 支持周次字符串（含区间 `1-8`、逗号分隔、单双周标识）展开为数字数组。
    - 会过滤掉特定课程名（示例中排除了含 “大学英语” 的课程），并忽略不完整记录。
  - 输出：JavaScript 数组，每项形如：{ name, teacher, position, day, sections: [...], weeks: [...] }

- `timer.js`
  - 输入：从 `provider` 返回字符串中解析出的 `meta`（至少需包含学期标识 `xnxq` 与 `xqid`/`xqdm`）。
  - 行为：调用同步接口 `https://szjw.cdu.edu.cn/admin/api/getZclistByXnxq?xnxq=...&xqid=...` 获取周次列表、节次时间与学期元信息，计算开学周一时间戳、上午/下午/晚上节次数量等。
  - 输出：一个对象，包含：
    - totalWeek（总周数）
    - startSemester（开学周一的时间戳字符串）
    - startWithSunday（是否以周日为周起始）
    - showWeekend（是否显示周末）
    - forenoon / afternoon / night（对应时段内的节次数量）
    - sections（节次数组，含 section、startTime、endTime）

## 快速使用（浏览器环境）

1. 在成都大学教务系统的课表页面打开控制台（或在扩展中注入脚本）。
2. 运行 `provider.js`：该脚本会返回字符串 (或在扩展中作为 provider 返回值)。示例：

   - 成功时：返回 JSON 字符串：
     {
       "data": [ ... ],
       "meta": { "xnxq": "2025-2026-1", "xqid": "0101" }
     }
   - 失败时：返回字符串 "do not continue"（表示缺少必要页面参数或接口异常）。

3. 将 `provider` 的结果传入 `parser.js`：
   - 调用 `scheduleHtmlParser(providerResult)`（其中 providerResult 是字符串）。
   - 返回值为课程数组，每项示例：

     { "name": "高等数学", "position": "教学楼101", "teacher": "张三", "weeks": [1,2,3,4,5], "day": 1, "sections": [1,2] }

4. 将 `provider` 的 meta 传给 `timer.js`（脚本内部已实现从 meta 读取）：调用 `scheduleTimer({ providerRes: providerResult })`。
   - 返回值为时间配置对象（见下方示例）。

## 示例输出

课程对象示例：

{
  "name": "高等数学",
  "position": "教学楼101",
  "teacher": "张三",
  "weeks": [1,2,3,4,5,6,7,8],
  "day": 1,
  "sections": [1,2]
}

时间配置示例：

{
  "totalWeek": 18,
  "startSemester": "1757260800000",
  "startWithSunday": false,
  "showWeekend": true,
  "forenoon": 4,
  "afternoon": 4,
  "night": 2,
  "sections": [
    {"section": 1, "startTime": "08:00", "endTime": "08:45"},
    {"section": 2, "startTime": "08:55", "endTime": "09:40"}
  ]
}

## 输入/输出

- Provider 输入：运行时在教务页面环境下，无需外部参数（从 DOM 读取）。输出：JSON 字符串或 "do not continue"。
- Parser 输入：provider 返回的字符串。输出：课程对象数组（详见示例）。
- Timer 输入：provider 返回的字符串（利用 meta 字段）。输出：学期时间配置对象。

错误模式与边界情况：

- 若页面无法提供 `xnxq`/`xhid`/`xqdm`，`provider.js` 返回 "do not continue"。集成方应检测并中止后续处理。
- `parser.js` 对不完整或不可解析的记录会跳过（例如缺少星期/节次/周次时忽略）。
- `timer.js` 若无法从接口拿到数据，会返回空对象 {}（调用方应判空）。

## 集成与验证建议

- 在集成到扩展或第三方工具时，请在浏览器控制台或扩展容器内同步调用 provider（示例代码中使用同步 XHR）。若你需要异步实现，请将同步 XHR 替换为 fetch/异步 XHR 并相应修改调用链。
- 最小验证步骤：
  1. 在教务系统课表页运行 `provider.js`，确认返回含 `data` 与 `meta` 的字符串。
  2. 将结果传给 `scheduleHtmlParser`，检查是否得到合理数量的课程对象。
  3. 将相同 provider 输出传给 `scheduleTimer`，确认得到 `startSemester` 与 `sections` 等字段。

## 参考

- `parser.js` 中有一条用于示例的课程过滤（过滤 “大学英语”），可根据需要调整或暴露为配置项。

