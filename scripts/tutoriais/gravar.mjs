import puppeteer from "puppeteer-core";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spoken } from "./fala.mjs";
import { mux } from "./mixar.mjs";
import { installOverlay } from "./overlay.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const env = process.env;
const CONFIG = {
  base: env.BASE ?? "http://localhost:3217",
  out: env.OUT ?? join(ROOT, "public", "tutoriais"),
  work: env.WORK ?? join(tmpdir(), "incluiedu-tutoriais"),
  ffmpeg: env.FFMPEG ?? "ffmpeg",
  python: env.VOZ_PYTHON ?? "python3",
  voice: env.VOZ ?? "pf_dora",
  speech: [env.VOZ_VELOCIDADE ?? "1"],
  chrome: env.CHROME_PATH ?? "/usr/bin/google-chrome",
  fps: 25,
  width: 1280,
  height: 720,
  scale: 1.5,
};
const args = process.argv.slice(2);
const REHEARSAL = args.includes("--ensaio");
const LIST = args.includes("--listar");
const LINES = args.includes("--falas");
const SILENT = env.SEM_VOZ === "1";
const filters = args.filter((arg) => !arg.startsWith("--"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scriptsDir = join(HERE, "roteiros");
const scenarios = [];
for (const file of readdirSync(scriptsDir).filter((name) => name.endsWith(".mjs")).sort()) {
  const scenario = (await import(pathToFileURL(join(scriptsDir, file)))).default;
  scenarios.push({ ...scenario, file });
}
const selected = filters.length ? scenarios.filter((s) => filters.some((f) => s.id.startsWith(f) || s.id.includes(f))) : scenarios;
if (LIST) {
  for (const s of scenarios) console.log(`${s.id.padEnd(30)} ${s.title} — ${s.audience}`);
  process.exit(0);
}
if (!selected.length) {
  console.error("Nenhum roteiro com esse nome. Use --listar.");
  process.exit(1);
}

function wavInfo(file) {
  const buffer = readFileSync(file);
  let offset = 12;
  let rate = 22050;
  while (offset < buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "fmt ") rate = buffer.readUInt32LE(offset + 12);
    if (id === "data") return { rate, samples: buffer.subarray(offset + 8, offset + 8 + size), seconds: size / 2 / rate };
    offset += 8 + size;
  }
  throw new Error(`WAV sem dados: ${file}`);
}

class Voice {
  constructor() {
    this.dir = join(CONFIG.work, "voz");
    mkdirSync(this.dir, { recursive: true });
    this.queue = [];
    this.process = null;
  }
  key(text) {
    return createHash("sha1").update(`${CONFIG.voice}|${CONFIG.speech.join("|")}|${spoken(text)}`).digest("hex").slice(0, 16);
  }
  start() {
    if (this.process || SILENT) return;
    this.process = spawn(CONFIG.python, [join(HERE, "tts.py"), CONFIG.voice, ...CONFIG.speech], { stdio: ["pipe", "pipe", "inherit"] });
    this.ready = new Promise((resolve) => { this.onReady = resolve; });
    createInterface({ input: this.process.stdout }).on("line", (line) => {
      const message = JSON.parse(line);
      if (message.ready) return this.onReady();
      this.queue.shift()?.(message);
    });
  }
  async clip(text) {
    if (SILENT) return { file: null, seconds: Math.max(1.6, text.length / 15) };
    const file = join(this.dir, `${this.key(text)}.wav`);
    if (!existsSync(file)) {
      this.start();
      await this.ready;
      const answer = await new Promise((resolve) => {
        this.queue.push(resolve);
        this.process.stdin.write(`${JSON.stringify({ text: spoken(text), out: file })}\n`);
      });
      if (!answer.ok) throw new Error(`narração: ${answer.error}`);
    }
    return { file, seconds: wavInfo(file).seconds };
  }
  stop() {
    this.process?.stdin.end();
    this.process = null;
  }
}

class Recorder {
  constructor(page, file) {
    this.page = page;
    this.file = file;
    this.chain = Promise.resolve();
    this.written = 0;
    this.last = null;
    this.t0 = 0;
  }
  async start() {
    this.ffmpeg = spawn(CONFIG.ffmpeg, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(CONFIG.fps), "-c:v", "mjpeg", "-i", "pipe:0", "-c:v", "libx264", "-preset", "medium", "-crf", "25", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-vf", "scale=1920:1080:flags=lanczos", "-r", String(CONFIG.fps), this.file], { stdio: ["pipe", "inherit", "inherit"] });
    this.done = new Promise((resolve, reject) => this.ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com ${code}`)))));
    this.client = await this.page.createCDPSession();
    this.firstFrame = new Promise((resolve) => { this.onFirst = resolve; });
    this.client.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      this.client.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
      const frame = Buffer.from(data, "base64");
      const at = metadata.timestamp ?? Date.now() / 1000;
      this.chain = this.chain.then(() => this.push(frame, at));
    });
    await this.client.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: CONFIG.width * CONFIG.scale, maxHeight: CONFIG.height * CONFIG.scale, everyNthFrame: 1 });
    await this.firstFrame;
  }
  async write(frame) {
    if (!this.ffmpeg.stdin.write(frame)) await new Promise((resolve) => this.ffmpeg.stdin.once("drain", resolve));
    this.written++;
  }
  async push(frame, at) {
    if (!this.t0) {
      this.t0 = at;
      this.last = frame;
      this.onFirst();
      return;
    }
    const target = Math.floor((at - this.t0) * CONFIG.fps);
    while (this.written < target) await this.write(this.last);
    this.last = frame;
  }
  offset(epochMs) {
    return Math.max(0, epochMs / 1000 - this.t0);
  }
  async stop() {
    await this.client.send("Page.stopScreencast").catch(() => {});
    const end = Date.now() / 1000;
    this.chain = this.chain.then(async () => {
      const target = Math.floor((end - this.t0) * CONFIG.fps);
      while (this.written < target) await this.write(this.last);
    });
    await this.chain;
    this.ffmpeg.stdin.end();
    await this.done;
    return this.written / CONFIG.fps;
  }
}

function mixNarration(cues, seconds, file) {
  const rate = cues.length ? wavInfo(cues[0].file).rate : 22050;
  const total = Math.ceil(seconds * rate);
  const mix = new Int16Array(total);
  for (const cue of cues) {
    const { samples } = wavInfo(cue.file);
    const start = Math.round(cue.at * rate);
    for (let i = 0; i < samples.length / 2 && start + i < total; i++) {
      const value = mix[start + i] + samples.readInt16LE(i * 2);
      mix[start + i] = Math.max(-32768, Math.min(32767, value));
    }
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + mix.byteLength, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(mix.byteLength, 40);
  writeFileSync(file, Buffer.concat([header, Buffer.from(mix.buffer)]));
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

class Tutorial {
  constructor(page, voice) {
    this.page = page;
    this.voice = voice;
    this.base = CONFIG.base;
    this.recorder = null;
    this.cues = [];
    this.state = { x: CONFIG.width / 2, y: CONFIG.height + 40, caption: null, card: null };
    this.speed = REHEARSAL ? 0.15 : 1;
    this.vars = {};
    page.on("load", () => this.overlay().catch(() => {}));
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
  }

  async overlay() {
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        return await this.page.evaluate(installOverlay, this.state);
      } catch {
        await sleep(150);
      }
    }
  }
  async call(method, ...params) {
    await this.overlay();
    await this.page.evaluate((m, p) => window.__tut[m](...p), method, params).catch(() => {});
  }
  async caption(text) {
    this.state.caption = text;
    await this.call("caption", text);
  }
  async card(card) {
    this.state.card = card;
    await this.call("card", card);
  }

  async say(text, action) {
    const clip = await this.voice.clip(text);
    await this.caption(text);
    const startedAt = Date.now();
    if (this.recorder && clip.file) this.cues.push({ file: clip.file, at: this.recorder.offset(startedAt) });
    const talking = sleep(REHEARSAL ? 50 : clip.seconds * 1000 + 250);
    const done = action ? action() : Promise.resolve();
    await Promise.all([talking, done]);
    await this.caption(null);
    await sleep(350 * this.speed);
  }
  async pause(ms = 600) {
    await sleep(ms * this.speed);
  }

  async intro({ title, subtitle, eyebrow }, narration) {
    await this.card({ title, subtitle, eyebrow });
    await this.pause(900);
    for (const line of [].concat(narration)) await this.say(line);
    await this.card(null);
    await this.pause(700);
  }
  async outro({ title = "Pronto!", subtitle }, narration) {
    await this.pause(400);
    await this.card({ title, subtitle, eyebrow: "Mais vídeos em Ajuda" });
    await this.pause(500);
    for (const line of [].concat(narration)) await this.say(line);
    await this.pause(1400);
  }

  async find(target, { timeout = 10000 } = {}) {
    if (target && typeof target === "object" && typeof target.asElement === "function") return target;
    const spec = typeof target === "string" ? (/^[#.[]/.test(target) ? { css: target } : { text: target }) : target;
    if (spec.field) return this.field(spec.field, spec);
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const handle = await this.page.evaluateHandle((spec) => {
        const visible = (el) => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        const scope = spec.shadow ? document.querySelector(spec.shadow)?.shadowRoot : spec.in ? document.querySelector(spec.in) : document;
        if (!scope) return null;
        const up = (el) => (el && spec.closest ? el.closest(spec.closest) ?? el : el);
        if (spec.css) {
          const all = [...scope.querySelectorAll(spec.css)].filter(visible);
          return up(all[spec.nth ?? 0] ?? null);
        }
        const norm = (value) => String(value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
        const wanted = norm(spec.text);
        const selector = spec.tag ?? "button, a, [role=button], [role=tab], [role=link], summary, label, input[type=submit], [role=option], [role=radio], [role=checkbox]";
        const candidates = [...scope.querySelectorAll(selector)].filter((el) => visible(el) && !el.closest("#tutorial-overlay"));
        const labels = (el) => [el.innerText, el.getAttribute("aria-label"), typeof el.value === "string" ? el.value : "", el.title].map(norm).filter(Boolean);
        const label = (el) => labels(el)[0] ?? "";
        let matches = candidates.filter((el) => labels(el).some((value) => value === wanted));
        if (!matches.length && !spec.exact) matches = candidates.filter((el) => labels(el).some((value) => value.includes(wanted)));
        matches.sort((a, b) => label(a).length - label(b).length);
        if (spec.nth !== undefined) {
          const ordered = candidates.filter((el) => matches.includes(el));
          return up(ordered[spec.nth] ?? null);
        }
        return up(matches[0] ?? null);
      }, spec);
      const element = handle.asElement();
      if (element) return element;
      await sleep(200);
    }
    throw new Error(`Elemento não encontrado: ${JSON.stringify(spec)} em ${this.page.url()}`);
  }

  async scrollTo(target, block = "center") {
    const element = await this.find(target);
    const needs = await element.evaluate((el, block) => {
      const rect = el.getBoundingClientRect();
      const margin = 90;
      const out = rect.top < margin || rect.bottom > innerHeight - 120;
      const x = Math.min(Math.max(rect.left + Math.min(rect.width / 2, 40), 0), innerWidth - 1);
      const y = Math.min(Math.max(rect.top + rect.height / 2, 0), innerHeight - 1);
      const hit = document.elementFromPoint(x, y);
      const hidden = rect.left < 0 || rect.right > innerWidth || (hit && !el.contains(hit) && !hit.contains(el) && !hit.closest("#tutorial-overlay"));
      if (out || hidden) el.scrollIntoView({ behavior: "smooth", block: out ? block : "nearest", inline: "center" });
      return out || hidden;
    }, block);
    if (needs) await this.settleScroll(element);
    return element;
  }
  async scrollBy(pixels) {
    await this.page.evaluate((y) => window.scrollBy({ top: y, behavior: "smooth" }), pixels);
    await this.settleScroll();
  }
  async scrollTop() {
    await this.page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await this.settleScroll();
  }
  // A rolagem suave pode demorar a começar.
  async settleScroll(element) {
    let last = "";
    let stable = 0;
    await sleep(150);
    for (let i = 0; i < 50 && stable < 2; i++) {
      await sleep(80);
      const now = await (element
        ? element.evaluate((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)}`; })
        : this.page.evaluate(() => String(window.scrollY))).catch(() => last);
      stable = now === last ? stable + 1 : 0;
      last = now;
    }
  }

  async moveTo(x, y, duration = 700) {
    const steps = Math.max(2, Math.round((duration * this.speed) / 16));
    const { x: x0, y: y0 } = this.state;
    for (let i = 1; i <= steps; i++) {
      const k = easeInOut(i / steps);
      await this.page.mouse.move(x0 + (x - x0) * k, y0 + (y - y0) * k);
      await sleep(12);
    }
    this.state.x = x;
    this.state.y = y;
  }
  async box(element) {
    const box = await element.boundingBox();
    if (!box) throw new Error("Elemento sem posição na tela");
    await this.avoid(box);
    return box;
  }
  async avoid(box) {
    const top = box.y + box.height > CONFIG.height - 130;
    if (top === Boolean(this.state.captionTop)) return;
    this.state.captionTop = top;
    await this.call("captionTop", top);
  }
  async point(target, { hold = 900, ring = true } = {}) {
    const element = await this.scrollTo(target);
    const box = await this.box(element);
    await this.moveTo(box.x + Math.min(box.width / 2, 60), box.y + box.height / 2);
    if (ring) await this.call("ring", box);
    await this.pause(hold);
    if (ring) await this.call("ring", null);
    return element;
  }
  async ring(target, hold = 1600) {
    const element = await this.scrollTo(target);
    await this.call("ring", await this.box(element));
    await this.pause(hold);
    await this.call("ring", null);
  }
  async click(target, { ring = false, wait = true, offsetX } = {}) {
    const element = await this.scrollTo(target);
    const box = await this.box(element);
    const x = box.x + (offsetX ?? Math.min(box.width / 2, Math.max(18, box.width - 18)));
    const y = box.y + box.height / 2;
    await this.moveTo(x, y);
    if (ring) {
      await this.call("ring", box);
      await this.pause(500);
    }
    await this.pause(180);
    await this.page.mouse.down();
    await sleep(90);
    await this.page.mouse.up();
    if (ring) await this.call("ring", null);
    if (wait) await this.settle();
    return element;
  }
  async type(target, text, { delay = 38, clear = false } = {}) {
    const element = await this.click(target, { wait: false });
    if (clear) await element.evaluate((el) => { el.select?.(); });
    await this.page.keyboard.type(text, { delay: REHEARSAL ? 0 : delay });
    await this.pause(300);
    return element;
  }
  // O menu nativo do <select> não aparece na gravação.
  async choose(target, option) {
    const element = await this.click(target, { wait: false });
    await this.page.keyboard.press("Escape").catch(() => {});
    const value = await element.evaluate((select, option) => {
      const wanted = String(option).toLocaleLowerCase("pt-BR");
      const options = [...select.options];
      const text = (o) => o.textContent.trim().toLocaleLowerCase("pt-BR");
      const found = options.find((o) => o.value === option) ?? options.find((o) => text(o) === wanted) ?? options.find((o) => text(o).startsWith(wanted)) ?? options.find((o) => text(o).includes(wanted));
      return found?.value ?? null;
    }, option);
    if (value === null) throw new Error(`Opção não encontrada: ${option}`);
    await element.select(value);
    await this.pause(400);
    return element;
  }
  async field(label, { nth = 0 } = {}) {
    const handle = await this.page.evaluateHandle((label, nth) => {
      const norm = (value) => (value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
      const wanted = norm(label);
      const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const found = [];
      for (const lab of document.querySelectorAll("label")) {
        if (!norm(lab.innerText).includes(wanted)) continue;
        const control = lab.control ?? lab.querySelector("input, textarea, select");
        if (control && visible(control)) found.push(control);
      }
      for (const el of document.querySelectorAll("input, textarea, select")) {
        if ((norm(el.getAttribute("aria-label")).includes(wanted) || norm(el.placeholder).includes(wanted)) && visible(el) && !found.includes(el)) found.push(el);
      }
      return found[nth] ?? null;
    }, label, nth);
    const element = handle.asElement();
    if (!element) throw new Error(`Campo não encontrado: ${label} em ${this.page.url()}`);
    return element;
  }

  async settle({ timeout = 10000 } = {}) {
    await sleep(250);
    await this.page.waitForNetworkIdle({ idleTime: 350, timeout }).catch(() => {});
    await this.page.waitForFunction(() => Boolean(document.querySelector("h1")), { timeout }).catch(() => {});
    await sleep(200);
  }
  async goto(path) {
    await this.page.goto(path.startsWith("http") ? path : this.base + path, { waitUntil: "networkidle2", timeout: 45000 });
    await this.settle();
    await this.overlay();
  }
  async waitForText(text, timeout = 15000) {
    await this.page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
  }
  async waitForUrl(part, timeout = 15000) {
    await this.page.waitForFunction((p) => location.href.includes(p), { timeout }, part);
    await this.settle();
  }
  async text() {
    return this.page.evaluate(() => document.body.innerText);
  }
  async quietLogin(email) {
    await this.page.goto(`${this.base}/login`, { waitUntil: "networkidle2" });
    await this.page.type("#email", email);
    await this.page.type("#password", "demo123");
    await Promise.all([this.page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), this.page.click("button[type=submit]")]);
    await this.settle();
  }
  async dismissWelcome() {
    const dismiss = await this.find({ text: "Agora não", exact: true }, { timeout: 1500 }).catch(() => null);
    if (dismiss) {
      await dismiss.click();
      await this.settle();
    }
  }
  async studentId(name) {
    await this.goto("/estudantes");
    const href = await this.page.evaluate((n) => [...document.querySelectorAll("a")].find((a) => a.closest("li, article, div")?.innerText.includes(n) && /\/estudantes\/[^/?]+$/.test(a.getAttribute("href") ?? ""))?.getAttribute("href"), name);
    if (!href) throw new Error(`Estudante não encontrado: ${name}`);
    return href.split("/").pop();
  }
  async poster() {
    if (REHEARSAL || !this.posterFile) return;
    const state = { ...this.state };
    await this.page.evaluate(() => { if (window.__tut) window.__tut.host.style.display = "none"; });
    await this.page.screenshot({ path: this.posterFile, type: "jpeg", quality: 82 });
    await this.page.evaluate(() => { if (window.__tut) window.__tut.host.style.display = ""; });
    this.state = state;
  }
}

