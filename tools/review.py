"""Read the review pins a person left in the deck (R in the deck → assets/review.js), and mark them applied.

usage: python review.py [deck] [--all] [--shots DIR] [--resolve N "what was done"]...
  deck       deck workspace, its presentation folder or the .html (default: current folder)
  (default)  open pins as a table: pin · slide number · id · title · note · what was under the click,
             then the slides marked "이 장 PDF에서 빼기" (pdf.py leaves them out by itself)
  --all      also the pins already applied
  --shots    capture each slide with open pins, pins drawn (?static&review), to DIR\\sNN.png
  --resolve  mark pin N applied with a one-line reply the person sees in the deck ("지난 의견 보기");
             repeat for more pins. The file is backed up first (assets\\review_backup\\, last 20, like the engine)
"""
import argparse
import html as htmllib
import json
import re
import shutil
import subprocess
import time
from pathlib import Path

from deckutil import browser_cli, find_html, read_js_data

BACKUPS = 20


def slides(html):
    """[(data-src, data-title)] in deck order."""
    out = []
    for tag in re.findall(r"<section\b[^>]*>", html.read_text(encoding="utf-8")):
        src = re.search(r'\bdata-src="([^"]*)"', tag)
        if src:
            t = re.search(r'\bdata-title="([^"]*)"', tag)
            out.append((src.group(1), htmllib.unescape(t.group(1)) if t else ""))
    return out


def cell(s):
    return str(s or "").replace("|", "／").replace("\n", " ")


def save(path, data):
    bak = path.parent / "review_backup"
    bak.mkdir(exist_ok=True)
    shutil.copy2(path, bak / ("review_" + time.strftime("%Y%m%d-%H%M%S") + ".js"))
    for old in sorted(bak.glob("*.js"))[:-BACKUPS]:
        old.unlink()
    path.write_text("window.DECK_REVIEW = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--shots")
    ap.add_argument("--resolve", nargs=2, action="append", metavar=("N", "REPLY"), default=[])
    a = ap.parse_args()

    html = find_html(a.deck)
    path = html.parent / "assets" / "review.js"
    if not path.exists():
        raise SystemExit("no assets/review.js — nobody has saved a review in this deck yet (R in the deck)")
    data = read_js_data(path)
    pins = data.get("pins", [])
    order = slides(html)
    num = {s: k + 1 for k, (s, _) in enumerate(order)}
    titles = dict(order)

    if a.resolve:
        by_id = {p["id"]: p for p in pins}
        for n, reply in a.resolve:
            if int(n) not in by_id:
                raise SystemExit("no pin %s (pins: %s)" % (n, sorted(by_id)))
            by_id[int(n)].update(done=True, reply=reply)
        save(path, data)
        print("marked applied: %s" % ", ".join(n for n, _ in a.resolve))
        return

    show = sorted((p for p in pins if a.all or not p.get("done")), key=lambda p: (num.get(p.get("slide"), 999), p["id"]))
    print("| pin | slide | id | title | note | under the click |" + (" applied |" if a.all else ""))
    print("|---|---|---|---|---|---|" + ("---|" if a.all else ""))
    for p in show:
        s = p.get("slide")
        print("| %d | %s | %s | %s | %s | %s |" % (p["id"], num.get(s, "(not in deck)"), s, cell(titles.get(s)), cell(p.get("note")), cell(p.get("at")))
              + (" %s |" % cell(p.get("reply")) if a.all and p.get("done") else (" |" if a.all else "")))
    print("open pins: %d of %d" % (sum(not p.get("done") for p in pins), len(pins)))
    off = data.get("nopdf", [])
    print("이 장 PDF에서 빼기: %s" % (", ".join("%s (%s)" % (num.get(k, "?"), k) for k in off) or "none"))

    if a.shots:
        out = Path(a.shots)
        out.mkdir(parents=True, exist_ok=True)
        for k in sorted({num[p["slide"]] for p in pins if not p.get("done") and p.get("slide") in num}):
            f = out / ("s%02d.png" % k)
            try:
                browser_cli(html.as_uri() + "?static&review#%d" % k, "--screenshot=" + str(f))
            except subprocess.TimeoutExpired:
                pass
            print(("saved " if f.exists() else "FAILED ") + str(f))


if __name__ == "__main__":
    main()
