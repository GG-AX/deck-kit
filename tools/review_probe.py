"""Check the review mode (R) in headless Chromium: pins, notes, PDF marks, drafts and saving.

usage: python review_probe.py [deck]
  deck   the deck to check (workspace, presentation folder or .html; default: current folder).
         Use a copy: nothing on disk is written, but the deck needs a slide with a report button (the sample has one).
Checks: R shows the review bar; a click puts a pin where it was clicked and records what was under it, and does not
press the button underneath; typing stays in the note; a pin left empty is dropped; pins keep their place when the
window is resized; the PDF mark; the draft survives a reload; saving merges with the file (a pin number taken there
is renumbered, done/reply from the file stay) and backs it up; ?static shows nothing, ?static&review shows the pins.
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
    ids = slide_ids(html)
    k = next((i + 1 for i, s in enumerate(ids) if 'data-src="%s"' % s in html.read_text(encoding="utf-8")
              and "data-report" in html.read_text(encoding="utf-8").split('data-src="%s"' % s, 1)[1].split("<section", 1)[0]), None)
    if not k:
        raise SystemExit("%s: no slide with a report button to test with" % html.name)
    src = ids[k - 1]
    with Chromium() as e:
        def click(x, y):
            for t in ("mousePressed", "mouseReleased"):
                e.send("Input.dispatchMouseEvent", type=t, x=x, y=y, button="left", clickCount=1)

        def rect(sel):
            return e.ev("(function(){var r=document.querySelector(%s).getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()" % json.dumps(sel))

        def leave(url=None):   # reload or open another page past the "unsaved changes" warning, which must appear
            e.events.clear()
            e.send("Page.navigate", url=url) if url else e.send("Page.reload")
            d = e.wait_event("Page.javascriptDialogOpening", timeout=10)
            e.send("Page.handleJavaScriptDialog", accept=True)
            e.wait_event("Page.loadEventFired")
            return d["params"]["type"] == "beforeunload"

        def draft():
            return json.loads(e.ev("localStorage.getItem(DECK_ENGINE.key+'|review-draft')") or "null")

        e.open("about:blank")
        e.open(html.as_uri() + "#%d" % k)
        wait(lambda: e.ev("window.DECK_ENGINE && 1"))
        e.ev("localStorage.clear()")
        e.reload()
        check("no review layer before R", e.ev("document.querySelectorAll('.rv-layer').length") == 0)
        e.key("r", "KeyR")
        check("R shows the review bar", e.ev("getComputedStyle(document.getElementById('rvbar')).display") == "flex")

        # a click on the report button: a pin, not the report
        bx, by, bw, bh = rect('.slide.active [data-report]')
        click(bx + bw / 2, by + bh / 2)
        time.sleep(0.4)
        check("the button underneath is not pressed", not e.ev("document.getElementById('overlay').classList.contains('open')"))
        pin = (draft() or {}).get("pins", {}).get("1")
        check("a pin is put where it was clicked", pin and pin["slide"] == src, pin)
        sx, sy, sw, sh = rect(".slide.active")
        check("its place is kept in % of the slide", pin and abs(pin["x"] - (bx + bw / 2 - sx) / sw * 100) < 0.2, pin)
        word = e.ev("document.querySelector('.slide.active [data-report]').innerText.trim().split(/\\s+/)[0]")
        check("what was under the click is recorded (the button's text)", pin and word in pin["at"], (word, pin and pin["at"]))
        check("the note opens", e.ev("document.getElementById('rvpop').classList.contains('open')"))
        e.ev("(function(t){t.value='PROBE make this bigger';t.dispatchEvent(new Event('input'))})(document.querySelector('#rvpop textarea'))")
        check("the note is kept as a draft", (draft() or {}).get("pins", {}).get("1", {}).get("note") == "PROBE make this bigger")
        e.ev("document.querySelector('#rvpop textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))")
        time.sleep(0.3)
        check("an arrow key typed in the note does not move the slide", e.ev("location.hash") == "#%d" % k)
        e.ev("document.querySelector('#rvpop textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
        check("Esc closes the note", not e.ev("document.getElementById('rvpop').classList.contains('open')"))

        # an empty pin is not kept
        click(sx + sw * 0.2, sy + sh * 0.8)
        time.sleep(0.3)
        e.key("Escape")
        check("a pin left without a note is dropped", list((draft() or {}).get("pins", {})) == ["1"], draft())

        # pins keep their place when the window changes size
        def pin_rel():
            p, s = rect('.rv-pin[data-id="1"]'), rect(".slide.active")
            return round((p[0] - s[0]) / s[2], 3), round((p[1] + p[3] - s[1]) / s[3], 3)
        before = pin_rel()
        e.send("Emulation.setDeviceMetricsOverride", width=1100, height=700, deviceScaleFactor=1, mobile=False)
        e.ev("dispatchEvent(new Event('resize'))")
        time.sleep(0.6)
        after = pin_rel()
        check("a pin keeps its place on the slide at another window size", abs(before[0] - after[0]) < 0.01 and abs(before[1] - after[1]) < 0.01, (before, after))
        e.send("Emulation.clearDeviceMetricsOverride")

        e.ev("document.getElementById('rvpdf').click()")
        check("the PDF mark is kept as a draft", (draft() or {}).get("nopdf", {}).get(src) is True, draft())
        check("the slide shows it is left out of the PDF", e.ev("!!document.querySelector('.slide.active .rv-nopdf')"))
        e.key("ArrowRight")
        time.sleep(0.4)
        check("an arrow key outside the note moves the slide", e.ev("location.hash") == "#%d" % (k + 1))
        check("the bar follows the slide (no mark here)", not e.ev("document.getElementById('rvpdf').checked"))

        # draft survives a reload
        e.ev("location.hash='#%d'" % k)
        check("leaving with unsaved pins warns first", leave())
        e.key("r", "KeyR")
        time.sleep(0.3)
        check("pins survive a reload", e.ev("document.querySelectorAll('.slide.active .rv-pin').length") == 1)

        # save into an in-memory assets folder whose review.js already has pin 1 (marked done by the agent)
        disk = {"saved": "x", "next": 2, "pins": [{"id": 1, "slide": ids[0], "x": 10, "y": 10, "note": "from the file", "at": "", "time": "",
                                                    "done": True, "reply": "fixed"}], "nopdf": []}
        e.ev(FAKE_FS + "window.__dir=__mkdir();__dir.e['engine.js']={text:'x'};__dir.e['review.js']={text:%s};"
             "window.showDirectoryPicker=function(){return Promise.resolve(window.__dir)}" % json.dumps("window.DECK_REVIEW = " + json.dumps(disk) + ";\n"))
        e.ev("document.getElementById('rvsv').click()")
        wait(lambda: "저장" in (e.ev("document.getElementById('rvst').textContent") or "") and "중" not in e.ev("document.getElementById('rvst').textContent"))
        check("save reports success", "저장했습니다" in e.ev("document.getElementById('rvst').textContent"), e.ev("document.getElementById('rvst').textContent"))
        t = e.ev("__dir.e['review.js'].text")
        saved = json.loads(t[t.index("{"):t.rindex("}") + 1])
        by = {p["id"]: p for p in saved["pins"]}
        check("the file's pin stays as it was (done, reply)", by.get(1, {}).get("reply") == "fixed" and by[1]["note"] == "from the file", by.get(1))
        check("a pin number taken in the file is renumbered", by.get(2, {}).get("note") == "PROBE make this bigger", sorted(by))
        check("no working flags are written", all("fresh" not in p for p in saved["pins"]))
        check("the PDF mark is saved", saved["nopdf"] == [src], saved["nopdf"])
        check("the old review.js is backed up", e.ev("Object.keys(__dir.e.review_backup.e).length") == 1)
        check("the draft is cleared", draft() is None)
        check("done pins are hidden until 지난 의견 보기", e.ev("document.querySelectorAll('.rv-pin.done').length") == 1 and
              e.ev("getComputedStyle(document.querySelector('.rv-pin.done')).display") == "none")
        e.ev("document.getElementById('rvold').click()")
        check("지난 의견 보기 shows them", e.ev("getComputedStyle(document.querySelector('.rv-pin.done')).display") == "block")

        # screenshots and PDF (?static): no review bar even if R is pressed; pins drawn with ?review are checked through review.py --shots
        e.ev("localStorage.clear()")
        e.open("about:blank")
        e.open(html.as_uri() + "?static#%d" % k)
        e.key("r", "KeyR")
        check("?static (screenshots, PDF) shows no review bar", e.ev("getComputedStyle(document.getElementById('rvbar')).display") == "none")
        e.ev("localStorage.clear()")
    print("%d/%d passed" % (sum(results), len(results)))
    raise SystemExit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
