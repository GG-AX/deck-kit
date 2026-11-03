"""Print the deck to a PDF with headless Chromium — text stays text (sharp, searchable), not screenshots.

usage: python pdf.py [deck] [--out FILE]
  deck   deck workspace, its presentation folder or the .html (default: current folder)
  --out  default <deck workspace>\\<workspace folder name>.pdf
One page per slide (1280×720), animations at their end state (?static).
Full-screen video slides (.video-full) are left out; product-card clips show their photo.
"""
import argparse
import base64
import json
from pathlib import Path

from deckutil import Chromium, deck_root, find_html

# before the deck's scripts run: motion.js may set window.MOTION, the engine then sees no clips and keeps the photos
NO_MOTION = "Object.defineProperty(window, 'MOTION', {get: function () { return {}; }, set: function () {}});"
PRINT_CSS = """
@page{size:1280px 720px;margin:0}
html,body{height:auto!important;overflow:visible!important}
body>*:not(.stage){display:none!important}
.stage{position:static!important;display:block!important}
.deck{transform:none!important;height:auto!important}
.slide{position:relative!important;inset:auto!important;width:1280px;height:720px;overflow:hidden;break-after:page;
  opacity:1!important;visibility:visible!important;transform:none!important}
.slide.dark{background:linear-gradient(135deg,var(--bg-deep),var(--bg-mid))}
.slide:not(.dark)::before{border-radius:0;box-shadow:none}
"""
PREPARE = """(async () => {
  let cut = 0;
  document.querySelectorAll('.slide').forEach(s => {
    if (s.querySelector('.video-full')) { s.remove(); cut++; } else s.classList.add('active');
  });
  document.querySelectorAll('img[loading]').forEach(i => i.loading = 'eager');
  const st = document.createElement('style'); st.textContent = %s; document.head.appendChild(st);
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  // the PDF stores pictures other than JPEG (webp) uncompressed at full size: shrink each to twice its printed
  // size, opaque ones as JPEG, transparent ones (cut-outs) as PNG
  const small = [...document.images].filter(i => i.naturalWidth > 64 && !/\\.svg/i.test(i.src)).map(i => {
    const b = i.getBoundingClientRect();
    const s = b.width ? Math.min(1, 2 * Math.max(b.width / i.naturalWidth, b.height / i.naturalHeight)) : 1;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(i.naturalWidth * s)); c.height = Math.max(1, Math.round(i.naturalHeight * s));
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, c.width, c.height);
    const a = x.getImageData(0, 0, c.width, c.height).data;
    let opaque = true;
    for (let k = 3; k < a.length; k += 4) if (a[k] < 255) { opaque = false; break; }
    if (!opaque && s === 1) return 0;
    return new Promise(r => { i.onload = i.onerror = r; i.removeAttribute('srcset');
      i.src = opaque ? c.toDataURL('image/jpeg', 0.88) : c.toDataURL('image/png'); });
  });
  await Promise.all(small);
  return [document.querySelectorAll('.slide').length, cut];
})()"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    ap.add_argument("--out")
    a = ap.parse_args()

    html = find_html(a.deck)
    root = deck_root(html)
    out = Path(a.out) if a.out else root / (root.name + ".pdf")
    # file access: the deck's own pictures may be read back from a canvas (JPEG step)
    with Chromium(size=(1280, 720), args=("--allow-file-access-from-files",)) as c:
        c.send("Page.enable")
        c.send("Page.addScriptToEvaluateOnNewDocument", source=NO_MOTION)
        c.open(html.as_uri() + "?static#1")
        pages, cut = c.ev(PREPARE % json.dumps(PRINT_CSS), wait=True)
        r = c.send("Page.printToPDF", printBackground=True, preferCSSPageSize=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(r["data"]))
    print("%s — %d pages%s (%.1f MB)" % (out, pages, ", %d video slides left out" % cut if cut else "",
                                         out.stat().st_size / 1e6))


if __name__ == "__main__":
    main()
