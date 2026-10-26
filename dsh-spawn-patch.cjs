"use strict";
/**
 * Workaround temporário para o sandbox DSH (Windows):
 * 1) spawns com stdio "pipe" falham com EPERM (pipes nomeados bloqueados);
 * 2) "ignore" + windowsHide:true faz o query-engine do Prisma sair com 0xC0000142
 *    (STATUS_DLL_INIT_FAILED) porque fica sem handles de consola.
 * Este patch redireciona "pipe" para "inherit" (mantém windowsHide, sem captura)
 * e liga streams PassThrough em memória onde o código espera child.stdout/stderr
 * (o motor binário do Prisma comunica por HTTP localhost). Remover após uso.
 */
const cp = require("child_process");
const { PassThrough } = require("stream");

const origSpawn = cp.spawn;

function withPseudoStreams(child) {
  if (child && child.stdout === null) {
    try { child.stdout = new PassThrough(); } catch (e) { /* noop */ }
  }
  if (child && child.stderr === null) {
    try { child.stderr = new PassThrough(); } catch (e) { /* noop */ }
  }
  return child;
}

cp.spawn = function patchedSpawn(cmd, args, opts) {
  if (typeof opts !== "object" || opts === null) {
    // stdio por omissão é "pipe" -> redirecionar
    return withPseudoStreams(origSpawn.call(this, cmd, args, { stdio: "inherit" }));
  }
  const stdio = opts.stdio;
  const hasPipe =
    stdio === undefined ||
    stdio === "pipe" ||
    (Array.isArray(stdio) && stdio.some((s) => s === "pipe"));
  if (!hasPipe) return origSpawn.apply(this, arguments);

  const patched = Object.assign({}, opts);
  patched.stdio = Array.isArray(stdio)
    ? stdio.map((s) => (s === "pipe" ? "inherit" : s))
    : ["inherit", "inherit", "inherit"];
  return withPseudoStreams(origSpawn.call(this, cmd, args, patched));
};
