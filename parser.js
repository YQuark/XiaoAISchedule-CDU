function scheduleHtmlParser(html) {
    function stripTags(s) {
        if (!s) return "";
        return String(s).replace(/<[^>]*>/g, "").replace(/^\s+|\s+$/g, "");
    }
    function toInt(v) {
        var n = Number(v);
        return isFinite(n) && Math.floor(n) === n ? n : 0;
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
                    if (odd && n % 2 === 0) { /* skip */ }
                    else if (even && n % 2 === 1) { /* skip */ }
                    else res.push(n);
                }
            }
        }
        // 去重+排序（ES5）
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

    // 按课程维度合并：name|teacher|position|day|zcstr -> sections[]
    var bucket = {}; // key -> [section,...]
    for (var i = 0; i < arr.length; i++) {
        var it = arr[i] || {};
        var name = stripTags(it.kcmc);
        var teacher = stripTags(it.tmc);
        // 先用原始教室号 croommc，缺了再回退 croombh
        var position = stripTags(it.croommc || it.croombh || "");
        var day = toInt(it.xingqi);
        var sec = toInt(it.djc);
        var zcStr = normalizeWeekStr(String(it.zcstr || it.zc || ""));
        if (!name || !day || !sec || !zcStr) continue;

        var key = name + "|" + teacher + "|" + position + "|" + day + "|" + zcStr;
        if (!bucket[key]) bucket[key] = [];
        bucket[key].push(sec);
    }

    var out = [];
    for (var key in bucket) {
        if (!bucket.hasOwnProperty(key)) continue;
        var parts = key.split("|");
        var name = parts[0], teacher = parts[1], position = parts[2], day = Number(parts[3]), zcStr = parts[4];

        // 去重排序节次
        var secs = bucket[key].slice(0).sort(function(a,b){return a-b;});
        var uniqSecs = [];
        for (var s = 0; s < secs.length; s++) {
            if (s === 0 || secs[s] !== secs[s-1]) uniqSecs.push(secs[s]);
        }

        var weeks = expandWeeks(zcStr);
        if (weeks.length && uniqSecs.length) {
            out.push({
                name: name,
                position: position,
                teacher: teacher,
                weeks: weeks,
                day: day,
                sections: uniqSecs
            });
        }
    }
    return out;
}
