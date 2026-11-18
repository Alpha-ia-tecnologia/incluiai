// Busca por trecho de texto sem distinguir maiúsculas nos dois bancos: o SQLite
// já compara assim (LIKE); o PostgreSQL distingue e pede mode "insensitive",
// que o cliente do SQLite não aceita.
import { usesPostgres } from "./env-config";

export const textContains = (value: string) => (usesPostgres() ? { contains: value, mode: "insensitive" } : { contains: value }) as { contains: string };
