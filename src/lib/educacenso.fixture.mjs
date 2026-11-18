import { FIELD, LAYOUT } from "./educacenso.ts";

const line = (count, values) => Array.from({ length: count }, (_, index) => values[index + 1] ?? "").join("|");
const marks = (start, offsets) => Object.fromEntries(offsets.map((offset) => [start + offset, "1"]));

// Os registros 00, 20, 30, 60 e 99 com o leiaute de cada edição. Dias: 1 a 7 a partir
// do campo de início do horário; tipos de deficiência, recursos e atendimentos do AEE:
// a posição na lista de cada um.
export function censusFile({ edition = 2025, school, classes = [], people = [], enrollments = [] }) {
  const layout = LAYOUT[edition];
  const record = (type, values) => line(layout.fields[type], { 1: type, [FIELD.school.code]: school.code, ...values });
  const kindOf = (kind) => edition === 2025
    ? { [layout.classCurricular]: kind === "curricular" ? "1" : "0", [layout.classComplementary]: "0", [layout.classAee]: kind === "aee" ? "1" : "0" }
    : { [layout.classType]: kind === "curricular" ? "6" : "5" };
  return [
    record("00", { 3: "1", [FIELD.school.name]: school.name, [FIELD.school.dependency]: school.dependency ?? "3", [FIELD.school.municipalPartnership]: "0" }),
    ...classes.map(({ code, name, kind, mediation = "1", days = {}, special = false, stage = "" }) => record("20", {
      [FIELD.schoolClass.systemCode]: code, [FIELD.schoolClass.name]: name, [FIELD.schoolClass.mediation]: mediation,
      ...Object.fromEntries(Object.entries(days).map(([day, interval]) => [FIELD.schoolClass.scheduleStart + Number(day), interval])),
      ...kindOf(kind), [layout.specialClass]: special ? "1" : "", [layout.stageGroup]: stage,
    })),
    ...people.map(({ code, inepId = "", cpf = "", name, birth, special = true, types = [], resources = [] }) => record("30", {
      [FIELD.person.systemCode]: code, [FIELD.person.inepId]: inepId, [FIELD.person.cpf]: cpf, [FIELD.person.name]: name, [FIELD.person.birthDate]: birth,
      [FIELD.person.specialFlag]: special ? "1" : "0", ...marks(FIELD.person.specialTypesStart, types), ...marks(FIELD.person.resourcesStart, resources),
    })),
    ...enrollments.map(({ person, klass, services = [] }) => record("60", {
      [FIELD.enrollment.personSystemCode]: person, [FIELD.enrollment.classSystemCode]: klass, ...marks(layout.aeeServicesStart, services),
    })),
    "99|",
  ];
}

const PEOPLE = [
  { code: "P1", inepId: "123456789012", cpf: "11122233344", name: "DANTE RIBEIRO", birth: "12/03/2019", types: [9], resources: [0, 12] },
  { code: "P2", inepId: "999888777666", name: "NOVA ALUNA DA SILVA", birth: "05/06/2018", types: [1] },
  { code: "P3", cpf: "55544433322", name: "ALUNO SEM DEFICIENCIA", birth: "01/01/2017", special: false },
  { code: "P4", inepId: "111222333444", name: "SO NO AEE", birth: "30/02/2018", types: [7] },
  { code: "P5", name: "ALUNA DA CLASSE ESPECIAL", birth: "10/10/2016", types: [7] },
  { code: "P6", name: "MENINO DA PRE", birth: "01/02/2021", types: [9] },
  { code: "P7", name: "ALUNO A DISTANCIA", birth: "03/03/2015", types: [6] },
  { code: "P8", name: "ALUNO DE MUITOS VINCULOS", birth: "04/04/2016", types: [7] },
  { code: "G1", name: "GESTORA COM DEFICIENCIA", birth: "01/01/1980", types: [6] },
];
const CLASSES = [
  { code: "T2A", name: "2º ANO A", kind: "curricular", stage: "302", days: { 1: "07:00-11:00", 2: "07:00-11:00", 3: "07:00-11:00", 4: "07:00-11:00", 5: "07:00-11:00" } },
  { code: "TAEE", name: "SALA DE RECURSOS MULTIFUNCIONAIS", kind: "aee", days: { 1: "13:00-15:00" } },
  { code: "CE1", name: "CLASSE ESPECIAL", kind: "curricular", stage: "302", special: true, days: { 1: "07:00-11:00" } },
  { code: "PRE", name: "PRE II", kind: "curricular", stage: "301", days: { 1: "07:00-11:00", 2: "07:00-11:00" } },
  { code: "TAEE2", name: "AEE MANHA", kind: "aee", days: { 2: "08:00-09:00" } },
  { code: "REM", name: "6º ANO A DISTANCIA", kind: "curricular", stage: "302", mediation: "3" },
];
const ENROLLMENTS = [
  { person: "P1", klass: "T2A" }, { person: "P1", klass: "TAEE", services: [0, 9] },
  { person: "P2", klass: "TAEE", services: [1] },
  { person: "P3", klass: "T2A" },
  { person: "P4", klass: "TAEE" }, // AEE sem nenhum tipo de atendimento
  { person: "P5", klass: "CE1" }, { person: "P5", klass: "TAEE", services: [0] },
  { person: "P6", klass: "PRE" }, { person: "P6", klass: "TAEE2", services: [9] }, { person: "P6", klass: "TAEE", services: [0] }, // horário coincidente e dois vínculos de AEE
  { person: "P7", klass: "REM" }, { person: "P7", klass: "TAEE", services: [0] }, // classe comum a distância
  ...Array.from({ length: 5 }, () => ({ person: "P8", klass: "TAEE", services: [0] })), // mais de 4 vínculos
  { person: "P9", klass: "T2A" },
];

export function sampleFile(edition = 2025, { dependency = "3", code = "12345678" } = {}) {
  const lines = censusFile({ edition, school: { code, name: "EMEF PAULO FREIRE", dependency }, classes: CLASSES, people: PEOPLE, enrollments: ENROLLMENTS });
  lines.splice(1 + CLASSES.length + PEOPLE.length, 0, `30|${code}`);
  return "﻿" + lines.join("\r\n");
}
