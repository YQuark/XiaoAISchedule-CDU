function scheduleTimer(opts) {
    function xhrGetAbs(absUrl) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", absUrl, false);
        xhr.withCredentials = true;
        try { xhr.send(null); } catch (e) { throw e; }
        if (xhr.status !== 200) throw new Error("HTTP " + xhr.status);
        return xhr.responseText;
    }
    function pad2(n){ return (n<10?'0':'') + n; }
    function toTs(dstr){ return String(new Date(dstr.replace(/-/g,'/') + " 00:00:00").getTime()); }

    var xnxq = "", xqid = "";
    try {
        var p = JSON.parse(opts && opts.providerRes || "{}");
        xnxq = p.meta && p.meta.xnxq || "";
        xqid = p.meta && p.meta.xqid || "";
    } catch (e) {}

    if (!xnxq || !xqid) {
        return {};
    }

    // 打教务“节次时间与周次”接口
    var url = "https://szjw.cdu.edu.cn/admin/api/getZclistByXnxq?xnxq="
        + encodeURIComponent(xnxq)
        + "&role=&userId=&xqid="
        + encodeURIComponent(xqid);
    var txt = xhrGetAbs(url);
    var json;
    try { json = JSON.parse(txt); } catch (e) { return {}; }
    if (!json || json.ret !== 0 || !json.data) return {};

    var data = json.data || {};
    var jcs = data.jcsjszList || [];
    var zclist = data.zclist || [];
    var jsxq = data.jsxq || {};

    // 计算 sections/上午下午晚上数量（sjd: sw/xw/ws）
    var sections = [];
    var forenoon = 0, afternoon = 0, night = 0;
    for (var i = 0; i < jcs.length; i++) {
        var t = jcs[i];
        sections.push({
            section: Number(t.jc),
            startTime: t.kssj,
            endTime: t.jssj
        });
        if (t.sjd === "sw") forenoon++;
        else if (t.sjd === "xw") afternoon++;
        else if (t.sjd === "ws" || t.sjd === "bw") night++;
    }
    // 排序一下节次
    sections.sort(function(a,b){ return a.section - b.section; });

    // 总周数与开学时间
    var totalWeek = Number(jsxq.pkzdzc) || zclist.length || 0;

    // 开学周一：用 zclist 里 zc 为 "1" 的 minrq
    var startSemester = "";
    for (var k = 0; k < zclist.length; k++) {
        if (String(zclist[k].zc) === "1" && zclist[k].minrq) {
            // minrq 形如 "2025-09-08 00:00:00"
            startSemester = toTs(zclist[k].minrq.split(" ")[0]);
            break;
        }
    }
    if (!startSemester) return {}; // 拿不到就不返回配置，严格

    return {
        totalWeek: totalWeek,            // 如 18
        startSemester: startSemester,    // "1757260800000"
        startWithSunday: false,
        showWeekend: true,
        forenoon: forenoon,
        afternoon: afternoon,
        night: night,
        sections: sections
    };
}
