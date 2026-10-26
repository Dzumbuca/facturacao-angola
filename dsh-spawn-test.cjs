"use strict";
// Teste: spawn do query-engine via node com vários modos de stdio
const { spawn } = require("child_process");
const mode = process.argv[2] || "inherit";
const optsMap = {
  inherit: { stdio: "inherit" },
  ignore: { stdio: "ignore" },
  ignoreHide: { stdio: "ignore", windowsHide: true },
  hide: { stdio: "inherit", windowsHide: true },
};
const opts = optsMap[mode];
if (!opts) { console.error("modo inválido"); process.exit(3); }
console.log("teste stdio:", mode);
const p = spawn("./node_modules/.prisma/client/query-engine-windows.exe", ["--version"], opts);
p.on("error", (e) => { console.log("spawn error:", e.code); process.exit(2); });
p.on("exit", (code, sig) => { console.log("exit code:", code, "signal:", sig); process.exit(code === 0 ? 0 : 1); });
