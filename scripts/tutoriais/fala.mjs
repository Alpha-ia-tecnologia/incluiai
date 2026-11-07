// Como a voz fala cada legenda. A legenda mostra o texto original; aqui ficam só
// as trocas para a voz: siglas, nomes e palavras que o Piper lê mal.
// Usado pelo gravador (scripts/tutoriais/gravar.mjs) e pela revisão da narração.
//
// Ajustado para a voz pt_BR-cadu-medium, testado com o Whisper: cada troca daqui
// fez a palavra ser entendida mais vezes do que a grafia normal.
export const SPOKEN = [
  // Nomes e siglas.
  [/\bIncluiEdu\b/g, "Inclui, Edu"],
  // AEE soletrado; a pausa depois do último "é" evita que a voz o engula.
  [/\bAEE\b(?![.,:;!?])/g, "á, é, é,"],
  [/\bAEE\b/g, "á, é, é"],
  [/\bPDF\b/g, "pê dê éfe"],
  [/\bCSV\b/g, "cê ésse vê"],
  [/\bQR\b/g, "quê érre"],
  [/\bWord\b/g, "Uórd"],
  [/\bDUA\b/g, "dê u á"],
  [/\b2FA\b/g, "duas etapas"],
  [/ · /g, ", "],
  // Fonemas crus entre [[ ]]. A voz engole o R depois de consoante ("fente") e o LH
  // ("escoa"): aqui o R vem vibrante, o LH como "lj" e o A final aberto.
  [/\bescolha\b/gi, "[[ˌeskˈolja]]"],
  [/\bconfira\b/gi, "[[kˌõnfˈiɾa]]"],
  [/\bcriar\b/gi, "[[kriʲˈaɾ]]"],
  [/\bprancha\b/gi, "[[prˈɐ̃nʃa]]"],
  [/\bpreenchido\b/gi, "[[prˌeẽnʃˈidʊ]]"],
  [/\bpreencha\b/gi, "[[prˌeˈẽnʃa]]"],
  [/\bfrente\b/gi, "[[frˈẽntʃɪ]]"],
  [/\bfilho\b/gi, "[[fˈiljʊ]]"],
  [/\bentregue\b/gi, "[[ˌẽntrˈɛɡɪ]]"],
  [/\bimprima\b/gi, "[[ˌĩmprˈima]]"],
  [/\bprecisa\b/gi, "[[prˌesˈiza]]"],
];

export const spoken = (text) => SPOKEN.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
