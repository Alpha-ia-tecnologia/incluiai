// Arquivos de exemplo do Educacenso para os testes (dados fictícios), nas edições
// 2025 e 2026 do leiaute, com o número oficial de campos de cada registro.

const line = (count, values) => Array.from({ length: count }, (_, index) => values[index + 1] ?? "").join("|");

const PEOPLE = [
  { 3: "P1", 4: "123456789012", 5: "11122233344", 6: "DANTE RIBEIRO", 7: "12/03/2019", 17: "1", 27: "1" },
  { 3: "P2", 4: "999888777666", 6: "NOVA ALUNA DA SILVA", 7: "05/06/2018", 17: "1", 19: "1" },
  { 3: "P3", 5: "55544433322", 6: "ALUNO SEM DEFICIENCIA", 7: "01/01/2017", 17: "0" },
  { 3: "P4", 4: "111222333444", 6: "SO NO AEE", 7: "30/02/2018", 17: "1", 25: "1" },
  { 3: "P5", 6: "ALUNA DA CLASSE ESPECIAL", 7: "10/10/2016", 17: "1", 25: "1" },
  { 3: "P6", 6: "MENINO DA PRE", 7: "01/02/2021", 17: "1", 27: "1" },
  { 3: "G1", 6: "GESTORA COM DEFICIENCIA", 7: "01/01/1980", 17: "1", 24: "1" },
];
// Matrículas: [pessoa, turma, tipos de AEE marcados (posição a partir do primeiro)].
const ENROLLMENTS = [["P1", "T2A"], ["P1", "TAEE", [0, 9]], ["P2", "TAEE", [1]], ["P3", "T2A"], ["P4", "TAEE", [0]], ["P5", "CE1"], ["P5", "TAEE", [0]], ["P6", "PRE"], ["P6", "TAEE", [9]], ["P9", "T2A"]];

export function sampleFile(edition = 2025) {
  const e25 = edition === 2025;
  const counts = e25 ? { "00": 56, "20": 70, "30": 108, "60": 32 } : { "00": 53, "20": 66, "30": 110, "60": 33 };
  const klass = (code, name, kind, stage, special) => line(counts["20"], {
    1: "20", 2: "12345678", 3: code, 5: name,
    ...(e25 ? { 14: kind === "curricular" ? "1" : "0", 16: kind === "aee" ? "1" : "0" } : { 14: kind === "curricular" ? "6" : "5" }),
    [e25 ? 24 : 22]: special ? "1" : "", [e25 ? 25 : 23]: stage ?? "",
  });
  const aeeStart = e25 ? 9 : 10;
  return [
    "﻿" + line(counts["00"], { 1: "00", 2: "12345678", 3: "1", 6: "EMEF PAULO FREIRE" }),
    klass("T2A", "2º ANO A", "curricular", "302"),
    klass("TAEE", "SALA DE RECURSOS MULTIFUNCIONAIS", "aee"),
    klass("CE1", "CLASSE ESPECIAL", "curricular", "302", true),
    klass("PRE", "PRE II", "curricular", "301"),
    ...PEOPLE.map((person) => line(counts["30"], { 1: "30", 2: "12345678", ...person })),
    "30|12345678",
    ...ENROLLMENTS.map(([person, klassCode, services = []]) => line(counts["60"], {
      1: "60", 2: "12345678", 3: person, 5: klassCode,
      ...Object.fromEntries(services.map((offset) => [aeeStart + offset, "1"])),
    })),
    "99|",
  ].join("\r\n");
}

export const SAMPLE = sampleFile(2025);
