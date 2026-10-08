"""Rendering load on chosen slides (headless Edge): screen frame rate and dropped video frames.

usage: python perf_probe.py [deck] --slides 4,2,16 [--size 1920,1080]
For each slide: requestAnimationFrame rate over 5 s and, for the videos playing on it, dropped / total
frames. A full-screen video (▶) on the slide is started first. Headless Edge draws on the CPU, so the
numbers are lower than on a laptop GPU — compare before/after on the same PC, not against a target.
"""
import argparse
import time

from deckutil import Edge, find_html

MEASURE = """new Promise(function(ok){
  var vids=[].slice.call(document.querySelectorAll('#deck > .slide')[%d].querySelectorAll('video'));
  var q0=vids.map(function(v){var q=v.getVideoPlaybackQuality();return [q.droppedVideoFrames,q.totalVideoFrames]});
  var frames=0,t0=performance.now();
  (function f(){frames++; if(performance.now()-t0<5000) requestAnimationFrame(f); else {
    var q1=vids.map(function(v){var q=v.getVideoPlaybackQuality();return [q.droppedVideoFrames,q.totalVideoFrames]});
    var d=0,t=0; q1.forEach(function(q,i){d+=q[0]-q0[i][0];t+=q[1]-q0[i][1];});
    ok({fps:Math.round(frames/((performance.now()-t0)/1000)*10)/10, videos:vids.filter(function(v){return !v.paused}).length, dropped:d, total:t});
  }})();
})"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    ap.add_argument("--slides", required=True, help="comma-separated slide numbers")
    ap.add_argument("--size", default="1920,1080")
    a = ap.parse_args()
    html = find_html(a.deck)
    w, h = (int(x) for x in a.size.split(","))
    with Edge(size=(w, h), args=["--autoplay-policy=no-user-gesture-required"]) as e:
        e.open(html.as_uri() + "#1")
        time.sleep(3)
        print(html.name, a.size)
        for n in (int(x) for x in a.slides.split(",")):
            e.ev("location.hash='#%d'" % n)
            time.sleep(2.5)
            if e.ev("(function(){var b=document.querySelectorAll('#deck > .slide')[%d].querySelector('.vbox');if(b&&b._toggle){b._toggle();return true}})()" % (n - 1)):
                time.sleep(1.5)
            r = e.ev(MEASURE % (n - 1), wait=True)
            print("  slide %-3d screen %5.1f fps | playing videos %d | video frames dropped %d of %d" % (n, r["fps"], r["videos"], r["dropped"], r["total"]))


if __name__ == "__main__":
    main()
