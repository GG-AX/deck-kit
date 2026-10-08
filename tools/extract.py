"""PowerPoint (.pptx) → slide manifest, web images, speaker notes, embedded HTML reports.

usage: python extract.py <file.pptx> [--deck DIR] [--prefix SUBDIR] [--manifest PATH] [--no-reports]
  --deck      the deck workspace (default: current folder); its presentation\\ folder is created if missing
  --prefix    put the images under assets\\img\\<prefix>\\sNN\\ (e.g. a second PPT version)
  --manifest  default <deck>\\work\\manifest.json
Writes
  manifest                                    every slide's shapes (text, pictures, videos, tables) with
                                              position and size in pt, plus the speaker notes
  presentation\\assets\\img\\[prefix\\]sNN\\*.webp  the slide pictures, longest side ≤ 1600 px, with the PPT crop
                                              applied (file name -cK when the same picture is cropped
                                              differently; the crop is in the manifest as "crop": [l, t, r, b]
                                              fractions). SVG-only pictures are copied as .svg
  presentation\\reports\\*.html                 HTML files embedded in the PPT (OLE packages)
Pictures that cannot be read (broken, or EMF/WMF) are skipped and listed at the end.
The PPT is only read. If PowerPoint has it open, close it first (the file is locked).
"""
import argparse
import io
import json
import posixpath
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image, ImageFile

import deckutil  # noqa: F401  (utf-8 console output)

ImageFile.LOAD_TRUNCATED_IMAGES = True   # a PPT can hold a cut-off PNG; show what is there instead of stopping
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
SVG = "{http://schemas.microsoft.com/office/drawing/2016/SVG/main}svgBlip"
EMU = 12700.0
MAX_SIDE = 1600


class Pptx:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.names = set(self.z.namelist())

    def read(self, part):
        return self.z.read(part)

    def rels(self, part):
        d, b = posixpath.split(part)
        rp = posixpath.join(d, "_rels", b + ".rels")
        out = {}
        if rp in self.names:
            for r in ET.fromstring(self.read(rp)):
                t = r.get("Target")
                if r.get("TargetMode") != "External":
                    t = posixpath.normpath(posixpath.join(d, t))
                out[r.get("Id")] = (r.get("Type").split("/")[-1], t)
        return out


def paras(el):
    out = []
    for p in el.iter(A + "p"):
        s = "".join(t.text or "" for t in p.iter(A + "t")).strip()
        if s:
            out.append(s)
    return out


def xfrm(el):
    for path in (P + "spPr/" + A + "xfrm", P + "grpSpPr/" + A + "xfrm", P + "xfrm", ".//" + A + "xfrm"):
        x = el.find(path)
        if x is not None:
            return x
    return None


