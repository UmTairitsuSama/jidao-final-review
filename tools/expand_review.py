import json, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
out=[]; coverage=[]
def add(cat,topic,title,task,code,samples,hint):
    q=dict(id=f'X{len(out)+1:03}',cat=cat,title=title,difficulty=2,tags=[topic,'补缺练习'],source='新编（逐项核查补充）',desc=f'### 题目描述\n{task}\n\n### 输入格式\n见上述约定；所有整数均为十进制。\n\n### 输出格式\n按题意输出，数之间一个空格，行末换行。',samples=[dict(zip(('in','out'),s)) for s in samples],hint=hint,pitfalls='检查输入边界与对象生存期；不得访问越界或已经释放的对象。',solution='#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n'+code+'\n')
    out.append(q); return q['id']
def pair(cat,topic,items):
    ids=[add(cat,topic,*item) for item in items]; coverage.append([cat,topic,ids])
pair('pointer','二级指针：改变指向与动态分配',[
('二级指针选择目标','输入 a、b、k（a,b 在 -100 至 100，k 为0或1）。实现 choose(int **p,int *a,int *b,int k)，令调用者指针指向 a 或 b，再将目标加10，输出 a b。','void choose(int **p,int *a,int *b,int k){*p=k?b:a;}\nint main(void){int a,b,k,*p;scanf("%d%d%d",&a,&b,&k);choose(&p,&a,&b,k);*p+=10;printf("%d %d\\n",a,b);return 0;}',[('3 5 1\n','3 15\n'),('0 -1 0\n','10 -1\n')],'传入指针变量自身的地址，用 *p 修改它。'),
('二级指针创建平方表','输入 n（1至100）。实现 create(int **p,int n)，分配数组并写入1至n的平方；主函数输出数组后释放。','int create(int **p,int n){*p=malloc((size_t)n*sizeof **p);if(!*p)return 0;for(int i=0;i<n;i++)(*p)[i]=(i+1)*(i+1);return 1;}\nint main(void){int n,*p=NULL;scanf("%d",&n);if(!create(&p,n))return 1;for(int i=0;i<n;i++)printf("%s%d",i?" ":"",p[i]);puts("");free(p);return 0;}',[('3\n','1 4 9\n'),('1\n','1\n')],'区分 *p 指针与 (*p)[i] 元素。')])
pair('pointer','数组指针与二维参数',[
('数组指针求列和','输入 n（1至20），再输入 n 行3列的整数（绝对值≤100）。用 int (*p)[3] 遍历，输出3个列和。','int main(void){int n,a[20][3],s[3]={0};scanf("%d",&n);int (*p)[3]=a;for(int i=0;i<n;i++)for(int j=0;j<3;j++){scanf("%d",&p[i][j]);s[j]+=p[i][j];}printf("%d %d %d\\n",s[0],s[1],s[2]);return 0;}',[('2\n1 2 3\n4 5 6\n','5 7 9\n'),('1\n-1 0 1\n','-1 0 1\n')],'数组指针每次移动跨过整行，不能把 int ** 当作连续二维数组。'),
('二维参数求行极差','输入 n（1至20）和 n 行3列整数（绝对值≤100）。实现 void ranges(const int a[][3],int n)，逐行输出最大值减最小值。','void ranges(const int a[][3],int n){for(int i=0;i<n;i++){int lo=a[i][0],hi=lo;for(int j=1;j<3;j++){if(a[i][j]<lo)lo=a[i][j];if(a[i][j]>hi)hi=a[i][j];}printf("%d\\n",hi-lo);}}\nint main(void){int n,a[20][3];scanf("%d",&n);for(int i=0;i<n;i++)for(int j=0;j<3;j++)scanf("%d",&a[i][j]);ranges(a,n);return 0;}',[('2\n1 5 2\n4 4 4\n','4\n0\n'),('1\n-3 0 4\n','7\n')],'二维数组形参必须保留第二维大小。')])
pair('pointer','动态扩容与所有权',[
('安全扩容后追加','输入 n,m（各1至30），再输入 n+m 个整数（绝对值≤100）。先只分配n项，读入前n项，再用 realloc 扩容，读入余项，输出总和。','int main(void){int n,m;scanf("%d%d",&n,&m);int *p=malloc((size_t)n*sizeof *p);if(!p)return 1;for(int i=0;i<n;i++)scanf("%d",p+i);int *t=realloc(p,(size_t)(n+m)*sizeof *p);if(!t){free(p);return 1;}p=t;for(int i=n;i<n+m;i++)scanf("%d",p+i);int s=0;for(int i=0;i<n+m;i++)s+=p[i];printf("%d\\n",s);free(p);return 0;}',[('2 2\n1 2 3 4\n','10\n'),('1 1\n-2 2\n','0\n')],'realloc 失败时原指针仍有效，先用临时指针接收。'),
('动态数组独立副本','输入 n（1至30）和n个整数（绝对值≤100）。用 malloc 建立独立副本，将原数组首项加1，输出原数组首项与副本首项。','int main(void){int n;scanf("%d",&n);int *a=malloc((size_t)n*sizeof *a),*b=malloc((size_t)n*sizeof *b);if(!a||!b){free(a);free(b);return 1;}for(int i=0;i<n;i++)scanf("%d",a+i);memcpy(b,a,(size_t)n*sizeof *a);a[0]++;printf("%d %d\\n",a[0],b[0]);free(a);free(b);return 0;}',[('2\n3 5\n','4 3\n'),('1\n-1\n','0 -1\n')],'指针赋值仅复制地址；独立副本需要另分配内存并复制元素。')])
pair('pointer','函数指针与回调',[
('回调变换求和','输入 n,k（1≤n≤30，k为0或1）和n个整数（绝对值≤100）。以函数指针调用变换：k=0取绝对值，k=1取平方，输出变换值之和。','int ab(int x){return x<0?-x:x;}int sq(int x){return x*x;}\nint main(void){int n,k,x,s=0;scanf("%d%d",&n,&k);int (*f)(int)=k?sq:ab;for(int i=0;i<n;i++){scanf("%d",&x);s+=f(x);}printf("%d\\n",s);return 0;}',[('3 0\n-2 0 3\n','5\n'),('2 1\n-2 3\n','13\n')],'函数指针的返回值及参数类型必须相符。'),
('回调筛选计数','输入 n,k（1≤n≤30，k为0或1）和n个整数（绝对值≤100）。k=0统计正数，k=1统计偶数，必须通过谓词函数指针完成。','int pos(int x){return x>0;}int even(int x){return x%2==0;}\nint main(void){int n,k,x,c=0;scanf("%d%d",&n,&k);int (*test)(int)=k?even:pos;for(int i=0;i<n;i++){scanf("%d",&x);c+=test(x);}printf("%d\\n",c);return 0;}',[('3 0\n-1 0 2\n','1\n'),('3 1\n-2 0 3\n','2\n')],'0是偶数，但不是正数。')])
pair('func','作用域与静态局部变量',[
('静态累计器','输入 n（1至20），实现 int tick(void)，内含初值0的静态局部变量，每次调用先加2再返回。连续调用n次，逐个输出返回值。','int tick(void){static int x=0;return x+=2;}int main(void){int n;scanf("%d",&n);for(int i=0;i<n;i++)printf("%s%d",i?" ":"",tick());puts("");return 0;}',[('3\n','2 4 6\n'),('1\n','2\n')],'静态局部变量只初始化一次；依次调用，避免在同一表达式中依赖求值顺序。'),
('同名变量遮蔽','输入 x（-100至100）。主函数保存 x；调用 f(x)，f在内层块定义同名局部变量 y=3并输出y，块外输出形参y+1；最后主函数输出原始x。每个数单独一行。','void f(int y){{int y=3;printf("%d\\n",y);}printf("%d\\n",y+1);}int main(void){int x;scanf("%d",&x);f(x);printf("%d\\n",x);return 0;}',[('8\n','3\n9\n8\n'),('0\n','3\n1\n0\n')],'块内同名声明遮蔽外层名字；值传递不会修改主函数变量。')])
pair('func','递归数组处理',[
('递归数组最大值','输入 n（1至50）和n个绝对值≤100的整数。用递归函数求最大值，禁止使用全局变量。','int mx(const int *a,int n){if(n==1)return a[0];int t=mx(a,n-1);return t>a[n-1]?t:a[n-1];}int main(void){int n,a[50];scanf("%d",&n);for(int i=0;i<n;i++)scanf("%d",a+i);printf("%d\\n",mx(a,n));return 0;}',[('3\n-3 -1 -2\n','-1\n'),('1\n4\n','4\n')],'递归出口是长度1，负数数组不能用0初始化最大值。'),
('递归统计负数','输入 n（1至50）和n个绝对值≤100的整数，用递归函数返回负数个数。','int count(const int *a,int n){return n==0?0:count(a,n-1)+(a[n-1]<0);}int main(void){int n,a[50];scanf("%d",&n);for(int i=0;i<n;i++)scanf("%d",a+i);printf("%d\\n",count(a,n));return 0;}',[('4\n-2 0 -1 3\n','2\n'),('1\n0\n','0\n')],'先处理n=0的出口，再读取a[n-1]。')])
pair('struct','联合体与枚举类型（拓展）',[
('带类型标记的联合体','输入 t,v（t为0或1，v为-100至100）。结构体含枚举类型标记和 union {int i;double d;}。t=0存整数v，输出v；t=1存v/2.0，输出一位小数。','enum Kind{INTEGER,REAL};struct Value{enum Kind tag;union{int i;double d;}u;};int main(void){int t,v;scanf("%d%d",&t,&v);struct Value x;x.tag=t?REAL:INTEGER;if(x.tag==INTEGER){x.u.i=v;printf("%d\\n",x.u.i);}else{x.u.d=v/2.0;printf("%.1f\\n",x.u.d);}return 0;}',[('0 3\n','3\n'),('1 3\n','1.5\n')],'联合体成员共享存储，按标记读取最后写入的成员。'),
('枚举状态转换','枚举状态0空闲、1工作、2完成。输入初始状态s与操作字符c（S开始、F完成）。仅0遇S转1，1遇F转2，其余不变。输出最终状态数值。','enum State{IDLE,WORK,DONE};int main(void){int s;char c;scanf("%d %c",&s,&c);enum State x=(enum State)s;if(x==IDLE&&c==\'S\')x=WORK;else if(x==WORK&&c==\'F\')x=DONE;printf("%d\\n",(int)x);return 0;}',[('0 S\n','1\n'),('2 S\n','2\n')],'转换需要同时检查原状态和操作。')])
pair('basic','宏与条件编译',[
('带括号的函数式宏','输入整数x（-100至100），用宏 SQUARE(x) 计算 (x+1) 的平方并输出。宏的参数及整个表达式都必须加括号。','\n#define SQUARE(x) ((x)*(x))\nint main(void){int x;scanf("%d",&x);printf("%d\\n",SQUARE(x+1));return 0;}',[('2\n','9\n'),('-1\n','0\n')],'不要把有自增等副作用的表达式作为会重复展开的宏参数。'),
('条件编译选择系数','源文件定义 MODE 为1。输入x（-100至100）；使用 #if MODE == 1 选择输出2*x，否则输出3*x。','\n#define MODE 1\nint main(void){int x;scanf("%d",&x);\n#if MODE == 1\n printf("%d\\n",2*x);\n#else\n printf("%d\\n",3*x);\n#endif\nreturn 0;}',[('3\n','6\n'),('0\n','0\n')],'预处理在编译前决定保留哪段代码。')])
pair('basic','整型提升与表达式转换',[
('整除与浮点除法对比','输入a,b（0至100，b非0），先输出a/b的整数商，再输出(double)a/b，保留两位小数。','int main(void){int a,b;scanf("%d%d",&a,&b);printf("%d %.2f\\n",a/b,(double)a/b);return 0;}',[('5 2\n','2 2.50\n'),('0 3\n','0 0.00\n')],'转换必须发生在除法前，事后转换不能恢复截掉的小数。'),
('扩大类型后做乘法','输入a,b（0至1000000000），输出精确整数乘积，必须在乘法之前转换到long long。','int main(void){int a,b;scanf("%d%d",&a,&b);long long v=(long long)a*b;printf("%lld\\n",v);return 0;}',[('1000000000 1000000000\n','1000000000000000000\n'),('0 9\n','0\n')],'只把乘积存入long long不足以避免int乘法溢出。')])
pair('algo','位掩码集合操作',[
('权限位修改','输入无符号整数x（0至255）、位号k（0至7）和v（0或1）。将第k位设为v，输出新值。最低位编号0。','int main(void){unsigned x,k,v;scanf("%u%u%u",&x,&k,&v);x=v?(x|(1u<<k)):(x&~(1u<<k));printf("%u\\n",x);return 0;}',[('3 1 0\n','1\n'),('0 7 1\n','128\n')],'清零使用与按位取反的掩码，避免使用逻辑非。'),
('权限集合交并差','输入a,b（0至255），分别输出交集a&b、并集a|b及差集a&~b的十进制值。','int main(void){unsigned a,b;scanf("%u%u",&a,&b);printf("%u %u %u\\n",a&b,a|b,a&~b);return 0;}',[('5 3\n','1 7 4\n'),('0 255\n','0 255 0\n')],'位运算每一位独立；&&、||不表示集合交并。')])
pair('string','字符串终止符与缓冲区容量',[
('有限长度复制','输入不含空白的字符串s（长度1至30）和k（0至30）。用容量31的目标数组复制前min(k,长度)个字符并显式补终止符，输出复制结果，k=0输出空行。','int main(void){char s[31],t[31];int k;scanf("%30s%d",s,&k);int n=(int)strlen(s);if(k>n)k=n;memcpy(t,s,(size_t)k);t[k]=0;puts(t);return 0;}',[('abc 2\n','ab\n'),('a 0\n','\n')],'字符内容长度不包括终止符，分配容量需多1。'),
('有限容量字符串拼接','输入两个非空无空白字符串（各≤30字符），目标容量固定为11。先放第一个串的前10个字符，再追加第二串直至总长10。输出结果。','int main(void){char a[31],b[31],t[11];scanf("%30s%30s",a,b);int n=0;for(int i=0;a[i]&&n<10;i++)t[n++]=a[i];for(int i=0;b[i]&&n<10;i++)t[n++]=b[i];t[n]=0;puts(t);return 0;}',[('abc def\n','abcdef\n'),('abcdefghij xyz\n','abcdefghij\n')],'最后一个位置必须留给终止符。')])
pair('struct','结构体复制与指针成员',[
('结构体值复制','输入x,y（-100至100），结构体Point包含两个int。复制a到b，再将a.x加1；输出b.x、b.y和a.x。','typedef struct{int x,y;}Point;int main(void){Point a,b;scanf("%d%d",&a.x,&a.y);b=a;a.x++;printf("%d %d %d\\n",b.x,b.y,a.x);return 0;}',[('2 3\n','2 3 3\n'),('0 -1\n','0 -1 1\n')],'普通标量成员被独立复制。'),
('结构体浅拷贝的共享对象','输入整数x（-100至100）。Box含int *p，让a.p指向x，结构体赋值b=a，再通过b.p加2。输出*a.p与*b.p。','typedef struct{int *p;}Box;int main(void){int x;scanf("%d",&x);Box a={&x},b=a;*b.p+=2;printf("%d %d\\n",*a.p,*b.p);return 0;}',[('3\n','5 5\n'),('-2\n','0 0\n')],'结构体赋值复制地址，不复制指针所指对象。')])
pair('pointer','单链表（拓展）',[
('链表头插逆序','输入n（1至30）及n个绝对值≤100的整数。动态分配单链表节点逐个头插，输出链表值后释放全部节点。','struct N{int v;struct N *next;};int main(void){int n,x;scanf("%d",&n);struct N *h=NULL;for(int i=0;i<n;i++){scanf("%d",&x);struct N *p=malloc(sizeof *p);if(!p){while(h){p=h->next;free(h);h=p;}return 1;}p->v=x;p->next=h;h=p;}int first=1;while(h){printf("%s%d",first?"":" ",h->v);first=0;struct N *p=h->next;free(h);h=p;}puts("");return 0;}',[('3\n1 2 3\n','3 2 1\n'),('1\n0\n','0\n')],'释放前保存next。'),
('链表删除首个匹配值','输入n（1至30）、目标x及n个绝对值≤100的整数。尾插建立链表，删除首个值为x的节点并释放；输出余下值，空表输出EMPTY。','struct N{int v;struct N *next;};int main(void){int n,x;scanf("%d%d",&n,&x);struct N *h=NULL,**tail=&h;for(int i=0;i<n;i++){struct N *p=malloc(sizeof *p);if(!p){while(h){p=h->next;free(h);h=p;}return 1;}scanf("%d",&p->v);p->next=NULL;*tail=p;tail=&p->next;}struct N **link=&h;while(*link&&(*link)->v!=x)link=&(*link)->next;if(*link){struct N *p=*link;*link=p->next;free(p);}if(!h)puts("EMPTY");else{int first=1;while(h){printf("%s%d",first?"":" ",h->v);first=0;struct N *p=h->next;free(h);h=p;}puts("");}return 0;}',[('3 2\n1 2 2\n','1 2\n'),('1 5\n5\n','EMPTY\n')],'二级指针把删除头节点与内部节点统一处理。')])
# 每个已有具体编程考点补一题代码分析，使用原程序但独立指定边界样例；明确标为配套分析，避免冒充新算法。
original=[]
for f in sorted((ROOT/'content').glob('*.json')):
    if f.name.startswith(('16_','17_','18_')):continue
    original+=json.loads(f.read_text(encoding='utf-8')).get('problems',[])
