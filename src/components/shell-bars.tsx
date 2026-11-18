"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isFormField, isStuckAtBottom, keyboardInset, nextTopBar, type TopBar } from "@/lib/shell-bars";

// Celular e tablet: a barra de cima some ao rolar para baixo e volta ao rolar
// para cima; com um formulário em uso, a barra de salvar fica no lugar da
// navegação de baixo. Tudo vira atributos no <html>, e o CSS (globals.css,
// "Moldura") decide o que cada largura faz com eles.
const COMPACT = "(max-width: 1023px)";
const FLAGS = ["data-topbar-hidden", "data-scrolled", "data-form-mode", "data-save-bar-stuck", "data-keyboard"] as const;
const VARS = ["--keyboard-inset", "--topbar-bottom", "--save-bar-right"] as const;

function inUse(element: Element | null) {
  if (!(element instanceof HTMLElement) || !element.closest("main form")) return false;
  return isFormField(element.tagName, element instanceof HTMLInputElement ? element.type : "");
}

export function ShellBars() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const compact = window.matchMedia(COMPACT);
    const header = document.querySelector<HTMLElement>(".shell-header");
    let bar: TopBar = { hidden: false, anchor: window.scrollY };
    let frame = 0;
    const values = new Map<(typeof VARS)[number], number>();
    const setVar = (name: (typeof VARS)[number], value: number) => {
      if (values.get(name) === value) return;
      values.set(name, value);
      root.style.setProperty(name, `${value}px`);
    };

    const flag = (name: (typeof FLAGS)[number], on: boolean) => {
      if (root.hasAttribute(name) !== on) root.toggleAttribute(name, on);
    };

    const update = () => {
      frame = 0;
      const height = root.clientHeight;
      const y = Math.min(Math.max(window.scrollY, 0), Math.max(root.scrollHeight - height, 0));
      // Com o foco do teclado, um menu aberto ou o assistente aberto, a barra fica.
      const engaged = Boolean(header?.querySelector(":focus-visible, details[open], [aria-expanded='true']"));
      bar = compact.matches && !engaged ? nextTopBar(bar, y) : { hidden: false, anchor: y };
      flag("data-topbar-hidden", bar.hidden);
      flag("data-scrolled", y > 8);

      const typing = inUse(document.activeElement);
      let stuck: DOMRect | null = null;
      for (const saveBar of document.querySelectorAll<HTMLElement>("main .save-bar")) {
        // Fechada num <details>, a barra não aparece (checkVisibility); sem ele, offsetParent.
        const shown = typeof saveBar.checkVisibility === "function" ? saveBar.checkVisibility() : saveBar.offsetParent !== null;
        const rect = saveBar.getBoundingClientRect();
        const now = shown && rect.height > 0 && rect.top < height && isStuckAtBottom(rect.bottom, height, parseFloat(getComputedStyle(saveBar).bottom) || 0);
        if (saveBar.hasAttribute("data-stuck") !== now) saveBar.toggleAttribute("data-stuck", now);
        if (now) stuck = rect;
      }
      flag("data-form-mode", typing || Boolean(stuck));
      flag("data-save-bar-stuck", Boolean(stuck));
      // O botão do VLibras acompanha a ponta direita da barra de salvar presa.
      if (stuck) setVar("--save-bar-right", Math.round(root.clientWidth - stuck.right));

      const view = window.visualViewport;
      const inset = typing && view ? keyboardInset({ layoutHeight: height, visualHeight: view.height, visualTop: view.offsetTop }) : 0;
      setVar("--keyboard-inset", inset);
      flag("data-keyboard", inset > 0);
      setVar("--topbar-bottom", Math.round(Math.max(header?.getBoundingClientRect().bottom ?? 0, 0)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    const view = window.visualViewport;
    // A página muda de lugar sem rolagem: cresce, troca de conteúdo e os cartões
    // entram subindo 8 px (animação "rise").
    const resize = new ResizeObserver(schedule);
    resize.observe(document.body);
    const content = document.querySelector("main");
    const changes = new MutationObserver(schedule);
    if (content) changes.observe(content, { childList: true, subtree: true });
    document.addEventListener("animationend", schedule, true);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    view?.addEventListener("resize", schedule);
    view?.addEventListener("scroll", schedule);
    compact.addEventListener("change", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    document.addEventListener("toggle", schedule, true);
    document.addEventListener("click", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      changes.disconnect();
      document.removeEventListener("animationend", schedule, true);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      view?.removeEventListener("resize", schedule);
      view?.removeEventListener("scroll", schedule);
      compact.removeEventListener("change", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      document.removeEventListener("toggle", schedule, true);
      document.removeEventListener("click", schedule, true);
      for (const name of FLAGS) root.removeAttribute(name);
      for (const name of VARS) root.style.removeProperty(name);
    };
  }, [pathname]);

  return null;
}