def walk(tree, sr, tf, out):
    """Collect shapes; tf maps child coordinates to slide coordinates (sx, sy, ox, oy) through groups."""
    sx, sy, ox, oy = tf
    for ch in tree:
        tag = ch.tag.split("}")[1]
        if tag not in ("sp", "pic", "grpSp", "graphicFrame"):
            continue
        nv = ch.find(".//" + P + "cNvPr")
        x = xfrm(ch)
        if x is None or x.find(A + "off") is None:
            continue
        off, ext = x.find(A + "off"), x.find(A + "ext")
        bx, by, bw, bh = int(off.get("x")), int(off.get("y")), int(ext.get("cx")), int(ext.get("cy"))
        X, Y, W, H = bx * sx + ox, by * sy + oy, bw * sx, bh * sy
        item = {"name": nv.get("name") if nv is not None else "", "x": X / EMU, "y": Y / EMU, "w": W / EMU, "h": H / EMU}
        if tag == "grpSp":
            co, ce = x.find(A + "chOff"), x.find(A + "chExt")
            cw, chh = int(ce.get("cx")) or 1, int(ce.get("cy")) or 1
            nsx, nsy = W / cw, H / chh
            walk(ch, sr, (nsx, nsy, X - int(co.get("x")) * nsx, Y - int(co.get("y")) * nsy), out)
        elif tag == "sp":
            t = paras(ch)
            if t:
                out.append(dict(item, kind="text", text=t))
        elif tag == "pic":
            b = ch.find(".//" + A + "blip")
            tgt = sr.get(b.get(R + "embed") if b is not None else None, ("", ""))[1]
            if not tgt:                                   # SVG-only picture: no bitmap fallback
                s = ch.find(".//" + SVG)
                tgt = sr.get(s.get(R + "embed") if s is not None else None, ("", ""))[1]
            vid = None
            for e in ch.iter():
                if e.tag.endswith("}media") or e.tag.endswith("videoFile"):
                    vid = sr.get(e.get(R + "embed") or e.get(R + "link"), ("", ""))[1] or vid
            if tgt:
                sr_ = ch.find(".//" + A + "srcRect")        # crop, 1/1000 % per side; negative = padding, ignored
                crop = [max(0, int(sr_.get(k, 0))) / 100000 if sr_ is not None else 0 for k in "ltrb"]
                out.append(dict(item, kind="video" if vid else "pic", media=tgt, video=vid,
                                **({"crop": crop} if any(crop) else {})))
        else:
            tbl = ch.find(".//" + A + "tbl")
            if tbl is not None:
                out.append(dict(item, kind="table", rows=[[" ".join(paras(tc)) for tc in tr.iter(A + "tc")] for tr in tbl.iter(A + "tr")]))


def save_image(ppt, src, dst_noext, crop=None):
    """Returns (path, (w, h)), or None for a format the browser cannot show. Raises on a broken image."""
    ext = posixpath.splitext(src)[1].lower()
    if ext == ".svg":
        path = dst_noext.with_suffix(".svg")
        path.write_bytes(ppt.read(src))
        return path, None
    if ext in (".emf", ".wmf", ".wdp", ".gif"):
        return None
    im = Image.open(io.BytesIO(ppt.read(src)))
    im.load()
    if crop:
        l, t, r, b = crop
        W, H = im.size
        im = im.crop((round(l * W), round(t * H), round(W * (1 - r)), round(H * (1 - b))))
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA" if "A" in im.getbands() or im.mode == "P" else "RGB")
    if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] == 255:   # alpha that hides nothing
        im = im.convert("RGB")
    s = min(1.0, MAX_SIDE / max(im.size))
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    path = dst_noext.with_suffix(".webp")
    im.save(path, "WEBP", quality=86, method=5)
    return path, im.size


