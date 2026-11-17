import "server-only";
import sharp, { type Sharp, type SharpOptions } from "sharp";
import { LOGO_MAX_BYTES, LOGO_TOO_BIG, sniffLogo, svgProblem, svgText, type LogoType } from "./logo-core";

export { LOGO_MAX_BYTES } from "./logo-core";
const MAX_SIDE = 1024;
// Teto de pixels na decodificação: um PNG pequeno pode declarar dimensões enormes.
const OPTIONS: SharpOptions = { limitInputPixels: 40_000_000, failOn: "error" };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

export type Logo = { data: Buffer; type: LogoType };

const UNREADABLE = "Não foi possível abrir a imagem do logo. Confira o arquivo e envie de novo.";

async function reencode(bytes: Uint8Array, type: Exclude<LogoType, "image/svg+xml">): Promise<Buffer> {
  // rotate() sem argumento aplica a orientação do EXIF antes de os metadados saírem na regravação.
  const image = sharp(bytes, OPTIONS).rotate().resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true });
  if (type === "image/png") return image.png({ compressionLevel: 9 }).toBuffer();
  if (type === "image/jpeg") return image.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return image.webp({ quality: 90 }).toBuffer();
}

export async function readLogo(file: File): Promise<Logo | { problem: string }> {
  if (!file.size) return { problem: "Escolha o arquivo do logo." };
  if (file.size > LOGO_MAX_BYTES) return { problem: LOGO_TOO_BIG };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffLogo(bytes);
  if (!type) return { problem: "O logo precisa ser uma imagem PNG, JPG, WebP ou SVG." };
  try {
    if (type !== "image/svg+xml") return { data: await reencode(bytes, type), type };
    const problem = svgProblem(svgText(bytes) ?? "");
    if (problem) return { problem };
    const logo: Logo = { data: Buffer.from(bytes), type };
    await logoPng(logo, 64);
    return logo;
  } catch {
    return { problem: UNREADABLE };
  }
}

// SVG: a densidade decide o tamanho em que o librsvg desenha (72 dpi = tamanho
// declarado no arquivo); desenhar já no tamanho pedido evita borrar ao ampliar.
// Ler as dimensões não desenha nada: o teto de pixels vale só para o desenho.
async function open(logo: Logo, size: number): Promise<Sharp> {
  if (logo.type !== "image/svg+xml") return sharp(logo.data, OPTIONS);
  const { width = size, height = size } = await sharp(logo.data, { failOn: "error", limitInputPixels: false }).metadata();
  const density = Math.min(2400, Math.max(1, Math.ceil((72 * size) / Math.max(width, height, 1))));
  return sharp(logo.data, { ...OPTIONS, density });
}

export async function logoPng(logo: Logo, size: number): Promise<Buffer> {
  return (await open(logo, size)).resize(size, size, { fit: "contain", background: TRANSPARENT }).png().toBuffer();
}

export async function logoPixels(logo: Logo, size: number): Promise<{ data: Uint8Array; width: number; height: number }> {
  const { data, info } = await (await open(logo, size))
    .resize(size, size, { fit: "inside", kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// O SVG aberto direto no navegador vira documento: o sandbox da CSP impede
// script mesmo que algo tenha passado pela checagem; nosniff impede o navegador
// de adivinhar outro tipo.
export const LOGO_RESPONSE_HEADERS = (logo: Logo): Record<string, string> => ({
  "Content-Type": logo.type,
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; sandbox",
  "Cross-Origin-Resource-Policy": "same-site",
});
