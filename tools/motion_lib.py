"""Shared motion library: reuse a card clip another deck already made, and keep new clips for the next deck.

usage: python motion_lib.py find --key STYLE [--image card.webp] [--deck DIR --case M01]
       python motion_lib.py add  --key STYLE --image card.webp --clip ai/motion/out/M01.mp4 [--deck DIR] [--prompt upper] [--model kling4_0]
  --key    the style number (the same style in a later deck finds the clip); --image also matches the exact same photo
  find     prints the library folder and exits 0, or exits 1 when there is none.
           With --deck and --case it copies the clip to <deck>/ai/motion/out/<case>.mp4 - then motion_post.py as usual.
  add      copies the start image and the raw clip (before motion_post) into <library>/<key>/ with info.json.
Library folder: the LIBRARY line below or the DECKKIT_MOTION_LIB environment variable. When neither is set or the
folder cannot be reached (no access), the tool says so and exits 0 - make new clips or keep the stills.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

import deckutil  # noqa: F401  (utf-8 console output)

LIBRARY = ""   # the shared folder, e.g. a synced team folder - set it once the team picks one


def sha1(path):
    return hashlib.sha1(Path(path).read_bytes()).hexdigest()


def folder(key):
    return re.sub(r'[<>:"/\\|?*\s]+', "_", key.strip())


def library():
    p = os.environ.get("DECKKIT_MOTION_LIB") or LIBRARY
    if not p:
        print("motion library not set - skipped (set LIBRARY in motion_lib.py or DECKKIT_MOTION_LIB)")
    elif not Path(p).is_dir():
        print("motion library not reachable: %s - skipped (no access: keep the stills or make new clips)" % p)
    else:
        return Path(p)
    return None


def find(lib, key, image=None):
    d = lib / folder(key)
    if (d / "clip.mp4").exists():
        return d
    if image:   # same photo filed under another key
        h = sha1(image)
        for info in lib.glob("*/info.json"):
            if json.loads(info.read_text(encoding="utf-8")).get("image_sha1") == h:
                return info.parent
    return None


def add(lib, key, image, clip, prompt=None, model=None, deck=None):
    d = lib / folder(key)
    d.mkdir(parents=True, exist_ok=True)
    shutil.copy2(image, d / ("start" + Path(image).suffix.lower()))
    shutil.copy2(clip, d / "clip.mp4")
    info = {"key": key, "image_sha1": sha1(image), "prompt": prompt, "model": model,
            "deck": deck, "date": time.strftime("%Y-%m-%d")}
    (d / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
    return d


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["find", "add"])
    ap.add_argument("--key", required=True)
    ap.add_argument("--image")
    ap.add_argument("--clip")
    ap.add_argument("--deck", default=".")
    ap.add_argument("--case")
    ap.add_argument("--prompt")
    ap.add_argument("--model")
    a = ap.parse_args()
    lib = library()
    if not lib:
        return
    root = Path(a.deck).resolve()
    img = root / a.image if a.image else None
    if a.cmd == "find":
        d = find(lib, a.key, img if img and img.exists() else None)
        if not d:
            print("not in library: %s" % a.key)
            sys.exit(1)
        print(d)
        if a.case:
            out = root / "ai" / "motion" / "out" / (a.case + ".mp4")
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(d / "clip.mp4", out)
            print("copied to %s" % out)
    else:
        if not (img and a.clip):
            sys.exit("add needs --image and --clip")
        print(add(lib, a.key, img, root / a.clip, a.prompt, a.model, root.name))


if __name__ == "__main__":
    main()
