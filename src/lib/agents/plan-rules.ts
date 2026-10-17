import type { CaseStudy, FunctionalProfile } from "@prisma/client";
import { ACTION_SUGGESTIONS } from "../objective";
import { applicableRules } from "../rules";
import { parseCaseStudy } from "../case-study";
import { splitItems } from "../form-options";
import { parseJson } from "../format";
import type { PlanProposal } from "./schemas";
import { DIMENSION_KEYS } from "./schemas";

// Proposta de plano sem IA (motor de regras): usada quando a IA está
// desligada ou indisponível. Segue as mesmas salvaguardas e passa pela
// mesma revisão do professor.

type Dimension = (typeof DIMENSION_KEYS)[number];

const CONDITION_BY_SUPPORT = ["de forma independente", "com supervisão", "com pista visual", "com modelo do professor", "com apoio físico parcial", "com apoio físico parcial"];

// Áreas que mais precisam de apoio, segundo o perfil e o estudo de caso.
function priorities(profile: FunctionalProfile | null, study: Record<string, string>): { dimension: Dimension; current: number }[] {
  const scores: { dimension: Dimension; current: number }[] = [];
  if (profile) {
    const isAlternative = profile.expressiveChannel !== "fala";
    scores.push(
      { dimension: "comunicacao", current: isAlternative ? Math.max(3, profile.adultInteraction) : profile.adultInteraction },
      { dimension: "leitura", current: profile.readingSupport },
      { dimension: "escrita", current: profile.writingSupport },
      { dimension: "matematica", current: profile.mathSupport },
      { dimension: "interacao", current: profile.peerInteraction },
      { dimension: "autonomia", current: Math.round((profile.organization + profile.feeding + profile.hygiene) / 3) },
      { dimension: "regulacao", current: parseJson<string[]>(profile.triggers, []).length ? 3 : 1 },
    );
  } else {
    const needs = `${study.motivos ?? ""} ${study.necessidades ?? ""}`.toLowerCase();
    const guess: [Dimension, RegExp][] = [
      ["comunicacao", /comunica/], ["leitura", /leitura|ler/], ["escrita", /escrita|escrever/],
      ["matematica", /matem|conta/], ["interacao", /intera|colegas/], ["autonomia", /autonomia/], ["regulacao", /regula|comportamento|aten/],
    ];
    for (const [dimension, pattern] of guess) if (pattern.test(needs)) scores.push({ dimension, current: 3 });
    if (!scores.length) scores.push({ dimension: "comunicacao", current: 3 }, { dimension: "autonomia", current: 3 });
  }
  return scores.sort((a, b) => b.current - a.current).slice(0, 2);
}

export function proposePlanWithRules(profile: FunctionalProfile | null, caseStudy: CaseStudy | null): PlanProposal {
  const study = parseCaseStudy(caseStudy?.content);
  const rules = profile ? applicableRules(profile) : [];
  const initialSituation = [
    study.leitura ? `Leitura: ${study.leitura.toLowerCase()}` : "",
    study.escrita ? `Escrita: hipótese ${study.escrita.toLowerCase()}` : "",
    study.matematica ? `Matemática: ${study.matematica.toLowerCase()}` : "",
    ...splitItems(study.potencialidades),
    ...(profile?.strengths ? splitItems(profile.strengths) : []),
  ].filter(Boolean);

  return {
    initialSituation: initialSituation.length ? initialSituation : ["A equipe deve registrar o que o estudante já consegue fazer"],
    commonRoomStrategies: [
      "Atividade da turma adaptada ao interesse",
      ...rules.filter((rule) => rule.id !== "R00-ANTISSEGREGACAO").map((rule) => rule.then),
    ],
    aeeStrategies: splitItems(study.necessidades).length ? splitItems(study.necessidades) : ["Atividades com o interesse âncora", "Ensino estruturado"],
    accessibilityResources: splitItems(study.recursos),
    reviewWeeks: 12,
    objectives: priorities(profile, study).map(({ dimension, current }) => {
      const currentSupport = Math.min(5, Math.max(1, current));
      return {
        dimension,
        action: ACTION_SUGGESTIONS[dimension][0],
        condition: CONDITION_BY_SUPPORT[currentSupport],
        criterion: "4 de 5 tentativas",
        deadlineWeeks: 8,
        currentSupport,
        targetSupport: currentSupport - 1,
        bnccCode: null,
        rationale: "Área com maior necessidade de apoio, segundo o perfil e o estudo de caso.",
      };
    }),
  };
}
