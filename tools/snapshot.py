"""Back up the live deck code into versions\\ BEFORE changing anything (method: versions\\README.md).

usage: python snapshot.py vN_<name> "one-line description" [deck]
  deck   deck workspace (default: current folder)
Copies the deck .html (its <head> gets <base href="../../presentation/"> and the CSS/JS paths point to the
copy), every .css/.js in presentation\\assets\\ and the deck's own scripts in work\\*.py and tools\\*.py,
then adds a row to the versions\\README.md table. Pictures, video and fonts stay shared with the live folder.
Run it before the first edit of a feedback round — a backup taken after an edit no longer matches the old deck.
"""
import re
import shutil
import sys
from pathlib import Path

from deckutil import deck_root, find_html

if len(sys.argv) < 3 or not re.match(r"^v\d+_[\w-]+$", sys.argv[1]):
    sys.exit(__doc__)
name, desc = sys.argv[1], sys.argv[2]
html = find_html(sys.argv[3] if len(sys.argv) > 3 else None)
root = deck_root(html)
V = root / "versions" / name
if V.exists():
    sys.exit("%s already exists" % V)

(V / "assets").mkdir(parents=True)
assets = sorted(p.name for p in (html.parent / "assets").glob("*") if p.suffix in (".css", ".js"))
for f in assets:
    shutil.copy2(html.parent / "assets" / f, V / "assets" / f)
    if f.endswith(".css"):                          # url(fonts/…) is relative to the CSS file → point it back to the live assets
        c = V / "assets" / f
        c.write_text(re.sub(r"url\((['\"]?)(?![a-zA-Z][\w+.-]*:|/|#)", r"url(\g<1>../../../presentation/assets/",
                            c.read_text(encoding="utf-8")), encoding="utf-8")
for d in ("work", "tools"):
    for py in (root / d).glob("*.py"):
        (V / d).mkdir(exist_ok=True)
        shutil.copy2(py, V / d / py.name)

h = html.read_text(encoding="utf-8")
h = re.sub(r"(<head[^>]*>)", r'\1\n<base href="../../presentation/">', h, count=1)
P = "../versions/%s/assets/" % name                 # relative to <base> = the live presentation folder
n = 0
for f in assets:
    h, k = re.subn(r'(["\'])assets/%s\1' % re.escape(f), r"\g<1>%s%s\1" % (P, f), h)
    n += k
(V / html.name).write_text(h, encoding="utf-8")

readme = root / "versions" / "README.md"
r = readme.read_text(encoding="utf-8").rstrip("\n").split("\n")
head = next(i for i, l in enumerate(r) if l.startswith("| 버전"))
end = head
while end + 1 < len(r) and r[end + 1].startswith("|"):
    end += 1
r.insert(end + 1, "| %s | `%s/` | %s |" % (name.split("_")[0], name, desc))
readme.write_text("\n".join(r) + "\n", encoding="utf-8")
print("%s: %d files, %d paths rewritten — README row added" % (V.relative_to(root), len(assets) + 1, n))
