# CDU Schedule Extension

从成都大学教务系统抓取课表数据，转换为第三方课表工具可用的格式。  
包含 **数据提供 (provider)**、**解析 (parser)**、**时间配置 (timer)** 三部分。

## 文件说明

- `provider.js`：
    - 从页面 DOM 或子 frame 获取学期参数（`xnxq`、`xhid`、`xqdm`）。
    - 调用教务系统接口 `sdpkkbList` 获取课表 JSON。
    - 返回 `{data: [...], meta: {...}}` 字符串，用于后续解析/计时。

- `parser.js`：
    - 输入：`provider.js` 返回的 JSON。
    - 输出：课程数组，每项包含：
        - `name`：课程名
        - `teacher`：教师名
        - `position`：教室
        - `weeks`：上课周次数组
        - `day`：周几（1-7）
        - `sections`：节次数组
    - 自动处理单双周、区间合并、节次排序去重。

- `timer.js`：
    - 输入：`provider.js` 的 `meta` 信息。
    - 调用接口 `getZclistByXnxq` 获取周次/节次时间。
    - 输出配置：
        - `totalWeek`：总周数
        - `startSemester`：开学时间戳
        - `sections`：节次时间段（含开始/结束时间）
        - `forenoon` / `afternoon` / `night` 节次数量

## 依赖环境

- 浏览器运行环境（脚本需访问教务系统接口）。
- 支持 ES5/ES6 的 JavaScript 解释器。

## 使用方式

1. 在课表工具中加载 `provider.js` → 获取原始 JSON 数据。
2. 使用 `parser.js` → 转换为标准课表对象数组。
3. 使用 `timer.js` → 获取学期起始时间、节次安排。
4. 将三部分结果交由课表应用渲染即可。

## 返回示例

课程对象示例：

```json
{
  "name": "高等数学",
  "position": "教学楼101",
  "teacher": "张三",
  "weeks": [1,2,3,4,5,6,7,8],
  "day": 1,
  "sections": [1,2]
}
```

时间配置示例：

```json
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
```
