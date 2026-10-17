// Calendário inclusivo — datas comemorativas ligadas ao público do AEE
// (autismo, surdez e Libras, deficiência visual etc.). As referências legais foram conferidas
// nas fontes oficiais (Planalto, Câmara, Senado, ONU/OMS); datas sem norma
// federal trazem a origem descrita como tal.

export type CalendarTheme = "direitos" | "comunicacao" | "visual" | "neuro" | "intelectual" | "fisica" | "saude";

export const CALENDAR_THEMES: Record<CalendarTheme, { label: string; chip: string; dot: string }> = {
  direitos: { label: "Inclusão e direitos", chip: "bg-brand-soft text-brand-strong", dot: "bg-brand" },
  comunicacao: { label: "Surdez, Libras e comunicação", chip: "bg-sky-soft text-sky-ink", dot: "bg-sky-ink" },
  visual: { label: "Deficiência visual", chip: "bg-teal-soft text-teal-ink", dot: "bg-teal-ink" },
  neuro: { label: "Neurodiversidade e aprendizagem", chip: "bg-peach-soft text-peach-ink", dot: "bg-peach-ink" },
  intelectual: { label: "Deficiência intelectual e síndromes", chip: "bg-rose-soft text-rose-ink", dot: "bg-rose-ink" },
  fisica: { label: "Deficiência física e motora", chip: "bg-sage-soft text-sage-ink", dot: "bg-sage-ink" },
  saude: { label: "Saúde e condições raras", chip: "bg-surface-muted text-ink-soft", dot: "bg-ink-soft" },
};

export type CommemorativeDate = {
  id: string;
  title: string;
  short: string; // rótulo curto exibido na grade do mês
  theme: CalendarTheme;
  month: number; // 1-12
  day: number | "ultimo"; // "ultimo" = último dia do mês
  endDay?: number; // semanas comemorativas
  about: string;
  idea: string; // proposta para a turma toda (DUA, sem expor estudantes)
  origin: string;
};

