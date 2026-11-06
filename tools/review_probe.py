"""Check the review mode (R) in headless Chromium: pins, notes, PDF marks, automatic saving.

usage: python review_probe.py [deck]
  deck   the deck to check (workspace, presentation folder or .html; default: current folder).
         Use a copy: nothing on disk is written (an in-memory assets folder answers the folder dialog), but the deck
         needs a slide with a report button (the sample has one).
Checks: the first R asks for the folder and saving is automatic after that (no save button); a click puts a pin where
it was clicked and records what was under it, and does not press the button underneath; a pin is saved once it has a
note, an empty one is dropped; typing stays in the note; pins keep their place when the window is resized; the PDF
mark; saving merges with the file (done/reply from the file stay, a pin number taken there meanwhile is renumbered
and later edits go to the renumbered pin) and backs it up; leaving with unsaved changes warns, and they survive a
reload; ?static (screenshots, PDF) shows no review bar.
"""
import argparse
import json
import time

from deckutil import Chromium, find_html, slide_ids
from notes_probe import FAKE_FS, check, results, wait


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    a = ap.parse_args()
    html = find_html(a.deck)
    text = html.read_text(encoding="utf-8")
    ids = slide_ids(html)
    k = next((i + 1 for i, s in enumerate(ids) if "data-report" in text.split('data-src="%s"' % s, 1)[1].split("<section", 1)[0]), None)
    if not k:
        raise SystemExit("%s: no slide with a report button to test with" % html.name)
    src = ids[k - 1]
    with Chromium() as e:
        def click(x, y):
            for t in ("mousePressed", "mouseReleased"):
                e.send("Input.dispatchMouseEvent", type=t, x=x, y=y, button="left", clickCount=1)

        def rect(sel):
            return e.ev("(function(){var r=document.querySelector(%s).getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()" % json.dumps(sel))

        def leave():   # reload past the "unsaved changes" warning, which must appear
            e.events.clear()
            e.send("Page.reload")
            d = e.wait_event("Page.javascriptDialogOpening", timeout=10)
            e.send("Page.handleJavaScriptDialog", accept=True)
            e.wait_event("Page.loadEventFired")
            return d["params"]["type"] == "beforeunload"

        def draft():
            return json.loads(e.ev("localStorage.getItem(DECK_ENGINE.key+'|review-draft')") or "null")

        def folder(review_text):   # an in-memory assets folder answers the folder dialog of this page
            e.ev(FAKE_FS + "window.__dir=__mkdir();__dir.e['engine.js']={text:'x'};__dir.e['review.js']={text:%s};"
                 "window.showDirectoryPicker=function(){return Promise.resolve(window.__dir)}" % json.dumps(review_text))

        def disk():
            t = e.ev("__dir.e['review.js'].text")
            return json.loads(t[t.index("{"):t.rindex("}") + 1])

        def put(data):
            e.ev("__dir.e['review.js'].text=%s" % json.dumps("window.DECK_REVIEW = " + json.dumps(data) + ";\n"))

        def pins():
            return {p["id"]: p for p in disk()["pins"]}

        def status():
            return e.ev("document.getElementById('rvst').textContent") or ""

        def note(t):
            e.ev("(function(a){a.value=%s;a.dispatchEvent(new Event('input'))})(document.querySelector('#rvpop textarea'))" % json.dumps(t))

        e.open("about:blank")
        e.open(html.as_uri() + "#%d" % k)
        wait(lambda: e.ev("window.DECK_ENGINE && 1"))
        e.ev("localStorage.clear()")
        e.reload()
        check("no review layer before R", e.ev("document.querySelectorAll('.rv-layer').length") == 0)

        # the file already has pin 1, applied by the agent
        folder("window.DECK_REVIEW = " + json.dumps({"saved": "x", "next": 2, "pins": [
            {"id": 1, "slide": ids[0], "x": 10, "y": 10, "note": "from the file", "at": "", "time": "", "done": True, "reply": "fixed"}], "nopdf": []}) + ";\n")
        e.key("r", "KeyR")
        check("R shows the review bar", e.ev("getComputedStyle(document.getElementById('rvbar')).display") == "flex")
        check("the first R asks for the folder and saves", wait(lambda: disk().get("deck")), disk())
        check("then saving is automatic: no save button", e.ev("document.getElementById('rvsv').style.display") == "none")
        check("the old review.js is backed up", e.ev("Object.keys(__dir.e.review_backup.e).length") == 1)

        # a click on the report button: a pin, not the report
        bx, by, bw, bh = rect(".slide.active [data-report]")
        click(bx + bw / 2, by + bh / 2)
        time.sleep(0.4)
        check("the button underneath is not pressed", not e.ev("document.getElementById('overlay').classList.contains('open')"))
        pin = (draft() or {}).get("pins", {}).get("2")
        check("a pin is put where it was clicked", pin and pin["slide"] == src, pin)
        sx, sy, sw, sh = rect(".slide.active")
        check("its place is kept in % of the slide", pin and abs(pin["x"] - (bx + bw / 2 - sx) / sw * 100) < 0.2, pin)
        word = e.ev("document.querySelector('.slide.active [data-report]').innerText.trim().split(/\\s+/)[0]")
        check("what was under the click is recorded (the button's text)", pin and word in pin["at"], (word, pin and pin["at"]))
        check("the note opens", e.ev("document.getElementById('rvpop').classList.contains('open')"))
        time.sleep(1.2)
        check("a pin without a note is not saved yet", sorted(pins()) == [1], sorted(pins()))
        note("PROBE make this bigger")
        check("its note saves by itself", wait(lambda: pins().get(2, {}).get("note") == "PROBE make this bigger"), pins().get(2))
        check("the status says so", wait(lambda: "자동 저장" in status()), status())
        check("the file's pin stays as it was (done, reply)", pins()[1]["reply"] == "fixed" and pins()[1]["note"] == "from the file")
        check("no working flags are written", all("fresh" not in p for p in disk()["pins"]))
        e.ev("document.querySelector('#rvpop textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))")
        time.sleep(0.3)
        check("an arrow key typed in the note does not move the slide", e.ev("location.hash") == "#%d" % k)
        e.ev("document.querySelector('#rvpop textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
        check("Esc closes the note", not e.ev("document.getElementById('rvpop').classList.contains('open')"))

        # an empty pin is not kept
        click(sx + sw * 0.2, sy + sh * 0.8)
        time.sleep(0.3)
        e.key("Escape")
        time.sleep(1)
        check("a pin left without a note is dropped", draft() is None and sorted(pins()) == [1, 2], (draft(), sorted(pins())))

        # pins keep their place when the window changes size
        def pin_rel():
            p, s = rect('.rv-pin[data-id="2"]'), rect(".slide.active")
            return round((p[0] - s[0]) / s[2], 3), round((p[1] + p[3] - s[1]) / s[3], 3)
        before = pin_rel()
        e.send("Emulation.setDeviceMetricsOverride", width=1100, height=700, deviceScaleFactor=1, mobile=False)
        e.ev("dispatchEvent(new Event('resize'))")
        time.sleep(0.6)
        after = pin_rel()
        check("a pin keeps its place on the slide at another window size", abs(before[0] - after[0]) < 0.01 and abs(before[1] - after[1]) < 0.01, (before, after))
        e.send("Emulation.clearDeviceMetricsOverride")

        e.ev("document.getElementById('rvpdf').click()")
        check("the PDF mark saves by itself", wait(lambda: disk()["nopdf"] == [src]), disk()["nopdf"])
        check("the slide shows it is left out of the PDF", e.ev("!!document.querySelector('.slide.active .rv-nopdf')"))
        e.key("ArrowRight")
        time.sleep(0.4)
        check("an arrow key outside the note moves the slide", e.ev("location.hash") == "#%d" % (k + 1))
        check("the bar follows the slide (no mark here)", not e.ev("document.getElementById('rvpdf').checked"))
        e.ev("location.hash='#%d'" % k)
        time.sleep(0.4)

        # another window saved pin 3 meanwhile: this window's new pin 3 becomes pin 4, and later edits go to pin 4
        click(sx + sw * 0.5, sy + sh * 0.5)
        time.sleep(0.3)
        other = disk()
        other["pins"].append({"id": 3, "slide": src, "x": 1, "y": 1, "note": "from another window", "at": "", "time": "", "done": False, "reply": ""})
        other["next"] = 4
        put(other)
        note("PROBE mine")
        check("a pin number taken in the file meanwhile is renumbered", wait(lambda: pins().get(4, {}).get("note") == "PROBE mine") and pins()[3]["note"] == "from another window",
              {i: p["note"] for i, p in pins().items()})
        note("PROBE mine, changed")
        check("later edits go to the renumbered pin (no copy)", wait(lambda: pins().get(4, {}).get("note") == "PROBE mine, changed") and sorted(pins()) == [1, 2, 3, 4],
              {i: p["note"] for i, p in pins().items()})
        e.key("Escape")
        check("done pins are hidden until 지난 의견 보기", e.ev("getComputedStyle(document.querySelector('.rv-pin.done')).display") == "none")
        e.ev("location.hash='#1'")
        time.sleep(0.4)
        e.ev("document.getElementById('rvold').click()")
        check("지난 의견 보기 shows them", e.ev("getComputedStyle(document.querySelector('.rv-pin.done')).display") == "block")
        e.ev("location.hash='#%d'" % k)
        time.sleep(0.4)

        # leaving while a change is not saved yet: a warning, and the change comes back
        saved = e.ev("__dir.e['review.js'].text")
        e.ev("window.__slow=8000")
        e.ev("document.getElementById('rvpdf').click()")
        time.sleep(0.3)
        check("leaving with an unsaved change warns first", leave())
        check("the unsaved change survives a reload", (draft() or {}).get("nopdf", {}).get(src) is False, draft())
        folder(saved)
        e.key("r", "KeyR")
        check("it is saved when review mode opens again", wait(lambda: disk()["nopdf"] == []), disk()["nopdf"])

        e.ev("localStorage.clear()")
        e.open("about:blank")
        e.open(html.as_uri() + "?static#%d" % k)
        e.ev("window.showDirectoryPicker=function(){return new Promise(function(){})}")   # the folder dialog would wait forever
        e.key("r", "KeyR")
        check("?static (screenshots, PDF) shows no review bar", e.ev("getComputedStyle(document.getElementById('rvbar')).display") == "none")
        e.ev("localStorage.clear()")
    print("%d/%d passed" % (sum(results), len(results)))
    raise SystemExit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
