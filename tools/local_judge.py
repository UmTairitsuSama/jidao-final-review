"""Serve the review site on loopback and run trusted C/C++ code with GCC or Clang."""

import argparse
import hmac
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
from time import monotonic, sleep
import webbrowser


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_LIMIT = 65536
INPUT_LIMIT = 480000


def capture(command, directory, input_text, timeout):
    with tempfile.TemporaryFile() as stdin, tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        stdin.write(input_text.encode("utf-8"))
        stdin.seek(0)
        with subprocess.Popen(command, cwd=directory, stdin=stdin, stdout=stdout, stderr=stderr) as process:
            deadline = monotonic() + timeout
            status = "ok"
            while True:
                if any(os.fstat(output.fileno()).st_size > OUTPUT_LIMIT for output in (stdout, stderr)):
                    status = "output"
                    break
                if process.poll() is not None:
                    status = "runtime" if process.returncode else "ok"
                    break
                if monotonic() >= deadline:
                    status = "timeout"
                    break
                sleep(0.02)
            if process.poll() is None:
                process.kill()
            process.wait()
            stdout.seek(0)
            stderr.seek(0)
            return {
                "status": status,
                "out": stdout.read(OUTPUT_LIMIT).decode("utf-8", errors="replace"),
                "err": stderr.read(OUTPUT_LIMIT).decode("utf-8", errors="replace"),
                "exitCode": process.returncode,
            }


class LocalJudge:
    def __init__(self, directory, compilers):
        self.directory = directory
        self.compilers = compilers
        self.executable = directory / "main.exe"
        self.ticket = None

    def compile(self, source, language):
        if not isinstance(language, str) or language not in self.compilers:
            raise ValueError("本机未配置所选语言的编译器。请使用 --cc 或 --cxx 指定路径。")
        compiler, flags = self.compilers[language]
        filename = "main.cpp" if language == "cpp" else "main.c"
        self.ticket = None
        self.executable.unlink(missing_ok=True)
        (self.directory / filename).write_bytes(source.encode("utf-8"))
        result = capture([compiler, *flags, filename, "-o", "main.exe"], self.directory, "", 60)
        diagnostics = result["out"] + result["err"]
        if result["status"] in ("timeout", "output"):
            raise ValueError("本机编译超时或编译输出超限。")
        if result["status"] == "ok" and self.executable.is_file():
            self.ticket = secrets.token_urlsafe(24)
        return {"module": self.ticket, "compileOutput": diagnostics}

    def run(self, ticket, input_text):
        if not self.ticket or not hmac.compare_digest(ticket, self.ticket):
            raise ValueError("本机程序已过期，请重新编译。")
        with tempfile.TemporaryDirectory(dir=self.directory) as running:
            return capture([str(self.executable)], running, input_text, 2)


def serve(port, html, compilers, open_browser):
    host = f"127.0.0.1:{port}"
    origin = f"http://{host}"
    token = secrets.token_urlsafe(32)
    config = json.dumps({"token": token})
    page = html.read_text(encoding="utf-8")
    page = page.replace("<head>", "<head><script>window.__NATIVE_JUDGE__=" + config.replace("<", "\u003c") + ";</script>", 1)

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(5)

        def send(self, status, content, kind):
            self.send_response(status)
            self.send_header("Content-Type", kind)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'")
            self.end_headers()
            try:
                self.wfile.write(content)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_GET(self):
            if self.headers.get("Host") == host and self.path == "/":
                self.send(200, page.encode("utf-8"), "text/html; charset=utf-8")
            else:
                self.send_error(404)

        def do_POST(self):
            if (
                self.path != "/local-judge"
                or self.headers.get("Host") != host
                or self.headers.get("Origin") != origin
                or not hmac.compare_digest(self.headers.get("X-Judge-Token", "").encode(), token.encode())
                or self.headers.get_content_type() != "application/json"
            ):
                self.send_error(403)
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 512000:
                    raise ValueError("请求大小超出限制。")
                data = json.loads(self.rfile.read(size))
                if not isinstance(data, dict):
                    raise ValueError("评测请求格式无效。")
                source = data.get("source")
                if isinstance(source, str) and len(source) <= OUTPUT_LIMIT:
                    result = judge.compile(source, data.get("language", "c"))
                elif isinstance(data.get("module"), str) and isinstance(data.get("input"), str) and len(data["input"]) <= INPUT_LIMIT:
                    result = judge.run(data["module"], data["input"])
                else:
                    raise ValueError("评测请求格式无效。")
                status = 200
            except (OSError, ValueError, subprocess.SubprocessError) as error:
                status, result = 400, {"toolError": str(error)}
            self.send(status, json.dumps(result, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    with tempfile.TemporaryDirectory(prefix="review-local-c-") as workspace:
        judge = LocalJudge(Path(workspace), compilers)
        with HTTPServer(("127.0.0.1", port), Handler) as server:
            print(f"本机 C/C++ 评测已启动。仅运行你信任的代码。\n{origin}/", flush=True)
            if open_browser:
                webbrowser.open(origin + "/")
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    local_page = ROOT / "计导期末复习.html"
    parser.add_argument("--html", type=Path, default=local_page if local_page.is_file() else ROOT / "index.html")
    parser.add_argument("--cc", default="gcc", help="Path to the GCC or Clang executable configured in VS Code")
    parser.add_argument("--cxx", default="g++", help="Path to the g++ or clang++ executable")
    parser.add_argument("--flag", action="append", help="C compiler flags, e.g. --flag=-std=c11 --flag=-g")
    parser.add_argument("--cxx-flag", action="append", help="C++ compiler flags, e.g. --cxx-flag=-std=c++17")
    parser.add_argument("--open", action="store_true", help="Open the local site in your browser")
    options = parser.parse_args()
    compilers = {}
    for language, command, flags, standard in (
        ("c", options.cc, options.flag, "-std=c11"),
        ("cpp", options.cxx, options.cxx_flag, "-std=c++17"),
    ):
        executable = shutil.which(command)
        if executable:
            compilers[language] = (str(Path(executable).resolve()), flags or [standard, "-g"])
    if not compilers:
        parser.error("请用 --cc 或 --cxx 指定本机编译器的完整路径。")
    if not options.html.is_file():
        parser.error("网站 HTML 不存在，请先运行 build.py 或用 --html 指定入口。")
    serve(options.port, options.html, compilers, options.open)
