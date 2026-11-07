# Revisão da narração dos tutoriais, antes de gravar.
#
# O Piper sorteia um pouco a pronúncia a cada vez: a mesma frase pode sair clara
# numa geração e embolada na seguinte. Para cada fala, este script gera o áudio,
# ouve com o Whisper (reconhecimento de fala, sem saber o texto esperado) e compara
# com o roteiro. Se não bater, gera de novo, até `--tentativas`. A versão mais clara
# fica no cache do gravador, que a usa na gravação.
#
#   node scripts/tutoriais/gravar.mjs --falas [roteiros] > falas.jsonl
#   python scripts/tutoriais/revisar.py falas.jsonl [--tentativas 4] [--insistir] [--refazer]
#
# Precisa de piper-tts, faster-whisper e num2words no mesmo Python, e de FFMPEG.
# Usa a placa de vídeo (CUDA) se houver; sem ela, roda no processador, mais devagar.
# Falas já revisadas (com o .json ao lado do .wav) são puladas; --insistir tenta de novo as
# que ainda divergem, e --refazer revisa todas.
# No fim, lista as falas que ainda divergem: reescreva-as ou ajuste scripts/tutoriais/fala.mjs.
import argparse
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
from num2words import num2words

sys.path.insert(0, str(Path(__file__).parent))
from tts import load, write_wav  # noqa: E402

# Grafias que o Whisper escreve de outro jeito, mas que são a mesma fala.
ALIASES = [
    (r"\bpe de efe\b", "pdf"), (r"\bce esse ve\b", "csv"), (r"\bque erre\b", "qr"), (r"\bde u a\b", "dua"),
    (r"\buord\b", "word"), (r"\binclui edu\b", "incluiedu"), (r"\be ?mail\b", "email"), (r"\bv ?libras\b", "vlibras"),
    (r"\ba e e\b", "aee"), (r"\bb n c c\b", "bncc"),
]


def words(text):
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"(\d+)º", lambda m: f" {num2words(int(m.group(1)), lang='pt_BR', to='ordinal')} ", text)
    text = re.sub(r"(\d+)", lambda m: f" {num2words(int(m.group(1)), lang='pt_BR')} ", text)
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    for pattern, replacement in ALIASES:
        text = re.sub(pattern, replacement, text)
    return text.split()


def errors(expected, heard):
    ops = SequenceMatcher(None, expected, heard, autojunk=False).get_opcodes()
    return sum(max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in ops if tag != "equal")


def whisper():
    from faster_whisper import WhisperModel

    try:
        model = WhisperModel("large-v3-turbo", device="cuda", compute_type="int8_float16")
        list(model.transcribe(np.zeros(16000, np.float32), language="pt")[0])  # o CUDA só carrega aqui
        return model, "placa de vídeo"
    except Exception:  # noqa: BLE001 — sem CUDA, vai no processador
        return WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 4), "processador"


def audio(path, ffmpeg):
    raw = subprocess.run([ffmpeg, "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def main():
    parser = argparse.ArgumentParser(description="Gera, ouve e escolhe a versão mais clara de cada fala dos tutoriais.")
    parser.add_argument("falas")
    parser.add_argument("--tentativas", type=int, default=4)
    parser.add_argument("--refazer", action="store_true", help="revisa de novo todas as falas")
    parser.add_argument("--insistir", action="store_true", help="tenta de novo só as falas que ainda divergem")
    options = parser.parse_args()
    ffmpeg = os.environ.get("FFMPEG", "ffmpeg")
    lines = [json.loads(line) for line in open(options.falas) if line.strip()]
    if not lines:
        sys.exit("Nenhuma fala. Gere a lista com: node scripts/tutoriais/gravar.mjs --falas > falas.jsonl")

    voices = {}
    model, where = whisper()
    print(f"{len(lines)} falas; Whisper no {where}", flush=True)
    started = time.time()
    pending, done, retried = [], 0, 0
    for number, line in enumerate(lines, 1):
        wav, report = Path(line["file"]), Path(line["file"]).with_suffix(".json")
        previous = json.loads(report.read_text()) if report.exists() and wav.exists() and not options.refazer else None
        if previous and not (options.insistir and previous["erros"]):
            result = previous
        else:
            key = (line["voice"], tuple(line["speech"]))
            if key not in voices:
                voices[key] = load(line["voice"], line["speech"])
            voice, config, gap = voices[key]
            wav.parent.mkdir(parents=True, exist_ok=True)
            expected = words(line["text"])
            best = previous  # com --insistir, só troca o áudio guardado por um melhor
            for attempt in range(1, options.tentativas + 1):
                candidate = wav.with_name(f"{wav.stem}.tentativa.wav")
                write_wav(voice, config, gap, line["spoken"], str(candidate))
                segments, _ = model.transcribe(audio(str(candidate), ffmpeg), language="pt", beam_size=5, temperature=0, condition_on_previous_text=False, vad_filter=False)
                heard = "".join(segment.text for segment in segments).strip()
                count = errors(expected, words(heard))
                if best is None or count < best["erros"]:
                    best = {"erros": count, "ouvido": heard, "tentativas": attempt}
                    candidate.replace(wav)
                if count == 0:
                    break
            wav.with_name(f"{wav.stem}.tentativa.wav").unlink(missing_ok=True)
            result = {**best, "tentativas": attempt}
            report.write_text(json.dumps(result, ensure_ascii=False))
            done += 1
            retried += attempt > 1
        if result["erros"]:
            pending.append((line, result))
        if number % 25 == 0:
            print(f"  {number}/{len(lines)} ({time.time() - started:.0f} s)", flush=True)

    print(f"\nRevisadas agora: {done} (geradas de novo: {retried}). Em {time.time() - started:.0f} s.")
    if not pending:
        print("Todas as falas foram entendidas como no roteiro.")
        return
    print(f"\n{len(pending)} falas ainda divergem do roteiro (melhor de {options.tentativas} tentativas):")
    for line, result in pending:
        print(f"\n{line['id']}  ({result['erros']} palavra{'s' if result['erros'] > 1 else ''})")
        print(f"  roteiro: {line['text']}")
        print(f"  ouvido : {result['ouvido']}")


if __name__ == "__main__":
    main()
