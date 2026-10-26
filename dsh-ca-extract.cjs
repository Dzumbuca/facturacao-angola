"use strict";
// Extrai a CA raiz auto-assinada ("Supabase Root 2021 CA") do handshake TLS
// e guarda em .dsh-tmp/supabase-root-ca.pem para validar a ligação no backup.
const tls = require("tls");
const fs = require("fs");
const path = require("path");

const HOST = "aws-0-eu-west-1.pooler.supabase.com";
const PORT = 6543;

fs.mkdirSync(path.join(__dirname, ".dsh-tmp"), { recursive: true });

const s = tls.connect(
  { host: HOST, port: PORT, servername: HOST, rejectUnauthorized: false, timeout: 15000 },
  () => {
    let c = s.getPeerCertificate(true);
    const seen = new Set();
    const certs = [];
    let guard = 0;
    while (c && c.fingerprint256 && guard++ < 8) {
      if (seen.has(c.fingerprint256)) break;
      seen.add(c.fingerprint256);
      if (c.raw) certs.push(c);
      c = c.issuerCertificate;
    }
    if (!certs.length) { console.log("SEM_RAW: getPeerCertificate sem campo raw"); process.exit(3); }
    const root = certs.find((x) => x.subject && x.issuer && x.subject.CN === x.issuer.CN);
    if (!root) { console.log("SEM_RAIZ_AUTOASSINADA"); process.exit(4); }
    const pem =
      "-----BEGIN CERTIFICATE-----\n" +
      (Buffer.isBuffer(root.raw) ? root.raw : Buffer.from(root.raw)).toString("base64").match(/.{1,64}/g).join("\n") +
      "\n-----END CERTIFICATE-----\n";
    const out = path.join(__dirname, ".dsh-tmp", "supabase-root-ca.pem");
    fs.writeFileSync(out, pem, "utf8");
    console.log("CA_RAIZ_GUARDADA:", out);
    console.log("subject:", root.subject.CN, "| fingerprint256:", root.fingerprint256);
    s.end();
    process.exit(0);
  }
);
s.on("error", (e) => { console.log("TLS_ERR", e.message); process.exit(1); });
s.on("timeout", () => { console.log("TLS_TIMEOUT"); s.destroy(); process.exit(1); });
