"""Which files in presentation\\assets does the deck actually use?

usage: python used_assets.py [deck] [--move]
used = files the browser loads while every slide is shown (headless Edge)
     + files named in the deck: HTML src/href/poster/data-report, every "assets/…" path in the deck's
       data scripts (data.js, motion.js, …), url() in engine.css/deck.css
     + always: the engine files, notes.js(+ notes.prev.js), the save helper, every font and its licence
     + files a versions\\ backup uses (backups load pictures from the live presentation folder)
Prints a summary, files that are referenced but missing, and whether card clips play.
--move puts the unused files in <deck>\\work\\unused_assets\\<same path> (nothing is deleted).
"""
import argparse
import re
import shutil
import time
import urllib.parse
from pathlib import Path

from deckutil import Edge, count_slides, deck_root, find_html

ALWAYS = {"assets/engine.js", "assets/engine.css", "assets/deck.css", "assets/notes.js", "assets/notes.prev.js", "assets/notes_server.ps1"}


def dynamic(html, pres):
    with Edge(args=["--autoplay-policy=no-user-gesture-required"]) as e:
        e.send("Network.enable")
        e.open(html.as_uri() + "#1")
        time.sleep(2)
        playing = {}
        for s in range(1, count_slides(html) + 1):
            e.ev("location.hash='#%d'" % s)
            time.sleep(2.2)
            v = e.ev("[].map.call(document.querySelectorAll('#deck > .slide')[%d].querySelectorAll('.bs-card video'),"
                     "function(x){return x.readyState>=2&&!x.paused})" % (s - 1)) or []
            if v:
                playing[s] = v
        events = e.events
    files, failed = set(), []
    for m in events:
        if m.get("method") == "Network.requestWillBeSent":
            u = m["params"]["request"]["url"]
            if u.startswith("file:///"):
                p = urllib.parse.unquote(urllib.parse.urlparse(u).path).lstrip("/")
                rel = relative(pres, p)
                if rel:
                    files.add(rel)
        elif m.get("method") == "Network.loadingFailed":
            failed.append(m["params"].get("errorText"))
    return files, failed, playing


def relative(pres, path):
    try:
        return Path(path).resolve().relative_to(pres.resolve()).as_posix()
    except ValueError:
        return None


def refs(html):
    """Paths (relative to presentation\\) named in a deck HTML and in the data scripts next to it."""
    keep, text = set(), html.read_text(encoding="utf-8")
    for a, b in re.findall(r'(?<!data-)(?:src|href|poster)="([^"]+)"|data-report="([^"]+)"', text):
        r = a or b
        if not re.match(r"^(https?:|#|data:|\.\./)", r):
            keep.add(urllib.parse.unquote(r.split("?")[0]))
    keep |= set(re.findall(r'(assets/[^"\'\s)<>]+\.\w{2,5})', text))
    for js in (html.parent / "assets").glob("*.js"):
        if js.name != "engine.js":
            keep |= set(re.findall(r'"(assets/[^"]+)"', js.read_text(encoding="utf-8")))
    return keep


def static(html, pres):
    keep = set(ALWAYS) | refs(html)
    for css in ("engine.css", "deck.css"):
        f = pres / "assets" / css
        if f.exists():
            for r in re.findall(r"url\(([^)]+)\)", f.read_text(encoding="utf-8")):
                r = r.strip("'\"")
                if not r.startswith("data:"):
                    keep.add("assets/" + r)
    keep |= {"assets/fonts/" + f.name for f in (pres / "assets" / "fonts").glob("*")} if (pres / "assets" / "fonts").is_dir() else set()
    return keep


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    ap.add_argument("--move", action="store_true")
    a = ap.parse_args()
    html = find_html(a.deck)
    pres = html.parent
    dyn, failed, playing = dynamic(html, pres)
    keep = dyn | static(html, pres)
    backup = set()
    for b in (deck_root(html) / "versions").glob("*/*.html"):   # a backup's <base> points at the live presentation folder
        backup |= refs(b)
    print("kept for versions backups:", len(backup - keep))
    keep |= backup
    all_files = [p.relative_to(pres).as_posix() for p in (pres / "assets").rglob("*") if p.is_file()]
    unused = sorted(f for f in all_files if f not in keep)
    size = sum((pres / f).stat().st_size for f in unused)
    print("assets files: %d | used: %d | unused: %d (%.1f MB)" % (len(all_files), len(all_files) - len(unused), len(unused), size / 1e6))
    for f in unused:
        print("  unused", f)
    missing = sorted(f for f in keep if f.startswith("assets/") and f not in ALWAYS and not (pres / f).exists())
    print("referenced but missing:", missing or "none")
    print("load failures:", [x for x in failed if x and "ABORTED" not in x][:5] or "none")
    if playing:
        print("card clips playing: %d of %d" % (sum(sum(v) for v in playing.values()), sum(len(v) for v in playing.values())))
    if a.move and unused:
        dest = deck_root(html) / "work" / "unused_assets"
        for f in unused:
            (dest / f).parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(pres / f), str(dest / f))
        for d in sorted((pres / "assets").rglob("*"), key=lambda p: -len(p.parts)):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
        (dest / "_moved_list.txt").write_text("\n".join(unused), encoding="utf-8")
        print("moved", len(unused), "files →", dest)


if __name__ == "__main__":
    main()
