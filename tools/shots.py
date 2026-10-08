"""Screenshot every slide (animations off: ?static) with headless Edge and print browser console errors.

usage: python shots.py [deck] [--from N] [--to N] [--size W,H] [--out DIR] [--reports]
  deck       deck workspace, its presentation folder or the .html (default: current folder)
  --out      default <deck>\\work\\shots  (files sNN.png)
  --reports  also capture the top of every report a slide opens (data-report) and save it as the
             report card preview: presentation\\assets\\img\\reports\\<report name>.webp
"""
import argparse
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from deckutil import count_slides, deck_root, edge_cli, find_html


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    ap.add_argument("--from", dest="first", type=int, default=1)
    ap.add_argument("--to", dest="last", type=int)
    ap.add_argument("--size", default="1600,900")
    ap.add_argument("--out")
    ap.add_argument("--reports", action="store_true")
    a = ap.parse_args()

    html = find_html(a.deck)
    out = Path(a.out) if a.out else deck_root(html) / "work" / "shots"
    out.mkdir(parents=True, exist_ok=True)
    n = count_slides(html)
    last = min(a.last or n, n)

    def one(k):
        f = out / ("s%02d.png" % k)
        if f.exists():
            f.unlink()
        _, errors = edge_cli(html.as_uri() + "?static#%d" % k, "--screenshot=" + str(f), size=a.size)
        return f, errors

    print("%s — %d slides → %s" % (html.name, n, out))
    bad = 0
    with ThreadPoolExecutor(6) as ex:
        for f, errors in ex.map(one, range(a.first, last + 1)):
            print(("ok      " if f.exists() else "MISSING ") + f.name)
            bad += not f.exists()
            for e in errors:
                print("   console:", e.split("CONSOLE", 1)[-1].strip())
    if a.reports:
        bad += reports(html, out)
    raise SystemExit(1 if bad else 0)


def reports(html, out):
    from PIL import Image
    dest = html.parent / "assets" / "img" / "reports"
    bad = 0
    for rel in sorted(set(re.findall(r'data-report="([^"]+)"', html.read_text(encoding="utf-8")))):
        rep = html.parent / rel
        if not rep.is_file():
            print("MISSING report", rel)
            bad += 1
            continue
        png = out / ("report_%s.png" % rep.stem)
        edge_cli(rep.as_uri(), "--screenshot=" + str(png), size="1600,1000", budget=20000, timeout=300)
        dest.mkdir(parents=True, exist_ok=True)
        thumb = dest / (rep.stem + ".webp")
        Image.open(png).convert("RGB").save(thumb, quality=86, method=6)
        print("report preview → " + thumb.relative_to(html.parent).as_posix())
    return bad


if __name__ == "__main__":
    main()
