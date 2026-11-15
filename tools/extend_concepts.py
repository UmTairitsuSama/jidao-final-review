import json,pathlib
R=pathlib.Path(__file__).resolve().parents[1]
p=R/'content/16_supplement.json';data=json.loads(p.read_text(encoding='utf-8'));rows=json.loads((R/'tmp/revision/coverage.json').read_text(encoding='utf-8'))
def pair(cat,topic,variants):
    ids=[]
    for title,task,body,samples,hint in variants:
        id=f'K{sum(q["id"].startswith("K") for q in data["problems"])+1:03}';ids.append(id)
        data['problems'].append(dict(id=id,cat=cat,title=title,difficulty=2,tags=[topic,'专项补缺'],source='新编',desc='### 题目描述\n'+task+'\n\n### 输入格式\n按题意给定次序输入。\n\n### 输出格式\n按题意输出，末尾换行。',samples=[dict(zip(('in','out'),s)) for s in samples],hint=hint,pitfalls=hint,solution='#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n'+body+'\n'))
    rows.append([cat,topic,ids])
pair('basic','短路求值与逻辑表达式',[
('与表达式的安全除法','输入a,b（-100至100）。仅当b非0且a/b>2时输出YES，否则NO，使用短路与避免除0。','int main(void){int a,b;scanf("%d%d",&a,&b);puts(b!=0&&a/b>2?"YES":"NO");return 0;}',[('5 0\n','NO\n'),('9 2\n','YES\n')],'&&左侧为假时不会计算右侧。'),
('或表达式条件计数','输入a,b（各0或1）。令c初值0，计算 a || (++c,b)，输出逻辑结果与c，中间空格。不得改变求值次序。','int main(void){int a,b,c=0;scanf("%d%d",&a,&b);int r=a||(++c,b);printf("%d %d\\n",r,c);return 0;}',[('1 0\n','1 0\n'),('0 1\n','1 1\n')],'||左侧为真时跳过右侧，逗号运算符先递增再取b。')])
pair('loop','break与continue',[
('遇零终止的正数和','输入n（1至100）和n个绝对值≤100的整数。顺序扫描，负数跳过，遇0立即停止累计；输出此前正数和。必须使用break和continue。','int main(void){int n,a[100],s=0;scanf("%d",&n);for(int i=0;i<n;i++)scanf("%d",a+i);for(int i=0;i<n;i++){if(!a[i])break;if(a[i]<0)continue;s+=a[i];}printf("%d\\n",s);return 0;}',[('5\n2 -1 3 0 9\n','5\n'),('1\n0\n','0\n')],'break终止最近一层循环，continue跳过本轮余下语句。'),
('跳过倍数寻找首项','输入n,k（1≤n≤100，1≤k≤100）。扫描1至n，跳过3的倍数，输出第一个严格大于k的剩余整数，无则-1。用continue跳过，用break停止。','int main(void){int n,k,b=-1;scanf("%d%d",&n,&k);for(int i=1;i<=n;i++){if(i%3==0)continue;if(i>k){b=i;break;}}printf("%d\\n",b);return 0;}',[('10 5\n','7\n'),('2 2\n','-1\n')],'严格大于不包含k自身。')])
pair('pointer','const指针与只读接口',[
('只读指针区间求和','输入n（1至50）和n个绝对值≤100的整数，实现sum(const int *begin,const int *end)，求半开区间和，禁止通过指针修改元素。','int sum(const int *b,const int *e){int s=0;while(b!=e)s+=*b++;return s;}int main(void){int n,a[50];scanf("%d",&n);for(int i=0;i<n;i++)scanf("%d",a+i);printf("%d\\n",sum(a,a+n));return 0;}',[('3\n1 -1 4\n','4\n'),('1\n0\n','0\n')],'const int *允许移动指针但不允许通过它改元素；尾后指针只用于比较。'),
('固定指向的指针','输入a,b（-100至100），声明int *const p=&a，通过*p将a增加b，输出a；p自身不得重新赋值。','int main(void){int a,b;scanf("%d%d",&a,&b);int *const p=&a;*p+=b;printf("%d\\n",a);return 0;}',[('2 3\n','5\n'),('-1 1\n','0\n')],'int *const固定指针本身，所指对象仍可修改。')])
pair('basic','sizeof与数组退化',[
('数组元素个数','输入n（1至10），定义int a[10]={0}，读入前n项（绝对值≤100）。用sizeof a / sizeof a[0]求容量，输出容量和前n项和。','int main(void){int n,a[10]={0},s=0;scanf("%d",&n);for(int i=0;i<n;i++){scanf("%d",a+i);s+=a[i];}printf("%zu %d\\n",sizeof a/sizeof a[0],s);return 0;}',[('2\n1 2\n','10 3\n'),('1\n0\n','10 0\n')],'数组在定义处的sizeof得到整个数组字节数。'),
('数组形参必须传长度','输入n（1至10）及n个绝对值≤100的整数。实现int nonzero(const int a[],int n)，输出非零元素数，不得试图用sizeof形参确定长度。','int nonzero(const int a[],int n){int c=0;for(int i=0;i<n;i++)c+=a[i]!=0;return c;}int main(void){int n,a[10];scanf("%d",&n);for(int i=0;i<n;i++)scanf("%d",a+i);printf("%d\\n",nonzero(a,n));return 0;}',[('3\n0 -1 2\n','2\n'),('1\n0\n','0\n')],'函数的数组形参调整为指针，长度必须另传。')])
pair('struct','typedef自定义类型',[
('类型别名与指针别名','用typedef int *IntPtr，输入x,y（-100至100），声明IntPtr p=&x,q=&y，交换*p与*q并输出x y。','typedef int *IntPtr;int main(void){int x,y;scanf("%d%d",&x,&y);IntPtr p=&x,q=&y;int t=*p;*p=*q;*q=t;printf("%d %d\\n",x,y);return 0;}',[('2 3\n','3 2\n'),('0 0\n','0 0\n')],'typedef别名是完整类型，与#define文本替换不同。'),
('结构体别名作为返回类型','定义typedef struct {int lo,hi;} Range。输入a,b（-100至100），函数返回有序端点Range，主函数输出lo hi。','typedef struct{int lo,hi;}Range;Range ordered(int a,int b){Range r={a<b?a:b,a>b?a:b};return r;}int main(void){int a,b;scanf("%d%d",&a,&b);Range r=ordered(a,b);printf("%d %d\\n",r.lo,r.hi);return 0;}',[('9 2\n','2 9\n'),('1 1\n','1 1\n')],'结构体值返回复制成员，不返回局部对象地址。')])
pair('algo','文件流与读写定位（拓展）',[
('临时文件文本往返','输入n（1至20）及n个绝对值≤100的整数。使用tmpfile创建临时流，以文本逐行写入，rewind后读取并输出总和；不得使用固定文件名。','int main(void){int n,x,s=0;scanf("%d",&n);FILE *f=tmpfile();if(!f)return 1;for(int i=0;i<n;i++){scanf("%d",&x);fprintf(f,"%d\\n",x);}rewind(f);while(fscanf(f,"%d",&x)==1)s+=x;fclose(f);printf("%d\\n",s);return 0;}',[('3\n1 2 -1\n','2\n'),('1\n0\n','0\n')],'检查打开结果，以读取函数返回值为循环条件，不能用while(!feof(f))。'),
('二进制流定位读取','输入三个绝对值≤100的整数，再输入k（0至2）。写入tmpfile二进制流，使用fseek定位第k项并用fread读取，输出它。','int main(void){int a[3],k,x;scanf("%d%d%d%d",a,a+1,a+2,&k);FILE *f=tmpfile();if(!f)return 1;if(fwrite(a,sizeof a[0],3,f)!=3){fclose(f);return 1;}if(fseek(f,(long)k*(long)sizeof(int),SEEK_SET)||fread(&x,sizeof x,1,f)!=1){fclose(f);return 1;}fclose(f);printf("%d\\n",x);return 0;}',[('2 4 6 1\n','4\n'),('-1 0 1 0\n','-1\n')],'二进制布局只供同一程序往返验证，不假设跨平台文件格式。')])
pair('pointer','void指针与对象生存期',[
('通用地址读取整数','输入x（-100至100）。实现int read_int(const void *p)，将通用地址转换回const int *后读取并返回x，主函数输出。','int read_int(const void *p){return *(const int *)p;}int main(void){int x;scanf("%d",&x);printf("%d\\n",read_int(&x));return 0;}',[('3\n','3\n'),('-1\n','-1\n')],'void *不能直接解引用或进行标准C指针算术，恢复实际对象类型后访问。'),
('返回堆对象而非局部地址','输入x（-100至100），实现int *make(int x)，返回动态分配的整数地址，存放x+1。主函数输出所指值并释放，不得返回自动局部变量地址。','int *make(int x){int *p=malloc(sizeof *p);if(p)*p=x+1;return p;}int main(void){int x;scanf("%d",&x);int *p=make(x);if(!p)return 1;printf("%d\\n",*p);free(p);p=NULL;return 0;}',[('2\n','3\n'),('-1\n','0\n')],'对象生存期必须覆盖使用时刻，free后即使指针非NULL也不能解引用。')])
pair('string','重叠内存移动',[
('重叠删除字符区间','输入不含空白的串s（长度1至30），再输入l,r（0≤l≤r<长度）。用memmove删除闭区间[l,r]，输出剩余字符串，可为空。','int main(void){char s[31];int l,r;scanf("%30s%d%d",s,&l,&r);size_t n=strlen(s);memmove(s+l,s+r+1,n-(size_t)r);puts(s);return 0;}',[('abcde 1 3\n','ae\n'),('a 0 0\n','\n')],'移动长度要包含终止符；重叠区域使用memmove。'),
('重叠插入一个字符','输入无空白字符串s（长度1至29）、插入位置k（0至长度）和非空白字符c。用memmove把k及以后字符右移一位（包含终止符），插入c并输出。','int main(void){char s[31],c;int k;scanf("%29s%d %c",s,&k,&c);size_t n=strlen(s);memmove(s+k+1,s+k,n-(size_t)k+1);s[k]=c;puts(s);return 0;}',[('abc 1 X\n','aXbc\n'),('a 1 z\n','az\n')],'缓冲区容量至少是原长度加2，插入末尾同样要移动终止符。')])
p.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');(R/'tmp/revision/coverage.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print('supplement',len(data['problems']),'coverage',len(rows))