async function listLines() {
  const voice = new Voice();
  const stub = () =>
    new Proxy(function () {}, {
      get: (_, key) => (key === "then" ? undefined : key === Symbol.iterator ? function* () {} : key === Symbol.toPrimitive ? () => "x" : stub()),
      apply: () => Promise.resolve(stub()),
    });
  for (const scenario of selected) {
    const lines = [];
    const t = new Proxy({ vars: {} }, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === "then") return undefined;
        if (key === "say") return async (text) => { lines.push(text); };
        if (key === "intro" || key === "outro") return async (_card, narration) => { lines.push(...[].concat(narration)); };
        return stub();
      },
    });
    try {
      await scenario.run(t);
    } catch (error) {
      console.error(`${scenario.id}: as falas pararam em ${lines.length} (${error.message})`);
    }
    lines.forEach((text, index) => {
      const id = `${scenario.id}#${String(index).padStart(2, "0")}`;
      console.log(JSON.stringify({ id, text, spoken: spoken(text), file: join(voice.dir, `${voice.key(text)}.wav`), voice: CONFIG.voice, speech: CONFIG.speech }));
    });
  }
}

function reseed() {
  if (!env.TUTORIAL_DB) return;
  execFileSync(process.execPath, ["prisma/seed.mjs"], { cwd: ROOT, env: { ...env, DATABASE_URL: env.TUTORIAL_DB }, stdio: ["ignore", "ignore", "inherit"] });
}

