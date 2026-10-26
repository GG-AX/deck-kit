"""Watch elements of one slide while it animates in (headless Chromium).

usage: python anim_probe.py [deck] --slide N --sel "CSS selector" [--secs 2.5]
Prints the boxes (x, y, width, height, start of text) of the matched elements whenever one of them
moves or resizes. Boxes that keep changing after the entrance animation = visible jumping
(e.g. a count-up that changes the width of its line).
"""
import argparse
import json
import time

from deckutil import Chromium, find_html


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    ap.add_argument("--slide", type=int, required=True)
    ap.add_argument("--sel", required=True)
    ap.add_argument("--secs", type=float, default=2.5)
    a = ap.parse_args()
    html = find_html(a.deck)
    js = ("(function(){var s=document.querySelectorAll('#deck > .slide')[%d];return [].map.call(s.querySelectorAll(%s),function(e){"
          "var r=e.getBoundingClientRect();return [Math.round(r.x*10)/10,Math.round(r.y*10)/10,Math.round(r.width*10)/10,"
          "Math.round(r.height*10)/10,(e.textContent||'').trim().slice(0,12)]})})()") % (a.slide - 1, json.dumps(a.sel))
    with Chromium() as e:
        e.open(html.as_uri() + "#1")
        time.sleep(1.0)
        e.ev("location.hash='#%d'" % a.slide)
        t0, last = time.time(), None
        while time.time() - t0 < a.secs:
            boxes = e.ev(js)
            geo = [b[:4] for b in boxes] if boxes else boxes
            if geo != last:
                print("%5.2fs" % (time.time() - t0), boxes)
                last = geo
            time.sleep(0.05)


if __name__ == "__main__":
    main()
