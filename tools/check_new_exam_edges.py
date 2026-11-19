import json,pathlib,random,itertools,tempfile,subprocess,shutil
R=pathlib.Path(__file__).resolve().parents[1]
qs={q['id']:q for e in json.loads((R/'content/17_four_new_exams.json').read_text(encoding='utf-8'))['exams'] for q in e['problems']}
qs.update({q['id']:q for q in json.loads((R/'content/22_former_exam_questions.json').read_text(encoding='utf-8'))['problems']})
rng=random.Random(20261115);count=0
def cases(id):
    for _ in range(40):
        n=rng.randint(1,8);a=[rng.randint(-5,5) for _ in range(n)]
        if id=='FM10-6':
            k=rng.randint(1,n);possible=[sum(a[i] for i in c) for c in itertools.combinations(range(n),k) if all(c[j]+1<c[j+1] for j in range(k-1))]
            yield f'{n} {k}\n'+ ' '.join(map(str,a))+'\n',str(max(possible)) if possible else 'IMPOSSIBLE'
        elif id=='FM8-6':
            a=[abs(x)+1 for x in a];s=rng.randint(1,25);lens=[j-i for i in range(n) for j in range(i+1,n+1) if sum(a[i:j])>=s]
            yield f'{n} {s}\n'+' '.join(map(str,a))+'\n',str(min(lens) if lens else 0)
        elif id=='FM7-6':
            ops=[];b=[0]*n
            for j in range(6):
                l=rng.randrange(n);r=rng.randrange(l,n);v=rng.randint(-5,5);ops.append(f'{l+1} {r+1} {v}')
                for i in range(l,r+1):b[i]+=v
            v=max(b);yield f'{n} 6\n'+'\n'.join(ops)+'\n',f'{v} {b.index(v)+1}'
        else:
            s=''.join(rng.choice('abc') for _ in range(n));ok=s==s[::-1] or any((s[:i]+s[i+1:])==(s[:i]+s[i+1:])[::-1] for i in range(n))
            yield s+'\n','YES' if ok else 'NO'
for id in ('FM7-6','FM8-6','FM10-3','FM10-6'):
    tmp=pathlib.Path(tempfile.mkdtemp(prefix='review_edge_'))
    try:
        src=tmp/'main.c';exe=tmp/'main.exe';src.write_text(qs[id]['solution'],encoding='utf-8')
        subprocess.run(['gcc','-std=c11','-O2',str(src),'-o',str(exe)],check=True,capture_output=True,timeout=60)
        for inp,expected in cases(id):
            r=subprocess.run([str(exe)],input=inp,text=True,capture_output=True,timeout=5)
            assert r.returncode==0 and r.stdout.strip()==expected,(id,inp,expected,r.stdout,r.stderr)
            count+=1
        print('PASS',id,40,flush=True)
    finally:shutil.rmtree(tmp)
print('PASS brute-force comparisons',count)
