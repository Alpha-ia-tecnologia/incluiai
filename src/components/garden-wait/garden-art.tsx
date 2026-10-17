import { memo } from "react";
import type { ArtState } from "@/lib/assistant/garden-scenes";
import styles from "./garden-wait.module.css";

// Desenho do canteiro (viewBox 96×96): traço preto sobre círculo lilás, como
// os personagens. Todas as partes ficam sempre no DOM e mudam por atributos
// data-*; as transições ficam no CSS e não se repetem ao reabrir o painel.
// Elementos com atributo transform nunca são animados: anima-se o filho.

const SPROUT = "M52 47.07V42a8 8 0 0 1 8-8h3a1 1 0 0 1 1 1v3a8 8 0 0 1-8 8 8 8 0 0 0-8 8c0 4 2 6 2 10a10 10 0 0 1-2 6";
const FLAG = "M52 47.07V42a8 8 0 0 1 8-8h3a1 1 0 0 1 1 1v3a8 8 0 0 1-8 8 8 8 0 0 0-4 1.07Z";
const LENS = "M32 46a10 10 0 0 1 16 8 10 10 0 0 1-16-8Z";
const LEAF = "M0 0a8 8 0 0 1 12 0 8 8 0 0 1-12 0Z";
const STEM = "M48 54C48.6 46 46.8 36 48 24";
const PETAL = "M0 0a5.5 5.5 0 0 1 9 0 5.5 5.5 0 0 1-9 0Z";
const SMALL_PETAL = "M0 0a3.85 3.85 0 0 1 6.3 0 3.85 3.85 0 0 1-6.3 0Z";
const SEPAL = "M0 0a4 4 0 0 1 6 0 4 4 0 0 1-6 0Z";
const CROWN = "M48 12C52.5 15.5 52.5 21.5 48 24 43.5 21.5 43.5 15.5 48 12Z";
const BUD = "M0-8C3.4-5.5 3.4-1.8 0 0-3.4-1.8-3.4-5.5 0-8Z";
const BRANCHES = "M48 28C45.5 25 42.5 23.2 39.5 22.5M48 28V19.5M48 28C50.5 25 53.5 23.2 56.5 22.5";
const STONE = "M-4.5 1.4C-5-1.6-2.4-3.3.6-3.3 3.7-3.3 5.3-1.2 4.7 1.4 4.2 3.2 2 3.6 0 3.6-2.6 3.6-4.2 3.2-4.5 1.4Z";
const TENDRIL = "M47.2 58C42 55.5 36 53.4 30.4 54.2c-2.2.4-2.5 3.2-.4 3.6 1.7.3 2.5-1.5 1.3-2.4";
const CLOUD = "M20 33.5a4.5 4.5 0 0 1 4.6-4.4 6 6 0 0 1 11.2 1.4 3.6 3.6 0 0 1 .4 7.1H23.6a3.8 3.8 0 0 1-3.6-4.1Z";
const DROP = "M0-3c1.4 1.6 1.8 2.6 1.8 3.4a1.8 1.8 0 0 1-3.6 0c0-.8.4-1.8 1.8-3.4Z";
const POT_LEAF = "M0 0a3.4 3.4 0 0 1 5 0 3.4 3.4 0 0 1-5 0Z";
const ROOTS = [
  { d: "M48 70C46.5 75 42 77.5 37 80", x: 37, y: 80 },
  { d: "M48 70C49 75 47.5 79.5 49 84", x: 49, y: 84 },
  { d: "M48 70C51 74 55.5 76.5 60 78.5", x: 60, y: 78.5 },
];
const STONE_SLOTS = [{ x: 29, y: 79 }, { x: 67, y: 82 }];
const RUNGS = [{ agent: "analista", y: 62 }, { agent: "planejador", y: 53 }, { agent: "revisor", y: 44 }];
const BUDS = [
  { context: "sala_comum", x: 39.5, y: 22.5, r: -50, fx: 37, fy: 20.5 },
  { context: "aee", x: 48, y: 19.5, r: 0, fx: 48, fy: 16.5 },
  { context: "casa", x: 56.5, y: 22.5, r: 50, fx: 59, fy: 20.5 },
];
const PETAL_ANGLES = [-90, -18, 54, 126, 198];

