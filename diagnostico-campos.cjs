const { Prisma } = require("@prisma/client");

const model = Prisma.dmmf.datamodel.models.find(
  (item) => item.name === "User"
);

if (!model) {
  console.error("ERRO: modelo User não encontrado.");
  process.exit(1);
}

const expected = [
  "emailVerified",
  "emailVerificationRequired",
  "sessionVersion",
];

const available = model.fields
  .filter((field) => expected.includes(field.name))
  .map((field) => field.name);

console.log("Campos encontrados:", available);
console.log(
  "Resultado:",
  expected.every((field) => available.includes(field))
    ? "SUCESSO — os três campos estão disponíveis."
    : "INCOMPLETO — faltam campos no Prisma Client."
);
