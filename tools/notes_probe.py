"""Check the presenter script (notes) in headless Chromium: editing, drafts, and saving.

usage: python notes_probe.py [deck] [--other DECK]
  deck     the deck to check (workspace, presentation folder or .html; default: current folder)
  --other  a second deck or copy: its drafts and presenter window must stay separate from the first
Checks: the presenter window (P) shows the slide's notes; an edit is kept as a draft and survives a reload;
arrow keys typed in the notes do not move slides; the notes follow slide changes.
Saving runs against an in-memory assets folder put in place of the folder dialog (nothing on disk is written):
edits made elsewhere since the deck was opened are kept, the replaced file is backed up (last 20),
another deck's folder is refused, and a draft made before notes.js changed is merged, not dropped.
"""
import argparse
import json
import time

from deckutil import Chromium, find_html, read_js_data, slide_ids

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
    def __init__(self, browser, html):
        self.e, self.html = browser, html
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

    def pwin(self, js):
        return self.e.ev("window.open('', %s)%s" % (json.dumps(self.key + "|presenter"), js))

    def fake_folder(self, notes_text):
        """An in-memory assets folder (engine.js + notes.js) answers the presenter's folder dialog."""
        # the same folder object is refilled: the engine keeps the folder it was given
        self.e.ev(FAKE_FS + "window.__dir=window.__dir||__mkdir();__dir.e={'engine.js':{text:'x'},'notes.js':{text:%s}};" % json.dumps(notes_text))
        self.pwin(".showDirectoryPicker=function(){return Promise.resolve(window.__dir)}")   # made here: window = the deck

    def disk(self, path="notes.js"):
        """A file of the fake folder ('a/b' = in a subfolder), parsed like read_js_data."""
        t = self.e.ev("(function(){var d=__dir,p=%s.split('/');for(var i=0;i<p.length-1;i++)d=d.e[p[i]];return d.e[p[p.length-1]].text})()" % json.dumps(path))
        return json.loads(t[t.index("{"):t.rindex("}") + 1])

    def backups(self):
        return self.e.ev("Object.keys((__dir.e.notes_backup||{e:{}}).e).length")

    def save(self):
        self.e.ev(self.P + ".getElementById('st').textContent=''")
        self.e.ev(self.P + ".getElementById('sv').click()")
        wait(lambda: any(w in self.status() for w in ("저장했습니다", "저장하지 못했습니다")))
        return self.status()


