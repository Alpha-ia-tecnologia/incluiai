// Vídeos tutoriais: regras puras (lista, perfil e duração), sem acesso a arquivo.
// Os vídeos são gravados na própria plataforma por scripts/tutoriais/gravar.mjs,
// que escreve public/tutoriais/tutoriais.json.

export type Tutorial = {
  id: string;
  title: string;
  audience: string;
  roles: string[];
  summary: string;
  seconds: number;
  video: string;
  poster: string | null;
};

// Nomes de arquivo simples: o JSON vira endereço de página e de vídeo.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:mp4|jpg)$/;

export function isTutorial(value: unknown): value is Tutorial {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" && SLUG.test(item.id) &&
    typeof item.title === "string" && item.title.trim() !== "" &&
    typeof item.audience === "string" &&
    typeof item.summary === "string" &&
    Array.isArray(item.roles) && item.roles.every((role) => typeof role === "string") &&
    typeof item.seconds === "number" && Number.isFinite(item.seconds) && item.seconds > 0 &&
    typeof item.video === "string" && FILE.test(item.video) && item.video.endsWith(".mp4") &&
    (item.poster === null || (typeof item.poster === "string" && FILE.test(item.poster) && item.poster.endsWith(".jpg")))
  );
}

// Lê o conteúdo do JSON: o que não tem o formato esperado fica de fora, na ordem do arquivo.
export function parseTutorials(raw: unknown): Tutorial[] {
  return Array.isArray(raw) ? raw.filter(isTutorial) : [];
}

export function tutorialsForRole(tutorials: Tutorial[], role: string): Tutorial[] {
  return tutorials.filter((tutorial) => tutorial.roles.includes(role));
}

// "1 min 20 s", "45 s", "2 min".
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (!minutes) return `${rest} s`;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}
