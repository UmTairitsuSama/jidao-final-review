# 计导期末复习 · 计算导论与程序设计（数组 → 类的设计）

北京邮电大学 大一上《计算导论与程序设计》**期末机考（C 语言）**离线复习网站的单文件网页版。

- 在线预览：<https://umtairitsusama.github.io/jidao-midterm-review/>
- 直接打开仓库里的 `index.html` 也可以离线使用（无需联网、无外部依赖）。

## 内容

| 模块 | 规模 |
|---|---|
| 精选题库 | 150 题 / 11 个考点（期中范围 74 题 + 期末新增 76 题：字符串 16、函数与递归 16、指针与动态内存 16、结构体与自定义类型 14、算法综合 14） |
| 知识精讲 | 9 节（数组进阶、字符串、函数、递归、指针、结构体、从结构体到「类」的设计、算法专题、机考应试） |
| 模拟考试 | 12 套（6 套期末全真卷 6 题/120 分钟 + 6 套期中范围热身卷 5 题/90 分钟） |
| 速查手册 | 24 节 |
| 错题本 / 作答记录 / 数据备份 | 数据只保存在本机浏览器 localStorage |

考试语言为 C（`gcc -std=c11`）；所有参考答案都是完整可编译的 C 程序，216 题 / 497 组样例全部实测通过。

## 构建与验证

```sh
python build.py --out index.html
python tools/check_problems.py --all
node tools/ui_test.mjs index.html
```

源码位于 `app/`（template.html / style.css / app.js），题目数据位于 `content/`，写作规范见 `SPEC_FINAL.md`。
旧版页面地址（`library.html`、`exams.html`、`exam-m1.html` …）会自动跳转到对应的新视图；本机存储键仍为 `cd_review_v2`，旧记录继续可用。
