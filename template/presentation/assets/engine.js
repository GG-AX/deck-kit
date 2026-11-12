/* deck-kit engine v1.8 (2026-11-12) — classic script, works from file://. Fixed: decks never edit it; change it only in deck-kit and raise the version (README). */
(function () {
  "use strict";
  var VERSION = "1.8";
  var D = window.DECK_DATA || { notes: {}, bestsellers: {}, portfolio: {} };
  var NORM = window.NORM || {};      // original image -> normalized (same-size figure, unified background)
  var CUT = window.CUT || {};        // original image -> [transparent cut-out, w, h]
  var MOTION = window.MOTION || {};  // image (or "block:<slide>:<n>") -> motion clip

  /* ---------- theme tokens (engine.css :root, overridable in deck.css) ---------- */
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function tokenRGB(name) {   // a color token as [r,g,b] in 0..1, whatever CSS color syntax it is written in
    var x = document.createElement("canvas").getContext("2d");
    x.fillStyle = "#000"; x.fillStyle = css(name) || "#000";
    var s = x.fillStyle, n = s.charAt(0) === "#" ? [1, 3, 5].map(function (i) { return parseInt(s.substr(i, 2), 16); }) : s.match(/[\d.]+/g).slice(0, 3).map(Number);
    return n.map(function (v) { return v / 255; });
  }
  function tone(k) { return "var(--tone-" + Math.min(9, k + 1) + ")"; }   // chart tones, darkest first

  /* ---------- background shader (monotone ribbons; colors = --bg-deep/-mid/-ribbon/-glow) ---------- */
  var VERT = "attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.0,1.0);}";
  var FRAG = "precision highp float;varying vec2 vUv;uniform float uTime;uniform vec2 uRes;" +
    "uniform vec3 MAIN;uniform vec3 LIGHTSUB;uniform vec3 DEEPSUB;uniform vec3 NAVYDARK;" +
    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}" +
    "float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);float a=hash(i);float b=hash(i+vec2(1.,0.));float c=hash(i+vec2(0.,1.));float d=hash(i+vec2(1.,1.));vec2 u=f*f*(3.-2.*f);return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;}" +
    "float fbm(vec2 p){float v=0.;float a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.;a*=0.5;}return v;}" +
    "void main(){vec2 uv=vUv;vec2 p=uv;p.x*=uRes.x/uRes.y;float t=uTime*0.05;" +
    "vec2 q=vec2(fbm(p+vec2(t,-t*0.7)),fbm(p+vec2(-t*0.5,t*0.9)+3.7));" +
    "vec2 r=vec2(fbm(p+q*1.8+vec2(1.7+t*0.3,9.2)),fbm(p+q*1.8+vec2(8.3-t*0.4,2.8)));" +
    "float f=fbm(p+r*1.5+vec2(t*0.4,-t*0.2));float ribbon=0.5+0.5*sin(p.y*3.+r.x*4.+uTime*0.25);ribbon=pow(ribbon,3.);" +
    "vec3 col=mix(NAVYDARK,DEEPSUB,smoothstep(0.2,0.8,f));col=mix(col,MAIN,ribbon*0.40*smoothstep(0.3,0.9,f));col=mix(col,LIGHTSUB,ribbon*0.12*pow(f,2.));" +
    "float vig=smoothstep(1.25,0.25,length(uv-0.5));col*=mix(0.5,1.0,vig);gl_FragColor=vec4(col,1.0);}";
  function shader(c) {
    if (!c) return;
    var gl = c.getContext("webgl", { antialias: false });
    if (!gl) { c.style.background = "linear-gradient(150deg,var(--bg-deep),var(--bg-mid))"; return; }
    function cs(t, s) { var sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; }
    var pr = gl.createProgram();
    gl.attachShader(pr, cs(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, cs(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr); gl.useProgram(pr);
    [["MAIN", "--bg-ribbon"], ["LIGHTSUB", "--bg-glow"], ["DEEPSUB", "--bg-mid"], ["NAVYDARK", "--bg-deep"]].forEach(function (u) {
      gl.uniform3fv(gl.getUniformLocation(pr, u[0]), tokenRGB(u[1]));
    });
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(pr, "aPos"); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    var uT = gl.getUniformLocation(pr, "uTime"), uR = gl.getUniformLocation(pr, "uRes"), t0s = performance.now(), last = 0;
    // Performance (frame drops on a laptop + big screen, 10/06): the background is a soft gradient, so it is
    // drawn at half the CSS resolution (stretched by CSS), at most 30 times a second, and not at all while
    // a video plays or a report is open — the canvas simply keeps its last frame.
    (function tick(now) {
      requestAnimationFrame(tick);
      if (document.hidden || bgPaused() || now - last < 33) return;
      last = now;
      var w = innerWidth * 0.5 | 0, h = innerHeight * 0.5 | 0;
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, c.width, c.height); gl.uniform2f(uR, c.width, c.height);
      gl.uniform1f(uT, STATIC ? 20 : (performance.now() - t0s) / 1000); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    })(0);
  }
  function bgPaused() {
    if (document.getElementById("overlay") && document.getElementById("overlay").classList.contains("open")) return true;
    var s = slides && slides[idx];
    if (!s) return false;
    var v = s.querySelectorAll("video");
    for (var i = 0; i < v.length; i++) if (!v[i].paused) return true;
    return false;
  }

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function media(src) {
    var shown = NORM[src] || src, m = MOTION[src];
    if (m && !STATIC) return '<video src="' + m + '" poster="' + shown + '" muted loop playsinline preload="none"></video>';
    return '<img src="' + shown + '" alt="" loading="lazy">';
  }
  // resolves once the web fonts the laid-out text needs are loaded (parts that measure their box wait for it)
  function fontsReady() { void document.body.offsetHeight; return document.fonts ? document.fonts.ready : Promise.resolve(); }
  // draw every host of one part; a broken one is reported in the console and skipped instead of blanking the deck
  function each(selector, draw) {
    document.querySelectorAll(selector).forEach(function (host) {
      try { draw(host); } catch (e) { console.error("deck-kit: could not draw " + selector, host, e); }
    });
  }

  /* ---------- product cards: <div class="bs-grid" data-bs="NAME"></div> + data.js
     DECK_DATA.bestsellers.NAME = {lines:4, cards:[{img, logo, retailer, season, style, spec:["FIRST LINE","more"], qty:["38,000 PCS"], alts:[img…]}]}
     (only img is required; norm.js may swap the image, motion.js turns it into a looping clip).
     No logo → the retailer name as text. style = style number line. lines = spec lines shown (default 4; the
     info box grows with it, the same for every card of the grid) ---------- */
  function specHtml(spec) { return spec.length ? "<b>" + esc(spec[0]) + "</b>" + esc(spec.slice(1).join(" ")) : ""; }
  function qtyHtml(q) {   // "38,000 PCS" → number + small unit; "TOP: 12,000 PCS" → small label in front
    return q.map(function (t) {
      var m = /^(?:([^:]{1,12}?)\s*:\s*)?(.+?)(?:\s+([^\s\d]\S*))?$/.exec(String(t).trim());
      var num = esc(m[2]) + (m[3] ? "<small>" + esc(m[3]) + "</small>" : "");
      return m[1] ? "<div><small>" + esc(m[1]) + "</small> " + num + "</div>" : num;
    }).join("");
  }
  function renderBestSellers() {
    each("[data-bs]", function (host) {
      var d = D.bestsellers[host.getAttribute("data-bs")]; if (!d) return;
      var anyAlts = d.cards.some(function (c) { return c.alts && c.alts.length; });
      var anyStyle = d.cards.some(function (c) { return c.style; }), lines = d.lines || 4;
      host.style.setProperty("--lines", lines);
      host.style.setProperty("--meta", 130 + (lines - 4) * 16 + (anyStyle ? 18 : 0) + (anyAlts ? 72 : 0) + "px");
      host.innerHTML = "";
      d.cards.forEach(function (c, k) {
        var card = el("div", "bs-card reveal" + (anyAlts ? " has-alts" : "")), qty = c.qty || [];
        card.style.setProperty("--i", k + 1);
        var alts = anyAlts ? '<div class="alts">' + (c.alts || []).map(function (a) { return '<img src="' + (NORM[a] || a) + '" alt="">'; }).join("") + "</div>" : "";
        card.innerHTML = '<div class="media">' + media(c.img) + "</div>" +
          '<div class="meta">' + alts.replace('class="alts"', 'class="alts" style="padding:0 0 8px;height:' + (anyAlts ? 72 : 0) + 'px"') +
          '<div class="row1">' + (c.logo ? '<img src="' + c.logo + '" alt="' + esc(c.retailer || "") + '">' : '<span class="brand">' + esc(c.retailer || "") + "</span>") +
          '<span class="season">' + esc(c.season || "") + "</span></div>" +
          (anyStyle ? '<div class="style">' + esc(c.style || "") + "</div>" : "") +
          '<div class="spec">' + specHtml(c.spec || []) + "</div>" +
          '<div class="qty' + (qty.length > 1 ? " two" : "") + '">' + qtyHtml(qty) + "</div></div>";
        host.appendChild(card);
      });
    });
  }

  /* ---------- bars: <div class="vbars" data-bars='[["2023",300],["2027 (F)",340,"fc2"]]'></div>
     each row = [label, value, highlight "fc"|"fc2" (optional), shown text (optional)];
     the tallest bar is 85% of the chart; the x-axis labels go right under the chart ---------- */
  function renderBars() {
    each("[data-bars]", function (host) {
      var rows = JSON.parse(host.getAttribute("data-bars")), max = Math.max.apply(null, rows.map(function (r) { return r[1]; })) || 1;
      host.insertAdjacentHTML("beforeend", rows.map(function (r, k) {
        return '<div class="b' + (r[2] ? " " + r[2] : "") + '" style="--d:' + k + '"><div class="v">' + esc(r[3] != null ? r[3] : r[1].toLocaleString("en-US")) +
          '</div><div class="bar" style="--h:' + r[1] * 85 / max + '%"></div></div>';
      }).join(""));
      host.insertAdjacentHTML("afterend", '<div class="vbars-x">' + rows.map(function (r) { return "<span>" + esc(r[0]) + "</span>"; }).join("") + "</div>");
    });
    // trend arrow: its stroke is non-scaling, so the dash that draws it is measured in screen px along the stretched path
    each(".vbars .trend path", function (p) {
      var m = p.getCTM(), L = p.getTotalLength(), len = 0, prev = null;
      if (!m || !L) return;
      for (var i = 0; i <= 40; i++) {
        var q = p.getPointAtLength(L * i / 40), x = m.a * q.x + m.c * q.y, y = m.b * q.x + m.d * q.y;
        if (prev) len += Math.sqrt((x - prev[0]) * (x - prev[0]) + (y - prev[1]) * (y - prev[1]));
        prev = [x, y];
      }
      p.style.setProperty("--len", Math.ceil(len) + 2);
    });
  }

  function legend(series, color, cls) {
    return '<div class="legend' + (cls ? " " + cls : "") + '">' + series.map(function (s, k) {
      return '<span style="--c:' + color(k) + '"><i></i>' + esc(s[0]) + "</span>";
    }).join("") + "</div>";
  }

  /* ---------- line chart: <div class="lc" data-line='{"x":["1월","2월",…],"series":[["올해",[12,15,…]],["작년",[10,11,…]]]}'></div>
     y starts at 0 and the highest point sits at 85%; a dot on every point, each line's last value at its end ---------- */
  function renderLines() {
    each("[data-line]", function (host) {
      var o = JSON.parse(host.getAttribute("data-line")), n = o.x.length, PAD = 4;
      var lasts = o.series.map(function (s) { return s[1][s[1].length - 1]; }), hi = Math.max.apply(null, lasts);
      var top = Math.max.apply(null, o.series.map(function (s) { return Math.max.apply(null, s[1]); })) / 0.85 || 1;
      function color(k) { return tone([0, 4, 2, 6][k % 4]); }
      function X(i) { return (PAD + (n > 1 ? i / (n - 1) : 0.5) * (100 - 2 * PAD)).toFixed(2); }
      function Y(v) { return (100 - v / top * 100).toFixed(2); }
      var html = legend(o.series, color) + '<div class="lc-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none">' + o.series.map(function (s, k) {
        return '<polyline class="lc-line" style="--c:' + color(k) + '" points="' + s[1].map(function (v, i) { return X(i) + "," + Y(v); }).join(" ") + '"/>';
      }).join("") + "</svg>";
      o.series.forEach(function (s, k) {
        s[1].forEach(function (v, i) { html += '<i class="lc-dot" style="--c:' + color(k) + ";left:" + X(i) + "%;top:" + Y(v) + "%;--d:" + i + '"></i>'; });
        var i = s[1].length - 1;
        html += '<b class="lc-end' + (lasts[k] < hi ? " lo" : "") + '" style="left:' + X(i) + "%;top:" + Y(s[1][i]) + "%;--d:" + i + '">' + esc(s[1][i].toLocaleString("en-US")) + "</b>";
      });
      host.innerHTML = html + '</div><div class="lc-x">' + o.x.map(function (t, i) { return '<span style="left:' + X(i) + '%">' + esc(t) + "</span>"; }).join("") + "</div>";
    });
  }

  /* ---------- stacked bars: <div class="stack" data-stack='{"x":["2024",…],"series":[["오프라인",[120,…]],["온라인",[60,…]]],"labels":true}'></div>
     first series at the bottom, darkest; the tallest column is 85%; each column's total on top.
     "labels":true → every piece gets "name (share%)" instead of a legend: inside on two lines or one line when it fits,
     otherwise beside the bar (pushed apart so they never overlap; on the left when the right side would leave the chart) ---------- */
  function renderStacks() {
    each("[data-stack]", function (host) {
      var o = JSON.parse(host.getAttribute("data-stack")), ns = o.series.length;
      var tot = o.x.map(function (_, i) { return o.series.reduce(function (sum, s) { return sum + (s[1][i] || 0); }, 0); });
      var max = Math.max.apply(null, tot) || 1;
      function shade(k) { return ns > 1 ? Math.round(k * 6 / (ns - 1)) : 0; }
      function color(k) { return tone(shade(k)); }
      host.classList.toggle("labeled", !!o.labels);
      host.innerHTML = (o.labels ? "" : legend(o.series, color, "sq")) + '<div class="stack-cols">' + o.x.map(function (_, i) {
        return '<div class="col" style="--d:' + i + '"><div class="tot">' + esc(tot[i].toLocaleString("en-US")) + '</div><div class="bars" style="--h:' + tot[i] * 85 / max + '%">' +
          o.series.map(function (s, k) { return '<i style="--c:' + color(k) + ";flex:" + (s[1][i] || 0) + '"></i>'; }).join("") + "</div></div>";
      }).join("") + '</div><div class="vbars-x">' + o.x.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>";
      if (o.labels) fontsReady().then(function () { stackLabels(host, o, tot, shade); });
    });
  }
  // Positions are stage px from layout (offset*), so the deck scale and the grow animation do not disturb them.
  // A label beside a bar must end before the next bar (or the chart's right edge): when one does not fit even on two lines,
  // the bars get narrower (between columns) or the chart gets right padding (last column), and the labels are placed again.
  function stackLabels(host, o, tot, shade) {
    var plot = host.querySelector(".stack-cols"), xs = host.querySelector(".vbars-x"), pad = 0;   // offsets are relative to host / col (both positioned)
    var cols = [].slice.call(plot.children), bars = cols.map(function (c) { return c.querySelector(".bars"); });
    for (var pass = 0; pass < 4; pass++) {
      host.querySelectorAll(".sl").forEach(function (e) { e.remove(); });
      var over = 0, right = 0;
      cols.forEach(function (col, i) {
        var b = bars[i], bw = b.offsetWidth, bh = b.offsetHeight, bl = b.offsetLeft, base = b.offsetTop + bh, acc = 0, outs = [];
        var room = i < cols.length - 1 ? cols[i + 1].offsetLeft + bars[i + 1].offsetLeft - col.offsetLeft - bl - bw - 12
                                       : host.clientWidth - col.offsetLeft - bl - bw - 8;
        o.series.forEach(function (s, k) {
          var v = s[1][i] || 0; if (!v) return;
          var h = bh * v / tot[i], mid = base - acc - h / 2, name = esc(s[0]), pct = Math.round(v / tot[i] * 100) + "%";
          acc += h;
          var lab = el("span", "sl", name + " (" + pct + ")");
          col.appendChild(lab);
          var one = lab.offsetWidth;
          lab.innerHTML = name + "<br>(" + pct + ")";
          var two = lab.offsetWidth, th = lab.offsetHeight;
          if (h >= th + 4 && two <= bw - 8) lab.className = "sl in";
          else if (h >= 15 && one <= bw - 8) { lab.className = "sl in"; lab.innerHTML = name + " (" + pct + ")"; }
          else {
            lab.className = "sl out";
            if (one <= room) lab.innerHTML = name + " (" + pct + ")";
            else if (i < cols.length - 1) over = Math.max(over, two - room); else right = Math.max(right, two - room);
            outs.push({ e: lab, y: mid, h: lab.offsetHeight });
            return;
          }
          if (shade(k) <= 4) lab.classList.add("inv");              // light text on the dark tones
          lab.style.left = bl + bw / 2 + "px"; lab.style.top = mid + "px";
        });
        outs.sort(function (a, b) { return a.y - b.y; });           // beside the bar: push apart, keep within the bar's height
        outs.forEach(function (p, k) { if (k) p.y = Math.max(p.y, outs[k - 1].y + (outs[k - 1].h + p.h) / 2 + 1); });
        for (var k = outs.length - 1; k >= 0; k--) {
          var lim = k < outs.length - 1 ? outs[k + 1].y - (outs[k + 1].h + outs[k].h) / 2 - 1 : base;
          outs[k].y = Math.min(outs[k].y, lim);
        }
        outs.forEach(function (p) { p.e.style.left = bl + bw + 6 + "px"; p.e.style.top = p.y + "px"; });
      });
      if (!over && !right) break;
      if (over) bars.forEach(function (b) { b.style.width = Math.max(24, b.offsetWidth - Math.ceil(over)) + "px"; });
      if (right) { pad += Math.ceil(right); plot.style.paddingRight = xs.style.paddingRight = 6 + pad + "px"; }
    }
  }

  /* ---------- logos sized by visible area: <div class="logo-grid4" data-logo-area="3600"> … <img> …
     every <img> inside gets width × height ≈ the area (stage px²), so wide and compact marks look the same weight.
     data-logo-max="190,64" caps width,height (default: 85% × 60% of the image's parent box); trim the margins off logo files first.
     <img data-optical="0.8"> scales one logo's area when it still looks too heavy or light ---------- */
  function renderLogoAreas() {
    each("[data-logo-area]", function (host) {
      var area = parseFloat(host.getAttribute("data-logo-area")), cap = (host.getAttribute("data-logo-max") || "").split(",").map(parseFloat);
      host.querySelectorAll("img").forEach(function (img) {
        function size() {
          if (!img.naturalWidth) return;
          var r = img.naturalWidth / img.naturalHeight, box = img.parentElement;
          var mw = cap[0] || box.clientWidth * 0.85, mh = cap[1] || box.clientHeight * 0.6;
          var h = Math.min(Math.sqrt(area * (parseFloat(img.getAttribute("data-optical")) || 1) / r), mh, mw / r);
          img.style.cssText += ";max-width:none;max-height:none;width:" + (h * r).toFixed(1) + "px;height:" + h.toFixed(1) + "px";
        }
        if (img.complete) size(); else img.addEventListener("load", size);
      });
    });
  }

  /* ---------- portfolio collage ----------
     data-collage='[{"g":0,"x":0,"y":0,"w":400,"h":300,"rows":1,"ov":0.18,"bg":"sage","label":"Tops"}]'
     Figures stand on a common baseline and overlap like a lookbook line-up. */
  function renderCollage() {
    each("[data-collage]", function (host) {
      var n = host.getAttribute("data-pf"), groups = D.portfolio[n]; if (!groups) return;
      // panel coordinates are authored for a 1192×578 box; scale to the actual collage box
      var sx = (host.clientWidth || 1192) / 1192, sy = (host.clientHeight || 578) / 578;
      var panels = JSON.parse(host.getAttribute("data-collage")).map(function (p) {
        var q = {}; for (var key in p) q[key] = p[key];
        q.x = p.x * sx; q.y = p.y * sy; q.w = p.w * sx; q.h = p.h * sy; return q;
      });
      host.innerHTML = "";
      panels.forEach(function (p, k) {
        var panel = el("div", "col-panel reveal" + (p.bg ? " " + p.bg : ""));
        panel.style.cssText = "left:" + p.x + "px;top:" + p.y + "px;width:" + p.w + "px;height:" + p.h + "px;--i:" + (k + 1);
        var motion = MOTION["block:" + n + ":" + k];
        if (motion) {
          panel.innerHTML = '<video class="fit" src="' + motion + '" poster="' + motion.replace(/\.mp4$/, ".jpg") + '" muted loop playsinline preload="none"></video>';
        } else {
          var items = [].concat.apply([], (Array.isArray(p.g) ? p.g : [p.g]).map(function (g) { return groups[g].items; }));
          if (p.take) items = items.slice(0, p.take);
          var all = items.map(function (it) { var c = CUT[it.img]; return c ? { src: c[0], w: c[1], h: c[2], back: it.back } : { src: it.img, w: it.w, h: it.h, back: it.back }; });
          // "back" figures are not part of the line-up: they stand behind the gaps between front figures, a little smaller
          var dims = all.filter(function (d) { return !d.back; }), backs = all.filter(function (d) { return d.back; });
          var ov = p.ov == null ? 0.16 : p.ov, pad = 14, gapRow = 10, top = p.label ? 36 : pad;
          var W = p.w - 2 * pad, H = p.h - top - pad;
          // width of a row at figure height 1 (each figure overlaps the next by `ov` of its own width)
          var unit = function (row) { return row.reduce(function (s, d, i) { var w = d.w / d.h; return s + (i < row.length - 1 ? w * (1 - ov) : w); }, 0); };
          // try 1..maxRows rows and keep the one where figures come out largest; all rows share one figure height
          var best = null;
          for (var r = 1; r <= (p.maxRows || 3); r++) {
            // split as evenly as possible (10 in 3 rows = 4/3/3, not 4/4/2)
            var rowsArr = [], at = 0;
            for (var ri = 0; ri < r && at < dims.length; ri++) {
              var cnt = Math.floor(dims.length / r) + (ri < dims.length % r ? 1 : 0);
              rowsArr.push(dims.slice(at, at + cnt)); at += cnt;
            }
            var h = (H - gapRow * (rowsArr.length - 1)) / rowsArr.length;
            rowsArr.forEach(function (row) { h = Math.min(h, W / unit(row)); });
            if (!best || h > best.h * 1.04) best = { h: h, rows: rowsArr };
          }
          var blockH = best.rows.length * best.h + gapRow * (best.rows.length - 1);
          var y0 = top + (H - blockH) / 2;
          best.rows.forEach(function (row, r) {
            var hh = best.h, x = pad + (W - unit(row) * hh) / 2, yTop = y0 + r * (hh + gapRow), seams = [];
            row.forEach(function (d, i) {
              var w = hh * d.w / d.h, img = el("img");
              img.src = d.src; img.alt = ""; img.loading = "lazy";
              img.style.cssText = "left:" + x.toFixed(1) + "px;top:" + yTop.toFixed(1) + "px;width:" + w.toFixed(1) + "px;height:" + hh.toFixed(1) + "px;z-index:" + (i % 2 ? 3 : 2);
              panel.appendChild(img); x += w * (1 - ov);
              if (i < row.length - 1) seams.push(x + w * ov / 2);
            });
            if (r === 0 && backs.length && seams.length) {
              backs.forEach(function (d, k) {
                var s = seams[Math.min(seams.length - 1, Math.round((k + 0.5) * seams.length / backs.length - 0.5))];
                var bh = hh * 0.9, bw = bh * d.w / d.h, img = el("img");
                img.src = d.src; img.alt = ""; img.loading = "lazy";
                img.style.cssText = "left:" + (s - bw / 2).toFixed(1) + "px;top:" + (yTop + hh - bh - hh * 0.03).toFixed(1) + "px;width:" + bw.toFixed(1) + "px;height:" + bh.toFixed(1) + "px;z-index:1;filter:brightness(.97)";
                panel.appendChild(img);
              });
            }
          });
        }
        if (p.label) panel.appendChild(el("div", "cat", esc(p.label)));
        host.appendChild(panel);
      });
    });
  }

  /* ---------- donuts: pathLength=100 segments, optional logo labels ---------- */
  function renderDonuts() {
    each("[data-donut]", function (host) {
      var parts = JSON.parse(host.getAttribute("data-donut"));
      var total = parts.reduce(function (s, p) { return s + p[1]; }, 0), acc = 0, gap = parts.length > 2 ? 0.5 : 0;
      var svg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" style="stroke:var(--track)" pathLength="100"/>';
      var labels = "", angles = [];
      parts.forEach(function (p, k) {
        var len = p[1] / total * 100;
        svg += '<circle class="seg" cx="50" cy="50" r="42" pathLength="100" style="stroke:' + (p[2] || tone(k)) + ";--len:" + Math.max(0, len - gap).toFixed(2) +
          ";--off:" + (-acc).toFixed(2) + ";--sd:" + k + '"/>';
        if (p[3]) angles.push({ a: (acc + len / 2) / 100 * 360, p: p });
        acc += len;
      });
      if (angles.length) {
        // one radius for every label; small neighbouring slices are spread apart by angle instead
        var MIN = 30;
        for (var pass = 0; pass < 8; pass++) {
          for (var i = 1; i < angles.length; i++) {
            var d = angles[i].a - angles[i - 1].a;
            if (d < MIN) { var push = (MIN - d) / 2; angles[i - 1].a -= push; angles[i].a += push; }
          }
          var wrap = angles[0].a + 360 - angles[angles.length - 1].a;
          if (wrap < MIN) { var w2 = (MIN - wrap) / 2; angles[0].a += w2; angles[angles.length - 1].a -= w2; }
        }
        angles.forEach(function (o) {
          var a = o.a / 180 * Math.PI - Math.PI / 2, R = 68;
          labels += '<div class="dl" style="left:' + (50 + R * Math.cos(a)).toFixed(1) + "%;top:" + (50 + R * Math.sin(a)).toFixed(1) + '%"><img src="' + o.p[3] + '" alt="' + esc(o.p[0]) + '"><b>' + o.p[1] + "%</b></div>";
        });
      }
      host.querySelector(".svg-host").innerHTML = svg + "</svg>";
      if (labels) { var l = el("div", "dlabels", labels); host.appendChild(l); }
    });
  }

  /* ---------- treemap (squarified): [[name, value, logo]], largest first; darker tone = larger share ---------- */
  function tmWorst(row, side) {
    var s = 0, mx = 0, mn = Infinity;
    row.forEach(function (r) { s += r.a; mx = Math.max(mx, r.a); mn = Math.min(mn, r.a); });
    return Math.max(side * side * mx / (s * s), s * s / (side * side * mn));
  }
  function squarify(items, x, y, w, h) {
    var rest = items.slice(), out = [];
    while (rest.length) {
      var side = Math.min(w, h), row = [rest.shift()];
      while (rest.length && tmWorst(row.concat(rest[0]), side) <= tmWorst(row, side)) row.push(rest.shift());
      var s = row.reduce(function (t, r) { return t + r.a; }, 0), th = s / side, p = 0;
      row.forEach(function (r) {
        var len = r.a / th;
        out.push(w >= h ? { r: r, x: x, y: y + p, w: th, h: len } : { r: r, x: x + p, y: y, w: len, h: th });
        p += len;
      });
      if (w >= h) { x += th; w -= th; } else { y += th; h -= th; }
    }
    return out;
  }
  function renderTreemaps() {
    each("[data-treemap]", function (host) {
      var D = JSON.parse(host.getAttribute("data-treemap")), GAP = 4;
      Promise.all(D.map(function (d) {
        return new Promise(function (ok) { if (!d[2]) return ok(3);   // no logo: the name is written instead
        var i = new Image(); i.onload = function () { ok(i.naturalWidth / i.naturalHeight); }; i.onerror = function () { ok(3); }; i.src = d[2]; });
      }).concat(fontsReady())).then(function (ratios) {   // measured after logos and fonts are in
        var W = host.clientWidth, H = host.clientHeight, total = D.reduce(function (s, d) { return s + d[1]; }, 0);
        var items = D.map(function (d, k) { return { d: d, k: k, a: d[1] / total * W * H }; });
        host.innerHTML = squarify(items, 0, 0, W, H).map(function (t) {
          var w = t.w - GAP, h = t.h - GAP, r = ratios[t.r.k];
          var lw = Math.min(w * (w < 120 ? 0.8 : 0.66), 128, Math.min(h * 0.26, 40) * r);
          var fs = Math.max(12, Math.min(30, Math.sqrt(w * h) / 7.5));
          return '<div class="tl' + (t.r.k < 5 ? " inv" : "") + '" style="left:' + (t.x + GAP / 2).toFixed(1) + "px;top:" + (t.y + GAP / 2).toFixed(1) +
            "px;width:" + w.toFixed(1) + "px;height:" + h.toFixed(1) + "px;--c:" + tone(t.r.k) + ";--k:" + t.r.k + '">' +
            (t.r.d[2] ? '<img src="' + t.r.d[2] + '" alt="' + esc(t.r.d[0]) + '" style="width:' + lw.toFixed(0) + "px;height:" + (lw / r).toFixed(0) + 'px">'
                      : '<i style="--fs:' + Math.max(12, fs * 0.55).toFixed(0) + 'px">' + esc(t.r.d[0]) + "</i>") +
            '<b style="--fs:' + fs.toFixed(0) + 'px">' + t.r.d[1] + "%</b></div>";
        }).join("");
      });
    });
  }

  /* ---------- count-up ---------- */
  var STATIC = /static/.test(location.search);
  if (STATIC) document.documentElement.classList.add("static");
  // printing from the browser: every slide at its end state (engine.css @media print lays them out one per page)
  addEventListener("beforeprint", function () { document.documentElement.classList.add("static"); [].forEach.call(document.images, function (i) { i.loading = "eager"; }); });
  addEventListener("afterprint", function () { if (!STATIC) document.documentElement.classList.remove("static"); });
  function countUp(slide) {
    if (STATIC) return;
    slide.querySelectorAll("[data-count]").forEach(function (n) {
      var raw = n.getAttribute("data-count"), to = parseFloat(raw), suf = n.getAttribute("data-suffix") || "", t0 = null;
      var dp = (raw.split(".")[1] || "").length, fmt = { minimumFractionDigits: dp, maximumFractionDigits: dp };   // 45.6 stays 45.6 (as ?static and the PDF show it)
      n.textContent = (0).toLocaleString("en-US", fmt) + suf;
      setTimeout(function () {
        requestAnimationFrame(function f(now) {
          if (t0 === null) t0 = now;
          var p = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - p, 3);
          n.textContent = (to * e).toLocaleString("en-US", fmt) + suf;
          if (p < 1) requestAnimationFrame(f);
        });
      }, 300);
    });
  }

  /* ---------- videos with a play button (no autoplay) ---------- */
  function setupPlayers() {
    each(".vbox", function (box) {
      var v = box.querySelector("video"), btn = box.querySelector(".play");
      function toggle() { if (v.paused) { v.controls = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); }
      btn.addEventListener("click", toggle);
      v.addEventListener("play", function () { box.classList.add("playing"); });
      v.addEventListener("pause", function () { box.classList.remove("playing"); });
      v.addEventListener("ended", function () { box.classList.remove("playing"); v.controls = false; });
      box._toggle = toggle;
    });
  }

  /* ---------- deck ---------- */
  var deck, slides, idx = 0, presenter = null, t0 = Date.now();
  function title(s) { return s.getAttribute("data-title") || ""; }
  function chapter(s) { return s.getAttribute("data-chapter") || ""; }
  function fit() { var s = Math.min(innerWidth / 1280, (innerHeight - 92) / 720) * 0.98; deck.style.transform = "scale(" + Math.max(0.2, s) + ")"; }
  function playMedia() {
    slides.forEach(function (s, k) {
      s.querySelectorAll("video").forEach(function (v) {
        var player = v.closest(".vbox");
        if (k === idx && !player && !STATIC) {   // ?static (screenshots): videos stay on their poster
          if (v.getAttribute("preload") === "none") v.setAttribute("preload", "auto");
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else if (k !== idx && !v.paused) { v.pause(); }
      });
    });
  }
  function render() {
    slides.forEach(function (s, k) {
      var on = k === idx;
      if (on && !s.classList.contains("active")) { void s.offsetWidth; s.classList.add("active"); countUp(s); }
      else if (!on) s.classList.remove("active");
    });
    var chap = document.getElementById("chap"); if (chap) chap.textContent = chapter(slides[idx]);
    // sample slides only: data-guide="name|when to use — what is in it", shown in the top bar (H hides it)
    var guide = document.getElementById("guide"), g = slides[idx].hasAttribute("data-sample") && (slides[idx].getAttribute("data-guide") || "").split("|");
    if (guide) guide.innerHTML = g && g[0] ? "<b>견본 · " + esc(g[0]) + "</b>" + esc(g[1] || "") + "<kbd>H 숨기기</kbd>" : "";
    document.getElementById("ctr").textContent = (idx + 1) + " / " + slides.length;
    document.getElementById("prog").style.width = ((idx + 1) / slides.length * 100) + "%";
    document.querySelectorAll("#dots i[data-k]").forEach(function (d) { d.classList.toggle("on", +d.getAttribute("data-k") === idx); });
    if (location.hash !== "#" + (idx + 1)) history.replaceState(null, "", "#" + (idx + 1));
    playMedia(); updatePresenter(); rvClosePop(); rvSync();
    document.dispatchEvent(new CustomEvent("deck:slide", { detail: { index: idx + 1, id: slides[idx].getAttribute("data-src") } }));
  }
  function go(k) { idx = Math.max(0, Math.min(slides.length - 1, k)); render(); }
  function step(d) { go(idx + d); }
  function fs() { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }

  function openReport(src, name) {
    var o = document.getElementById("overlay"), f = o.querySelector("iframe");
    o.querySelector(".ob b").textContent = name; o.querySelector(".ob a").href = src;
    o.querySelector(".loading").style.display = "grid";
    f.onload = function () { o.querySelector(".loading").style.display = "none"; };
    f.src = src; o.classList.add("open");
  }
  function closeReport() { var o = document.getElementById("overlay"); o.classList.remove("open"); o.querySelector("iframe").src = "about:blank"; }

  function toggleOverview(force) {
    var o = document.getElementById("overview"), open = force != null ? force : !o.classList.contains("open");
    o.classList.toggle("open", open);
    if (!open) return;
    var g = o.querySelector(".ov"); g.innerHTML = "";
    slides.forEach(function (s, k) {
      var t = el("div", "tile" + (k === idx ? " on" : ""), "<b>" + String(k + 1).padStart(2, "0") + "</b><div>" + esc(title(s)) + "</div><span>" + esc(chapter(s)) + "</span>");
      t.onclick = function () { toggleOverview(false); go(k); };
      g.appendChild(t);
    });
  }

  /* ---------- presenter notes: editable in the presenter window, saved back into assets/notes.js ----------
     notes.js travels with the presentation folder, so re-sharing the folder shares the edited script.
     Unsaved edits are kept in localStorage — only the slides edited here, so they never undo changes made elsewhere.
     Browsers share storage between all local files, so every key carries this copy's folder:
     two decks, or two copies of one deck, never see each other's drafts, files or presenter window. */
  var DECK_DIR = decodeURIComponent(location.pathname).replace(/^\/([A-Za-z]:)/, "$1").replace(/\//g, "\\").replace(/\\[^\\]*$/, "");
  var KEY = "deck:" + DECK_DIR.toLowerCase();
  // For scripts a deck or another kit adds after engine.js (e.g. a language switch) — these names stay the same across
  // engine versions (README "밖에서 쓰는 엔진 기능"). go(n) / index() count slides from 1; redraw() measures again the parts
  // that size themselves to their box (stacked-bar labels, treemaps, logo sizes) after text or visibility changed;
  // every slide change fires document event "deck:slide" with detail {index, id}.
  window.DECK_ENGINE = {
    version: VERSION, key: KEY,   // read by the kit's tools
    go: function (n) { go((parseInt(n, 10) || 1) - 1); },
    index: function () { return idx + 1; },
    redraw: function () { renderStacks(); renderTreemaps(); fontsReady().then(renderLogoAreas); }
  };
  var NB = window.DECK_NOTES || { saved: "", notes: D.notes || {} };
  var NOTES = {}, EDITED = {}, DRAFT = KEY + "|notes-draft", dirty = false, draftStale = false, presSrc = null;
  for (var nk in NB.notes) NOTES[nk] = NB.notes[nk];
  try {
    var draft = JSON.parse(localStorage.getItem(DRAFT) || "null");
    if (draft && draft.notes && !draft.edited && draft.base === NB.saved)   // drafts from engine 1.6 kept every slide
      for (var dk in draft.notes) if (JSON.stringify(draft.notes[dk]) !== JSON.stringify(NB.notes[dk] || [])) EDITED[dk] = draft.notes[dk];
    if (draft && draft.edited) { EDITED = draft.edited; draftStale = draft.base !== NB.saved; }   // notes.js changed since: merged on save
    for (var ek in EDITED) { NOTES[ek] = EDITED[ek]; dirty = true; }
  } catch (e) {}
  function setNotes(src, text) {
    NOTES[src] = EDITED[src] = text.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    keepNotes();
    autoSave(NOTESTORE, 2000);
  }
  function keepNotes() {
    dirty = Object.keys(EDITED).length > 0;
    try { if (dirty) localStorage.setItem(DRAFT, JSON.stringify({ base: NB.saved, edited: EDITED })); else localStorage.removeItem(DRAFT); } catch (e) {}
    presStatus();
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function bySlide(o) {   // slide order; entries of slides taken out of the deck are kept at the end
    var r = {};
    slides.forEach(function (s) { var k = s.getAttribute("data-src"); if (o[k]) r[k] = o[k]; });
    for (var k in o) if (!(k in r)) r[k] = o[k];
    return r;
  }
  function isSlide(k) { return slides.some(function (s) { return s.getAttribute("data-src") === k; }); }
  var NOTESTORE = {
    file: "notes.js", global: "DECK_NOTES", what: "스크립트",
    win: function () { return presenter && !presenter.closed ? presenter : window; },
    snap: function () { return JSON.parse(JSON.stringify(EDITED)); },
    merge: function (disk, snap) {   // the file as it is now + only the slides edited here
      var n = {}, k;
      for (k in (disk && disk.notes) || {}) n[k] = disk.notes[k];
      for (k in snap) { if (snap[k].length) n[k] = snap[k]; else delete n[k]; }
      return { notes: bySlide(n) };
    },
    all: function () { return { notes: bySlide(NOTES) }; },
    foreign: function (disk) { var ks = Object.keys(disk.notes || {}); return ks.length && !ks.some(isSlide); },
    saved: function (data, snap) {   // edits typed while saving stay unsaved (they were not in this save)
      var k;
      NB = data; NOTES = {}; draftStale = false;
      for (k in EDITED) if (same(EDITED[k], snap[k])) delete EDITED[k];
      for (k in data.notes) NOTES[k] = data.notes[k];
      for (k in EDITED) NOTES[k] = EDITED[k];
      keepNotes();
      // show what other edits brought in — never while the presenter is typing (that would move the caret)
      if (!presenter || presenter.closed || presenter.document.activeElement.id !== "no") { presSrc = null; updatePresenter(); }
    },
    status: function (msg, ok) { presStatus(msg, ok); }
  };
  function saveNotes(win) { saveStore(win, NOTESTORE); }

  /* Saving (notes.js and review.js), in order of preference:
     1) Edge/Chrome file access: the presentation's assets folder is chosen once per copy and remembered (IndexedDB).
        After that every change saves by itself a moment later (autoSave). Before writing, the file is read again and
        only this window's edits are put in (st.merge), so edits made elsewhere since the deck was opened (the agent,
        another window, OneDrive) are kept; the old file goes to assets/<name>_backup/ (last 20 — while one person
        keeps typing, at most one backup every 10 minutes, so the history is not filled with a minute of typing).
        A click on the save button is needed only to choose the folder, or to allow writing again after the browser
        restarted.
     2) other browsers: download the file to replace by hand */
  var autoDir = false, BACKUP_GAP = 10 * 60 * 1000;   // autoDir: the remembered folder can be written without asking
  function autoSave(st, ms) {
    clearTimeout(st.timer);
    if (autoDir) st.timer = setTimeout(function () { saveStore(st.win(), st, true); }, ms);
  }
  function idb(mode, fn, win) {
    return new Promise(function (ok, no) {
      var q = (win || window).indexedDB.open(KEY, 1);
      q.onupgradeneeded = function () { q.result.createObjectStore("kv"); };
      q.onerror = function () { no(q.error); };
      q.onsuccess = function () {
        var tx = q.result.transaction("kv", mode), r;
        try { r = fn(tx.objectStore("kv")); } catch (e) { no(e); return; }
        tx.oncomplete = function () { ok(r && r.result); };
        tx.onerror = function () { no(tx.error); };
      };
    });
  }
  var BACKUPS = 20;
  var ON_WIN = /^[A-Za-z]:/.test(DECK_DIR);
  function showDir() { return ON_WIN ? DECK_DIR + "\\assets" : DECK_DIR.replace(/\\/g, "/") + "/assets"; }   // Mac paths keep their slashes
  function jsText(global, data) { return "window." + global + " = " + JSON.stringify(data, null, 1) + ";\n"; }
  function readJs(dir, name) {   // → [text, data] or ["", null] when the file is not there
    return dir.getFileHandle(name).then(function (h) { return h.getFile(); }).then(function (f) { return f.text(); }).then(function (t) {
      try { return [t, JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1))]; }
      catch (e) { throw new Error(name + "를 읽을 수 없습니다(손으로 고치다 깨졌을 수 있음)"); }
    }, function (e) { if (e.name === "NotFoundError") return ["", null]; throw e; });
  }
  function writeFile(dir, name, text) {
    return dir.getFileHandle(name, { create: true }).then(function (h) { return h.createWritable(); })
      .then(function (w) { return w.write(text).then(function () { return w.close(); }); });
  }
  function backup(dir, name, text) {   // keeps the file being replaced; the oldest beyond BACKUPS are removed
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    var stem = name.replace(/\.js$/, ""), file = stem + "_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + ".js";
    return dir.getDirectoryHandle(stem + "_backup", { create: true }).then(function (b) {
      return writeFile(b, file, text).then(function () {
        var names = [], it = b.keys();
        function next() {
          return it.next().then(function (r) {
            if (!r.done) { if (/\.js$/.test(r.value)) names.push(r.value); return next(); }
            names.sort();
            return Promise.all(names.slice(0, Math.max(0, names.length - BACKUPS)).map(function (n) { return b.removeEntry(n); }));
          });
        }
        return next();
      });
    });
  }
  // the folder is asked for and remembered through the window holding the click: Chrome only grants write
  // permission (after a browser restart) to a handle that lives in the window holding that click
  var dirHandle = null;   // the remembered folder, once read or chosen in this page
  function assetsDir(win, st, quiet) {   // quiet (automatic save): never asks — fails with "ask" instead
    var known = dirHandle ? Promise.resolve(dirHandle) : idb("readonly", function (s) { return s.get("assetsDir"); }, win).catch(function () { return null; });
    return known.then(function (h) {
      if (!h) return null;
      dirHandle = h;
      return h[quiet ? "queryPermission" : "requestPermission"]({ mode: "readwrite" }).then(function (p) { return p === "granted" ? h : null; }, function () { return null; });
    }).then(function (h) {
      if (h) { autoDir = true; return h; }
      autoDir = false;
      if (quiet) throw new Error("ask");
      // a page cannot open the dialog at a path, so the path goes to the clipboard: paste it into the dialog
      try { win.navigator.clipboard.writeText(showDir()).catch(function () {}); } catch (e) {}
      st.status("이 덱의 assets 폴더를 골라 주세요(덱마다 처음 한 번) — 경로를 복사해 두었습니다: " +
        (ON_WIN ? "창의 '폴더' 칸에 Ctrl+V → Enter → [폴더 선택]" : "창에서 ⌘⇧G → ⌘V → Enter → [선택]") + " · " + showDir());
      return win.showDirectoryPicker({ id: "deckkit-assets", mode: "readwrite" }).then(function (d) {
        return d.getFileHandle("engine.js").then(function () {
          idb("readwrite", function (s) { return s.put(d, "assetsDir"); }, win).catch(function () {});
          autoDir = true; dirHandle = d;
          return d;
        }, function () { throw new Error("고른 폴더에 engine.js가 없습니다 — 덱 폴더 안의 assets 폴더를 골라 주세요"); });
      });
    });
  }
  function saveStore(win, st, quiet) {
    if (st.busy) { st.again = true; return; }   // one save at a time; the changes made meanwhile follow right after
    var stamp = new Date().toISOString();
    function fail(e) {
      if (e && e.message === "ask") st.status("");   // the status line asks for one click on the save button
      else if (e && e.name !== "AbortError" && e.message !== "cancel") st.status("저장하지 못했습니다 — " + e.message);
    }
    if (!quiet) st.status("저장 중…");
    if (!win.showDirectoryPicker) {
      if (quiet) return;
      var data = st.all(); data.saved = stamp; data.deck = DECK_DIR;
      var a = win.document.createElement("a");
      a.href = URL.createObjectURL(new Blob([jsText(st.global, data)], { type: "text/javascript" }));
      a.download = st.file;
      win.document.body.appendChild(a); a.click(); a.remove();
      st.saved(data, st.snap());
      st.status(st.file + "를 내려받았습니다 → 덱 폴더의 assets/" + st.file + "를 이 파일로 바꿔 넣어야 반영됩니다", true);
      return;
    }
    var snap = st.snap();
    st.busy = true;
    assetsDir(win, st, quiet).then(function (dir) {
      return readJs(dir, st.file).then(function (cur) {
        var disk = cur[1];
        // a file saved by another deck: its folder is written in it (older files: none of its slides is in this deck)
        if (disk && (disk.deck ? disk.deck.toLowerCase() !== DECK_DIR.toLowerCase() : st.foreign(disk)) &&
            !win.confirm("이 assets 폴더의 " + st.what + "는 다른 위치의 덱에서 저장한 것입니다:\n" + (disk.deck || "(위치 기록 없음)") +
              "\n\n이 덱을 옮기거나 복사했다면 '확인', 다른 덱의 폴더를 잘못 골랐다면 '취소'를 누르세요.")) {
          idb("readwrite", function (s) { return s.delete("assetsDir"); }, win).catch(function () {});
          dirHandle = null; autoDir = false;
          throw new Error("cancel");
        }
        var data = st.merge(disk, snap); data.saved = stamp; data.deck = DECK_DIR;
        var text = jsText(st.global, data);
        // no new backup when the file is still this window's last save and its backup is recent
        var keep = cur[0] && !(disk && disk.saved === st.lastStamp && Date.now() - (st.lastBackup || 0) < BACKUP_GAP);
        return (keep ? backup(dir, st.file, cur[0]).then(function () { st.lastBackup = Date.now(); }) : Promise.resolve()).then(function () {
          return writeFile(dir, st.file, text);
        }).then(function () {
          st.lastStamp = stamp;
          st.saved(data, snap);
          st.status((quiet ? "✓ 자동 저장 " : "✓ 저장했습니다 ") + new Date().toLocaleTimeString(), true);
        });
      });
    }).catch(function (e) { st.status(""); fail(e); }).then(function () {
      st.busy = false;
      if (st.again) { st.again = false; autoSave(st, 300); }
    });
  }
  function presStatus(msg, ok) {
    if (!presenter || presenter.closed) return;
    var st = presenter.document.getElementById("st");
    if (msg) { st.textContent = msg; st.className = ok ? "ok" : ""; return; }
    var n = Object.keys(EDITED).length;
    st.className = dirty ? "dirty" : "";
    st.textContent = dirty ? "저장 안 한 수정 " + n + "장" + (draftStale ? " — notes.js가 그 뒤 바뀌었습니다. 저장하면 최신 파일에 합쳐집니다" : "") +
        (autoDir ? " — 곧 자동 저장" : " — [스크립트 저장]을 한 번 누르면 그다음부터 자동으로 저장됩니다") :
      NB.saved ? "저장됨 " + new Date(NB.saved).toLocaleString() : autoDir ? "고치면 자동으로 저장됩니다" : "아직 저장 안 함";
  }

  /* ---------- presenter window (notes only on the presenter's screen) ---------- */
  // presenter-only window: fixed monotone colors (not theme tokens); amber = unsaved, green = saved
  var PRES_CSS = "body{margin:0;background:#1C1C1E;color:#F2F2F4;font-family:'Segoe UI','Malgun Gothic',-apple-system,'Apple SD Gothic Neo',sans-serif;display:grid;grid-template-rows:auto 1fr auto;height:100vh}" +
    "header{display:flex;align-items:center;gap:16px;padding:14px 20px;border-bottom:1px solid #3A3A3C}header b{font-size:22px}header .t{font:600 22px Consolas,monospace;color:#D1D1D6;margin-left:auto}" +
    "main{display:grid;grid-template-columns:2fr 1fr;gap:18px;padding:18px 20px;min-height:0}" +
    ".notes{box-sizing:border-box;width:100%;height:100%;resize:none;border:1px solid transparent;outline:0;color:inherit;font:21px/1.55 'Segoe UI','Malgun Gothic',-apple-system,'Apple SD Gothic Neo',sans-serif;background:#2C2C2E;border-radius:6px;padding:18px 22px}" +
    ".notes:focus{border-color:#636366}.notes::placeholder{color:#8E8E93}" +
    ".side{display:flex;flex-direction:column;gap:12px}.box{background:#2C2C2E;border-radius:6px;padding:14px 16px}.box small{display:block;font:600 11px Consolas,monospace;letter-spacing:.14em;color:#AEAEB2;margin-bottom:6px}" +
    ".box div{font-size:17px;font-weight:700}footer{display:flex;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid #3A3A3C}" +
    "button{background:#3A3A3C;color:#fff;border:0;border-radius:4px;padding:10px 22px;font-size:15px;cursor:pointer}#sv{background:#D1D1D6;color:#1C1C1E;font-weight:700}" +
    "#sv{padding:12px 30px;font-size:17px}#st{margin-left:auto;font-size:15px;color:#AEAEB2;text-align:right}#st.dirty{color:#E8C27A}#st.ok{color:#9FD39B;font-weight:700;font-size:17px}";
  function openPresenter() {
    if (presenter && !presenter.closed) { presenter.focus(); return; }
    presenter = window.open("", KEY + "|presenter", "width=1100,height=720");
    if (!presenter) { alert("팝업이 막혀 있습니다 — 이 페이지의 팝업을 허용해야 발표자 창이 열립니다."); return; }
    var d;
    try { d = presenter.document; } catch (e) {
      // a presenter window left from before this page was reloaded: it can no longer be reached
      presenter.close(); presenter = null;
      alert("예전 발표자 창을 닫았습니다. P를 다시 눌러 주세요.");
      return;
    }
    d.open();
    d.write('<!doctype html><html><head><meta charset="utf-8"><title>Presenter — ' + esc(document.title) + "</title><style>" + PRES_CSS +
      '</style></head><body><header><b id="n"></b><span id="ti"></span><span class="t" id="tm">00:00</span></header>' +
      '<main><textarea class="notes" id="no" spellcheck="true" placeholder="이 장에는 스크립트가 없습니다 — 여기에 쓰면 됩니다. 빈 줄 = 새 문단"></textarea>' +
      '<div class="side"><div class="box"><small>NOW</small><div id="cur"></div></div>' +
      '<div class="box"><small>NEXT</small><div id="nx"></div></div><div class="box"><small>CHAPTER</small><div id="ch"></div></div></div></main>' +
      '<footer><button id="pv">◀ 이전</button><button id="nt">다음 ▶</button><button id="rs">타이머 처음부터</button>' +
      '<button id="sv" title="Ctrl+S">스크립트 저장</button><span id="st"></span></footer></body></html>');
    d.close();
    presSrc = null;
    d.getElementById("pv").onclick = function () { step(-1); };
    d.getElementById("nt").onclick = function () { step(1); };
    d.getElementById("rs").onclick = function () { t0 = Date.now(); };
    d.getElementById("sv").onclick = function () { saveNotes(presenter); };
    d.getElementById("no").addEventListener("input", function () { setNotes(presSrc, this.value); });
    presenter.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); saveNotes(presenter); return; }
      if (e.target && e.target.tagName === "TEXTAREA") { if (e.key === "Escape") e.target.blur(); return; }  // typing never moves slides
      onKey(e);
    });
    presenter.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
    updatePresenter();
    presStatus();
  }
  function updatePresenter() {
    if (!presenter || presenter.closed) return;
    var d = presenter.document, s = slides[idx], nx = slides[idx + 1], src = s.getAttribute("data-src");
    d.getElementById("n").textContent = (idx + 1) + " / " + slides.length;
    d.getElementById("ti").textContent = title(s);
    d.getElementById("cur").textContent = title(s);
    d.getElementById("nx").textContent = nx ? title(nx) : "— end —";
    d.getElementById("ch").textContent = chapter(s);
    if (src !== presSrc) {  // only on slide change, so the caret is not reset while typing
      presSrc = src;
      var ta = d.getElementById("no");
      ta.value = (NOTES[src] || []).join("\n\n");   // presSrc = null makes it reload (after a save brought in other edits)
      ta.scrollTop = 0;
    }
  }
  setInterval(function () {
    if (!presenter || presenter.closed) return;
    var s = Math.floor((Date.now() - t0) / 1000);
    presenter.document.getElementById("tm").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }, 1000);

  /* ---------- R: review mode — pins on the slides where something should change, saved in assets/review.js ----------
     For the deck's maker on their own PC: click a spot, write what to fix, save, then ask the agent to apply it
     (tools/review.py reads it). Pins sit in % of the slide, so they keep their place at any window size; each pin also
     records what was under the click ("at"), so "this number" is clear to the agent. Applied pins are marked done with
     the agent's reply and stay, dimmed, under "지난 의견 보기". "이 장 PDF에서 빼기" marks are read by tools/pdf.py.
     Nothing is built until R is pressed, so slides and screenshots stay exactly as they were. */
  var RV = window.DECK_REVIEW || { saved: "", next: 1, pins: [], nopdf: [] };
  var RV_SHOT = /[?&]review\b/.test(location.search);   // screenshots for the agent: open pins drawn, nothing else
  var RVDRAFT = KEY + "|review-draft", rvEdits = { pins: {}, nopdf: {} }, rvDirty = false, reviewing = false, rvOpen = null, rvDrag = null;
  try {   // pin edits made here and not saved yet (by pin id; null = deleted), kept on top of whatever review.js holds
    var rd = JSON.parse(localStorage.getItem(RVDRAFT) || "null");
    if (rd && rd.pins) { rvEdits = rd; rvDirty = true; }
  } catch (e) {}
  function rvPins() {
    var out = [], seen = {};
    (RV.pins || []).forEach(function (p) {
      var e = rvEdits.pins[p.id]; seen[p.id] = 1;
      if (e === null) return;
      out.push(e && !e.fresh ? Object.assign({}, p, e) : p);
    });
    for (var id in rvEdits.pins) { var e = rvEdits.pins[id]; if (e && e.fresh) out.push(e); }   // edits of a pin gone from the file are dropped
    return out;
  }
  function rvNopdf(base, edits) {   // slide ids, in slide order
    var s = {};
    edits = edits || rvEdits.nopdf;
    (base || []).forEach(function (k) { s[k] = 1; });
    for (var k in edits) { if (edits[k]) s[k] = 1; else delete s[k]; }
    return Object.keys(bySlide(s));
  }
  function rvNextId() {
    var m = (RV.next || 1) - 1;
    rvPins().forEach(function (p) { m = Math.max(m, p.id); });
    return m + 1;
  }
  function rvEdit(id, fields) {   // fields = null deletes the pin
    var cur = rvEdits.pins[id];
    if (fields === null) { if (cur && cur.fresh) delete rvEdits.pins[id]; else rvEdits.pins[id] = null; }
    else rvEdits.pins[id] = Object.assign(cur || { id: id }, fields);
  }
  function rvKeep(noDraw) {   // noDraw: typing a note (redrawing is not needed, and saving waits a little longer)
    rvDirty = Object.keys(rvEdits.pins).length + Object.keys(rvEdits.nopdf).length > 0;
    try { if (rvDirty) localStorage.setItem(RVDRAFT, JSON.stringify(rvEdits)); else localStorage.removeItem(RVDRAFT); } catch (e) {}
    if (!noDraw) rvDraw();
    rvSync();
    if (rvDirty) autoSave(RVSTORE, noDraw ? 2000 : 600);
  }
  var RVSTORE = {
    file: "review.js", global: "DECK_REVIEW", what: "검수 메모", renum: {},
    win: function () { return window; },
    snap: function () {   // a new pin is saved once it has a note (an empty one is dropped when its note closes)
      var s = JSON.parse(JSON.stringify(rvEdits));
      for (var id in s.pins) if (s.pins[id] && s.pins[id].fresh && !(s.pins[id].note || "").trim()) delete s.pins[id];
      return s;
    },
    merge: function (disk, snap) {   // the file as it is now (the agent may have marked pins done) + the pin edits made here
      disk = disk || {};
      var byId = {}, max = (disk.next || 1) - 1, out = [], id, e;
      RVSTORE.renum = {};
      (disk.pins || []).forEach(function (p) {
        byId[p.id] = 1; max = Math.max(max, p.id);
        e = snap.pins[p.id];
        if (e === null) return;
        out.push(e && !e.fresh ? Object.assign({}, p, e) : p);   // done/reply from the file stay
      });
      for (id in snap.pins) {
        e = snap.pins[id];
        if (!e || !e.fresh) continue;
        var n = Object.assign({}, e); delete n.fresh;
        if (byId[n.id]) n.id = RVSTORE.renum[id] = max + 1;   // that number was taken in the file meanwhile
        max = Math.max(max, n.id); byId[n.id] = 1; out.push(n);
      }
      return { next: max + 1, pins: out.sort(function (a, b) { return a.id - b.id; }), nopdf: rvNopdf(disk.nopdf, snap.nopdf) };
    },
    all: function () {
      return { next: rvNextId(), pins: rvPins().map(function (p) { var n = Object.assign({}, p); delete n.fresh; return n; }), nopdf: rvNopdf(RV.nopdf) };
    },
    foreign: function (disk) { var ps = disk.pins || []; return ps.length && !ps.some(function (p) { return isSlide(p.slide); }); },
    saved: function (data, snap) {   // what changed while saving stays unsaved; a new pin that was saved is now a pin of the file
      RV = data;
      var id, cur, was, nid;
      for (id in snap.pins) {
        was = snap.pins[id]; cur = rvEdits.pins[id];
        nid = RVSTORE.renum[id] || +id;
        if (rvOpen === +id && was && was.fresh) { rvOpen = nid; document.querySelector("#rvpop b").textContent = "메모 " + nid; }   // the open note follows its pin
        if (same(cur, was)) { delete rvEdits.pins[id]; continue; }
        if (!(was && was.fresh)) continue;
        delete rvEdits.pins[id];
        if (cur === undefined) rvEdits.pins[nid] = null;   // deleted while saving
        else if (cur) { cur = Object.assign({}, cur, { id: nid }); delete cur.fresh; rvEdits.pins[nid] = cur; }
      }
      for (id in snap.nopdf) if (rvEdits.nopdf[id] === snap.nopdf[id]) delete rvEdits.nopdf[id];
      rvKeep();
    },
    status: rvStatus
  };
  function pct(v, w) { return Math.round(Math.max(0, Math.min(100, v / w * 100)) * 10) / 10; }
  function rvAt(x, y, slide) {   // what is under the click: its text, its picture, its tag — for the agent to find the spot
    var hits = document.elementsFromPoint(x, y), t = null;
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].closest(".rv-layer")) continue;
      if (slide.contains(hits[i])) t = hits[i];
      break;
    }
    if (!t || t === slide) return "빈 곳";
    var parts = [], txt = (t.innerText || t.textContent || "").replace(/\s+/g, " ").trim();
    var img = t.tagName === "IMG" ? t.getAttribute("src") : t.tagName === "VIDEO" ? (t.getAttribute("poster") || t.getAttribute("src")) :
      (/url\("?([^")]+)/.exec(getComputedStyle(t).backgroundImage) || [])[1];
    if (txt) parts.push("글자: " + (txt.length > 60 ? txt.slice(0, 60) + "…" : txt));
    if (img) parts.push("그림: " + decodeURIComponent(img.split(/[\\/]/).pop()));
    parts.push(t.tagName.toLowerCase() + [].map.call(t.classList, function (c) { return "." + c; }).join(""));
    return parts.join(" · ");
  }
  function rvLayer(s) {
    var l = s.querySelector(":scope > .rv-layer");
    if (l) return l;
    l = el("div", "rv-layer"); s.appendChild(l);
    l.addEventListener("pointerdown", function (e) {   // the layer covers the slide: clicks never reach its buttons
      if (!reviewing || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      var pin = e.target.closest(".rv-pin"), r = s.getBoundingClientRect();
      if (pin) { rvDrag = { id: +pin.getAttribute("data-id"), el: pin, x0: e.clientX, y0: e.clientY, r: r, moved: false }; pin.setPointerCapture(e.pointerId); return; }
      if (rvOpen !== null) { rvClosePop(); return; }   // a click beside an open note only closes it
      var id = rvNextId();
      rvEdit(id, { slide: s.getAttribute("data-src"), x: pct(e.clientX - r.left, r.width), y: pct(e.clientY - r.top, r.height),
        note: "", at: rvAt(e.clientX, e.clientY, s), time: new Date().toISOString(), done: false, reply: "", fresh: true });
      rvKeep(); rvOpenPop(id);
    });
    l.addEventListener("pointermove", function (e) {
      var d = rvDrag; if (!d) return;
      if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) > 4) d.moved = true;
      if (d.moved) { d.el.style.left = pct(e.clientX - d.r.left, d.r.width) + "%"; d.el.style.top = pct(e.clientY - d.r.top, d.r.height) + "%"; }
    });
    l.addEventListener("pointerup", function (e) {
      var d = rvDrag; if (!d) return;
      rvDrag = null;
      if (d.moved) { rvEdit(d.id, { x: pct(e.clientX - d.r.left, d.r.width), y: pct(e.clientY - d.r.top, d.r.height) }); rvKeep(); }
      else rvOpenPop(d.id);
    });
    return l;
  }
  function rvDraw() {
    var pins = rvPins(), off = rvNopdf(RV.nopdf);
    slides.forEach(function (s) {
      var src = s.getAttribute("data-src"), l = rvLayer(s);
      l.innerHTML = (off.indexOf(src) >= 0 ? '<div class="rv-nopdf">PDF에서 뺌</div>' : "") + pins.filter(function (p) { return p.slide === src; }).map(function (p) {
        return '<div class="rv-pin' + (p.done ? " done" : "") + (p.id === rvOpen ? " on" : "") + '" data-id="' + p.id + '" style="left:' + p.x + "%;top:" + p.y + '%">' + p.id + "</div>";
      }).join("");
    });
  }
  function rvBuild() {
    if (document.getElementById("rvbar")) return;
    var b = el("div", "rv-bar", '<b>검수 중</b><span id="rvn"></span><label><input type="checkbox" id="rvpdf"> 이 장 PDF에서 빼기</label>' +
      '<label><input type="checkbox" id="rvold"> 지난 의견 보기</label><button id="rvsv" title="Ctrl+S">저장</button><span id="rvst"></span>' +
      '<button id="rvx">끝내기 (R)</button><small>고칠 곳을 클릭하면 메모가 붙습니다 · 핀은 끌어서 옮깁니다 · 메모는 자동으로 저장됩니다 · 다 적었으면 에이전트에게 "검수 의견 반영해줘"</small>');
    b.id = "rvbar"; document.body.appendChild(b);
    var p = el("div", "rv-pop", '<b></b><div class="rv-done"></div><textarea placeholder="무엇을 어떻게 고칠지 적어 주세요 — Enter = 완료, Shift+Enter = 줄바꿈"></textarea>' +
      '<div class="rv-at"></div><footer><button class="del">삭제</button><button class="ok">닫기</button></footer>');
    p.id = "rvpop"; document.body.appendChild(p);
    document.getElementById("rvpdf").onchange = function () { rvEdits.nopdf[slides[idx].getAttribute("data-src")] = this.checked; rvKeep(); this.blur(); };
    document.getElementById("rvold").onchange = function () { document.body.classList.toggle("rv-old", this.checked); rvClosePop(); this.blur(); };
    document.getElementById("rvsv").onclick = function () { saveStore(window, RVSTORE); };
    document.getElementById("rvx").onclick = function () { toggleReview(false); };
    p.querySelector("textarea").addEventListener("input", function () { rvEdit(rvOpen, { note: this.value }); rvKeep(true); });
    p.querySelector(".del").onclick = function () { rvEdit(rvOpen, null); rvOpen = null; p.classList.remove("open"); rvKeep(); };
    p.querySelector(".ok").onclick = function () { rvClosePop(); };
    addEventListener("beforeunload", function (e) { if (rvDirty) { e.preventDefault(); e.returnValue = ""; } });
  }
  function rvOpenPop(id) {
    var pin = rvPins().filter(function (q) { return q.id === id; })[0];
    if (!pin) return;
    rvOpen = id; rvDraw();
    var p = document.getElementById("rvpop"), ta = p.querySelector("textarea"), mark = document.querySelector('.rv-pin[data-id="' + id + '"]');
    p.querySelector("b").textContent = "메모 " + id;
    p.querySelector(".rv-done").textContent = pin.done ? "반영함 — " + (pin.reply || "") : "";
    p.querySelector(".rv-at").textContent = pin.at ? "누른 곳: " + pin.at : "";
    ta.value = pin.note || ""; ta.readOnly = !!pin.done;
    p.querySelector(".del").style.display = pin.done ? "none" : "";
    p.classList.add("open");
    var r = mark.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
    p.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right + 10)) + "px";
    p.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.top)) + "px";
    if (!pin.done) ta.focus();
  }
  function rvClosePop() {
    if (rvOpen === null) return;
    var e = rvEdits.pins[rvOpen];
    if (e && e.fresh && !(e.note || "").trim()) rvEdit(rvOpen, null);   // a pin left without a note is not kept
    rvOpen = null;
    document.getElementById("rvpop").classList.remove("open");
    rvKeep();
  }
  function rvSync() {   // the bar follows the current slide
    if (!reviewing) return;
    var src = slides[idx].getAttribute("data-src"), open = rvPins().filter(function (p) { return !p.done; });
    document.getElementById("rvn").textContent = "의견 " + open.length + "개 (이 장 " + open.filter(function (p) { return p.slide === src; }).length + ")";
    document.getElementById("rvpdf").checked = rvNopdf(RV.nopdf).indexOf(src) >= 0;
    rvStatus();
  }
  function rvStatus(msg, ok) {
    var st = document.getElementById("rvst");
    if (!st) return;
    if (msg) { st.textContent = msg; st.className = ok ? "ok" : ""; return; }
    st.className = rvDirty ? "dirty" : "";
    st.textContent = rvDirty ? (autoDir ? "곧 자동 저장" : "[저장]을 한 번 누르면 그다음부터 자동으로 저장됩니다") :
      RV.saved ? "저장됨 " + new Date(RV.saved).toLocaleTimeString() : autoDir ? "메모는 자동으로 저장됩니다" : "";
  }
  function toggleReview(on) {
    reviewing = on != null ? on : !reviewing;
    // the first time, ask for the folder right away (pressing R is the click the browser needs), so notes save by themselves
    if (reviewing) { rvBuild(); rvDraw(); toggleOverview(false); }
    if (reviewing && !autoDir && window.showDirectoryPicker) saveStore(window, RVSTORE);
    else rvClosePop();
    document.body.classList.toggle("reviewing", reviewing);
    rvSync();
  }

  /* ---------- D: frame-rate meter for checking playback on the presentation laptop (hidden by default) ---------- */
  var meter = null;
  function perfMeter() {
    if (meter) { meter.el.remove(); cancelAnimationFrame(meter.raf); clearInterval(meter.iv); meter = null; return; }
    var box = el("div", null, "");
    box.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:99;background:rgba(0,0,0,.75);color:#fff;font:12px/1.5 Consolas,monospace;padding:6px 10px;border-radius:6px;pointer-events:none";
    document.body.appendChild(box);
    meter = { el: box, frames: 0, dropped0: null };
    (function f() { meter.frames++; meter.raf = requestAnimationFrame(f); })();
    meter.iv = setInterval(function () {
      var d = 0, t = 0, vids = slides[idx].querySelectorAll("video");
      [].forEach.call(vids, function (v) { if (v.getVideoPlaybackQuality) { var q = v.getVideoPlaybackQuality(); d += q.droppedVideoFrames; t += q.totalVideoFrames; } });
      box.textContent = "screen " + meter.frames + " fps · videos " + [].filter.call(vids, function (v) { return !v.paused; }).length +
        " · dropped " + d + "/" + t + " · " + screen.width + "×" + screen.height + " @" + (devicePixelRatio || 1);
      meter.frames = 0;
    }, 1000);
  }

  function onKey(e) {
    if (e.target && e.target.tagName === "TEXTAREA") {   // typing a review note: Enter finishes it, Shift+Enter = new line
      // not while a Korean (IME) syllable is still being composed — that Enter only completes the syllable
      if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229)) { e.preventDefault(); rvClosePop(); }
      return;
    }
    if (reviewing && (e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); saveStore(window, RVSTORE); return; }
    var t = e.target;   // typing in a field of a slide, and browser shortcuts (Cmd+P, Ctrl+F …), are not deck keys
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var ov =document.getElementById("overlay").classList.contains("open");
    if (e.key === "Escape") { if (ov) closeReport(); toggleOverview(false); rvClosePop(); return; }
    if (ov) return;
    var k = e.key;
    if (k === "Enter") { var box = slides[idx].querySelector(".vbox"); if (box) { box._toggle(); e.preventDefault(); } }
    else if (k === "ArrowRight" || k === " " || k === "PageDown") { step(1); e.preventDefault(); }
    else if (k === "ArrowLeft" || k === "PageUp") { step(-1); e.preventDefault(); }
    else if (k === "Home") go(0);
    else if (k === "End") go(slides.length - 1);
    else if (k === "f" || k === "F") fs();
    else if (k === "g" || k === "G") toggleOverview();
    else if (k === "p" || k === "P") openPresenter();
    else if (k === "d" || k === "D") perfMeter();
    else if (k === "h" || k === "H") document.body.classList.toggle("noguide");
    else if (k === "r" || k === "R") toggleReview();
  }

  /* ---------- chrome: background, bars, report overlay, overview ----------
     Built here so a deck's HTML holds only its slides. The top bar comes from
     <body data-logo="assets/img/logo.webp" data-topline="Company · Event">. */
  var KEYS = "← → move · Enter play video · F full screen · G overview · P presenter · R review";
  function buildChrome() {
    if (document.getElementById("bg")) return;   // decks that still write these in their HTML
    var logo = document.body.getAttribute("data-logo"), line = document.body.getAttribute("data-topline");
    var stage = deck.closest(".stage") || deck;
    stage.insertAdjacentHTML("beforebegin", '<canvas id="bg"></canvas><div class="scrim"></div><div class="progress" id="prog"></div>' +
      '<div class="topbar">' + (logo ? '<img src="' + esc(logo) + '" alt=""><span class="div"></span>' : "") +
      (line ? '<span class="t">' + esc(line) + "</span>" : "") + '<span class="guide" id="guide"></span><span class="chap" id="chap"></span></div>');
    stage.insertAdjacentHTML("afterend", '<div class="bar-bottom"><button id="prev">‹ PREV</button><div class="dots" id="dots"></div>' +
      '<span id="ctr"></span><button id="next">NEXT ›</button></div><div class="hint">' + KEYS + "</div>" +
      '<div class="overlay" id="overlay"><div class="ob"><b></b><span class="sp"></span><a href="#" target="_blank" rel="noopener">Open in new tab ↗</a>' +
      '<button id="closeOverlay">Close ✕ (Esc)</button></div><div style="position:relative;flex:1;display:flex"><iframe title="Report"></iframe>' +
      '<div class="loading">LOADING REPORT…</div></div></div>' +
      '<div class="overview" id="overview"><div class="keys">' + KEYS + ' · Esc close</div><div class="ov"></div></div>');
  }

  function init() {
    deck = document.getElementById("deck");
    buildChrome();
    shader(document.getElementById("bg"));
    renderBestSellers(); renderBars(); renderLines(); renderStacks(); renderDonuts(); renderTreemaps(); setupPlayers();
    fontsReady().then(function () { renderCollage(); renderLogoAreas(); });   // both size to their box, which text above it (web fonts) can still move
    slides = Array.prototype.slice.call(deck.querySelectorAll(":scope > .slide"));
    var dots = document.getElementById("dots"), prev = null;
    slides.forEach(function (s, k) {
      if (prev !== null && chapter(s) !== prev) dots.appendChild(el("i", "ch"));
      var d = el("i"); d.setAttribute("data-k", k); d.title = (k + 1) + ". " + title(s); d.onclick = function () { go(k); };
      dots.appendChild(d); prev = chapter(s);
    });
    document.querySelectorAll("[data-report]").forEach(function (b) {
      b.addEventListener("click", function () { openReport(b.getAttribute("data-report"), b.getAttribute("data-name")); });
    });
    document.getElementById("prev").onclick = function () { step(-1); };
    document.getElementById("next").onclick = function () { step(1); };
    document.getElementById("closeOverlay").onclick = closeReport;
    addEventListener("keydown", onKey);
    addEventListener("resize", fit);
    // reloading or leaving the deck closes its presenter window (a reloaded page could not reach the old one)
    addEventListener("pagehide", function () { if (presenter && !presenter.closed) presenter.close(); });
    addEventListener("hashchange", function () { var n = parseInt(location.hash.slice(1), 10); if (n && n - 1 !== idx) go(n - 1); });
    var n = parseInt(location.hash.slice(1), 10);
    idx = n ? Math.max(1, Math.min(slides.length, n)) - 1 : 0;   // #-3 → first slide
    fit(); render();
    if (RV_SHOT) { document.documentElement.classList.add("rv-shot"); rvDraw(); }
    // folder chosen before and writing still allowed: save by itself from the start (and save what was left unsaved)
    if (window.showDirectoryPicker && !STATIC) assetsDir(window, NOTESTORE, true).then(function () {
      if (dirty) autoSave(NOTESTORE, 500);
      if (rvDirty) autoSave(RVSTORE, 500);
      presStatus(); rvStatus();
    }, function () {});
  }
  document.addEventListener("DOMContentLoaded", init);
})();
