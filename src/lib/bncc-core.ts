// Base da BNCC (habilidades e objetivos de aprendizagem), pura para teste com
// node --test (src/lib/bncc-core.test.mjs): o recorte pelo estudante (etapa,
// ano, faixa etária), a busca por código ou palavra e a sugestão de
// habilidades a partir do texto de um objetivo. Sem IA: palavras em comum,
// pesando mais as raras. Os dados ficam em prisma/data/bncc.json (bncc.ts).

export type BnccSkill = { code: string; stage: "EI" | "EF" | "EM"; component: string; years: string; description: string };
export type BnccScope = { stage: "EI" | "EF" | "EM" | null; year: number | null; eiGroup: "01" | "02" | "03" | null };

export const BNCC_CODE = /^(EI0[1-3][A-Z]{2}\d{2}|EF\d{2}[A-Z]{2}\d{2}|EM13[A-Z]{2,3}\d{2,3})$/;
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

// Anos de uma habilidade do fundamental: "1º ano", "1º e 2º anos", "1º ao 5º ano".
export function efYears(label: string): number[] {
  const numbers = [...label.matchAll(/(\d)º/g)].map((match) => Number(match[1]));
  if (numbers.length === 2 && /\bao\b/.test(label)) return Array.from({ length: numbers[1] - numbers[0] + 1 }, (_, index) => numbers[0] + index);
  return numbers;
}

// Recorte pelo estudante: etapa, ano (fundamental) e faixa etária (infantil:
// bebês até 1 ano e 6 meses, crianças bem pequenas até 3 anos e 11 meses,
// crianças pequenas até 5 anos e 11 meses). EJA usa todas as etapas.
export function scopeFor(student: { stage: string; gradeYear: string; birthDate: Date }, today: Date = new Date()): BnccScope {
  if (student.stage === "educacao_infantil") {
    const months = (today.getFullYear() - student.birthDate.getFullYear()) * 12 + today.getMonth() - student.birthDate.getMonth() - (today.getDate() < student.birthDate.getDate() ? 1 : 0);
    return { stage: "EI", year: null, eiGroup: months <= 18 ? "01" : months < 48 ? "02" : "03" };
  }
  if (student.stage === "anos_iniciais" || student.stage === "anos_finais") {
    const year = Number(/(\d)/.exec(student.gradeYear)?.[1] ?? NaN);
    return { stage: "EF", year: year >= 1 && year <= 9 ? year : null, eiGroup: null };
  }
  if (student.stage === "ensino_medio") return { stage: "EM", year: null, eiGroup: null };
  return { stage: null, year: null, eiGroup: null };
}

export function inScope(skill: BnccSkill, scope: BnccScope | null): boolean {
  if (!scope?.stage) return true;
  if (skill.stage !== scope.stage) return false;
  if (skill.stage === "EI") return !scope.eiGroup || skill.code.slice(2, 4) === scope.eiGroup;
  if (skill.stage === "EF") return !scope.year || efYears(skill.years).includes(scope.year);
  return true;
}

// Componentes ligados a cada área do objetivo (no infantil, os campos de experiência).
const DIMENSION_COMPONENTS: Record<string, string[]> = {
  leitura: ["Língua Portuguesa", "Escuta, fala, pensamento e imaginação"],
  escrita: ["Língua Portuguesa", "Escuta, fala, pensamento e imaginação"],
  comunicacao: ["Língua Portuguesa", "Escuta, fala, pensamento e imaginação"],
  matematica: ["Matemática", "Matemática e suas Tecnologias", "Espaços, tempos, quantidades, relações e transformações"],
  interacao: ["O eu, o outro e o nós"],
  regulacao: ["O eu, o outro e o nós"],
  autonomia: ["Corpo, gestos e movimentos", "O eu, o outro e o nós"],
};
export const componentsFor = (dimension: string | null | undefined) => DIMENSION_COMPONENTS[dimension ?? ""] ?? [];

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Palavras que não ajudam a achar a habilidade (gramaticais e de qualquer objetivo).
const STOP = new Set(("a ao aos as com como da das de do dos e em entre na nas no nos o os ou para pela pelas pelo pelos por que se sem sua suas seu seus um uma uns umas " +
  "ate apos cada mais menos muito pouco bem quando onde ja nao sim tambem sobre partir meio forma modo outros outras outro outra diferentes " +
  "estudante aluno aluna crianca criancas atividade atividades apoio apoios tentativa tentativas semana semanas vez vezes aula aulas dia dias rotina escolar escola " +
  "professor professora sala comum independente independentemente supervisao instrucao verbal visual pista fisico parcial modelo").split(" "));
// Raiz curta: as 5 primeiras letras (identificar/identificará, palavra/palavras).
export function stems(text: string): string[] {
  return [...new Set(plain(text).split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !STOP.has(word)).map((word) => word.slice(0, 5)))];
}

// Busca do campo: um código (ou o começo dele) ou palavras, todas presentes.
// As habilidades do recorte do estudante vêm primeiro.
export function searchSkills(skills: readonly BnccSkill[], query: string, scope: BnccScope | null, limit = 8): BnccSkill[] {
  const code = normalizeCode(query);
  const byScope = (a: BnccSkill, b: BnccSkill) => Number(inScope(b, scope)) - Number(inScope(a, scope)) || a.code.localeCompare(b.code);
  if (/^E[IFM]\d/.test(code) && !/\s/.test(query.trim())) return skills.filter((skill) => skill.code.startsWith(code)).sort(byScope).slice(0, limit);
  const wanted = stems(query);
  if (!wanted.length) return [];
  return skills
    .filter((skill) => {
      const have = new Set(stems(`${skill.description} ${skill.component}`));
      return wanted.every((stem) => have.has(stem));
    })
    .sort(byScope)
    .slice(0, limit);
}

// Sugestão a partir do texto do objetivo: só habilidades do recorte do estudante;
// pontos = soma da raridade das raízes em comum, com bônus no componente da área.
const rarity = new WeakMap<readonly BnccSkill[], Map<string, number>>();
function idf(skills: readonly BnccSkill[]): Map<string, number> {
  const cached = rarity.get(skills);
  if (cached) return cached;
  const count = new Map<string, number>();
  for (const skill of skills) for (const stem of stems(skill.description)) count.set(stem, (count.get(stem) ?? 0) + 1);
  const weights = new Map([...count].map(([stem, n]) => [stem, Math.log(skills.length / n)]));
  rarity.set(skills, weights);
  return weights;
}

export function suggestSkills(skills: readonly BnccSkill[], text: string, scope: BnccScope | null, dimension?: string | null, limit = 5): BnccSkill[] {
  const wanted = stems(text);
  if (!wanted.length) return [];
  const weights = idf(skills);
  const preferred = componentsFor(dimension);
  return skills
    .filter((skill) => inScope(skill, scope))
    .map((skill) => {
      const have = new Set(stems(skill.description));
      const score = wanted.reduce((sum, stem) => sum + (have.has(stem) ? weights.get(stem) ?? 0 : 0), 0);
      return { skill, score: score && preferred.includes(skill.component) ? score * 1.5 : score };
    })
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score || a.skill.code.localeCompare(b.skill.code))
    .slice(0, limit)
    .map((item) => item.skill);
}

// Nome curto do componente para indicadores e etiquetas.
export const componentLabel = (skill: Pick<BnccSkill, "stage" | "component">) => (skill.stage === "EI" ? `Educação infantil: ${skill.component}` : skill.component);
