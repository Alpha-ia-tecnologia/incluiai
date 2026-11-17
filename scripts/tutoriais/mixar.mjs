import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const FADE_IN = 1.5;
const FADE_OUT = 3;
const SEAM = 3;

export const MUSIC = {
  file: env.TRILHA ?? join(HERE, "trilha.flac"),
  volume: Number(env.TRILHA_VOLUME ?? -8),
};

export function duration(ffmpeg, file) {
  const { stderr } = spawnSync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const match = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr ?? "");
  if (!match) throw new Error(`Não foi possível ler a duração de ${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export function mux({ ffmpeg, video, narration, seconds, out, music = MUSIC }) {
  const args = ["-y", "-loglevel", "error", "-i", video];
  if (narration) args.push("-i", narration);
  if (!music.file || !existsSync(music.file)) {
    if (narration) args.push("-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-ac", "1", "-shortest");
    else args.push("-map", "0:v", "-c", "copy");
    execFileSync(ffmpeg, [...args, "-movflags", "+faststart", out]);
    return;
  }
  const length = duration(ffmpeg, music.file);
  const copies = Math.max(1, Math.ceil((seconds - SEAM) / (length - SEAM)));
  const first = narration ? 2 : 1;
  for (let i = 0; i < copies; i++) args.push("-i", music.file);
  const graph = [];
  let bed = `[${first}:a]`;
  for (let i = 1; i < copies; i++) {
    graph.push(`${bed}[${first + i}:a]acrossfade=d=${SEAM}:c1=tri:c2=tri[loop${i}]`);
    bed = `[loop${i}]`;
  }
  const fadeOut = Math.max(0, seconds - FADE_OUT).toFixed(2);
  graph.push(`${bed}aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${seconds.toFixed(2)},volume=${music.volume}dB,afade=t=in:d=${FADE_IN},afade=t=out:st=${fadeOut}:d=${FADE_OUT}[bed]`);
  if (narration) {
    graph.push("[1:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit[voice][key]");
    graph.push("[bed][key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=500[ducked]");
    graph.push("[voice][ducked]amix=inputs=2:duration=first:normalize=0[audio]");
  } else {
    graph.push("[bed]anull[audio]");
  }
  args.push("-filter_complex", graph.join(";"), "-map", "0:v", "-map", "[audio]", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-t", seconds.toFixed(2));
  execFileSync(ffmpeg, [...args, "-movflags", "+faststart", out]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ffmpeg = env.FFMPEG ?? "ffmpeg";
  const out = env.OUT ?? join(HERE, "..", "..", "public", "tutoriais");
  const work = env.WORK ?? join(tmpdir(), "incluiedu-tutoriais");
  const filters = process.argv.slice(2);
  const ids = readdirSync(out)
    .filter((name) => name.endsWith(".mp4") && !name.includes(".mixando."))
    .map((name) => name.slice(0, -4))
    .filter((id) => !filters.length || filters.some((f) => id.startsWith(f) || id.includes(f)))
    .sort();
  let failed = 0;
  for (const id of ids) {
    const narration = join(work, `${id}.wav`);
    if (!existsSync(narration)) {
      console.error(`✗ ${id}: a narração não está em ${narration}; regrave o vídeo`);
      failed++;
      continue;
    }
    const video = join(out, `${id}.mp4`);
    const temp = join(out, `${id}.mixando.mp4`);
    mux({ ffmpeg, video, narration, seconds: duration(ffmpeg, narration), out: temp });
    renameSync(temp, video);
    console.log(`✓ ${id}`);
  }
  if (failed) process.exit(1);
}
