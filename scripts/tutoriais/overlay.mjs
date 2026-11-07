// Camada desenhada por cima da plataforma durante a gravação: cursor, clique,
// destaque do elemento, legenda e as telas de abertura e encerramento.
// Fica num shadow DOM, sem receber cliques (pointer-events: none), e não muda a
// página. É instalada de novo a cada documento, com o estado que o gravador guarda.
export function installOverlay(state) {
  if (!window.__tut) {
    const host = document.createElement("div");
    host.id = "tutorial-overlay";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        * { box-sizing: border-box; pointer-events: none; }
        :host { font-family: inherit; }
        .cursor { position: fixed; left: 0; top: 0; width: 30px; height: 30px; transform: translate(-100px, -100px); filter: drop-shadow(0 2px 3px rgba(6,36,58,.45)); }
        .ripple { position: fixed; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; border: 4px solid #ffc83d; animation: ripple .55s ease-out forwards; }
        @keyframes ripple { from { transform: scale(.6); opacity: 1; } to { transform: scale(3.6); opacity: 0; } }
        .ring { position: fixed; border: 4px solid #ffc83d; border-radius: 14px; box-shadow: 0 0 0 6px rgba(255,200,61,.28), 0 0 24px rgba(255,200,61,.55); opacity: 0; transition: opacity .25s ease, left .35s ease, top .35s ease, width .35s ease, height .35s ease; }
        .ring.on { opacity: 1; }
        .caption { position: fixed; left: 50%; bottom: 26px; transform: translate(-50%, 8px); width: max-content; max-width: min(940px, calc(100vw - 48px)); padding: 13px 26px 14px; border-radius: 16px; background: rgba(6,36,58,.93); color: #fff; font: 600 23px/1.38 inherit; font-family: inherit; text-align: center; letter-spacing: .005em; box-shadow: 0 10px 30px rgba(6,36,58,.35); opacity: 0; transition: opacity .22s ease, transform .22s ease; }
        .caption.on { opacity: 1; transform: translate(-50%, 0); }
        .caption.top { bottom: auto; top: 22px; }
        .card { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 48px; text-align: center; color: #fff; background: radial-gradient(1200px 600px at 20% 10%, #0f7cb3 0%, rgba(15,124,179,0) 60%), linear-gradient(135deg, #06243a 0%, #0b3550 45%, #0a6a9a 100%); opacity: 0; transition: opacity .45s ease; }
        .card.on { opacity: 1; }
        .card.on ~ .cursor { opacity: 0; }
        .brand { display: inline-flex; align-items: center; gap: 12px; font-size: 22px; font-weight: 700; letter-spacing: .01em; }
        .brand i { display: inline-flex; width: 44px; height: 44px; border-radius: 50%; background: #fff; color: #0a6a9a; align-items: center; justify-content: center; font-style: normal; font-size: 24px; }
        .eyebrow { padding: 8px 18px; border-radius: 999px; background: rgba(255,255,255,.14); font-size: 19px; font-weight: 600; }
        .title { max-width: 1000px; font-size: 62px; line-height: 1.08; font-weight: 800; letter-spacing: -.015em; }
        .subtitle { max-width: 860px; font-size: 26px; line-height: 1.4; color: #d3e9f5; }
        .stripe { display: flex; gap: 0; width: 180px; height: 8px; border-radius: 99px; overflow: hidden; }
        .stripe span { flex: 1; } .stripe span:nth-child(1) { background: #4fb3e3; } .stripe span:nth-child(2) { background: #ffc83d; } .stripe span:nth-child(3) { background: #b5d334; }
      </style>
      <div class="card" part="card"><div class="brand"><i><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"/><path d="M5 21h14"/></svg></i>IncluiEdu</div><div class="eyebrow"></div><div class="title"></div><div class="stripe"><span></span><span></span><span></span></div><div class="subtitle"></div></div>
      <div class="ring"></div>
      <div class="caption"></div>
      <svg class="cursor" viewBox="0 0 30 30"><path d="M5 3 L5 24 L10.5 18.8 L14.2 27 L18 25.3 L14.4 17.4 L21.8 17.2 Z" fill="#fff" stroke="#0b3550" stroke-width="2" stroke-linejoin="round"/></svg>`;
    const $ = (selector) => root.querySelector(selector);
    const api = {
      host,
      x: -100,
      y: -100,
      cursor(x, y) {
        api.x = x;
        api.y = y;
        $(".cursor").style.transform = `translate(${x - 5}px, ${y - 3}px)`;
      },
      caption(text) {
        const element = $(".caption");
        if (text) {
          element.textContent = text;
          element.classList.add("on");
        } else element.classList.remove("on");
      },
      // Legenda no alto quando o alvo está no pé da tela (barra de salvar, por exemplo).
      captionTop(top) {
        $(".caption").classList.toggle("top", Boolean(top));
      },
      ring(rect) {
        const element = $(".ring");
        if (!rect) return element.classList.remove("on");
        const pad = 8;
        Object.assign(element.style, { left: `${rect.x - pad}px`, top: `${rect.y - pad}px`, width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px` });
        element.classList.add("on");
      },
      card(card) {
        const element = $(".card");
        if (!card) return element.classList.remove("on");
        $(".eyebrow").textContent = card.eyebrow ?? "";
        $(".eyebrow").style.display = card.eyebrow ? "" : "none";
        $(".title").textContent = card.title ?? "";
        $(".subtitle").textContent = card.subtitle ?? "";
        element.classList.add("on");
      },
      ripple(x, y) {
        const element = document.createElement("div");
        element.className = "ripple";
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        root.appendChild(element);
        setTimeout(() => element.remove(), 700);
      },
    };
    window.addEventListener("mousemove", (event) => api.cursor(event.clientX, event.clientY), true);
    window.addEventListener("mousedown", (event) => api.ripple(event.clientX, event.clientY), true);
    window.__tut = api;
  }
  const api = window.__tut;
  if (!api.host.isConnected) document.body.appendChild(api.host);
  if (state) {
    api.cursor(state.x, state.y);
    api.captionTop(state.captionTop);
    api.caption(state.caption);
    if (state.card) {
      // Sem transição ao voltar para um documento novo com a tela já aberta.
      const card = api.host.shadowRoot.querySelector(".card");
      card.style.transition = "none";
      api.card(state.card);
      requestAnimationFrame(() => { card.style.transition = ""; });
    } else api.card(null);
  }
  return true;
}
