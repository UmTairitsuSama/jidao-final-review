const compilerUrl = "https://cdn.jsdelivr.net/npm/browsercc@0.1.1/dist/index.js";
const wasiUrl = "https://cdn.jsdelivr.net/npm/@bjorn3/browser_wasi_shim@0.4.2/dist/index.js";
const outputLimit = 64 * 1024;

async function compile(source, language) {
  const cpp = language === "cpp";
  const file = cpp ? "/main.cpp" : "/main.c";
  const compiler = cpp ? "clang++" : "clang";
  const { Clang, LLD, setUpSysroot } = await import(compilerUrl);
  let compileOutput = "";
  const printErr = (line) => {
    if (compileOutput.length < 8192) compileOutput += line + "\n";
  };
  const sysrootUrl = new URL("sysroot.tar", compilerUrl);
  const [driver, clang, lld, sysroot] = await Promise.all([
    Clang({ thisProgram: compiler, printErr }),
    Clang({ thisProgram: compiler, printErr }),
    LLD({ thisProgram: "wasm-ld", printErr }),
    fetch(sysrootUrl).then((response) => {
      if (!response.ok) throw new Error("编译器标准库下载失败（HTTP " + response.status + "）");
      return response.arrayBuffer();
    }),
  ]);
  driver.FS.writeFile(file, source);
  driver.FS.mkdirTree("/lib/wasm32-wasi");
  driver.FS.writeFile("/lib/wasm32-wasi/crt1-command.o", new Uint8Array(0));
  if (cpp) driver.FS.mkdirTree("/include/c++/v1");
  const args = [cpp ? "-std=c++17" : "-std=c11", "-O2", file, "-lm",
    "-Wl,--max-memory=67108864", "-o", "/submission.wasm", "-###"];
  if (driver.callMain(args) !== 0) throw new Error(compileOutput);

  const commands = compileOutput.split("\n").filter((line) => /^\s+"/.test(line))
    .map((line) => Array.from(line.matchAll(/"([^"]*)"/g), (match) => match[1]));
  const cc = commands.find((command) => command[1] === "-cc1");
  const link = commands.find((command) => /(?:^|\/)wasm-ld$/.test(command[0]));
  if (!cc || !link) throw new Error("Clang 未生成编译或链接命令。");
  const objectPath = cc[cc.indexOf("-o") + 1];
  compileOutput = "";
  setUpSysroot(clang, sysroot);
  clang.FS.writeFile(file, source);
  if (clang.callMain(cc.slice(1)) !== 0) return { compileOutput, module: null };

  setUpSysroot(lld, sysroot);
  lld.FS.writeFile(objectPath, clang.FS.readFile(objectPath));
  if (lld.callMain(link.slice(1)) !== 0) return { compileOutput, module: null };
  const module = await WebAssembly.compile(lld.FS.readFile("/submission.wasm"));
  return { compileOutput, module };
}

async function run(module, input) {
  const { WASI, File, OpenFile, ConsoleStdout } = await import(wasiUrl);
  const stdout = new TextDecoder();
  const stderr = new TextDecoder();
  const result = { out: "", err: "", status: "ok" };
  let size = 0;
  const limitReached = new Error("output limit");
  function capture(key, decoder) {
    return new ConsoleStdout((data) => {
      const remaining = outputLimit - size;
      result[key] += decoder.decode(data.subarray(0, remaining), { stream: true });
      size += Math.min(data.length, remaining);
      if (data.length > remaining) throw limitReached;
    });
  }
  const fds = [
    new OpenFile(new File(new TextEncoder().encode(input))),
    capture("out", stdout),
    capture("err", stderr),
  ];
  const wasi = new WASI([], [], fds);
  self.postMessage({ running: true });
  try {
    const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });
    const exit = wasi.start(instance);
    if (exit !== 0) {
      result.status = "runtime";
      result.err += "\n退出代码 " + exit;
    }
  } catch (error) {
    result.status = error === limitReached ? "output" : "runtime";
    if (error !== limitReached) result.err += "\n" + error.message;
  }
  result.out += stdout.decode();
  result.err += stderr.decode();
  return result;
}

self.onmessage = async ({ data }) => {
  try {
    const result = data.source === undefined
      ? await run(data.module, data.input)
      : await compile(data.source, data.language);
    self.postMessage(result);
  } catch (error) {
    self.postMessage({ toolError: error.message });
  }
};
