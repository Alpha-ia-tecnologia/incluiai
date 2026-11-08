// Como a voz fala cada legenda. A legenda mostra o texto do roteiro; aqui ficam só
// as trocas para a voz, nas palavras que ela lê mal. Usado pelo gravador
// (scripts/tutoriais/gravar.mjs) e pela revisão da narração (revisar.py).
//
// Ajustado para a voz Kokoro pf_dora e conferido com o Whisper. PDF, QR, DUA, Word e
// IncluiEdu ela já lê bem. Letra acentuada solta ela lê pelo nome do acento
// ("é agudo"): por isso as siglas vão sem acento.
export const SPOKEN = [
  // Soletrado, com uma pausa curta entre as letras: é como se diz AEE.
  [/\bAEE\b/g, "A. E. E."],
  [/\bCSV\b/g, "cê ésse vê"],
  [/ · /g, ", "],
];

export const spoken = (text) => SPOKEN.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
