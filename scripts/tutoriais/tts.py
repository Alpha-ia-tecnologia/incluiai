# Narração dos tutoriais com o Piper (voz neural que roda no próprio computador).
# Lê uma linha JSON por pedido {"text": "...", "out": "/caminho.wav"} e responde
# {"ok": true, "seconds": 3.42}. Nada sai da máquina.
#
#   python tts.py <voz.onnx> [length_scale] [noise_scale] [noise_w_scale] [pausa_s]
#
# O Piper fala cada frase separada e, sozinho, emenda uma na outra sem respiro:
# a pausa (em segundos) entra entre as frases de uma mesma fala.
# O texto pode trazer fonemas crus entre [[ ]], para palavras que a voz lê mal.
import json
import sys
import wave

from piper import PiperVoice, SynthesisConfig


def load(path, speech):
    """Voz e ajustes: speech = [length_scale, noise_scale, noise_w_scale, pausa_s]."""
    values = [float(value) for value in speech] + [1.0, 0.667, 0.8, 0.0][len(speech):]
    config = SynthesisConfig(length_scale=values[0], noise_scale=values[1], noise_w_scale=values[2])
    return PiperVoice.load(path), config, values[3]


def write_wav(voice, config, gap, text, path):
    """Grava a fala em `path` e devolve a duração em segundos."""
    frames = 0
    with wave.open(path, "wb") as wav:
        for index, chunk in enumerate(voice.synthesize(text, syn_config=config)):
            if index == 0:
                wav.setframerate(chunk.sample_rate)
                wav.setsampwidth(chunk.sample_width)
                wav.setnchannels(chunk.sample_channels)
            elif gap:
                silence = int(chunk.sample_rate * gap)
                wav.writeframes(b"\0\0" * silence)
                frames += silence
            wav.writeframes(chunk.audio_int16_bytes)
            frames += len(chunk.audio_int16_bytes) // 2
        rate = wav.getframerate()
    return frames / rate


if __name__ == "__main__":
    voice, config, gap = load(sys.argv[1], sys.argv[2:6])
    print(json.dumps({"ready": True, "rate": voice.config.sample_rate}), flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request = json.loads(line)
        try:
            seconds = write_wav(voice, config, gap, request["text"], request["out"])
            print(json.dumps({"ok": True, "seconds": seconds}), flush=True)
        except Exception as error:  # noqa: BLE001 — o gravador mostra o erro
            print(json.dumps({"ok": False, "error": str(error)}), flush=True)