export const COMMEMORATIVE_DATES: CommemorativeDate[] = [
  {
    id: "braille-mundial", title: "Dia Mundial do Braille", short: "Braille", theme: "visual", month: 1, day: 4,
    about: "Homenageia Louis Braille, nascido em 4 de janeiro de 1809, e lembra que o braille é essencial para a autonomia na leitura e na escrita de pessoas cegas.",
    idea: "Apresente o alfabeto braille à turma com cartelas em relevo (cola, botões ou EVA) e proponha que cada estudante escreva o próprio nome.",
    origin: "Proclamado pela Assembleia Geral da ONU em 2018.",
  },
  {
    id: "doencas-raras", title: "Dia Mundial das Doenças Raras", short: "Doenças raras", theme: "saude", month: 2, day: "ultimo",
    about: "Dá visibilidade às pessoas com doenças raras e às suas famílias. É lembrado no último dia de fevereiro — 29 nos anos bissextos, a data mais rara do calendário.",
    idea: "Converse sobre como cada pessoa é única e monte com a turma um mural de \"coisas que nos tornam diferentes e coisas que temos em comum\".",
    origin: "Campanha internacional criada em 2008 pela EURORDIS.",
  },
  {
    id: "audicao", title: "Dia Mundial da Audição", short: "Audição", theme: "comunicacao", month: 3, day: 3,
    about: "Promove o cuidado com a audição e o acesso à reabilitação auditiva.",
    idea: "Faça uma caça aos sons na escola e crie com a turma sinais visuais para pedir silêncio — o ambiente fica melhor para quem é sensível a ruído.",
    origin: "Promovido pela Organização Mundial da Saúde (OMS).",
  },
  {
    id: "sindrome-down", title: "Dia Internacional da Síndrome de Down", short: "Síndrome de Down", theme: "intelectual", month: 3, day: 21,
    about: "A data 21/3 faz referência à trissomia do cromossomo 21. Celebra a vida e os direitos das pessoas com síndrome de Down.",
    idea: "Proponha a campanha das meias trocadas: cada pessoa vem com um par diferente, e a turma conversa sobre como a diferença faz parte de todos nós.",
    origin: "Reconhecido pela ONU desde 2012.",
  },
  {
    id: "epilepsia", title: "Dia Roxo — Conscientização sobre a Epilepsia", short: "Dia Roxo", theme: "saude", month: 3, day: 26,
    about: "Conhecido como Purple Day, combate o preconceito e divulga informações sobre a epilepsia.",
    idea: "Com a equipe escolar, revise o que fazer durante uma crise (manter a calma, proteger a cabeça, deitar de lado, cronometrar, não colocar nada na boca) e convide a turma a usar roxo.",
    origin: "Campanha internacional criada em 2008 por Cassidy Megan, no Canadá.",
  },
  {
    id: "autismo", title: "Dia Mundial de Conscientização sobre o Autismo", short: "Autismo", theme: "neuro", month: 4, day: 2,
    about: "Promove informação, respeito e inclusão das pessoas autistas.",
    idea: "Trabalhe com a turma as diferentes formas de comunicar e de sentir o ambiente — por exemplo, um cantinho da calma que qualquer estudante pode usar.",
    origin: "Instituído pela ONU em 2007; no Brasil, Dia Nacional pela Lei nº 13.652/2018.",
  },
  {
    id: "braille-nacional", title: "Dia Nacional do Sistema Braille", short: "Sistema Braille", theme: "visual", month: 4, day: 8,
    about: "Homenageia José Álvares de Azevedo, nascido em 8 de abril de 1834, primeiro professor cego do Brasil e responsável por trazer o braille ao país.",
    idea: "Explore com a turma livros táteis e etiquete objetos da sala em braille e em tinta.",
    origin: "Lei nº 12.266/2010.",
  },
  {
    id: "libras", title: "Dia Nacional da Libras", short: "Libras", theme: "comunicacao", month: 4, day: 24,
    about: "Marca a data da Lei nº 10.436/2002, que reconheceu a Língua Brasileira de Sinais como meio legal de comunicação e expressão.",
    idea: "Ensine à turma sinais do dia a dia (cumprimentos, cores, \"obrigado\") e use-os na rotina da semana.",
    origin: "Lei nº 13.055/2014.",
  },
  {
    id: "orgulho-autista", title: "Dia do Orgulho Autista", short: "Orgulho Autista", theme: "neuro", month: 6, day: 18,
    about: "Criado pela própria comunidade autista para celebrar a neurodiversidade e afirmar o autismo como parte da identidade.",
    idea: "Valorize os interesses de cada estudante: organize uma roda em que todos mostram algo de que gostam muito.",
    origin: "Iniciativa da comunidade autista, celebrada desde 2005.",
  },
  {
    id: "lbi", title: "Aniversário da Lei Brasileira de Inclusão", short: "LBI", theme: "direitos", month: 7, day: 6,
    about: "A Lei Brasileira de Inclusão (Estatuto da Pessoa com Deficiência) assegura o sistema educacional inclusivo em todos os níveis.",
    idea: "Faça com a turma uma vistoria de acessibilidade da escola: o que facilita e o que dificulta a participação de todos?",
    origin: "Lei nº 13.146, sancionada em 6 de julho de 2015.",
  },
  {
    id: "tdah", title: "Semana Nacional de Conscientização sobre o TDAH", short: "Semana do TDAH", theme: "neuro", month: 8, day: 1,
    about: "Semana que inclui o dia 1º de agosto, voltada a informar sobre o Transtorno do Déficit de Atenção com Hiperatividade e combater estigmas.",
    idea: "Experimente com a turma estratégias que ajudam todo mundo a manter o foco: pausas ativas, tarefas em etapas curtas e quadro de rotina visível.",
    origin: "Lei nº 14.420/2022.",
  },
  {
    id: "altas-habilidades", title: "Dia das Pessoas com Altas Habilidades ou Superdotação", short: "Altas habilidades", theme: "neuro", month: 8, day: 10,
    about: "Lembra que estudantes com altas habilidades ou superdotação também são público do AEE e têm direito a enriquecimento curricular.",
    idea: "Proponha projetos de investigação em que cada estudante aprofunda um tema de interesse e apresenta à turma.",
    origin: "Adotado em leis municipais (ex.: Porto Alegre, Lei nº 12.727/2020); há projeto de lei federal em tramitação.",
  },
  {
    id: "deficiencia-intelectual", title: "Semana Nacional da Pessoa com Deficiência Intelectual e Múltipla", short: "DI e múltipla", theme: "intelectual", month: 8, day: 21, endDay: 28,
    about: "Semana de conscientização sobre os direitos e as potencialidades das pessoas com deficiência intelectual e múltipla.",
    idea: "Organize uma mostra de produções coletivas em que cada estudante participa do jeito que consegue, com o apoio de que precisa, e todos assinam o trabalho.",
    origin: "Lei nº 13.585/2017.",
  },
  {
    id: "luta-pcd", title: "Dia Nacional de Luta da Pessoa com Deficiência", short: "Luta da PcD", theme: "direitos", month: 9, day: 21,
    about: "Data de mobilização pela inclusão e pelos direitos das pessoas com deficiência, celebrada pelos movimentos sociais desde 1982.",
    idea: "Monte com a turma uma árvore da inclusão: cada folha traz uma atitude que ajuda todos a participar.",
    origin: "Lei nº 11.133/2005.",
  },
  {
    id: "atleta-paralimpico", title: "Dia Nacional do Atleta Paralímpico", short: "Atleta paralímpico", theme: "fisica", month: 9, day: 22,
    about: "Lembra a fundação do Comitê Paralímpico Internacional, em 22 de setembro de 1989, e valoriza o esporte adaptado.",
    idea: "Leve esportes paralímpicos para a educação física, como goalball ou vôlei sentado, com a turma toda jogando junto.",
    origin: "Lei nº 12.622/2012.",
  },
  {
    id: "linguas-sinais", title: "Dia Internacional das Línguas de Sinais", short: "Línguas de sinais", theme: "comunicacao", month: 9, day: 23,
    about: "Reforça que as línguas de sinais são línguas completas e fundamentais para os direitos das pessoas surdas.",
    idea: "Mostre à turma vídeos de contação de histórias em Libras e compare sinais de outros países.",
    origin: "Proclamado pela ONU em 2017.",
  },
  {
    id: "surdo", title: "Dia Nacional do Surdo", short: "Dia do Surdo", theme: "comunicacao", month: 9, day: 26,
    about: "Lembra a fundação, em 26 de setembro de 1857, da primeira escola de surdos do Brasil, hoje Instituto Nacional de Educação de Surdos (INES).",
    idea: "Convide uma pessoa surda ou um intérprete de Libras para conversar com a turma sobre cultura surda.",
    origin: "Lei nº 11.796/2008.",
  },
  {
    id: "paralisia-cerebral", title: "Dia Mundial da Paralisia Cerebral", short: "Paralisia cerebral", theme: "fisica", month: 10, day: 6,
    about: "Dá visibilidade às pessoas com paralisia cerebral e à importância da acessibilidade e da tecnologia assistiva.",
    idea: "Explore recursos de tecnologia assistiva com a turma — engrossadores de lápis, pranchas de comunicação, acionadores — e conversem sobre como ampliam a participação.",
    origin: "Movimento internacional iniciado em 2012.",
  },
  {
    id: "deficiencia-fisica", title: "Dia da Pessoa com Deficiência Física", short: "Deficiência física", theme: "fisica", month: 10, day: 11,
    about: "Chama atenção para a acessibilidade e a mobilidade das pessoas com deficiência física.",
    idea: "Mapeie com a turma os caminhos da escola: onde uma cadeira de rodas passa com facilidade e onde há barreiras? Levem as propostas à gestão.",
    origin: "Criado em São Paulo em 1981 e hoje lembrado em todo o país.",
  },
  {
    id: "gagueira", title: "Dia Internacional de Atenção à Gagueira", short: "Gagueira", theme: "comunicacao", month: 10, day: 22,
    about: "Promove o respeito ao tempo de fala de cada pessoa e combate o preconceito contra quem gagueja.",
    idea: "Combine com a turma regras de escuta: esperar o colega terminar, não completar frases e manter o contato visual.",
    origin: "Celebrado internacionalmente desde 1998.",
  },
  {
    id: "dislexia", title: "Dia Nacional de Atenção à Dislexia", short: "Dislexia", theme: "neuro", month: 11, day: 16,
    about: "Incentiva a identificação precoce e as adaptações que garantem o direito de aprender a estudantes com dislexia.",
    idea: "Ofereça a toda a turma o mesmo conteúdo em mais de um formato — áudio, texto ampliado e imagem — e deixe cada estudante escolher.",
    origin: "Lei nº 13.085/2015.",
  },
  {
    id: "pcd-internacional", title: "Dia Internacional da Pessoa com Deficiência", short: "Pessoa com deficiência", theme: "direitos", month: 12, day: 3,
    about: "Data da ONU para promover os direitos e o bem-estar das pessoas com deficiência em todas as esferas da sociedade.",
    idea: "Leia com a turma histórias com personagens com deficiência e conversem sobre o que torna um lugar acessível.",
    origin: "Proclamado pela ONU em 1992.",
  },
  {
    id: "deficiencia-visual", title: "Dia Nacional da Pessoa com Deficiência Visual", short: "Deficiência visual", theme: "visual", month: 12, day: 13,
    about: "Conhecido como Dia do Cego, coincide com o dia de Santa Luzia. Lembra os direitos das pessoas cegas e com baixa visão.",
    idea: "Pratique audiodescrição com a turma: em duplas, um descreve uma imagem em detalhes e o outro desenha a partir da descrição.",
    origin: "Decreto nº 51.045/1961.",
  },
];