const run = async () => {
  mkdirSync(CONFIG.out, { recursive: true });
  mkdirSync(CONFIG.work, { recursive: true });
  const voice = new Voice();
  const browser = await puppeteer.launch({
    executablePath: CONFIG.chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--lang=pt-BR", "--font-render-hinting=none", "--disable-extensions"],
    env: { ...env, LANG: "pt_BR.UTF-8", TZ: "America/Sao_Paulo" },
  });
  const failures = [];
  const manifestFile = join(CONFIG.out, "tutoriais.json");
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : [];
  try {
    for (const scenario of selected) {
      const started = Date.now();
      console.log(`\n▶ ${scenario.id} — ${scenario.title}${REHEARSAL ? " (ensaio)" : ""}`);
      reseed();
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({ width: CONFIG.width, height: CONFIG.height, deviceScaleFactor: CONFIG.scale });
      await page.emulateTimezone("America/Sao_Paulo");
      await page.setExtraHTTPHeaders({ "Accept-Language": "pt-BR,pt;q=0.9" });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message.slice(0, 160)));
      const t = new Tutorial(page, voice);
      const raw = join(CONFIG.work, `${scenario.id}.video.mp4`);
      t.posterFile = join(CONFIG.out, `${scenario.id}.jpg`);
      try {
        if (scenario.setup) await scenario.setup(t);
        await t.overlay();
        if (!REHEARSAL) {
          t.recorder = new Recorder(page, raw);
          await t.recorder.start();
        }
        await scenario.run(t);
        if (REHEARSAL) {
          console.log(`  ✓ ensaio ok (${((Date.now() - started) / 1000).toFixed(0)} s)`);
        } else {
          const seconds = await t.recorder.stop();
          const final = join(CONFIG.out, `${scenario.id}.mp4`);
          const wav = t.cues.length ? join(CONFIG.work, `${scenario.id}.wav`) : null;
          if (wav) mixNarration(t.cues, seconds, wav);
          mux({ ffmpeg: CONFIG.ffmpeg, video: raw, narration: wav, seconds, out: final });
          rmSync(raw, { force: true });
          const entry = { id: scenario.id, title: scenario.title, audience: scenario.audience, roles: scenario.roles, summary: scenario.summary, seconds: Math.round(seconds), video: `${scenario.id}.mp4`, poster: existsSync(t.posterFile) ? `${scenario.id}.jpg` : null };
          const index = manifest.findIndex((item) => item.id === scenario.id);
          if (index >= 0) manifest[index] = entry;
          else manifest.push(entry);
          manifest.sort((a, b) => a.id.localeCompare(b.id));
          writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
          const size = (statSync(final).size / 1024 / 1024).toFixed(1);
          console.log(`  ✓ ${final} — ${Math.floor(seconds / 60)}min${String(Math.round(seconds % 60)).padStart(2, "0")}s, ${size} MB`);
        }
        if (errors.length) console.log(`  ! erros na página: ${errors.join(" | ")}`);
      } catch (error) {
        failures.push(scenario.id);
        console.error(`  ✗ ${error.message}`);
        const shot = join(CONFIG.work, `${scenario.id}.erro.png`);
        await page.screenshot({ path: shot }).catch(() => {});
        console.error(`    captura: ${shot}`);
        if (t.recorder) await t.recorder.stop().catch(() => {});
      } finally {
        await context.close().catch(() => {});
      }
    }
  } finally {
    voice.stop();
    await browser.close();
  }
  if (failures.length) {
    console.error(`\nFalharam: ${failures.join(", ")}`);
    process.exit(1);
  }
};

if (LINES) await listLines();
else await run();
