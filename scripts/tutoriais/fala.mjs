// Ajustado para a voz Kokoro pf_dora e conferido com o Whisper. PDF, QR, DUA, Word e
// IncluiEdu ela já lê bem. Letra acentuada solta ela lê pelo nome do acento
// ("é agudo"): por isso as siglas vão sem acento.
export const SPOKEN = [
  [/\bAEE\b/g, "A. E. E."],
  [/\bCSV\b/g, "cê ésse vê"],
  [/ · /g, ", "],
];

export const spoken = (text) => SPOKEN.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
