import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Character } from "@/components/character";
import { ArrowRight, BookOpen, CircleHelp, Route } from "lucide-react";

export const dynamic = "force-dynamic";

const teachingSteps = [
  { title: "Fazer o estudo de caso", text: "Abra Estudantes, escolha um nome e entre em Estudo de caso. Registre o que a família, a escola e o próprio estudante contam, observe-o nos espaços da escola e conclua com a síntese e os apoios necessários. Você pode salvar e continuar depois.", href: "/estudantes", action: "Escolher estudante" },
  { title: "Conhecer o estudante", text: "Em Como aprende, conte os interesses, as formas de comunicação e os apoios que ajudam esse estudante. O que o estudo de caso levantou já aparece como sugestão.", href: "/estudantes", action: "Escolher estudante" },
  { title: "Definir o que ensinar", text: "Em Plano de ensino, crie o plano e adicione um objetivo: uma aprendizagem que você quer acompanhar. Descreva também como perceber que ela foi alcançada.", href: "/estudantes?acao=acompanhar", action: "Abrir acompanhamento" },
  { title: "Preparar a atividade", text: "Com o perfil e o objetivo preenchidos, peça sugestões em Atividades. Leia o passo a passo e aceite a atividade que pretende aplicar. A decisão é sempre do profissional.", href: "/estudantes?acao=preparar", action: "Preparar uma atividade" },
  { title: "Registrar como foi a aula", text: "Depois da aula, escolha a atividade ou o objetivo, informe a participação, o apoio necessário e o resultado observado. Acrescente uma observação se precisar e toque em salvar.", href: "/estudantes?acao=registrar", action: "Registrar uma aula" },
  { title: "Acompanhar e ajustar", text: "Consulte o Resumo para ver resultados e a Evolução para rever os acontecimentos. Use o que funcionou para planejar as próximas aulas e revisar o plano com a equipe.", href: "/estudantes?acao=acompanhar", action: "Ver acompanhamento" },
];