for q in original:
    s=q['samples'][-1]
    new=dict(q);new['id']='V-'+q['id'];new['title']=q['title']+'·代码分析';new['source']='配套代码分析（原题 '+q['id']+'）';new['tags']=list(dict.fromkeys(q['tags']+['代码分析']))[:6]
    new['desc']='### 题目描述\n阅读下面程序，先不运行，推导指定输入下的完整输出。写出关键变量变化、循环或递归的停止条件，并说明一个边界条件为什么不会越界或出错。本题与 '+q['id']+' 共用算法，练习形式为代码分析，不计作独立算法。\n\n```c\n'+q['solution']+'\n```\n\n### 指定输入\n```\n'+s['in']+'```\n\n### 作答要求\n写出输出及上述解释，再展开参考答案核对。样例区提供另一个输入作为格式参考。'
    new['desc']=new['desc'].replace('样例区提供另一个输入作为格式参考。','参考输出在答案区展示。')
    new['samples']=[q['samples'][0]];new['hint']='指定输入的完整输出：\n```\n'+s['out']+'```\n分析要点：'+q['hint']+'\n边界核对：'+q.get('pitfalls','核对最小输入与停止条件。');out.append(new)
    coverage.append([q['cat'],q['title'],[q['id'],new['id']]])
(ROOT/'content/16_supplement.json').write_text(json.dumps({'problems':out},ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'tmp/revision/coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2),encoding='utf-8')
print('supplement',len(out),'coverage rows',len(coverage))
