"""Remove identical files inside presentation\\ (e.g. one logo saved under several folders).

usage: python dedupe_presentation.py [deck] [--dry]
For each group of identical files (same size and content): keep one copy (the shortest path, then the
first in name order), rewrite every "path" in the deck .html and the deck's data scripts (data.js,
motion.js, …) to it, and delete the other copies. --dry only prints what would happen.
"""
import argparse
import collections
import hashlib
import os
import subprocess

from deckutil import find_html

SKIP = {"assets/notes.prev.js"}   # backup written by the notes save helper, a copy by design


def md5(path):
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    html = find_html(a.deck)
    pres = html.parent
    groups = collections.defaultdict(list)
    for p in pres.rglob("*"):
        rel = p.relative_to(pres).as_posix()
        if p.is_file() and rel not in SKIP:
            groups[(p.stat().st_size, md5(p))].append(rel)
    texts = [html] + [f for f in (pres / "assets").glob("*.js") if f.name not in ("engine.js", "notes.js", "notes.prev.js")]
    content = {t: t.read_text(encoding="utf-8") for t in texts}
    removed = 0
    for paths in groups.values():
        if len(paths) < 2:
            continue
        paths.sort(key=lambda x: (len(x), x))
        keep, others = paths[0], paths[1:]
        print("keep", keep, "←", ", ".join(others))
        if a.dry:
            continue
        for x in others:
            for t in content:
                content[t] = content[t].replace('"' + x + '"', '"' + keep + '"')
            (pres / x).unlink()
            removed += 1
    if not a.dry:
        for t, s in content.items():
            t.write_text(s, encoding="utf-8")
        for dp, _, _ in sorted(os.walk(pres / "assets"), key=lambda x: -len(x[0])):
            if not os.listdir(dp):
                subprocess.run(["attrib", "-r", dp], capture_output=True)   # OneDrive folders can be read-only
                os.rmdir(dp)
    print("removed copies:", removed)


if __name__ == "__main__":
    main()