export const GardenArt = memo(function GardenArt({ clipId, grown, ties, stem, roots, stones, trellis, rungs, buds, side, crown, stake, cloud, sun }: ArtState & { clipId: string }) {
  return (
    <svg viewBox="0 0 96 96" className={styles.art} strokeWidth={2} aria-hidden="true" focusable="false">
      <defs><clipPath id={clipId}><circle cx="48" cy="50" r="40" /></clipPath></defs>
      <g className={styles.sun} data-part="sol" data-on={sun !== null}>
        <path className={styles.sunTrack} d="M9.03 27.5A45 45 0 0 1 86.97 27.5" strokeWidth={1.6} />
        <g className={styles.sunHand} style={{ transform: `rotate(${sun ?? -60}deg)` }}><circle className={styles.sunDisc} cx="48" cy="5" r="4" strokeWidth={1.6} /></g>
      </g>
      <g clipPath={`url(#${clipId})`}>
        <circle className={styles.sky} cx="48" cy="50" r="40" />
        <rect className={styles.soil} x="0" y="70" width="96" height="26" />
        <g className={styles.roots}>
          {ROOTS.map((root, slot) => {
            const mark = roots.find((item) => item.slot === slot);
            return (
              <g key={slot} data-part="raiz" data-slot={slot} data-estado={mark?.state ?? "nenhum"}>
                <path className={`${styles.ink} ${styles.rootLine}`} d={root.d} pathLength={1} strokeWidth={1.8} data-on={Boolean(mark)} />
                <circle className={styles.pebble} cx={root.x} cy={root.y} r="3.6" strokeWidth={1.4} data-palette={mark?.palette ?? "sky"} data-estado={mark?.state ?? "nenhum"} />
                <g transform={`translate(${root.x} ${root.y})`}><path className={styles.stone} d={STONE} strokeWidth={1.4} data-on={mark?.state === "pedra"} /></g>
              </g>
            );
          })}
        </g>
        {STONE_SLOTS.map((slot, index) => (
          <g key={index} transform={`translate(${slot.x} ${slot.y})`}><path className={styles.stone} d={STONE} strokeWidth={1.4} data-part="pedra" data-on={index < stones} /></g>
        ))}
        <g className={styles.trellis} data-part="trelica" data-on={trellis}>
          <path className={styles.ink} d="M17 72V37M27 72V37" />
          {RUNGS.map((rung, index) => (
            <path key={rung.agent} className={styles.rung} d={`M13.5 ${rung.y}H30.5`} data-part="degrau" data-agent={rung.agent} data-estado={rungs[index]} />
          ))}
          <path className={styles.ink} d={TENDRIL} strokeWidth={1.6} />
        </g>
        <g className={styles.stake} data-part="tutor" data-off={!stake}><rect x="42.6" y="38" width="4.2" height="38" rx="2.1" strokeWidth={1.6} /></g>
        <ellipse className={styles.seed} data-part="semente" cx="48" cy="68.6" rx="3.4" ry="2.4" strokeWidth={1.4} />
        <g className={styles.breath} data-part="planta">
          <g className={styles.perk}>
            <g className={styles.entry}>
              <path className={`${styles.ink} ${styles.stem}`} d={STEM} pathLength={1} data-stem={stem} />
              <g transform="translate(47.6 41) rotate(202)"><path className={`${styles.paper} ${styles.leaf}`} d={LEAF} strokeWidth={1.8} data-part="folha" data-on={grown >= 1} /></g>
              <g transform="translate(48.3 33) rotate(-24)"><path className={`${styles.paper} ${styles.leaf}`} d={LEAF} strokeWidth={1.8} data-part="folha" data-on={grown >= 2} /></g>
              <path className={styles.paper} d={LENS} />
              <path className={styles.flagFill} d={FLAG} />
              <path className={styles.ink} d={SPROUT} />
              <g className={styles.buds} data-part="botoes" data-on={buds !== null} data-revisao={buds?.review ?? false}>
                <path className={styles.ink} d={BRANCHES} strokeWidth={1.8} />
                {BUDS.map((bud, index) => {
                  const state = buds?.states[index] ?? "fechado";
                  return (
                    <g key={bud.context} data-part="botao" data-context={bud.context} data-estado={state}>
                      <g transform={`translate(${bud.x} ${bud.y}) rotate(${bud.r})`}><path className={styles.budShape} d={BUD} strokeWidth={1.6} data-tone={bud.context} data-estado={state} /></g>
                      <g transform={`translate(${bud.fx} ${bud.fy})`}>
                        <g className={styles.budFlower} data-estado={state}>
                          {PETAL_ANGLES.map((angle) => <path key={angle} className={styles.budPetal} d={SMALL_PETAL} transform={`rotate(${angle})`} strokeWidth={1.4} data-tone={bud.context} />)}
                          <circle className={styles.budCenter} r="2" data-tone={bud.context} />
                        </g>
                      </g>
                    </g>
                  );
                })}
              </g>
              <g className={styles.crown} data-part="coroa" data-on={crown === "botao"}>
                <g transform="translate(48 24) rotate(-155)"><path className={styles.paper} d={SEPAL} strokeWidth={1.4} /></g>
                <g transform="translate(48 24) rotate(-25)"><path className={styles.paper} d={SEPAL} strokeWidth={1.4} /></g>
                <path className={styles.crownBud} d={CROWN} strokeWidth={1.6} />
              </g>
              <g transform="translate(48 20)">
                <g className={styles.flower} data-part="flor" data-on={crown === "flor"}>
                  {PETAL_ANGLES.map((angle) => (
                    <g key={angle} transform={`rotate(${angle})`}><path className={`${styles.paper} ${styles.petal}`} d={PETAL} strokeWidth={1.6} /></g>
                  ))}
                  <circle className={styles.flowerCenter} r="3" strokeWidth={1.3} />
                </g>
              </g>
            </g>
          </g>
        </g>
        <rect className={styles.tie} data-part="amarrilho" data-off={ties < 2} x="41.4" y="62.1" width="10.2" height="3.8" rx="1.9" strokeWidth={1.2} />
        <rect className={styles.tie} data-part="amarrilho" data-off={ties < 1} x="41.4" y="54.1" width="10.2" height="3.8" rx="1.9" strokeWidth={1.2} />
        <g transform="rotate(6 73 57)">
          <g className={styles.sheet} data-part="folha-papel" data-on={side === "folha"}>
            <rect className={styles.paper} x="65" y="47" width="16" height="20" rx="1.8" strokeWidth={1.6} />
            {[67.2, 71.5, 75.8].map((x) => <rect key={x} className={styles.frame} x={x} y="50" width="3.3" height="3.3" rx=".6" strokeWidth={1} />)}
            <path className={styles.textLine} d="M67.6 57.6H78.4M67.6 61.6H75" strokeWidth={1.4} />
          </g>
        </g>
        <g className={styles.pot} data-part="vasinho" data-on={side === "vasinho"}>
          <path className={styles.potBody} d="M63 58.5H79V61.5H63Z" strokeWidth={1.6} />
          <path className={styles.potBody} d="M64.2 61.5H77.8L75.8 70H66.2Z" strokeWidth={1.6} />
          <path className={styles.ink} d="M71 58.5V53.5M76.5 59.5L79.5 52" strokeWidth={1.4} />
          <g transform="translate(71 54) rotate(-35)"><path className={styles.paper} d={POT_LEAF} strokeWidth={1.3} /></g>
          <g transform="translate(71 54) rotate(215)"><path className={styles.paper} d={POT_LEAF} strokeWidth={1.3} /></g>
          <g transform="rotate(8 80.5 48.5)">
            <rect className={styles.paper} x="75.5" y="44.5" width="10" height="8" rx="1.6" strokeWidth={1.4} />
            <rect className={styles.checkbox} data-part="caixa" x="77.4" y="46.4" width="4.2" height="4.2" rx=".8" strokeWidth={1.2} />
          </g>
        </g>
      </g>
      <path className={styles.ink} d="M13.4 70H82.6" />
      <path className={`${styles.paper} ${styles.cloud}`} d={CLOUD} strokeWidth={1.6} data-part="nuvem" data-on={cloud} />
      <g transform="rotate(-18 77 24)">
        <g className={styles.canTilt} data-part="regador">
          <path className={styles.canBody} d="M71 18h12v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2Z" strokeWidth={1.6} />
          <path className={styles.ink} d="M83 20.5a3.5 3.5 0 0 1 0 6" strokeWidth={1.6} />
          <path className={styles.ink} d="M71 22.5L64 18" />
        </g>
      </g>
      <g className={styles.drops}>
        {[[60, 28], [57.5, 32], [61.5, 34.5]].map(([x, y]) => (
          <g key={x} transform={`translate(${x} ${y})`}><path className={styles.drop} d={DROP} strokeWidth={1.2} /></g>
        ))}
      </g>
    </svg>
  );
});
