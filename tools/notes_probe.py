"""Check the presenter script (notes) in headless Edge: editing, drafts, and saving.

usage: python notes_probe.py [deck] [--other DECK] [--save]
  deck     the deck to check (workspace, presentation folder or .html; default: current folder)
  --other  a second deck or copy: its drafts and presenter window must stay separate from the first
  --save   also save for real through the local helper (Start Presentation.bat's notes_server.ps1),
           then put notes.js and notes.prev.js back as they were
Checks: the presenter window (P) shows the slide's notes; an edit is kept as a draft and survives a reload;
arrow keys typed in the notes do not move slides; the notes follow slide changes.
Choosing the file to save to needs a real file dialog, so that path is only checked for availability.
"""
import argparse
import json
import subprocess
import time
import urllib.request

from deckutil import Edge, find_html, read_js_data, slide_ids

HELPER = "http://127.0.0.1:47615"
results = []


def check(name, ok, info=""):
    results.append(bool(ok))
    print(("PASS " if ok else "FAIL ") + name + ("  " + str(info) if info and not ok else ""))


def wait(fn, timeout=8.0):
    end = time.time() + timeout
    while time.time() < end:
        v = fn()
        if v:
            return v
        time.sleep(0.25)
    return fn()


class Deck:
    def __init__(self, edge, html):
        self.e, self.html = edge, html
        ids = slide_ids(html)
        notes = read_js_data(html.parent / "assets" / "notes.js")["notes"]
        with_notes = [i for i, s in enumerate(ids[:-1]) if notes.get(s)]
        if not with_notes:
            raise SystemExit("%s: no slide with notes (and a slide after it) to test with" % html.name)
        self.n = with_notes[0] + 1                       # 1-based slide number
        self.first = notes[ids[self.n - 1]][0]

    def open(self):
        self.e.open("about:blank")                       # a full load even when only the #slide would change
        self.e.open(self.html.as_uri() + "#%d" % self.n)
        self.key = wait(lambda: self.e.ev("window.DECK_ENGINE && DECK_ENGINE.key"))
        self.P = "window.open('', %s).document" % json.dumps(self.key + "|presenter")

    def presenter(self):
        self.e.key("p", "KeyP")
        return wait(lambda: self.e.ev("(function(){try{return !!%s.getElementById('no')}catch(e){return false}})()" % self.P))

    def notes_text(self):
        return self.e.ev(self.P + ".getElementById('no').value") or ""

    def type(self, text):
        self.e.ev("(function(d){var t=d.getElementById('no');t.value=%s;t.dispatchEvent(new Event('input'))})(%s)" % (json.dumps(text), self.P))

    def status(self):
        return self.e.ev(self.P + ".getElementById('st').textContent") or ""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    ap.add_argument("--other")
    ap.add_argument("--save", action="store_true")
    a = ap.parse_args()
    html = find_html(a.deck)
    with Edge() as e:
        d = Deck(e, html)
        d.open()
        e.ev("localStorage.clear()")
        e.reload()
        check("presenter window opens", d.presenter())
        check("it shows the notes of slide %d" % d.n, d.notes_text().startswith(d.first), repr(d.notes_text()[:60]))
        check("saving by file choice is available", e.ev("typeof window.open('', %s).showSaveFilePicker" % json.dumps(d.key + "|presenter")) == "function")
        d.type("PROBE line one.\n\nPROBE line two.")
        draft = e.ev("localStorage.getItem(%s) || ''" % json.dumps(d.key + "|notes-draft"))
        check("an edit is kept as a draft (under this folder's key)", '"PROBE line one."' in draft and '"PROBE line two."' in draft)
        check("status says unsaved", "Unsaved" in d.status(), d.status())
        e.ev("(function(d){var t=d.getElementById('no');t.focus();t.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))})(%s)" % d.P)
        time.sleep(0.3)
        check("an arrow key typed in the notes does not move the slide", e.ev("location.hash") == "#%d" % d.n, e.ev("location.hash"))
        e.ev("(function(d){d.getElementById('no').blur();d.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))})(%s)" % d.P)
        time.sleep(0.5)
        check("an arrow key outside the notes moves the slide", e.ev("location.hash") == "#%d" % (d.n + 1), e.ev("location.hash"))
        check("the notes follow the slide", not d.notes_text().startswith("PROBE"))
        e.ev("location.hash = '#%d'" % d.n)
        time.sleep(0.5)
        check("the edit is back on its slide", d.notes_text().startswith("PROBE line one."))
        e.ev("window.open('', %s).close()" % json.dumps(d.key + "|presenter"))
        e.reload()
        d.presenter()
        check("the draft survives a reload", d.notes_text().startswith("PROBE line one."))

        if a.other:
            o = Deck(e, find_html(a.other))
            o.open()
            check("the other copy has its own key", o.key != d.key, o.key)
            o.presenter()
            check("the other copy shows its own notes, not this draft", not o.notes_text().startswith("PROBE"), repr(o.notes_text()[:60]))
            check("the other copy has no draft", not e.ev("localStorage.getItem(%s)" % json.dumps(o.key + "|notes-draft")))
            check("the presenter windows are separate", o.P != d.P)

        if a.save:
            save_through_helper(e, d, html)
        e.ev("localStorage.clear()")
    print("%d/%d passed" % (sum(results), len(results)))
    raise SystemExit(0 if all(results) else 1)


def save_through_helper(e, d, html):
    assets = html.parent / "assets"
    keep = {f: (assets / f).read_bytes() if (assets / f).exists() else None for f in ("notes.js", "notes.prev.js")}
    helper = subprocess.Popen(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(assets / "notes_server.ps1")],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ping = lambda: urllib.request.urlopen(HELPER + "/ping", timeout=2).read().decode("utf-8")
        served = wait(lambda: _try(ping), timeout=15)
        check("the helper serves this folder", served and served.lower().rstrip("\\") == str(html.parent).lower().rstrip("\\"), served)
        d.open()
        d.presenter()
        d.type("SAVED BY PROBE — 한글 확인")
        e.ev(d.P + ".getElementById('sv').click()")
        st = wait(lambda: "Saved" in d.status() and d.status(), timeout=10)
        check("Save notes reports saved", st and st.startswith("✓"), d.status())
        text = (assets / "notes.js").read_text(encoding="utf-8")
        check("notes.js on disk has the edit (Korean kept)", "SAVED BY PROBE — 한글 확인" in text)
        check("the previous notes.js was kept as notes.prev.js", (assets / "notes.prev.js").exists())
    finally:
        _try(lambda: urllib.request.urlopen(HELPER + "/quit", timeout=2).read())
        helper.wait(10)
        for f, data in keep.items():                     # put the deck's own files back
            if data is None:
                (assets / f).unlink(missing_ok=True)
            else:
                (assets / f).write_bytes(data)


def _try(fn):
    try:
        return fn()
    except OSError:
        return None


if __name__ == "__main__":
    main()
