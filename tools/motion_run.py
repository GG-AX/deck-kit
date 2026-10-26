"""Make short clips from still images with the Higgsfield CLI (costs credits - ask the user first).

Run --dry-run first and show the user the list and credits before submitting anything.
Every job id is written to <deck>/ai/higgsfield_jobs.json right after it is submitted, and a case that is
already in that log is never submitted again (no double spending). Finished clips: <deck>/ai/motion/out/<case>.mp4

usage: python motion_run.py --plan plan.json [--plan more.json] [--deck DIR] [--dry-run]
  --dry-run  only lists what would be submitted and the credits written in the plan - nothing is sent
plan.json (UTF-8), paths relative to the deck folder:
  [ { "case": "M01", "image": "source/look1.png", "prompt": "...", "end_image": true,
      "model": "seedance_2_0", "aspect_ratio": "3:4", "duration": 5, "resolution": "720p", "credits": 22.5 } ]
  end_image: end on the start image (the clip loops back without a jump). Defaults: the values above.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import deckutil  # noqa: F401  (utf-8 console output)

UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def opt(p, name, default):
    v = p.get(name)
    return default if v is None or str(v) == "" else v


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--plan", action="append", required=True)
    ap.add_argument("--deck", default=".")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    root = Path(a.deck).resolve()
    log = root / "ai" / "higgsfield_jobs.json"
    out_dir = root / "ai" / "motion" / "out"

    def read_log():
        return json.loads(log.read_text(encoding="utf-8")) if log.exists() else []

    cli = None
    if not a.dry_run:
        cli = shutil.which("higgsfield.cmd" if os.name == "nt" else "higgsfield") or shutil.which("higgsfield")
        if not cli:
            sys.exit("higgsfield CLI not found (looked for higgsfield / higgsfield.cmd on PATH) — install it first.")

    jobs, stop, total = [], False, 0.0
    for plan in a.plan:
        if stop:
            break
        for p in json.loads(Path(plan).read_text(encoding="utf-8")):
            old = next((x for x in read_log() if x.get("case") == p["case"]), None)
            if old:
                print("%s already submitted (%s) - skipped" % (p["case"], old["job"]))
                jobs.append({"case": p["case"], "job": old["job"]})
                continue
            img = root / p["image"]
            model, ar, dur = opt(p, "model", "seedance_2_0"), opt(p, "aspect_ratio", "3:4"), opt(p, "duration", 5)
            res, credits = opt(p, "resolution", "720p"), opt(p, "credits", None)
            if not img.exists():
                print("%s image not found: %s - stopping" % (p["case"], img))
                stop = True
                break
            if a.dry_run:
                print("%s: %s %s %ss %s, image %s, credits %s" % (p["case"], model, ar, dur, res, p["image"], credits or "?"))
                total += float(credits or 0)
                continue
            extra = ["--end-image", str(img)] if p.get("end_image") else []
            r = subprocess.run([cli, "generate", "create", model, "--start-image", str(img), *extra, "--prompt", p["prompt"],
                                "--aspect_ratio", str(ar), "--duration", str(dur), "--resolution", str(res),
                                "--generate_audio", "false", "--json"],
                               capture_output=True, text=True, encoding="utf-8", errors="replace")
            raw = r.stdout + r.stderr
            m = UUID.search(r.stdout)   # without --wait the CLI prints just the new job id(s): ["<uuid>"]
            if not m:
                print("%s SUBMIT FAILED - stopping so nothing is charged twice:\n%s" % (p["case"], raw))
                stop = True
                break
            entries = read_log() + [{"case": p["case"], "job": m.group(0), "model": model, "prompt": p["prompt"], "credits": credits,
                                     "end_image": bool(p.get("end_image")), "image": p["image"],
                                     "out": "ai/motion/out/%s.mp4" % p["case"], "date": time.strftime("%Y-%m-%d")}]
            log.parent.mkdir(parents=True, exist_ok=True)
            log.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
            print("%s submitted %s" % (p["case"], m.group(0)))
            jobs.append({"case": p["case"], "job": m.group(0)})
    if a.dry_run:
        print("dry run - nothing submitted. Credits written in the plan: %g" % total)
        return

    # wait for all, download as they finish
    out_dir.mkdir(parents=True, exist_ok=True)
    pending = [j for j in jobs if not (out_dir / (j["case"] + ".mp4")).exists()]
    deadline = time.time() + 60 * 60
    while pending and time.time() < deadline:
        time.sleep(20)
        for j in pending[:]:
            try:
                r = json.loads(subprocess.run([cli, "generate", "get", j["job"], "--json"], capture_output=True,
                                              text=True, encoding="utf-8", errors="replace").stdout)
            except ValueError:
                continue
            if r.get("status") == "completed":
                urllib.request.urlretrieve(r["result_url"], str(out_dir / (j["case"] + ".mp4")))
                print("%s done" % j["case"])
                pending.remove(j)
            elif r.get("status") in ("failed", "nsfw", "canceled", "cancelled"):
                print("%s %s" % (j["case"], r["status"]))
                pending.remove(j)
    print("finished; still pending: %d" % len(pending))


if __name__ == "__main__":
    main()
