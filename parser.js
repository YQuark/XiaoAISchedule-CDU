function scheduleHtmlParser(html) {
  function stripTags(s) {
    return s ? String(s).replace(/<[^>]*>/g, "").trim() : "";
  }
  function toInt(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }
  function normalizeWeekStr(s) {
    if (!s) return "";
    return String(s).replace(/，/g, ",").replace(/\s+/g, "").replace(/周/g, "");
  }
  function expandWeeks(weekStr) {
    var res = [];
    if (!weekStr) return res;
    var odd = /单/.test(weekStr);
    var even = /双/.test(weekStr);
    var clean = weekStr.replace(/[()（）单双]/g, "");
    var parts = clean.split(",");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p) continue;
      if (p.indexOf("-") !== -1) {
        var ab = p.split("-");
        var a = Number(ab[0]), b = Number(ab[1]);
        if (isFinite(a) && isFinite(b) && a <= b) {
          for (var w = a; w <= b; w++) {
            if (odd && w % 2 === 0) continue;
            if (even && w % 2 === 1) continue;
            res.push(w);
          }
        }
      } else {
        var n = Number(p);
        if (isFinite(n)) {
          if (odd && n % 2 === 0) { }
          else if (even && n % 2 === 1) { }
          else res.push(n);
        }
      }
    }
    res.sort(function(a,b){return a-b;});
    var uniq = [];
    for (var j = 0; j < res.length; j++) {
      if (j === 0 || res[j] !== res[j-1]) uniq.push(res[j]);
    }
    return uniq;
  }

  var payload;
  try { payload = JSON.parse(html); } catch (e) { return []; }
  var arr = payload && payload.data;
  if (!arr || Object.prototype.toString.call(arr) !== "[object Array]") return [];

  var result = [];

  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var name = stripTags(it.kcmc);
    var teacher = stripTags(it.tmc);
    var position = stripTags(it.croommc || it.croombh || "");
    var day = toInt(it.xingqi);
    var sec = toInt(it.djc);
    var weeks = expandWeeks(normalizeWeekStr(String(it.zcstr || it.zc || "")));

    // 🚫 在这里加过滤逻辑
    if (name.includes("大学英语")) continue;

    if (!name || !day || !sec || !weeks.length) continue;

    result.push({
      name: name,
      position: position,
      teacher: teacher,
      day: day,
      sections: [sec],
      weeks: weeks
    });
  }

  return result;
}
