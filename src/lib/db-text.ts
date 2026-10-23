// Busca por trecho de texto sem distinguir maiúsculas nos dois bancos: o SQLite
// já compara assim (LIKE); o PostgreSQL distingue e pede mode "insensitive",
// que o cliente do SQLite não aceita.
const POSTGRES = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");

export const textContains = (value: string) => (POSTGRES ? { contains: value, mode: "insensitive" } : { contains: value }) as { contains: string };