// A cor de cada campanha acompanha o nome (azul, verde), não o tema.
export const MONTHLY_CAMPAIGNS: { month: number; title: string; text: string; theme: CalendarTheme; chip: string }[] = [
  { month: 4, title: "Abril Azul", text: "mês de conscientização sobre o autismo.", theme: "neuro", chip: "bg-sky-soft text-sky-ink" },
  { month: 9, title: "Setembro Verde", text: "mês de luta pela inclusão da pessoa com deficiência.", theme: "direitos", chip: "bg-sage-soft text-sage-ink" },
  { month: 9, title: "Setembro Azul", text: "mês de visibilidade da comunidade surda.", theme: "comunicacao", chip: "bg-sky-soft text-sky-ink" },
];

export const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export type YMD = { year: number; month: number; day: number };

// Ocorrência de uma data comemorativa em um ano específico.
export type CalendarEvent = {
  key: string;
  entry: CommemorativeDate;
  start: YMD;
  end: YMD;
};

// "Hoje" no fuso da rede municipal, independente do fuso do servidor.
export function todayInBrazil(now = new Date()): YMD {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Número de dias desde a época — permite comparar e subtrair datas sem fuso.
export function dayIndex({ year, month, day }: YMD): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function weekdayOf(date: YMD): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function monthEvents(year: number, month: number): CalendarEvent[] {
  return COMMEMORATIVE_DATES.filter((entry) => entry.month === month)
    .map((entry) => {
      const day = entry.day === "ultimo" ? daysInMonth(year, month) : entry.day;
      return { key: `${entry.id}-${year}`, entry, start: { year, month, day }, end: { year, month, day: entry.endDay ?? day } };
    })
    .sort((a, b) => a.start.day - b.start.day);
}

// Próximas datas a partir de hoje, incluindo semanas que já estão em curso.
export function upcomingEvents(today: YMD, horizonDays = 45): CalendarEvent[] {
  const from = dayIndex(today);
  const events: CalendarEvent[] = [];
  for (let offset = 0; offset < 13; offset++) {
    const index = today.year * 12 + (today.month - 1) + offset;
    events.push(...monthEvents(Math.floor(index / 12), (index % 12) + 1));
  }
  return events
    .filter((event) => dayIndex(event.end) >= from && dayIndex(event.start) - from <= horizonDays)
    .sort((a, b) => dayIndex(a.start) - dayIndex(b.start));
}

export function relativeLabel(event: CalendarEvent, today: YMD): string {
  const start = dayIndex(event.start) - dayIndex(today);
  if (start < 0) return "Acontecendo agora";
  if (start === 0) return "Hoje";
  if (start === 1) return "Amanhã";
  return `Em ${start} dias`;
}

export function dateRangeLabel(event: CalendarEvent): string {
  const { start, end } = event;
  const month = MONTH_NAMES[start.month - 1];
  if (dayIndex(start) === dayIndex(end)) return `${start.day} de ${month}`;
  if (start.month === end.month) return `${start.day} a ${end.day} de ${month}`;
  return `${start.day} de ${month} a ${end.day} de ${MONTH_NAMES[end.month - 1]}`;
}

export function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
