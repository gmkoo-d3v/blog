"""One-time, pinned vendor acquisition for offline use. No remote code executed here."""
from pathlib import Path
import urllib.request,tarfile,io,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
raw=ROOT/'vendor/three-r187';raw.mkdir(parents=True,exist_ok=True)
base='https://raw.githubusercontent.com/mrdoob/three.js/r187/'
for src,dest in [('build/three.module.js','three.module.js'),('build/three.core.js','three.core.js'),('examples/jsm/controls/OrbitControls.js','OrbitControls.js'),('LICENSE','LICENSE')]:
    path=raw/dest
    if not path.exists():path.write_bytes(urllib.request.urlopen(base+src,timeout=45).read())
    print(dest,path.stat().st_size)
tool=ROOT/'.build';tool.mkdir(exist_ok=True)
if not (tool/'esbuild.exe').exists():
    data=urllib.request.urlopen('https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.25.12.tgz',timeout=45).read()
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        member=next(m for m in archive.getmembers() if m.name.endswith('/esbuild.exe'))
        (tool/'esbuild.exe').write_bytes(archive.extractfile(member).read())
(raw/'source.json').write_text(json.dumps({'threeTag':'r187','source':base,'esbuild':'0.25.12','downloadedFiles':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in raw.iterdir() if p.is_file() and p.name!='source.json'}},indent=2),encoding='utf8')