def embedded_html(ppt):
    """(name, bytes) of every OLE package in the PPT (reports are embedded this way)."""
    import olefile
    parts = sorted((n for n in ppt.names if n.startswith("ppt/embeddings/oleObject") and n.endswith(".bin")),
                   key=lambda n: int("".join(c for c in posixpath.basename(n) if c.isdigit()) or 0))
    for part in parts:
        try:
            raw = olefile.OleFileIO(io.BytesIO(ppt.read(part))).openstream("\x01Ole10Native").read()
            # Ole10Native: size(4) flags(2) label\0 path\0 ?(4) ?(4) tmppath\0 datasize(4) data
            i = 6
            end = raw.index(b"\0", i)
            label = raw[i:end]
            i = raw.index(b"\0", end + 1) + 1 + 8
            i = raw.index(b"\0", i) + 1
            size = int.from_bytes(raw[i:i + 4], "little")
            data = raw[i + 4:i + 4 + size]
        except (OSError, ValueError, IndexError):
            print("skip", part, "(not a file package)")
            continue
        for enc in ("utf-8", "cp949"):          # the label is in the PC's code page (Korean Windows: cp949)
            try:
                name = label.decode(enc)
                break
            except UnicodeDecodeError:
                name = label.decode("latin-1")
        yield part, posixpath.basename(name.replace("\\", "/")), data


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pptx")
    ap.add_argument("--deck", default=".")
    ap.add_argument("--prefix", default="")
    ap.add_argument("--manifest")
    ap.add_argument("--no-reports", action="store_true")
    a = ap.parse_args()
    deck = Path(a.deck).resolve()
    pres = deck / "presentation"
    img_out = pres / "assets" / "img" / a.prefix if a.prefix else pres / "assets" / "img"
    manifest = Path(a.manifest).resolve() if a.manifest else deck / "work" / "manifest.json"
    try:
        ppt = Pptx(a.pptx)
    except PermissionError:
        sys.exit("The PPT is locked — close it in PowerPoint and run again.")
    pres_xml = ET.fromstring(ppt.read("ppt/presentation.xml"))
    size = pres_xml.find(P + "sldSz")
    page_w, page_h = int(size.get("cx")) / EMU, int(size.get("cy")) / EMU
    prels = ppt.rels("ppt/presentation.xml")
    order = [prels[s.get(R + "id")][1] for s in pres_xml.find(P + "sldIdLst")]
    slides, saved, skipped = [], {}, []
    for i, part in enumerate(order, 1):
        sr = ppt.rels(part)
        shapes = []
        walk(ET.fromstring(ppt.read(part)).find(P + "cSld/" + P + "spTree"), sr, (1, 1, 0, 0), shapes)
        notes = []
        for kind, t in sr.values():
            if kind == "notesSlide":
                for sp in ET.fromstring(ppt.read(t)).iter(P + "sp"):
                    ph = sp.find(".//" + P + "ph")
                    if ph is not None and ph.get("type") == "body":
                        notes = paras(sp)
        folder = img_out / ("s%02d" % i)
        for sh in shapes:
            sh["offcanvas"] = sh["x"] + sh["w"] < 0 or sh["y"] + sh["h"] < 0 or sh["x"] > page_w or sh["y"] > page_h or sh["w"] < 2
            if sh.get("kind") in ("pic", "video") and not sh["offcanvas"]:
                src, crop = sh["media"], tuple(sh.get("crop", ()))
                key = (i, src, crop)
                if key not in saved:
                    folder.mkdir(parents=True, exist_ok=True)
                    stem = posixpath.splitext(posixpath.basename(src))[0]
                    k = sum(1 for s in saved if s[:2] == (i, src))   # same picture, other crop: -c1, -c2 …
                    try:
                        saved[key] = save_image(ppt, src, folder / (stem + ("-c%d" % k if k else "")), crop)
                        if saved[key] is None:
                            skipped.append("slide %d %s: format not supported" % (i, src))
                    except Exception as e:                # broken picture: skip it, keep going
                        saved[key] = None
                        skipped.append("slide %d %s: %s" % (i, src, e))
                r = saved[key]
                if r:
                    sh["file"] = r[0].relative_to(pres).as_posix()
                    if r[1]:
                        sh["px"] = list(r[1])
        slides.append({"n": i, "shapes": shapes, "notes": notes})
        print("slide %d: %d shapes, %d note paragraphs" % (i, len(shapes), len(notes)))
    reports = []
    if not a.no_reports:
        for part, name, data in embedded_html(ppt):
            if not name.lower().endswith((".html", ".htm")):
                print("skip", part, name, "(not HTML)")
                continue
            (pres / "reports").mkdir(parents=True, exist_ok=True)
            (pres / "reports" / name).write_bytes(data)
            reports.append({"part": part, "file": "reports/" + name, "bytes": len(data)})
            print("report", name, "%.1f MB" % (len(data) / 1e6))
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps({"page": [page_w, page_h], "slides": slides, "reports": reports}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("manifest →", manifest)
    if skipped:
        print("\nSKIPPED %d pictures (not in presentation\\ — take them from a slide render or ask for the original):" % len(skipped))
        for s in skipped:
            print("  " + s)


if __name__ == "__main__":
    main()