# in-memory stand-in for the File System Access folder handle (only the calls the engine makes)
FAKE_FS = """window.__mkdir=function(){
 function nf(){return Promise.reject(new DOMException('no such entry','NotFoundError'))}
 function Dir(){this.kind='directory';this.e={};this.f=nf}   // own function: cannot be stored in IndexedDB, so never remembered
 Dir.prototype.getFileHandle=function(n,o){var e=this.e;if(!(n in e)){if(!(o&&o.create))return nf();e[n]={text:''}}var f=e[n];
  return Promise.resolve({name:n,getFile:function(){return Promise.resolve({text:function(){return Promise.resolve(f.text)}})},
   createWritable:function(){var b='';return Promise.resolve({write:function(t){b+=t;return Promise.resolve()},
    close:function(){return new Promise(function(r){setTimeout(function(){f.text=b;r()},window.__slow||0)})}})}})};   // __slow: a save that takes time
 Dir.prototype.getDirectoryHandle=function(n,o){var e=this.e;if(!(n in e)){if(!(o&&o.create))return nf();e[n]=new Dir()}return Promise.resolve(e[n])};
 Dir.prototype.keys=function(){var k=Object.keys(this.e),i=0;return{next:function(){return Promise.resolve(i<k.length?{done:false,value:k[i++]}:{done:true})}}};
 Dir.prototype.removeEntry=function(n){delete this.e[n];return Promise.resolve()};
 Dir.prototype.requestPermission=Dir.prototype.queryPermission=function(){return Promise.resolve('granted')};
 return new Dir()};"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    ap.add_argument("--other")
    a = ap.parse_args()
    html = find_html(a.deck)
    with Chromium() as e:
        d = Deck(e, html)
        d.open()
        e.ev("localStorage.clear()")
        e.reload()
        check("presenter window opens", d.presenter())
        check("it shows the notes of slide %d" % d.n, d.notes_text().startswith(d.first), repr(d.notes_text()[:60]))
        check("saving by folder choice is available", d.pwin(".showDirectoryPicker && 'yes'") == "yes")
        d.type("PROBE line one.\n\nPROBE line two.")
        draft = e.ev("localStorage.getItem(%s) || ''" % json.dumps(d.key + "|notes-draft"))
        check("an edit is kept as a draft (under this folder's key)", '"PROBE line one."' in draft and '"PROBE line two."' in draft)
        check("status says unsaved", "저장 안 한" in d.status(), d.status())
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

        # saving after notes.js was changed elsewhere (the agent, OneDrive) since the deck was opened
        ids = slide_ids(html)
        mine, other = ids[d.n - 1], next(s for s in ids if s != ids[d.n - 1])
        on_disk = (html.parent / "assets" / "notes.js").read_text(encoding="utf-8")
        changed = read_js_data(html.parent / "assets" / "notes.js")
        changed["saved"], changed["notes"][other] = "elsewhere", ["OTHER EDIT made elsewhere."]
        d.fake_folder("window.DECK_NOTES = " + json.dumps(changed) + ";\n")
        check("save reports success", "저장했습니다" in d.save(), d.status())
        n = d.disk()["notes"]
        check("the edit is saved", n.get(mine, [""])[0] == "PROBE line one.", n.get(mine))
        check("an edit made elsewhere since opening is kept", n.get(other) == ["OTHER EDIT made elsewhere."], n.get(other))
        check("the deck's folder is written in the file", "deck:" + d.disk()["deck"].lower() == d.key, d.disk().get("deck"))
        check("the replaced file is backed up", d.backups() == 1, d.backups())
        bak = e.ev("Object.keys(__dir.e.notes_backup.e)[0]")
        check("the backup holds the file as it was", d.disk("notes_backup/" + bak)["notes"].get(other) == ["OTHER EDIT made elsewhere."])
        check("status no longer says unsaved", "저장 안 한" not in d.status(), d.status())

        # from now on saving is automatic
        check("the save button is hidden once saving is automatic", d.pwin(".document.getElementById('sv').style.display") == "none")
        d.type("PROBE saved by itself.")
        check("an edit saves by itself", wait(lambda: d.disk()["notes"].get(mine) == ["PROBE saved by itself."]), d.disk()["notes"].get(mine))
        check("the status says so", wait(lambda: "자동 저장" in d.status()), d.status())
        check("no new backup while one person keeps typing", d.backups() == 1, d.backups())
        changed = d.disk()
        changed["saved"], changed["notes"][other] = "elsewhere again", ["OTHER EDIT, second time."]
        e.ev("__dir.e['notes.js'].text=%s" % json.dumps("window.DECK_NOTES = " + json.dumps(changed) + ";\n"))
        d.type("PROBE after another edit.")
        wait(lambda: d.disk()["notes"].get(mine) == ["PROBE after another edit."])
        check("a file changed elsewhere is backed up before the next automatic save", d.backups() == 2, d.backups())
        check("and the change made elsewhere is kept", d.disk()["notes"].get(other) == ["OTHER EDIT, second time."])
        e.ev("window.__slow=2500")                       # typing on while a save is still being written
        d.type("PROBE typed first.")
        time.sleep(2.6)
        d.type("PROBE typed while saving.")
        time.sleep(6)
        e.ev("window.__slow=0")
        check("what was typed during a save is saved too (not dropped)", d.disk()["notes"].get(mine) == ["PROBE typed while saving."], d.disk()["notes"].get(mine))
        check("and nothing is left unsaved", wait(lambda: "저장 안 한" not in d.status()), d.status())

        # another deck's assets folder chosen by mistake
        wrong = dict(d.disk(), deck="C:\\another\\deck\\presentation")
        d.fake_folder("window.DECK_NOTES = " + json.dumps(wrong) + ";\n")
        d.type("PROBE wrong folder.")
        d.pwin(".confirm=function(){return false}")
        d.e.ev(d.P + ".getElementById('sv').click()")
        time.sleep(1)
        check("another deck's notes.js is not overwritten", d.disk()["deck"].startswith("C:\\another"), d.disk()["deck"])
        check("nothing is lost: the edit is still unsaved", "저장 안 한" in d.status(), d.status())

        # a draft made before notes.js changed: kept and merged on save, not dropped
        dk = json.dumps(d.key + "|notes-draft")
        e.ev("localStorage.setItem(%s, JSON.stringify(Object.assign(JSON.parse(localStorage.getItem(%s)), {base: 'older'})))" % (dk, dk))
        d.pwin(".close()")
        e.reload()
        d.presenter()
        check("a draft older than notes.js is kept", d.notes_text().startswith("PROBE wrong folder."), repr(d.notes_text()[:40]))
        check("the presenter says it will be merged", "합쳐집니다" in d.status(), d.status())
        d.fake_folder(on_disk)
        e.ev("__dir.e.notes_backup=__mkdir();for(var i=0;i<25;i++)__dir.e.notes_backup.e['notes_2000-'+(100+i)+'.js']={text:'x'}")
        d.save()
        check("the old draft is merged into the file", d.disk()["notes"].get(mine) == ["PROBE wrong folder."], d.disk()["notes"].get(mine))
        check("at most 20 backups are kept", d.backups() == 20, d.backups())
        check("the newest backup is among them", e.ev("Object.keys(__dir.e.notes_backup.e).some(function(k){return k.indexOf('notes_20')==0&&k.indexOf('notes_2000')<0})"))

        if a.other:
            o = Deck(e, find_html(a.other))
            o.open()
            check("the other copy has its own key", o.key != d.key, o.key)
            o.presenter()
            check("the other copy shows its own notes, not this draft", not o.notes_text().startswith("PROBE"), repr(o.notes_text()[:60]))
            check("the other copy has no draft", not e.ev("localStorage.getItem(%s)" % json.dumps(o.key + "|notes-draft")))
            check("the presenter windows are separate", o.P != d.P)

        e.ev("localStorage.clear()")
    print("%d/%d passed" % (sum(results), len(results)))
    raise SystemExit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
