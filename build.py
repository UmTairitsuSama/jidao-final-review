#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 content/*.json + app/{template.html,style.css,app.js} 合成为单文件离线网页。

用法:
    python build.py
    python build.py --content content --out 计导期中复习.html
"""
import argparse
import base64
import datetime
import glob
import gzip
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.abspath(__file__))
VERSION = "v2.1"
CATS = {"basic", "select", "loop", "array1", "array2", "mix",
        "string", "func", "pointer", "struct", "algo"}
CAT_ORDER = ["basic", "select", "loop", "array1", "array2", "mix",
             "string", "func", "pointer", "struct", "algo"]
REQ = ["id", "cat", "title", "difficulty", "tags", "source", "desc", "samples", "hint", "solution"]


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def vscode_assets():
    folder = os.path.join(ROOT, "app", "vscode-c")

    def read(name):
        with open(os.path.join(folder, name), encoding="utf-8") as source:
            return source.read()

    def theme(name):
        jsonc = read(name + ".json")
        strings = r'"(?:\\.|[^"\\])*"'
        preserve_strings = lambda token: token[0] if token[0].startswith('"') else ""
        cleaned = re.sub(strings + r'|//[^\n]*|/\*[\s\S]*?\*/', preserve_strings, jsonc)
        cleaned = re.sub(strings + r'|,(?=\s*[}\]])', preserve_strings, cleaned)
        return json.loads(cleaned)

    themes = {}
    for name in ("light", "dark"):
        base = theme(name + "_vs")
        plus = theme(name + "_plus")
        modern = theme(name + "_modern")
        colors = {**base["colors"], **plus.get("colors", {}), **modern.get("colors", {})}
        themes[name] = {
            "settings": [{
                "settings": {"foreground": colors["editor.foreground"],
                             "background": colors["editor.background"]},
            }] + base["tokenColors"] + plus["tokenColors"] + modern.get("tokenColors", []),
        }
    data = {
        "themes": themes,
        "grammars": {scope: load_json(os.path.join(folder, file)) for scope, file in (
            ("source.c", "c.tmLanguage.json"), ("source.c.platform", "platform.tmLanguage.json"),
            ("source.cpp", "cpp.tmLanguage.json"),
        )},
    }
    with open(os.path.join(folder, "onig.wasm"), "rb") as engine:
        wasm = engine.read()

    def encode(value):
        return base64.b64encode(gzip.compress(value, mtime=0)).decode("ascii")

    libraries = "\n".join(
        "<script>" + read(name + "-main.js").replace("</script", r"<\/script") + "</script>"
        for name in ("vscode-textmate", "vscode-oniguruma")
    )
    notices = "\n".join(read(name) for name in (
        "LICENSE.txt", "ThirdPartyNotices.txt", "vscode-textmate-LICENSE.md",
        "vscode-oniguruma-LICENSE.txt", "vscode-oniguruma-NOTICES.txt",
    ))
    return libraries + '\n<script type="application/json" id="vscode-c-assets">' + json.dumps({
        "data": encode(json.dumps(data, ensure_ascii=False).encode("utf-8")),
        "wasm": encode(wasm),
        "notices": notices,
    }).replace("</", "<\\/") + "</script>"


def check_problems(problems, where):
    errors, warnings = [], []
    seen = {}
    for q in problems:
        pid = q.get("id", "<无id>")
        for k in REQ:
            if k not in q or q[k] in (None, "", []):
                errors.append(f"{where} {pid}: 缺少字段 {k}")
        if q.get("cat") not in CATS:
            errors.append(f"{where} {pid}: cat 非法 {q.get('cat')!r}")
        if not isinstance(q.get("difficulty"), int) or not 1 <= q["difficulty"] <= 5:
            errors.append(f"{where} {pid}: difficulty 非法")
        if not isinstance(q.get("samples"), list) or not q["samples"]:
            errors.append(f"{where} {pid}: 没有样例")
        for s in q.get("samples") or []:
            if not isinstance(s, dict) or not isinstance(s.get("in"), str) or not isinstance(s.get("out"), str):
                errors.append(f"{where} {pid}: 样例格式错误（需要 in/out 字符串）")
        checks = q.get("checkpoints", [])
        if not isinstance(checks, list) or any(
            not isinstance(case, dict) or any(not isinstance(case.get(key), str) for key in ("in", "out"))
            for case in checks
        ):
            errors.append(f"{where} {pid}: 检查点格式错误（需要由 in/out 字符串组成的列表）")
        harness = q.get("harness", "")
        if not isinstance(harness, str) or ("harness" in q and not re.search(r"\bmain\s*\(", harness)):
            errors.append(f"{where} {pid}: harness 必须包含裁判主函数")
        sol = (harness if isinstance(harness, str) else "") + (q.get("solution") or "")
        if "main" not in sol:
            errors.append(f"{where} {pid}: solution 不是完整程序")
        if re.search(r"(?<![A-Za-z_])gets\s*\(", sol) or "conio.h" in sol:
            errors.append(f"{where} {pid}: solution 使用了 gets/conio.h")
        if pid in seen:
            errors.append(f"{where} {pid}: ID 重复")
        seen[pid] = True
        if not q.get("tags"):
            warnings.append(f"{where} {pid}: 没有标签")
        if len(str(q.get("title", ""))) > 40:
            warnings.append(f"{where} {pid}: 标题过长")
    return errors, warnings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--content", default=os.path.join(ROOT, "content"))
    ap.add_argument("--out", default=os.path.join(ROOT, "计导期末复习.html"))
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.content, "*.json")))
    if not files:
        print("[FATAL] content/ 下没有 JSON 文件")
        return 2
    problems, exams, sections, guide = [], [], [], []
    for f in files:
        data = load_json(f)
        name = os.path.basename(f)
        if "problems" in data:
            problems.extend(data["problems"])
        elif "exams" in data:
            exams.extend(data["exams"])
        elif "sections" in data:
            sections.extend(data["sections"])
        elif "guide" in data:
            guide.extend((data.get("guide") or {}).get("sections") or [])
        else:
            print(f"[FATAL] {name}: 顶层缺少 problems/exams/sections/guide")
            return 2

    errors, warnings = check_problems(problems, "题库")
    exam_problems = []
    for e in exams:
        eid = e.get("id", "<无id>")
        ps = e.get("problems") or []
        if not 3 <= len(ps) <= 10:
            errors.append(f"卷 {eid}: 题数必须 3–10，当前 {len(ps)}")
        for i, q in enumerate(ps, 1):
            q["_exam"] = eid
            q["_examTitle"] = e.get("title", eid)
        ee, ww = check_problems(ps, f"卷{eid}")
        errors.extend(ee)
        warnings.extend(ww)
        exam_problems.extend(ps)
        if not isinstance(e.get("duration"), int):
            errors.append(f"卷 {eid}: duration 必须是整数")
        if not e.get("title"):
            errors.append(f"卷 {eid}: 缺少 title")
    if len(exams) < 6:
        warnings.append(f"模拟卷数量为 {len(exams)}（预期 ≥ 6）")

    allp = problems + exam_problems
    ids = {}
    for q in allp:
        ids.setdefault(q.get("id"), 0)
        ids[q["id"]] += 1
    for pid, n in ids.items():
        if n > 1:
            errors.append(f"题目 ID 重复：{pid}（{n} 次）")

    for s in sections:
        if not s.get("title") or not s.get("body"):
            errors.append("速查手册：每节必须有 title 与 body")
    if not sections:
        warnings.append("速查手册为空")
    for s in guide:
        if not s.get("title") or not s.get("body"):
            errors.append("知识精讲：每节必须有 title 与 body")

    # 统计
    by_cat = {}
    for q in problems:
        by_cat[q["cat"]] = by_cat.get(q["cat"], 0) + 1
    if errors:
        print(f"[FATAL] 数据校验失败（{len(errors)} 个错误）：")
        for e in errors[:100]:
            print("  -", e)
        return 1
    for w in warnings:
        print("[WARN]", w)

    built = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    payload = {
        "meta": {
            "builtAt": built,
            "version": VERSION,
            "counts": {"problems": len(problems), "exams": len(exams),
                       "examProblems": len(exam_problems), "byCat": by_cat},
        },
        "problems": problems,
        "exams": exams,
        "cheatsheet": {"sections": sections},
        "guide": {"sections": guide},
    }
    data_js = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    template = open(os.path.join(ROOT, "app", "template.html"), encoding="utf-8").read()
    css = open(os.path.join(ROOT, "app", "style.css"), encoding="utf-8").read()
    js = open(os.path.join(ROOT, "app", "app.js"), encoding="utf-8").read()
    with open(os.path.join(ROOT, "app", "judge-worker.js"), encoding="utf-8") as f:
        worker = json.dumps(f.read(), ensure_ascii=False).replace("</", "<\\/")
    with open(os.path.join(ROOT, "app", "judge.js"), encoding="utf-8") as f:
        judge = f.read().replace("%%JUDGE_WORKER%%", worker)
    html = (template.replace("%%CSS%%", css)
                    .replace("%%JS%%", js.replace("%%JUDGE%%", judge))
                    .replace("%%DATA%%", data_js)
                    .replace("%%VSCODE_ASSETS%%", vscode_assets())
                    .replace("%%VERSION%%", VERSION)
                    .replace("%%BUILT%%", built))
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    size = os.path.getsize(args.out) / 1024
    print(f"[OK] 已生成 {args.out}  ({size:.0f} KB)")
    print(f"     精选题 {len(problems)} 道 / 模拟卷 {len(exams)} 套 / 卷内题 {len(exam_problems)} 道 / 速查 {len(sections)} 节 / 精讲 {len(guide)} 节")
    print("     分类:", {k: by_cat.get(k, 0) for k in CAT_ORDER})
    return 0


if __name__ == "__main__":
    sys.exit(main())
