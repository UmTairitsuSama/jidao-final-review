import json,pathlib,collections
R=pathlib.Path(__file__).resolve().parents[1]
rows=json.loads((R/'tmp/revision/coverage.json').read_text(encoding='utf-8'))
allq=[]
for f in sorted((R/'content').glob('*.json')):allq+=json.loads(f.read_text(encoding='utf-8')).get('problems',[])
byid={q['id']:q for q in allq}
assert len(byid)==len(allq)
assert all(len(set(row[2]))>=2 and all(i in byid for i in row[2]) for row in rows)
intro='''# C语言复习资料逐项核查与补缺报告

核查依据：本地 SPEC_FINAL.md、原有150道精选题、知识精讲、速查手册及 PTA 原题库。范围按课程“基础至数组、字符串、函数递归、指针动态内存、结构体与封装”整理，并保留原资料中的算法拓展。未取得学校正式考纲，不能据此断言覆盖所有可能的C语言考题。

本次核查表以原题的每个具体任务为一行，并增加原题缺少的语言机制专项。每行至少有两道可定位的练习。原有具体任务采用“一道完整编程＋一道配套代码分析”；V-题与原题共用算法，**不是第二道独立编程题**。新增X/K专项是独立编程题。模考试题不用于凑题库最低数量。

练习方法：编程题先独立实现；代码分析题先写指定输入的输出、关键变量变化、停止条件和边界解释，再展开答案核对。代码分析题样例区另给格式参考；指定输入的输出可由参考程序核对。

新增重点：二级指针、数组指针及二维参数、realloc扩容、深浅复制、回调、静态局部与遮蔽、递归数组处理、const指针、void指针、生存期、sizeof与数组形参退化、宏与条件编译、短路求值、break/continue、缓冲区容量、memmove、typedef。联合体、链表、文件流为拓展，不据此推断学校一定考查。

“类的设计”按原资料的C语言约定，用结构体与操作函数训练封装；不添加C++类语法。原T05、T11、T12、T13及新增FM9-4、FM10-5覆盖该思想。

## 题型覆盖表

编程任务覆盖：数值计算、条件与枚举、循环与模拟、数组统计和修改、排序与查找、矩阵变换、字符串处理、函数接口与递归、指针操作和动态内存、结构体排序及管理、算法综合。每个原有具体任务增加配套代码分析。额外补充语言机制专项，题号与每个小类别的数量见下表。

| 所属板块 | 具体小类别 / 原任务 | 对应题号 | 数量 | 练习构成 |
|---|---|---|---:|---|
'''
names=dict(basic='基础',select='选择',loop='循环',array1='一维数组',array2='二维数组',mix='控制流综合',string='字符串',func='函数递归',pointer='指针内存',struct='自定义类型',algo='算法综合')
table='\n'.join('| '+names[c]+' | '+t+' | '+', '.join(ids)+' | '+str(len(ids))+' | '+('编程＋配套代码分析' if any(i.startswith('V-') for i in ids) else '两道专项编程')+' |' for c,t,ids in rows)
tail=f'\n\n共 {len(rows)} 个核查行，题库共 {len(allq)} 题。其中原有150道编程题，本次新增42道专项编程及150道配套代码分析。四套新增卷FM7–FM10共24题，每卷120分钟、100分。\n\n## 原资料的表述修正\n\n原网页关于“与真实期末机考一致”的说法缺少正式考纲支持，新增卷以本地课程范围为设计依据；原有卷保留作为练习。联合体、链表、文件操作、较高阶算法作为拓展使用。代码与样例验证结果见 tmp/revision 下的日志；样例通过不能替代对所有输入的证明。\n'
report=intro+table+tail
(R/'知识点覆盖核查表.md').write_text(report,encoding='utf-8')
guide={'guide':{'sections':[dict(id='g-audit',title='逐项覆盖核查与补缺导航',ch='本次修订 · 核查表',weight='高频',body=report.replace('# C语言复习资料逐项核查与补缺报告','### 核查范围',1))]}}
(R/'content/18_audit_guide.json').write_text(json.dumps(guide,ensure_ascii=False,indent=2),encoding='utf-8')
es=json.loads((R/'content/17_four_new_exams.json').read_text(encoding='utf-8'))['exams']
for answers in (False,True):
    parts=['# 四套期末仿真卷'+(' · 参考答案与评分建议' if answers else ' · 试题册'),'每套120分钟，100分。六题依次10、15、15、20、20、20分。评分建议：算法思路40%，实现与接口40%，边界和输出20%；仅供自评。']
    for e in es:
        parts+=['\n## '+e['title'],e['subtitle']]
        for q in e['problems']:
            parts+=['\n### '+q['id']+' '+q['title']]
            if answers:parts+=[q['hint'],'易错点：'+q['pitfalls'],'```c\n'+q['solution']+'```']
            else:
                parts+=[q['desc']]
                for i,s in enumerate(q['samples'],1):parts+=[f'样例{i}输入：\n```\n'+s['in']+'```','输出：\n```\n'+s['out']+'```']
    (R/('四套期末仿真卷_参考答案.md' if answers else '四套期末仿真卷_试题册.md')).write_text('\n\n'.join(parts),encoding='utf-8')
print('coverage verified',len(rows),'rows;',len(allq),'bank problems')
