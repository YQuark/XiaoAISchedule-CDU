function scheduleHtmlProvider(iframeContent, frameContent, dom) {
    function pickHidden(d, id) {
        try {
            var el = d.getElementById(id);
            return el ? (el.value || el.textContent || "").replace(/^\s+|\s+$/g, "") : "";
        } catch (e) { return ""; }
    }
    function collectDocs(win, out) {
        out = out || [];
        try {
            if (win.document) out.push(win.document);
            var i, f;
            for (i = 0; i < win.frames.length; i++) {
                try {
                    f = win.frames[i];
                    if (f && f.location && f.document) collectDocs(f, out);
                } catch (e) {}
            }
        } catch (e) {}
        return out;
    }
    function xhrGetAbs(absUrl) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", absUrl, false);
        xhr.withCredentials = true;
        try { xhr.send(null); } catch (e) { throw e; }
        if (xhr.status !== 200) throw new Error("HTTP " + xhr.status);
        return xhr.responseText;
    }

    // ——— 1) 从当前页面或子 frame 抓 xnxq/xhid/xqdm ———
    var docs = collectDocs(window, []);
    var xnxq = "", xhid = "", xqdm = "";
    for (var i = 0; i < docs.length; i++) {
        xnxq = xnxq || pickHidden(docs[i], "xnxq");
        xhid = xhid || pickHidden(docs[i], "xhid");
        xqdm = xqdm || pickHidden(docs[i], "xqdm");
        if (xnxq && xhid && xqdm) break;
    }
    if (!xnxq || !xhid || !xqdm) {
        // 严格模式：拿不到就立即中断，不做兜底
        return "do not continue";
    }

    // ——— 2) 直接打教务课表接口 ———
    var qs = "xnxq=" + encodeURIComponent(xnxq)
        + "&xhid=" + encodeURIComponent(xhid)
        + "&xqdm=" + encodeURIComponent(xqdm)
        + "&zdzc=&zxzc=&xskbxslx=0";
    var url = "https://szjw.cdu.edu.cn/admin/pkgl/xskb/sdpkkbList?" + qs;

    var txt = xhrGetAbs(url);
    var json;
    try { json = JSON.parse(txt); } catch (e) { return "do not continue"; }
    if (!json || !json.data || Object.prototype.toString.call(json.data) !== "[object Array]") {
        return "do not continue";
    }

    // Provider必须返回字符串：只返回 data 数组串
    return JSON.stringify({
        data: json.data,
        meta: { xnxq: xnxq, xqid: xqdm }   // Timer 用
    });
}
