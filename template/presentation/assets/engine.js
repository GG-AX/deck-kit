/* deck-kit engine v1.5 (2026-10-26) — classic script, works from file://. Fixed: decks never edit it; change it only in deck-kit and raise the version (README). */
(function () {
  "use strict";
  var VERSION = "1.0";
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
     DECK_DATA.bestsellers.NAME = {cards:[{img, logo, retailer, season, spec:["FIRST LINE","more"], qty:["38,000 PCS"], alts:[img…]}]}
     (only img is required; norm.js may swap the image, motion.js turns it into a looping clip) ---------- */
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
      host.innerHTML = "";
      d.cards.forEach(function (c, k) {
        var card = el("div", "bs-card reveal" + (anyAlts ? " has-alts" : "")), qty = c.qty || [];
        card.style.setProperty("--i", k + 1);
        var alts = anyAlts ? '<div class="alts">' + (c.alts || []).map(function (a) { return '<img src="' + (NORM[a] || a) + '" alt="">'; }).join("") + "</div>" : "";
        card.innerHTML = '<div class="media">' + media(c.img) + "</div>" +
          '<div class="meta">' + alts.replace('class="alts"', 'class="alts" style="padding:0 0 8px;height:' + (anyAlts ? 72 : 0) + 'px"') +
          '<div class="row1">' + (c.logo ? '<img src="' + c.logo + '" alt="' + esc(c.retailer || "") + '">' : "<span></span>") +
          '<span class="season">' + esc(c.season || "") + "</span></div>" +
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
        return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i.naturalWidth / i.naturalHeight); }; i.onerror = function () { ok(3); }; i.src = d[2]; });
      }).concat(fontsReady())).then(function (ratios) {   // measured after logos and fonts are in
        var W = host.clientWidth, H = host.clientHeight, total = D.reduce(function (s, d) { return s + d[1]; }, 0);
        var items = D.map(function (d, k) { return { d: d, k: k, a: d[1] / total * W * H }; });
        host.innerHTML = squarify(items, 0, 0, W, H).map(function (t) {
          var w = t.w - GAP, h = t.h - GAP, r = ratios[t.r.k];
          var lw = Math.min(w * (w < 120 ? 0.8 : 0.66), 128, Math.min(h * 0.26, 40) * r);
          var fs = Math.max(12, Math.min(30, Math.sqrt(w * h) / 7.5));
          return '<div class="tl' + (t.r.k < 5 ? " inv" : "") + '" style="left:' + (t.x + GAP / 2).toFixed(1) + "px;top:" + (t.y + GAP / 2).toFixed(1) +
            "px;width:" + w.toFixed(1) + "px;height:" + h.toFixed(1) + "px;--c:" + tone(t.r.k) + ";--k:" + t.r.k + '">' +
            '<img src="' + t.r.d[2] + '" alt="' + esc(t.r.d[0]) + '" style="width:' + lw.toFixed(0) + "px;height:" + (lw / r).toFixed(0) + 'px">' +
            '<b style="--fs:' + fs.toFixed(0) + 'px">' + t.r.d[1] + "%</b></div>";
        }).join("");
      });
    });
  }

  /* ---------- count-up ---------- */
  var STATIC = /static/.test(location.search);
  if (STATIC) document.documentElement.classList.add("static");
  function countUp(slide) {
    if (STATIC) return;
    slide.querySelectorAll("[data-count]").forEach(function (n) {
      var to = parseFloat(n.getAttribute("data-count")), suf = n.getAttribute("data-suffix") || "", t0 = null;
      n.textContent = "0" + suf;
      setTimeout(function () {
        requestAnimationFrame(function f(now) {
          if (t0 === null) t0 = now;
          var p = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - p, 3);
          n.textContent = Math.round(to * e).toLocaleString("en-US") + suf;
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
    playMedia(); updatePresenter();
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
     Unsaved edits are kept in localStorage (only on top of the notes.js they were made on).
     Browsers share storage between all local files, so every key carries this copy's folder:
     two decks, or two copies of one deck, never see each other's drafts, files or presenter window. */
  var DECK_DIR = decodeURIComponent(location.pathname).replace(/^\/([A-Za-z]:)/, "$1").replace(/\//g, "\\").replace(/\\[^\\]*$/, "");
  var KEY = "deck:" + DECK_DIR.toLowerCase();
  window.DECK_ENGINE = { version: VERSION, key: KEY };   // read by the kit's tools
  var NB = window.DECK_NOTES || { saved: "", notes: D.notes || {} };
  var NOTES = NB.notes, DRAFT = KEY + "|notes-draft", noteHandle = null, dirty = false, presSrc = null;
  try {
    var draft = JSON.parse(localStorage.getItem(DRAFT) || "null");
    if (draft && draft.base === NB.saved && draft.notes) { NOTES = draft.notes; dirty = true; }
  } catch (e) {}
  function setNotes(src, text) {
    NOTES[src] = text.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    dirty = true;
    try { localStorage.setItem(DRAFT, JSON.stringify({ base: NB.saved, notes: NOTES })); } catch (e) {}
    presStatus();
  }
  /* Saving, in order of preference:
     1) Edge/Chrome file access: notes.js is chosen once per PC; the choice is remembered (IndexedDB)
     2) other browsers: download notes.js to replace by hand */
  function idb(mode, fn) {
    return new Promise(function (ok, no) {
      var q = indexedDB.open(KEY, 1);
      q.onupgradeneeded = function () { q.result.createObjectStore("kv"); };
      q.onerror = function () { no(q.error); };
      q.onsuccess = function () {
        var tx = q.result.transaction("kv", mode), r = fn(tx.objectStore("kv"));
        tx.oncomplete = function () { ok(r && r.result); };
        tx.onerror = function () { no(tx.error); };
      };
    });
  }
  function rememberedHandle() {
    if (noteHandle) return Promise.resolve(noteHandle);
    return idb("readonly", function (st) { return st.get("notesHandle"); }).catch(function () { return null; });
  }
  function saveNotes(win) {
    var stamp = new Date().toISOString(), ordered = {};
    slides.forEach(function (s) { var k = s.getAttribute("data-src"); if (NOTES[k]) ordered[k] = NOTES[k]; });   // slide order
    for (var k in NOTES) if (!(k in ordered)) ordered[k] = NOTES[k];   // notes of slides taken out of the deck are kept
    var text = "window.DECK_NOTES = " + JSON.stringify({ saved: stamp, notes: ordered }, null, 1) + ";\n";
    function done(msg) { NB.saved = stamp; dirty = false; try { localStorage.removeItem(DRAFT); } catch (e) {} presStatus(msg, true); }
    function fail(e) { if (e && e.name !== "AbortError" && e.message !== "cancel") presStatus("Not saved — " + e.message); }
    presStatus("Saving…");
    if (!win.showSaveFilePicker) {
      var a = win.document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
      a.download = "notes.js";
      win.document.body.appendChild(a); a.click(); a.remove();
      done("Downloaded notes.js → replace assets/notes.js in the presentation folder with it");
      return;
    }
    rememberedHandle().then(function (h) {
      if (!h) return null;
      // a remembered file is only reused if it is still the notes.js this deck was loaded from (folder not moved/copied)
      return h.requestPermission({ mode: "readwrite" }).then(function (p) {
        if (p !== "granted") return null;
        return h.getFile().then(function (f) { return f.text(); }).then(function (t) {
          var m = /"saved":\s*"([^"]*)"/.exec(t);
          return m && m[1] === NB.saved ? h : null;
        });
      }).catch(function () { return null; });
    }).then(function (h) {
      if (h) return h;
      presStatus("Choose " + (/^[A-Za-z]:/.test(DECK_DIR) ? DECK_DIR + "\\assets\\notes.js" : DECK_DIR.replace(/\\/g, "/") + "/assets/notes.js") + " (only once per copy)");   // Mac paths keep their slashes
      return win.showSaveFilePicker({ suggestedName: "notes.js", types: [{ description: "Presenter notes", accept: { "text/javascript": [".js"] } }] }).then(function (h2) {
        if (h2.name !== "notes.js" && !win.confirm('"' + h2.name + '" is not notes.js — the deck only reads assets/notes.js. Save anyway?')) throw new Error("cancel");
        return h2;
      });
    }).then(function (h) {
      return h.createWritable().then(function (w) { return w.write(text).then(function () { return w.close(); }); }).then(function () {
        noteHandle = h;
        idb("readwrite", function (st) { return st.put(h, "notesHandle"); }).catch(function () {});
        done("✓ Saved");
      });
    }).catch(fail);
  }
  function presStatus(msg, ok) {
    if (!presenter || presenter.closed) return;
    var st = presenter.document.getElementById("st");
    if (msg) { st.textContent = msg; st.className = ok ? "ok" : ""; return; }
    st.className = dirty ? "dirty" : "";
    st.textContent = dirty ? "Unsaved changes — press Save notes" :
      NB.saved ? "Saved " + new Date(NB.saved).toLocaleString() : "Not saved yet";
  }

  /* ---------- presenter window (notes only on the presenter's screen) ---------- */
  // presenter-only window: fixed monotone colors (not theme tokens); amber = unsaved, green = saved
  var PRES_CSS = "body{margin:0;background:#1C1C1E;color:#F2F2F4;font-family:'Segoe UI','Malgun Gothic',sans-serif;display:grid;grid-template-rows:auto 1fr auto;height:100vh}" +
    "header{display:flex;align-items:center;gap:16px;padding:14px 20px;border-bottom:1px solid #3A3A3C}header b{font-size:22px}header .t{font:600 22px Consolas,monospace;color:#D1D1D6;margin-left:auto}" +
    "main{display:grid;grid-template-columns:2fr 1fr;gap:18px;padding:18px 20px;min-height:0}" +
    ".notes{box-sizing:border-box;width:100%;height:100%;resize:none;border:1px solid transparent;outline:0;color:inherit;font:21px/1.55 'Segoe UI','Malgun Gothic',sans-serif;background:#2C2C2E;border-radius:6px;padding:18px 22px}" +
    ".notes:focus{border-color:#636366}.notes::placeholder{color:#8E8E93}" +
    ".side{display:flex;flex-direction:column;gap:12px}.box{background:#2C2C2E;border-radius:6px;padding:14px 16px}.box small{display:block;font:600 11px Consolas,monospace;letter-spacing:.14em;color:#AEAEB2;margin-bottom:6px}" +
    ".box div{font-size:17px;font-weight:700}footer{display:flex;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid #3A3A3C}" +
    "button{background:#3A3A3C;color:#fff;border:0;border-radius:4px;padding:10px 22px;font-size:15px;cursor:pointer}#sv{background:#D1D1D6;color:#1C1C1E;font-weight:700}" +
    "#sv{padding:12px 30px;font-size:17px}#st{margin-left:auto;font-size:15px;color:#AEAEB2;text-align:right}#st.dirty{color:#E8C27A}#st.ok{color:#9FD39B;font-weight:700;font-size:17px}";
  function openPresenter() {
    if (presenter && !presenter.closed) { presenter.focus(); return; }
    presenter = window.open("", KEY + "|presenter", "width=1100,height=720");
    if (!presenter) { alert("Pop-up blocked: allow pop-ups to open the presenter window."); return; }
    var d;
    try { d = presenter.document; } catch (e) {
      // a presenter window left from before this page was reloaded: it can no longer be reached
      presenter.close(); presenter = null;
      alert("The old presenter window was closed. Press P again.");
      return;
    }
    d.open();
    d.write('<!doctype html><html><head><meta charset="utf-8"><title>Presenter — ' + esc(document.title) + "</title><style>" + PRES_CSS +
      '</style></head><body><header><b id="n"></b><span id="ti"></span><span class="t" id="tm">00:00</span></header>' +
      '<main><textarea class="notes" id="no" spellcheck="true" placeholder="No notes for this slide — type here to add. Blank line = new paragraph."></textarea>' +
      '<div class="side"><div class="box"><small>NOW</small><div id="cur"></div></div>' +
      '<div class="box"><small>NEXT</small><div id="nx"></div></div><div class="box"><small>CHAPTER</small><div id="ch"></div></div></div></main>' +
      '<footer><button id="pv">◀ Prev</button><button id="nt">Next ▶</button><button id="rs">Reset timer</button>' +
      '<button id="sv" title="Ctrl+S">Save notes</button><span id="st"></span></footer></body></html>');
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
      ta.value = (NOTES[src] || []).join("\n\n");
      ta.scrollTop = 0;
    }
  }
  setInterval(function () {
    if (!presenter || presenter.closed) return;
    var s = Math.floor((Date.now() - t0) / 1000);
    presenter.document.getElementById("tm").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }, 1000);

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
    var ov = document.getElementById("overlay").classList.contains("open");
    if (e.key === "Escape") { if (ov) closeReport(); toggleOverview(false); return; }
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
  }

  /* ---------- chrome: background, bars, report overlay, overview ----------
     Built here so a deck's HTML holds only its slides. The top bar comes from
     <body data-logo="assets/img/logo.webp" data-topline="Company · Event">. */
  var KEYS = "← → move · Enter play video · F full screen · G overview · P presenter";
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
    idx = n ? Math.min(slides.length, n) - 1 : 0;
    fit(); render();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
