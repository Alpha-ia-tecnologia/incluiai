import type { FunctionalProfile } from "@prisma/client";
import { parseJson } from "./format";

// Motor de regras determinísticas (item 17.3, Etapa A).
// Regras versionadas, auditáveis e visíveis ao professor:
// cada adaptação gerada aponta para a regra que a originou.

export const RULES_VERSION = "1.0.0";

export interface AdaptationRule {
  id: string;
  when: string; // condição legível
  then: string; // exigência aplicada a toda atividade
}

interface SensoryProfile {
  auditiva?: string;
  visual?: string;
  tatil?: string;
  vestibular?: string;
  proprioceptiva?: string;
}

export function applicableRules(profile: FunctionalProfile): AdaptationRule[] {
  const rules: AdaptationRule[] = [];
  const sensory = parseJson<SensoryProfile>(profile.sensoryProfile, {});
  const isCAA = profile.expressiveChannel.startsWith("caa") || profile.expressiveChannel === "olhar_acionador";

  if (isCAA) {
    rules.push({
      id: "R01-CAA",
      when: "CAA ou acionador como canal expressivo",
      then: "Prever forma de resposta não vocal (apontar, cartão, botão, varredura)",
    });
  }
  if (profile.expressiveChannel === "libras" || profile.receptiveChannel === "libras") {
    rules.push({
      id: "R02-LIBRAS",
      when: "Libras como canal de comunicação",
      then: "Instruções em Libras e apoio visual; sem dependência de instrução oral",
    });
  }
  if (profile.commandSteps <= 1) {
    rules.push({
      id: "R03-1ETAPA",
      when: "Compreende comandos de 1 etapa",
      then: "Fracionar a atividade em passos únicos, um comando por vez",
    });
  }
  if (sensory.auditiva === "hiper") {
    rules.push({
      id: "R04-AUD",
      when: "Hipersensibilidade auditiva",
      then: "Evitar áudio simultâneo; prever fone abafador ou canto silencioso",
    });
  }
  if (sensory.visual === "hiper") {
    rules.push({
      id: "R05-VIS",
      when: "Hipersensibilidade visual",
      then: "Reduzir estímulos visuais concorrentes; material limpo, um foco por vez",
    });
  }
  if (profile.taskToleranceMinutes > 0 && profile.taskToleranceMinutes < 10) {
    rules.push({
      id: "R06-TEMPO",
      when: "Tolerância à tarefa menor que 10 minutos",
      then: "Blocos curtos com pausa programada; duração dentro da tolerância",
    });
  }
  if (profile.fineMotor >= 4) {
    rules.push({
      id: "R07-MOTOR",
      when: "Apoio motor FIS-P ou FIS-T em motricidade fina",
      then: "Adaptar preensão, plano inclinado, acionador ou resposta por escolha",
    });
  }
  if (profile.organization >= 3) {
    rules.push({
      id: "R08-ROTINA",
      when: "Dificuldade de organização e transição",
      then: "Rotina visual com aviso antecipado de 2 minutos antes de trocar de atividade",
    });
  }
  if (profile.groupWork >= 3) {
    rules.push({
      id: "R09-GRUPO",
      when: "Trabalho em grupo exige modelo ou apoio físico",
      then: "Prever colega mediador e papel claro e curto dentro do grupo",
    });
  }
  if (profile.attentionMinutes > 0 && profile.attentionMinutes < profile.taskToleranceMinutes) {
    rules.push({
      id: "R10-ATENCAO",
      when: "Atenção sustentada menor que a tolerância declarada",
      then: "Alternar momentos de ação e escuta; retomar o objetivo a cada bloco",
    });
  }

  rules.push({
    id: "R00-ANTISSEGREGACAO",
    when: "Regra permanente (item 17.7)",
    then: "Nenhuma atividade de sala comum pode isolar o estudante; indicar como participa junto da turma",
  });

  return rules;
}
