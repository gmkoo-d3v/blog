"""Generate offline modular pages. --strict requires all 68 PDF page anchors (day 1 and day 2) and all 49 D3 (MuJoCo deck) map entries."""
from pathlib import Path
from html import escape as esc
from html.parser import HTMLParser
from collections import OrderedDict
import json,re,argparse
ROOT=Path(__file__).resolve().parent

class Fragment(HTMLParser):
    def __init__(self):
        super().__init__();self.pages={};self.ids=[];self.forbidden=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if a.get('id'):self.ids.append(a['id'])
        if 'data-pdf-page' in a:self.pages[int(a['data-pdf-page'])]=a.get('id')
        if tag in ('script','style','iframe'):self.forbidden.append(tag)

def page_range(pages):
    return f'PDF p.{pages[0]}' if len(pages)==1 else f'PDF p.{pages[0]}–{pages[-1]}'

def plabel(t):
    # lessons without D2 pages (D3-only lessons) carry their own label in part*.json
    return t.get('label') or page_range(t['pages'])

def compact(nums):
    out=[];nums=sorted(nums)
    for n in nums:
        if out and n==out[-1][1]+1:out[-1][1]=n
        else:out.append([n,n])
    return '·'.join(str(a) if a==b else f'{a}–{b}' for a,b in out)

