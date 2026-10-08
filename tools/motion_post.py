"""Turn a short clip into a seamless loop for a product card (or a full video), and link it.

usage: python motion_post.py <clip.mp4> --image assets/img/…/card.webp [--deck DIR] [--box W:H] [--height 960] [--link]
  --image   the card image the clip belongs to (path as written in data.js); the loop is named after it
  --box     crop like the card shows it (card width : height, e.g. 280:450; picture kept at x centre, y 85%)
  --height  output height in px (default 960)
  --link    also map the image to the loop in presentation\\assets\\motion.js
Writes presentation\\assets\\video\\<image name>.mp4 (forward + reverse = loops without a jump, no sound)
and a 3-frame review strip in <deck>\\work\\motion_frames\\<image name>.jpg.
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

from deckutil import find_ffmpeg, find_html


def strip(ff, clip, out, seconds):
    out.parent.mkdir(parents=True, exist_ok=True)
    ims = []
    with tempfile.TemporaryDirectory() as tmp:
        for k, t in enumerate((0.0, seconds / 2, max(0.0, seconds - 0.1))):
            png = Path(tmp) / ("%d.png" % k)
            subprocess.run([ff, "-v", "error", "-y", "-ss", "%.2f" % t, "-i", str(clip), "-frames:v", "1", str(png)], check=True)
            im = Image.open(png).convert("RGB")
            ims.append(im.resize((int(im.width * 480 / im.height), 480)))
    s = Image.new("RGB", (sum(i.width for i in ims) + 16, 480), "white")
    x = 0
    for im in ims:
        s.paste(im, (x, 0))
        x += im.width + 8
    s.save(out, quality=88)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clip")
    ap.add_argument("--image", required=True)
    ap.add_argument("--deck", default=".")
    ap.add_argument("--box")
    ap.add_argument("--height", type=int, default=960)
    ap.add_argument("--link", action="store_true")
    a = ap.parse_args()
    ff = find_ffmpeg()
    html = find_html(a.deck)
    pres = html.parent
    name = Path(a.image).stem
    dst = pres / "assets" / "video" / (name + ".mp4")
    dst.parent.mkdir(parents=True, exist_ok=True)
    crop = ""
    if a.box:
        w, h = (float(x) for x in a.box.split(":"))
        r = w / h   # same crop the card applies: cover, x centre, y 85%
        crop = "crop='if(gt(iw/ih,{r}),ih*{r},iw)':'if(gt(iw/ih,{r}),ih,iw/{r})':'(iw-ow)/2':'(ih-oh)*0.85',".format(r=r)
    vf = "[0:v]%sscale=-2:%d:flags=lanczos,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[v]" % (crop, a.height)
    subprocess.run([ff, "-v", "error", "-y", "-i", a.clip, "-filter_complex", vf, "-map", "[v]", "-an", "-c:v", "libx264",
                    "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dst)], check=True)
    probe = str(Path(ff).with_name(Path(ff).name.lower().replace("ffmpeg", "ffprobe")))
    seconds = float(subprocess.run([probe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dst)],
                                   capture_output=True, text=True).stdout.strip() or 4)
    review = pres.parent / "work" / "motion_frames" / (name + ".jpg")
    strip(ff, dst, review, seconds)
    print("loop →", dst.relative_to(pres).as_posix(), "%.2f MB" % (dst.stat().st_size / 1e6), "| review strip →", review)
    if a.link:
        js = pres / "assets" / "motion.js"
        text = js.read_text(encoding="utf-8") if js.exists() else "window.MOTION = {};\n"
        head = text[:text.index("window.MOTION")]
        motion = json.loads(text[text.index("{", text.index("window.MOTION")):text.rindex("}") + 1])
        motion[a.image] = dst.relative_to(pres).as_posix()
        js.write_text(head + "window.MOTION = %s;\n" % json.dumps(motion, indent=1, ensure_ascii=False), encoding="utf-8")
        print("linked in assets/motion.js:", a.image, "→", motion[a.image])
        if 'src="assets/motion.js"' not in html.read_text(encoding="utf-8"):
            print('note: add <script src="assets/motion.js"></script> before engine.js in', html.name)


if __name__ == "__main__":
    main()
