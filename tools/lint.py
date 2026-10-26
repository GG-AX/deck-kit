"""Read-only check of a deck workspace — changes nothing. Run it before handing a deck over for review.

usage: python lint.py [deck]
Checks: HTML tag balance · slide ids (duplicate, invalid) · leftover samples · referenced files exist ·
notes.js keys vs slides · deck scripts (work\\, tools\\) compile · work\\*.json parse ·
deck.css rules defined twice (the later one wins) and classes no slide uses · inline title font sizes · engine identical to the kit ·
versions\\ backups open (their files still exist) · template placeholders left in CLAUDE.md / session.md / FEEDBACK.md / 사용법 (How to use).txt.
Exit code 1 when there is an ERR line.
"""
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

from deckutil import deck_root, find_html, read_js_data

KIT = Path(__file__).resolve().parent.parent / "template" / "presentation" / "assets"
R = []


def add(area, level, msg):
    R.append((area, level, msg))


class Tags(HTMLParser):
    VOID = {"img", "meta", "link", "br", "col", "input", "source", "hr", "base", "wbr", "area", "embed", "track"}

    def __init__(s):
        super().__init__()
        s.stack, s.err = [], []

    def handle_starttag(s, t, a):
        if t not in s.VOID:
            s.stack.append((t, s.getpos()))

    def handle_endtag(s, t):
        if t in s.VOID:
            return
        if s.stack and s.stack[-1][0] == t:
            s.stack.pop()
        else:
            s.err.append((t, s.getpos()))


html_path = find_html(sys.argv[1] if len(sys.argv) > 1 else None)
root, P = deck_root(html_path), html_path.parent
html = html_path.read_text(encoding="utf-8")

# 1. HTML
t = Tags()
t.feed(html)
add("HTML", "OK" if not t.err and not t.stack else "ERR",
    "tag balance: %d mismatched closes, %d unclosed%s" % (len(t.err), len(t.stack), " e.g. %s" % t.err[:2] if t.err else ""))
sl = re.findall(r'<section\b[^>]*\bclass="(?:[^"]*\s)?slide(?:\s[^"]*)?"[^>]*\bdata-src="([^"]+)"', html)
dup = sorted({i for i in sl if sl.count(i) > 1})
bad = [i for i in sl if not re.match(r"^[A-Za-z0-9][A-Za-z0-9_-]*$", i)]
add("HTML", "OK" if not dup and not bad else "ERR", "%d slides, duplicate ids: %s, invalid ids: %s" % (len(sl), dup or "none", bad or "none"))
add("HTML", "OK" if "data-sample" not in html else "WARN", "leftover sample slides (data-sample): " + ("none" if "data-sample" not in html else "found"))

# 2. referenced files
refs = set(re.findall(r'(?<![\w-])(?:src|href|poster|data-report)="([^"#:]+)"', html))
for m in re.findall(r"data-treemap='([^']+)'", html):
    for row in json.loads(m.replace("&#39;", "'")):
        if len(row) > 2:
            refs.add(row[2])
missing = sorted(r for r in refs if not (P / r).exists())
add("Files", "OK" if not missing else "ERR", "%d referenced files, missing: %s" % (len(refs), missing or "none"))

# 3. notes
if (P / "assets" / "notes.js").exists():
    notes = read_js_data(P / "assets" / "notes.js").get("notes", {})
    add("Notes", "OK" if set(notes) == set(sl) else "WARN", "notes vs slides — no script entry: %s, orphan keys: %s"
        % (sorted(set(sl) - set(notes)) or "none", sorted(set(notes) - set(sl)) or "none"))
    add("Notes", "INFO", "slides with an empty script: %s" % ([k for k in sl if not notes.get(k)] or "none"))

# 4. deck scripts and data
pys = sorted(list((root / "work").glob("*.py")) + list((root / "tools").glob("*.py")))
for f in pys:
    try:
        compile(f.read_text(encoding="utf-8"), str(f), "exec")
    except SyntaxError as e:
        add("Python", "ERR", "%s: line %s %s" % (f.relative_to(root), e.lineno, e.msg))
add("Python", "INFO", "%d deck scripts checked" % len(pys))
for f in sorted((root / "work").glob("*.json")):
    try:
        json.loads(f.read_text(encoding="utf-8"))
    except ValueError as e:
        add("JSON", "ERR", "%s: %s" % (f.relative_to(root), e))