def load_course(strict):
    lessons=[];owners={};missing=[]
    for meta in sorted((ROOT/'content/day2').glob('part*.json')):
        for lesson in json.loads(meta.read_text(encoding='utf8')):
            slug=lesson['id']
            if not re.fullmatch(r'day2-[a-z0-9-]+',slug):raise ValueError(f'Invalid id: {slug}')
            path=ROOT/'content/day2'/f'{slug}.html'
            if not path.exists():missing.append(slug);continue
            body=path.read_text(encoding='utf8');p=Fragment();p.feed(body)
            if len(p.ids)!=len(set(p.ids)) or p.forbidden:raise ValueError(f'Invalid fragment {slug}')
            if set(p.pages)!=set(lesson['pages']):raise ValueError(f'Page metadata mismatch {slug}')
            for n in lesson['pages']:
                if not 1<=n<=68 or n in owners or p.pages[n]!=f'pdf-p{n:02}':raise ValueError(f'Invalid/duplicate page {n} in {slug}')
                owners[n]=slug
            if not lesson['pages'] and not lesson.get('label'):raise ValueError(f'Lesson without D2 pages needs a label: {slug}')
            for n in lesson.get('d3pages',[]):
                if f'd3-p{n:02}' not in p.ids:raise ValueError(f'Missing D3 anchor d3-p{n:02} in {slug}')
            lessons.append({**lesson,'slug':slug,'body':body,'ids':p.ids})
    lessons.sort(key=lambda t:t['sortKey'] if 'sortKey' in t else min(t['pages']))
    if strict and (missing or set(owners)!=set(range(1,69))):raise ValueError(f'Incomplete course: modules {missing}; pages {sorted(set(range(1,69))-set(owners))}')
    return lessons,owners,missing

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--strict',action='store_true');args=parser.parse_args()
    lessons,owners,missing=load_course(args.strict)
    day1=[]; day1owners={}
    outline=ROOT/'content/day1/outline.json'
    if args.strict and not outline.exists(): raise ValueError('Day1 outline missing')
    if outline.exists():
        raw=json.loads(outline.read_text(encoding='utf8'))
        for item in (raw.get('lessons',[]) if isinstance(raw,dict) else raw):
            slug=item['id']; path=ROOT/'content/day1'/item.get('file',f'{slug}.html')
            body=path.read_text(encoding='utf8'); fragment=Fragment(); fragment.feed(body)
            pages=item.get('sourcePages',item.get('pages',[]))
            if len(fragment.ids)!=len(set(fragment.ids)) or fragment.forbidden: raise ValueError(f'Invalid fragment {slug}')
            for n in pages:
                if n in day1owners or f'day1-p{n:02}' not in fragment.ids: raise ValueError(f'Invalid day1 anchor {n} in {slug}')
                day1owners[n]=slug
            day1.append({**item,'slug':slug,'ids':fragment.ids,'body':body,'pages':pages,'summary':item.get('summary',item.get('mainQuestion','')),'group':'1일차 · '+item.get('group','기초')})
        if args.strict and set(day1owners)!=set(range(1,69)): raise ValueError('Incomplete day1 coverage')
    all_lessons=day1+lessons
    notes=json.loads((ROOT/'content/topics.json').read_text(encoding='utf8'))
    quiz_path=ROOT/'content/day2/active-learning.json'
    quizzes=json.loads(quiz_path.read_text(encoding='utf8')) if quiz_path.exists() else []
    day1_quiz_path=ROOT/'content/day1/active-learning.json'  # day-1 self-checks (ids e01-..e12-..)
    if day1_quiz_path.exists():
        day1_quizzes=json.loads(day1_quiz_path.read_text(encoding='utf8'));known={q['id'] for q in quizzes}
        if any(q['id'] in known for q in day1_quizzes):raise ValueError('Duplicate quiz id between day1 and day2')
        quizzes+=day1_quizzes
    (ROOT/'scripts/quiz-data.js').write_text('window.StudyQuizzes = '+json.dumps(quizzes,ensure_ascii=False)+';',encoding='utf8')
    template=(ROOT/'templates/layout.html').read_text(encoding='utf8')
    groups=OrderedDict()
    for t in all_lessons:groups.setdefault(t['group'],[]).append(t)
    # D3 = third deck (MuJoCo, 49 pages). content/d3-map.json maps each page to lesson#anchor; strict needs all 49.
    D3_STATUS={'existing':'기존 설명','new':'새로 쓴 글','batch2':'보강 예정'}
    d3=json.loads((ROOT/'content/d3-map.json').read_text(encoding='utf8')) if (ROOT/'content/d3-map.json').exists() else []
    ids_by_slug={t['slug']:set(t['ids']) for t in all_lessons}; d3owners={}
    for e in d3:
        if e['lesson'] not in ids_by_slug or e['anchor'] not in ids_by_slug[e['lesson']]:raise ValueError(f"D3 map: {e['lesson']}#{e['anchor']} not found")
        if e['status'] not in D3_STATUS:raise ValueError(f"D3 map: bad status {e['status']}")
        for n in range(e['pages'][0],e['pages'][-1]+1):
            if n in d3owners or not 1<=n<=49:raise ValueError(f'D3 map: duplicate or bad page {n}')
            d3owners[n]=e
    if args.strict and d3 and set(d3owners)!=set(range(1,50)):raise ValueError(f'Incomplete D3 map: {sorted(set(range(1,50))-set(d3owners))}')
    def d3_context(slug):
        nums=[n for n,e in d3owners.items() if e['lesson']==slug]
        return ' · MuJoCo 교안 p.'+compact(nums) if nums else ''
    def render(title,content,slug=None,kind='notes',lesson=None):
        prefix='../' if slug else '';docs=prefix;pages='' if slug else 'pages/'
        nav=f'<a href="{prefix}index.html">학습 시작</a><a href="{pages}day1-coverage.html">1일차 교안 쪽에서 찾기</a><a href="{pages}coverage.html">2일차 교안 쪽에서 찾기</a><a href="{pages}d3-coverage.html">MuJoCo 교안 쪽에서 찾기</a><a href="{pages}simulator.html">2D 작업 공간 실험 ↗</a><a href="{pages}dh-lab.html">DH 3D 실험실 ↗</a><a href="{pages}jacobian-lab.html">야코비안 실험실 ↗</a>'
        for group,items in groups.items():
            nav+='<details class="nav-group"'+(' open' if any(t['slug']==slug for t in items) else '')+f'><summary>{esc(group)}</summary>'
            for t in items:
                current=' aria-current="page"' if t['slug']==slug else ''
                nav+=f'<a href="{pages}{t["slug"]}.html"{current}><span>{esc(t["title"])}</span><small>{plabel(t)}</small></a>'
            nav+='</details>'
        nav+='<details class="nav-group"'+(' open' if kind=='notes' and slug not in ('simulator','coverage') else '')+'><summary>수업 중 헷갈렸던 것</summary>'
        for t in notes:
            current=' aria-current="page"' if t['slug']==slug else ''
            nav+=f'<a href="{pages}{t["slug"]}.html"{current}>{esc(t["title"])}</a>'
        nav+='</details>'
        # Keep lesson images local; source caches stay outside the published tree.
        content=re.sub(r'(src|href)="../../source-library/(local-day1/[^"#]+\.(?:png|svg|jpg|jpeg))"', lambda m: m[1]+'="'+prefix+'assets/'+m[2]+'"', content, flags=re.I)
        content=re.sub(r'href="../../source-library/snapshot/([^"]+)"', lambda m: 'href="https://github.com/playideas/python-book/blob/ef89393f254f7315fe31dcdd8f7fc12eabe488b8/'+m[1]+'"', content)
        content=re.sub(r'<a\b[^>]*href="../../source-library/[^"]+"[^>]*>(.*?)</a>', r'\1', content, flags=re.S)
        content=content.replace('href="../../assets/', 'href="'+prefix+'assets/')
        content=re.sub(r'<a\b[^>]*href="(?:class-notes\.md|\.\./\.qa/[^"]+)"[^>]*>(.*?)</a>', r'\1', content, flags=re.S)
        content=content.replace('src="assets/','src="'+docs+'assets/').replace('href="assets/','href="'+docs+'assets/')
        content=re.sub(r'href="([\w-]+\.md)"',lambda m:'href="'+docs+m[1]+'"',content)
        scripts='<script src="../scripts/kinematics.js"></script><script src="../scripts/simulator.js"></script>' if slug=='simulator' else ''
        if slug=='dh-lab':scripts=''.join('<script src="../'+file+'"></script>' for file in ['scripts/dh-math.js','scripts/dh-lessons.js','scripts/dh-view.js','scripts/dh-lab.js'])
        if slug=='jacobian-lab':scripts=''.join('<script src="../scripts/'+file+'"></script>' for file in ['jacobian-math.js','jacobian-view.js','jacobian-lab.js'])
        extra_styles=''
        if slug=='day1-09-euler':
            lesson_modules=['gimbal-lock-demo','euler-sequence-demo','rotation-vector-demo']
            extra_styles=''.join(f'<link rel="stylesheet" href="../styles/{name}.css">' for name in lesson_modules)
            scripts+=''.join(f'<script src="../scripts/{name}.js"></script>' for name in lesson_modules)
        if slug=='day1-10-quaternion':
            lesson_modules=['complex-plane-demo','interpolation-demo']
            extra_styles+=''.join(f'<link rel="stylesheet" href="../styles/{name}.css">' for name in lesson_modules)
            scripts+=''.join(f'<script src="../scripts/{name}.js"></script>' for name in lesson_modules)
        if slug=='day1-11-transform':
            lesson_modules=['matrix-basics-demo','camera-cup-demo']
            extra_styles+=''.join(f'<link rel="stylesheet" href="../styles/{name}.css">' for name in lesson_modules)
            scripts+=''.join(f'<script src="../scripts/{name}.js"></script>' for name in lesson_modules)
        if slug and slug.startswith('day1-') and slug!='day1-coverage':  # run blocks + day-1 widgets (h04b)
            extra_styles+='<link rel="stylesheet" href="../styles/h04b-demos.css">'
            h4={'day1-03-body':['motor-lag-demo'],'day1-04-timing':['control-period-demo'],'day1-07-frames-rotation':['frame-rotation-demo'],'day1-12-gyro':['gyro-data','gyro-demo']}
            if slug in h4:scripts+='<script src="../scripts/h04b-plot.js"></script>'+''.join(f'<script src="../scripts/{"h04b-"+n if n!="gyro-data" else "h04b-gyro-data"}.js"></script>' for n in h4[slug])
        if slug in ('day2-40-mujoco-start','day2-41-xml-primer'):
            extra_styles+='<link rel="stylesheet" href="../styles/xml-scene-demo.css">'
            scripts+=''.join(f'<script src="../scripts/{n}.js"></script>' for n in (['viewer-tour-data','viewer-tour-demo'] if slug=='day2-40-mujoco-start' else ['xml-scene-demo']))
        b2={'day2-55-actuator':['control-loop-data','control-loop-demo','sag-data','sag-demo'],'day2-59-sensor':['sensor-data','sensor-demo'],'day2-62-push':['spec-sheet-demo','arm-push-data','arm-push-demo','arm-replay-data','arm-replay-demo']}  # batch 2 widgets
        if slug in b2:
            extra_styles+='<link rel="stylesheet" href="../styles/mujoco-b2-demos.css">'
            scripts+=''.join(f'<script src="../scripts/{n}.js"></script>' for n in b2[slug])
        if 'data-kit=' in content:  # visual kit (HANDOFF-07): any page with data-kit markup gets the kit + every content/kit-data/<name>.js named in data-src
            names=list(OrderedDict.fromkeys(n for v in re.findall(r'data-src="([^"]+)"',content) for n in v.split()))
            for n in names:
                if not re.fullmatch(r'[a-z0-9-]+',n) or not (ROOT/'content/kit-data'/f'{n}.js').exists():raise ValueError(f'Kit data missing: content/kit-data/{n}.js')
            extra_styles+=f'<link rel="stylesheet" href="{prefix}styles/kit.css">'
            scripts+=f'<script src="{prefix}scripts/kit-core.js"></script>'+''.join(f'<script src="{prefix}content/kit-data/{n}.js"></script>' for n in names)+''.join(f'<script src="{prefix}scripts/kit-{n}.js"></script>' for n in ['controls','plot','scene2d','scene3d','code'])
        pager='';sequence=all_lessons if kind=='course' else notes
        if slug and any(t['slug']==slug for t in sequence):
            i=next(i for i,t in enumerate(sequence) if t['slug']==slug)
            if i:pager+=f'<a href="{sequence[i-1]["slug"]}.html">← 이전: {esc(sequence[i-1]["title"])}</a>'
            if i+1<len(sequence):pager+=f'<a href="{sequence[i+1]["slug"]}.html">다음: {esc(sequence[i+1]["title"])} →</a>'
        context=plabel(lesson)+' · '+esc(lesson['group'])+d3_context(lesson['slug']) if lesson else '로봇기초 · 1·2일차 / 이해를 위한 필기'
        result=template
        for k,v in dict(title=esc(title),content=content,nav=nav,prefix=prefix,docs=docs,scripts=scripts,pager=pager,context=context,extra_styles=extra_styles).items():result=result.replace('{{'+k+'}}',v)
        return result
    for t in notes+[{'slug':'simulator','title':'직접 움직이는 로봇팔 실험실'}]:
        content=(ROOT/'content'/f'{t["slug"]}.html').read_text(encoding='utf8')
        (ROOT/'pages'/f'{t["slug"]}.html').write_text(render(t['title'],content,t['slug']),encoding='utf8')
    for t in all_lessons:(ROOT/'pages'/f'{t["slug"]}.html').write_text(render(t['title'],t['body'],t['slug'],'course',t),encoding='utf8')
    first='pages/'+all_lessons[0]['slug']+'.html' if all_lessons else 'pages/links.html'
    intro='<p class="lead">교안의 한 줄이 이해되지 않아도 괜찮습니다. 왜 배우는지부터 시작해, 그림과 작은 예를 거쳐 수식·코드와 실습 풀이까지 따라갑니다.</p>'
    intro+=f'<div class="study-routes"><a href="{first}"><strong>처음부터 차근차근</strong><span>교안 순서로 설명과 예제 읽기 →</span></a><a href="pages/coverage.html"><strong>지금 보는 교안 쪽으로</strong><span>PDF 페이지 번호로 바로 찾기 →</span></a><a href="pages/dh-lab.html"><strong>DH 값을 직접 바꾸기</strong><span>설명을 보고 같은 값으로 움직여 보기 →</span></a></div>'
    intro+='<div class="point"><strong>야코비안 숫자가 무슨 뜻인지 모르겠다면</strong><br><a href="pages/jacobian-lab.html">각도·J 네 칸·코드·손끝 움직임을 함께 보기 →</a></div>'
    intro+='<p class="small">MuJoCo 2일차 교안(49쪽)을 들고 있다면 <a href="pages/d3-coverage.html">MuJoCo 교안 쪽 번호로 찾기 →</a> · 내 PC에서 예제를 돌리는 방법은 <a href="pages/run-code.html">예제 실행 안내 →</a></p>'
    intro+=f'<h2>1일차와 2일차 수업</h2><p class="small">1일차 {len(day1owners)}/68쪽, 2일차 {len(owners)}/68쪽, MuJoCo 교안 {len(d3owners)}/49쪽 설명 연결. 실습 코드는 해설과 실행 결과의 검증 여부를 구분해 읽으세요.</p>'
    for group,items in groups.items():
        intro+=f'<section class="course-group"><h3>{esc(group)}</h3><div class="lesson-grid">'
        for t in items:intro+=f'<a class="lesson-card" href="pages/{t["slug"]}.html"><small>{plabel(t)}</small><strong>{esc(t["title"])}</strong><span>{esc(t["summary"])}</span></a>'
        intro+='</div></section>'
    intro+='<h2>수업 중 헷갈렸던 것</h2><p>말씀하신 질문과 손그림에서 출발한 짧은 설명입니다. 전체 강의와 별도로 다시 찾아볼 수 있습니다.</p><ul>'
    intro+=''.join(f'<li><a href="pages/{t["slug"]}.html">{esc(t["title"])}</a></li>' for t in notes)+'</ul>'
    (ROOT/'index.html').write_text(render('로봇기초 1·2일차, 처음부터 이해하기',intro,kind='home'),encoding='utf8')
    coverage='<p class="lead">강의 화면에 나온 PDF 쪽 번호를 선택하면 그 페이지의 설명으로 바로 이동합니다.</p><p>파일 첫 장을 1쪽으로 세었습니다. 한 주제가 여러 쪽에 걸쳐도 각 쪽의 설명 위치에 연결됩니다.</p><div class="page-grid">';coverage_data=[]
    for n in range(1,69):
        if n in owners:
            t=next(t for t in lessons if t['slug']==owners[n]);url=f'{t["slug"]}.html#pdf-p{n:02}'
            coverage+=f'<a href="{url}" title="{esc(t["title"])}">{n:02}</a>'
            coverage_data.append({'page':n,'lesson':t['slug'],'title':t['title'],'href':'pages/'+url})
        else:coverage+=f'<span title="아직 작성 중">{n:02}</span>'
    coverage+='</div><div class="tablewrap"><table><thead><tr><th>교안 쪽</th><th>학습 주제</th><th>무엇을 이해하나요?</th></tr></thead><tbody>'
    for t in [t for t in lessons if t['pages']]:coverage+=f'<tr><td>{page_range(t["pages"])}</td><td><a href="{t["slug"]}.html">{esc(t["title"])}</a></td><td>{esc(t["summary"])}</td></tr>'
    coverage+='</tbody></table></div>'
    (ROOT/'pages/coverage.html').write_text(render('교안 68쪽에서 바로 찾기',coverage,'coverage','coverage'),encoding='utf8')
    day1coverage='<p class="lead">1일차 교안 쪽 번호로 찾아갑니다.</p><div class="page-grid">'
    for n in range(1,69):
        if n in day1owners:
            t=next(t for t in day1 if t['slug']==day1owners[n]);day1coverage+=f'<a href="{t["slug"]}.html#day1-p{n:02}" title="{esc(t["title"])}">{n:02}</a>'
        else: day1coverage+=f'<span>{n:02}</span>'
    day1coverage+='</div>'
    (ROOT/'pages/day1-coverage.html').write_text(render('1일차 교안에서 찾기',day1coverage,'day1-coverage','coverage'),encoding='utf8')
    (ROOT/'coverage.json').write_text(json.dumps(coverage_data,ensure_ascii=False,indent=2),encoding='utf8')
    if d3:
        title_of={t['slug']:t['title'] for t in all_lessons};d3data=[]
        d3cov='<p class="lead">MuJoCo 2일차 교안(49쪽, 13~18차시)의 쪽 번호로 찾아갑니다. 교안 첫 장을 1쪽으로 셉니다.</p><p class="small">숫자 옆 * 는 지금은 가까운 설명으로 연결되고, 그 쪽의 전용 설명은 보강할 예정이라는 표시입니다.</p><div class="page-grid">'
        for n in range(1,50):
            e=d3owners[n];star='*' if e['status']=='batch2' else ''
            d3cov+=f'<a href="{e["lesson"]}.html#{e["anchor"]}" title="{esc(e["topic"])} · {D3_STATUS[e["status"]]}">{n:02}{star}</a>'
            d3data.append({'page':n,'topic':e['topic'],'lesson':e['lesson'],'href':f'pages/{e["lesson"]}.html#{e["anchor"]}','status':e['status']})
        d3cov+='</div><div class="tablewrap"><table><thead><tr><th>교안 쪽</th><th>주제</th><th>설명 위치</th><th>상태</th></tr></thead><tbody>'
        for e in d3:
            a,b=e['pages'][0],e['pages'][-1];rng=f'p.{a}' if a==b else f'p.{a}–{b}'
            d3cov+=f'<tr><td>{rng}</td><td>{esc(e["topic"])}</td><td><a href="{e["lesson"]}.html#{e["anchor"]}">{esc(title_of[e["lesson"]])}</a></td><td>{D3_STATUS[e["status"]]}</td></tr>'
        d3cov+='</tbody></table></div>'
        (ROOT/'pages/d3-coverage.html').write_text(render('MuJoCo 교안 49쪽에서 바로 찾기',d3cov,'d3-coverage','coverage'),encoding='utf8')
        (ROOT/'coverage-d3.json').write_text(json.dumps(d3data,ensure_ascii=False,indent=2),encoding='utf8')
    print(f'Built {len(day1)} day1 lessons ({len(day1owners)}/68 pages), {len(lessons)} day2 lessons ({len(owners)}/68 pages), D3 map {len(d3owners)}/49 pages, and {len(notes)+4} utility pages')
    if missing:print('Pending:',', '.join(missing))
if __name__=='__main__':main()
