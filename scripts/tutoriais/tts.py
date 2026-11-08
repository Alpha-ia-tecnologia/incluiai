# Narração dos tutoriais com a Kokoro (voz neural aberta, Apache 2.0, que roda no
# próprio computador; usa a placa de vídeo se houver). Nada sai da máquina.
#
#   python tts.py [voz] [velocidade]      voz: pf_dora (padrão); velocidade: 1 = normal
#
# Lê uma linha JSON por pedido {"text": "...", "out": "/caminho.wav"} e responde
# {"ok": true, "seconds": 3.42}. O texto pode trazer a pronúncia de uma palavra no
# formato da Kokoro, [palavra](/fonemas/), para as que a voz lê mal.
import json
import sys
import wave

import numpy as np

RATE = 24000
PEAK = 0.89  # -1 dBFS: todas as falas no mesmo volume


def load(voice="pf_dora", speed="1"):
    """A voz pronta para falar: (pipeline, voz, velocidade)."""
    import torch
    from kokoro import KPipeline

    device = "cuda" if torch.cuda.is_available() else "cpu"
    pipeline = KPipeline(lang_code="p", repo_id="hexgrad/Kokoro-82M", device=device)
    return pipeline, voice, float(speed)


def write_wav(engine, text, path):
    """Grava a fala em `path` (WAV 24 kHz mono) e devolve a duração em segundos."""
    pipeline, voice, speed = engine
    parts = [np.asarray(audio.cpu() if hasattr(audio, "cpu") else audio, dtype=np.float32) for _, _, audio in pipeline(text, voice=voice, speed=speed) if audio is not None]
    audio = np.concatenate(parts) if parts else np.zeros(RATE // 10, np.float32)
    peak = float(np.max(np.abs(audio))) or 1.0
    pcm = (np.clip(audio * (PEAK / peak), -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    return len(pcm) / RATE


if __name__ == "__main__":
    # As bibliotecas escrevem avisos na saída padrão: as respostas vão por um canal só delas.
    answer, sys.stdout = sys.stdout, sys.stderr
    engine = load(*sys.argv[1:3])
    print(json.dumps({"ready": True, "rate": RATE}), file=answer, flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request = json.loads(line)
        try:
            seconds = write_wav(engine, request["text"], request["out"])
            print(json.dumps({"ok": True, "seconds": seconds}), file=answer, flush=True)
        except Exception as error:  # noqa: BLE001 — o gravador mostra o erro
            print(json.dumps({"ok": False, "error": str(error)}), file=answer, flush=True)