# 5. deck.css
css_path = P / "assets" / "deck.css"
if css_path.exists():
    body = re.sub(r"/\*.*?\*/", "", css_path.read_text(encoding="utf-8"), flags=re.S)
    sels = [" ".join(b.split()) for b in re.findall(r"([^{}]+)\{[^{}]*\}", body) if "," not in b]
    redef = sorted({s for s in sels if s and sels.count(s) > 1 and not s.startswith("@")})
    add("CSS", "WARN" if redef else "OK", "rules defined more than once in deck.css (the later wins): %d %s" % (len(redef), redef[:12]))
    used = {c for cl in re.findall(r'class="([^"]+)"', html) for c in cl.split()}
    engine = (KIT / "engine.js").read_text(encoding="utf-8") if (KIT / "engine.js").exists() else ""
    classes = set(re.findall(r"\.([a-zA-Z][\w-]*)", re.sub(r"url\([^)]*\)", "", body)))
    unused = sorted(c for c in classes - used if not re.search(r"\b%s\b" % re.escape(c), engine))   # engine-made classes count as used
    add("CSS", "WARN" if unused else "OK", "classes in deck.css no slide uses: %d %s" % (len(unused), unused))
inline = re.findall(r'class="[^"]*\btitle\b[^"]*"[^>]*style="[^"]*font-size', html)
add("CSS", "WARN" if inline else "OK", "titles with an inline font-size: %d — use .title.l/.m/.s, or one .title rule in deck.css (DESIGN 덱 전체 통일)" % len(inline))

# 6. engine untouched
def engine_ver(p):
    m = re.search(rb"engine v(\d+)\.(\d+)", p.read_bytes()[:200]) if p.exists() else None
    return tuple(map(int, m.groups())) if m else None

deck_v, kit_v = engine_ver(P / "assets" / "engine.js"), engine_ver(KIT / "engine.js")
older = deck_v and kit_v and deck_v < kit_v   # a deck made with an older kit keeps its engine until it is upgraded on purpose
for f in ("engine.js", "engine.css", "notes_server.ps1"):
    a, b = P / "assets" / f, KIT / f
    if a.exists() and b.exists():
        same = a.read_bytes().replace(b"\r\n", b"\n") == b.read_bytes().replace(b"\r\n", b"\n")   # installed copies may be CRLF
        if same:
            add("Engine", "OK", "%s identical to the kit: True" % f)
        elif older:
            add("Engine", "WARN", "%s: deck engine v%d.%d, kit v%d.%d — fine for a deck in progress; to upgrade see SKILL.md" % ((f,) + deck_v + kit_v))
        else:
            add("Engine", "ERR", "%s identical to the kit: False — engine changes belong in deck-kit, deck fixes in deck.css" % f)

# 7. versions
vr = root / "versions" / "README.md"
rows = re.findall(r"^\| (v\d+) \| `([^`]+)/`", vr.read_text(encoding="utf-8"), re.M) if vr.exists() else []
for v, d in rows:
    decks = list((root / "versions" / d).glob("*.html"))
    vh = decks[0].read_text(encoding="utf-8") if decks else ""
    vrefs = set(re.findall(r'(?<![\w-])(?:src|href|poster)="([^"#:]+)"', re.sub(r"<base [^>]*>", "", vh)))
    vmiss = sorted(r for r in vrefs if not os.path.exists(os.path.normpath(P / r)))
    for c in (root / "versions" / d / "assets").glob("*.css"):   # url(fonts/…) resolves next to the copied CSS
        for u in re.findall(r"url\(['\"]?([^'\")]+)", c.read_text(encoding="utf-8")):
            if not re.match(r"[a-zA-Z][\w+.-]*:|#", u) and not os.path.exists(os.path.normpath(c.parent / u)):
                vmiss.append("%s: %s" % (c.name, u))
    add("Versions", "OK" if decks and not vmiss else "ERR", "%s %s: deck %s, missing files %d%s — do not delete files a backup still uses"
        % (v, d, "ok" if decks else "MISSING", len(vmiss), " e.g. %s" % vmiss[:3] if vmiss else ""))
dirs = sorted(p.name for p in (root / "versions").glob("v*") if p.is_dir())
add("Versions", "OK" if dirs == sorted(d for _, d in rows) else "WARN", "folders %s vs README rows %s" % (dirs, [d for _, d in rows]))

# 8. docs
for f in ("CLAUDE.md", "session.md", "FEEDBACK.md", "presentation/사용법 (How to use).txt"):
    p = root / f
    if p.exists() and any(s in p.read_text(encoding="utf-8") for s in ("<덱 이름>", "(날짜)", "(할 일)")):
        add("Docs", "WARN", "%s: template placeholder left" % f)

tot = sum(p.stat().st_size for p in P.rglob("*") if p.is_file())
add("Size", "INFO", "presentation\\ %.1f MB" % (tot / 1e6))

for a, l, m in R:
    print("[%-4s] %-8s %s" % (l, a, m))
sys.exit(1 if any(l == "ERR" for _, l, _ in R) else 0)