export default async function HelpPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const family = user.role === "familia";
  const therapist = user.role === "terapeuta";
  const managing = ["secretaria", "gestao"].includes(user.role);
  const portal = user.studentId ? `/familia/${user.studentId}` : "/";
  const steps = family ? [
    { title: "Ver o que está sendo trabalhado", text: "Abra Meu filho. Veja os objetivos apresentados pela escola, as atividades para casa e as conquistas recentes.", href: portal, action: "Abrir acompanhamento" },
    { title: "Observar uma conquista em casa", text: "Faça as atividades orientadas pela escola e observe o que a criança conseguiu fazer e de que ajuda precisou.", href: portal, action: "Ver atividades para casa" },
    { title: "Compartilhar com a escola", text: "Use Registrar uma conquista de casa. Escreva uma observação do cotidiano, informe quem está registrando e envie. Você poderá consultar o registro na mesma página.", href: portal, action: "Registrar uma conquista" },
  ] : therapist ? [
    { title: "Conhecer o contexto escolar", text: "Em Orientações, confira o estudante acompanhado e as informações de comunicação e interesses compartilhadas pela escola.", href: user.studentId ? "/terapeuta" : "/", action: "Abrir orientações" },
    { title: "Compartilhar orientações práticas", text: "Preencha o formulário com recursos de acessibilidade, estratégias e orientações que possam ser usadas na escola. Os campos com asterisco são obrigatórios.", href: user.studentId ? "/terapeuta" : "/", action: "Escrever orientações" },
    { title: "Consultar o que foi enviado", text: "Depois de enviar, confira o histórico abaixo do formulário para retomar as orientações compartilhadas com a equipe.", href: user.studentId ? "/terapeuta" : "/", action: "Ver orientações enviadas" },
  ] : managing ? [
    { title: "Ver onde a rede precisa de atenção", text: "Abra o Painel de indicadores para consultar os dados da rede ou de uma escola e as necessidades de acompanhamento.", href: "/painel", action: "Abrir o painel" },
    { title: "Entender cada trajetória", text: "Em Estudantes, busque um nome ou uma turma. Abra o acompanhamento para consultar plano, registros e evolução.", href: "/estudantes?acao=acompanhar", action: "Consultar estudante" },
    { title: "Manter os cadastros organizados", text: "Em Escolas e turmas, consulte os cadastros e adicione as escolas e turmas que organizam o atendimento da rede.", href: "/cadastros", action: "Abrir escolas e turmas" },
  ] : teachingSteps;
  const commonQuestions = [
    { question: "Preciso preencher tudo de uma vez?", answer: "Você pode usar a plataforma por etapas. Salve o formulário em que estiver trabalhando antes de sair da página. No acompanhamento do estudante, a indicação Próximo passo ajuda a escolher o que fazer em seguida." },
    { question: "Como sei que um registro de aula foi salvo?", answer: "Ao salvar, aguarde a mensagem de confirmação. O novo registro também aparece no histórico da página. Se houver falha, os campos do registro permanecem preenchidos para você tentar novamente." },
    { question: "Posso falar em vez de digitar a observação?", answer: "Nos campos com a opção de ditado, você pode usar o microfone se o navegador oferecer esse recurso. Permita o acesso ao microfone e confira o texto antes de salvar. Se a opção não estiver disponível, digite normalmente." },
    { question: "O que é o plano de ensino ou PPI?", answer: "É o Plano Pedagógico Individual: reúne o que será trabalhado com o estudante, o apoio necessário e os critérios para acompanhar a aprendizagem. Na plataforma, você o encontra em Plano de ensino." },
    { question: "O que significa AEE?", answer: "Atendimento Educacional Especializado. Na plataforma, é um dos contextos em que a equipe pode planejar atividades e acompanhar o estudante." },
  ];
  const questions = family || therapist ? [
    { question: "Meu estudante não apareceu. O que faço?", answer: "Peça à equipe da escola para conferir o vínculo do seu acesso com o estudante. Você não precisa criar um novo cadastro por conta própria." },
    { question: "Como volto ao meu acompanhamento?", answer: family ? "Use Meu filho no menu. No celular, essa opção fica na parte inferior da tela." : "Use Orientações no menu. No celular, essa opção fica na parte inferior da tela." },
    { question: "Os campos são salvos enquanto eu digito?", answer: "Não. Revise o que escreveu e use o botão de envio antes de sair da página. Depois, confira seu registro no histórico." },
  ] : commonQuestions;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between gap-5">
        <div><p className="mb-3 flex items-center gap-2 text-sm font-medium text-brand-strong"><CircleHelp size={18} aria-hidden /> Ajuda e primeiros passos</p><h1 className="text-3xl leading-tight tracking-tight sm:text-4xl">Vamos por partes.</h1><p className="mt-3 max-w-xl text-base leading-relaxed text-ink-soft">Você não precisa conhecer todos os recursos para começar. Siga o caminho da sua rotina.</p></div>
        <Character variant="care" className="hidden w-36 sm:block" />
      </div>
      <Link href="/jornada" className="mb-8 flex items-center gap-4 rounded-2xl bg-lilac-soft p-5 transition-colors hover:bg-lilac">
        <Route size={26} className="shrink-0 text-brand-strong" aria-hidden />
        <span className="min-w-0 flex-1"><span className="block text-base font-medium">Prefere um caminho guiado?</span><span className="mt-1 block text-sm leading-relaxed text-ink-soft">Em Minha jornada, a plataforma mostra o que você já fez, com os seus dados, e o próximo passo.</span></span>
        <ArrowRight size={20} className="shrink-0 text-brand-strong" aria-hidden />
      </Link>
      <section aria-labelledby="steps-title">
        <h2 id="steps-title" className="mb-5 text-xl font-medium">{family ? "Acompanhe e compartilhe conquistas" : therapist ? "Aproxime suas orientações da escola" : managing ? "Acompanhe o trabalho da rede" : "Da primeira informação à próxima aula"}</h2>
        <ol className="space-y-4">
          {steps.map((step, index) => <li key={step.title} className="flex gap-3 rounded-2xl border border-line bg-paper-raised p-5 sm:gap-5 sm:p-6"><span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft font-medium text-brand-strong">{index + 1}</span><div className="min-w-0"><h3 className="text-xl font-medium">{step.title}</h3><p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.text}</p><Link href={step.href} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline">{step.action}<ArrowRight size={16} className="shrink-0" aria-hidden /></Link></div></li>)}
        </ol>
      </section>
      <section className="mt-10" aria-labelledby="questions-title">
        <h2 id="questions-title" className="mb-4 flex items-center gap-2 text-xl font-medium"><BookOpen size={21} aria-hidden /> Dúvidas do dia a dia</h2>
        <div className="space-y-3">{questions.map((item) => <details key={item.question} className="rounded-2xl border border-line bg-paper-raised"><summary className="cursor-pointer px-5 py-4 text-base font-medium">{item.question}</summary><p className="px-5 pb-5 text-sm leading-relaxed text-ink-soft">{item.answer}</p></details>)}</div>
      </section>
      <p className="mt-8 rounded-2xl bg-brand-soft p-5 text-sm leading-relaxed text-ink-soft">Precisa de ajuda com o acesso ou com as informações de um estudante? Procure a coordenação da sua escola.</p>
    </div>
  );
}