"use strict";
// Inspecionar a cadeia de certificados TLS apresentada pelo pooler
const net = require("net");
const tls = require("tls");

const HOST = "aws-0-eu-west-1.pooler.supabase.com";
const PORT = 6543;

const sock = net.connect({ host: HOST, port: PORT, timeout: 15000 }, () => {
  const req = Buffer.alloc(8);
  req.writeInt32BE(8, 0);
  req.writeInt32BE(80877103, 4);
  sock.write(req);
});
sock.on("error", (e) => { console.log("TCP_ERR", e.message); process.exit(1); });
sock.once("data", (buf) => {
  const tlsSock = tls.connect({
    socket: sock, servername: HOST, timeout: 15000,
    rejectUnauthorized: false,
  }, () => {
    const chain = tlsSock.getPeerCertificate(true);
    let c = chain;
    let i = 0;
    while (c && i < 6) {
      console.log(`[${i}] subject: ${c.subject && c.subject.CN}`);
      console.log(`    issuer : ${c.issuer && c.issuer.CN} (${c.issuer && c.issuer.O})`);
      console.log(`    valid  : ${c.valid_from} -> ${c.valid_to}`);
      c = c.issuerCertificate;
      if (c && c.subject && c.subject.CN === chain.subject && chain.issuerCertificate === c) break;
      i++;
      if (c === chain) break; // auto-assinada (raiz)
    }
    tlsSock.end();
    process.exit(0);
  });
  tlsSock.on("error", (e) => { console.log("TLS_ERR", e.message); process.exit(1); });
});
