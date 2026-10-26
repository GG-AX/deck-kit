"""Shared helpers for the deck-kit tools: find the browser, find the deck, count slides, drive headless Chromium.

A deck is given as its workspace folder, its presentation folder or the .html itself
(default: the current folder). The deck .html is the one .html directly inside presentation\\.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

# Windows pipes default to cp949: Korean paths or a "✓" would crash print()
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

BROWSER_PATHS = [r"%ProgramFiles%\Google\Chrome\Application\chrome.exe",
                 r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
                 r"%LocalAppData%\Google\Chrome\Application\chrome.exe",
                 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                 r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe",
                 r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe",
                 r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe",
                 "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
SLIDE_RE = re.compile(r'<section\b[^>]*\bclass="(?:[^"]*\s)?slide(?:\s[^"]*)?"', re.I)
BROWSER = None               # the executable, found once per process (shots.py finds it before starting its threads)
BROWSER_IS_PLAYWRIGHT = False


def find_browser():
    """DECKKIT_BROWSER, else Playwright's Chromium, else Chrome or Edge (headless flags are the same)."""
    global BROWSER, BROWSER_IS_PLAYWRIGHT
    if BROWSER:
        return BROWSER
    p = os.environ.get("DECKKIT_BROWSER")
    if not p:
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as pw:
                p = pw.chromium.executable_path
            # Playwright's full chrome.exe can fail to start on Windows (side-by-side error); its headless shell,
            # downloaded with it and what Playwright itself runs headless, takes the same flags
            rev = Path(p).parents[1].name.split("-")[-1]
            p = next((str(s) for s in Path(p).parents[2].glob("chromium_headless_shell-%s/*/chrome-headless-shell*" % rev)
                      if s.name in ("chrome-headless-shell", "chrome-headless-shell.exe")), p)
            BROWSER_IS_PLAYWRIGHT = os.path.isfile(p)
            p = p if BROWSER_IS_PLAYWRIGHT else None
        except Exception:    # not installed, or its browser not downloaded yet
            p = None
    p = p or next((x for x in map(os.path.expandvars, BROWSER_PATHS) if os.path.isfile(x)), None) \
        or shutil.which("chrome") or shutil.which("google-chrome") or shutil.which("msedge")
    BROWSER = p or sys.exit("브라우저 없음 — pip install playwright && python -m playwright install chromium")
    return BROWSER


def find_ffmpeg():
    p = shutil.which("ffmpeg")
    if p:
        return p
    for c in sorted(Path(os.path.expandvars(r"%LocalAppData%\Microsoft\WinGet\Packages")).glob("Gyan.FFmpeg*/*/bin/ffmpeg.exe")):
        return str(c)
    for c in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"):
        if os.path.isfile(c):
            return c
    sys.exit("ffmpeg was not found (install: winget install Gyan.FFmpeg / brew install ffmpeg).")


def find_html(path=None):
    p = Path(path or ".").resolve()
    if p.is_file():
        return p
    for d in (p / "presentation", p):
        if d.is_dir():
            htmls = sorted(d.glob("*.html"))
            if len(htmls) == 1:
                return htmls[0]
            if len(htmls) > 1:
                sys.exit("More than one .html in %s — keep only the deck: %s" % (d, ", ".join(h.name for h in htmls)))
    sys.exit("No deck found at %s (expected presentation\\<deck>.html)" % p)


def deck_root(html):
    """The deck's workspace folder (the one holding presentation\\ and work\\)."""
    pres = Path(html).parent
    return pres.parent if pres.name.lower() == "presentation" else pres


def count_slides(html):
    return len(SLIDE_RE.findall(Path(html).read_text(encoding="utf-8")))


def slide_ids(html):
    """data-src of every slide, in deck order."""
    return re.findall(r'<section\b[^>]*\bdata-src="([^"]*)"', Path(html).read_text(encoding="utf-8"))


def read_js_data(path):
    """The object of a `window.X = {...};` data file (data.js, notes.js, norm.js, ...)."""
    t = Path(path).read_text(encoding="utf-8")
    start = re.search(r"^window\.\w+\s*=\s*", t, re.M).end()   # comments above it may contain braces
    return json.loads(t[start:t.rindex("}") + 1])


def browser_cli(url, *args, size="1600,900", budget=15000, timeout=180):
    """One-shot headless Chromium (e.g. --screenshot=FILE or --dump-dom). Returns (stdout, console error lines)."""
    prof = tempfile.mkdtemp(prefix="deckkit_edge_")
    try:
        r = subprocess.run([find_browser(), "--headless=new", "--disable-gpu-sandbox", "--hide-scrollbars", "--mute-audio",
                            "--no-first-run", "--user-data-dir=" + prof, "--window-size=" + size,
                            "--virtual-time-budget=%d" % budget, "--enable-logging=stderr", "--v=0", *args, url],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
        errors = [l for l in r.stderr.splitlines() if "CONSOLE" in l and "rror" in l]
        return r.stdout, errors
    finally:
        shutil.rmtree(prof, ignore_errors=True)


class Chromium:
    """Headless Chromium driven over the DevTools protocol (needs websocket-client)."""

    def __init__(self, size=(1600, 900), args=()):
        import websocket
        self.prof = tempfile.mkdtemp(prefix="deckkit_cdp_")
        self.proc = subprocess.Popen([find_browser(), "--headless=new", "--remote-debugging-port=0", "--no-first-run",
                                      "--hide-scrollbars", "--mute-audio", "--user-data-dir=" + self.prof,
                                      "--window-size=%d,%d" % size, *args, "about:blank"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        port_file = Path(self.prof) / "DevToolsActivePort"   # the browser writes the port it picked here
        page = None
        for _ in range(150):
            try:
                port = int(port_file.read_text().split()[0])
                targets = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/json" % port, timeout=2).read())
                page = next(t for t in targets if t.get("type") == "page")
                break
            except (OSError, ValueError, IndexError, StopIteration):
                time.sleep(0.2)
        if not page:
            self.close()
            raise RuntimeError("headless Chromium did not start")
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=60, suppress_origin=True)
        self.n = 0
        self.events = []

    def send(self, method, **params):
        self.n += 1
        self.ws.send(json.dumps({"id": self.n, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get("id") == self.n:
                if "error" in m:
                    raise RuntimeError("%s: %s" % (method, m["error"]))
                return m.get("result", {})
            self.events.append(m)

    def ev(self, expr, wait=False):
        """Evaluate JS in the page and return its value (wait=True awaits a promise)."""
        r = self.send("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=wait)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"].get("exception", {}).get("description") or r["exceptionDetails"])
        return r.get("result", {}).get("value")

    def wait_event(self, name, timeout=60):
        end = time.time() + timeout
        while time.time() < end:
            for i, e in enumerate(self.events):
                if e.get("method") == name:
                    return self.events.pop(i)
            m = json.loads(self.ws.recv())
            if m.get("method") == name:
                return m
            self.events.append(m)
        raise TimeoutError(name)

    def open(self, url):
        self.send("Page.enable")
        self.events.clear()
        self.send("Page.navigate", url=url)
        self.wait_event("Page.loadEventFired")

    def key(self, key, code=None):
        for t in ("keyDown", "keyUp"):
            self.send("Input.dispatchKeyEvent", type=t, key=key, code=code or key,
                      text=key if t == "keyDown" and len(key) == 1 else "")

    def reload(self):
        self.events.clear()
        self.send("Page.reload")
        self.wait_event("Page.loadEventFired")

    def close(self):
        try:
            if getattr(self, "ws", None):
                self.ws.close()
        finally:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
            shutil.rmtree(self.prof, ignore_errors=True)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
