// Testes do logo (tipo pelos bytes e SVG seguro): node --test src/lib/branding/logo-core.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffLogo, svgProblem } from "./logo-core.ts";

const bytes = (text) => new TextEncoder().encode(text);
const svg = (body, attributes = "") => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"${attributes}>${body}</svg>`;

test("tipo vem dos bytes, não do nome nem do navegador", () => {
  assert.equal(sniffLogo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "image/png");
  assert.equal(sniffLogo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0])), "image/jpeg");
  assert.equal(sniffLogo(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])), "image/webp");
  assert.equal(sniffLogo(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45])), null, "RIFF de áudio não é WebP");
  assert.equal(sniffLogo(bytes(svg(""))), "image/svg+xml");
  assert.equal(sniffLogo(bytes(`﻿<?xml version="1.0" encoding="UTF-8"?>\n<!-- logo -->\n${svg("")}`)), "image/svg+xml");
  assert.equal(sniffLogo(bytes("<html><body>oi</body></html>")), null);
  assert.equal(sniffLogo(bytes("%PDF-1.7")), null);
  assert.equal(sniffLogo(bytes("texto <svg> no meio")), null);
  assert.equal(sniffLogo(new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x20, 0xff, 0xfe])), null, "UTF-8 inválido");
});

test("SVG simples passa: gradiente, uso interno, imagem embutida, estilo interno", () => {
  const good = [
    svg('<rect width="10" height="10" fill="#1f6f43"/>'),
    svg('<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect fill="url(#g)" width="10" height="10"/>'),
    svg('<defs><path id="p" d="M0 0h5v5z"/></defs><use href="#p"/><use xlink:href="#p"/>'),
    svg('<image width="10" height="10" href="data:image/png;base64,iVBORw0KGgo="/>'),
    svg('<style>.a{fill:url( "#g" );stroke:#000}</style><g class="a"><text x="1" y="8">Prefeitura de Londrina</text></g>'),
    `<?xml version="1.0"?>\n<!-- Gerado pelo Inkscape -->\n${svg('<g id="layer1" style="display:inline"><circle cx="5" cy="5" r="4"/></g>', ' version="1.1" width="10mm"')}`,
  ];
  for (const sample of good) assert.equal(svgProblem(sample), null, sample);
});

test("SVG com script, evento, link externo ou DTD é recusado, com texto para o formulário", () => {
  const bad = [
    svg('<script>alert(1)</script>'),
    svg('<SCRIPT>alert(1)</SCRIPT>'),
    svg('<svg:script xmlns:svg="http://www.w3.org/2000/svg">alert(1)</svg:script>'),
    svg("", ' onload="alert(1)"'),
    '<svg/onload=alert(1)>',
    svg('<rect width="10" height="10" ONCLICK = "x()"/>'),
    svg('<a href="javascript:alert(1)"><rect width="10" height="10"/></a>'),
    svg('<a xlink:href="jav&#x61;script:alert(1)"><rect width="10" height="10"/></a>'),
    svg('<a href="java&#9;script:alert(1)"><rect width="10" height="10"/></a>'),
    svg('<a href="java\tscript:alert(1)"><rect width="10" height="10"/></a>'),
    svg('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">oi</div></foreignObject>'),
    `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]>${svg("&x;")}`,
    `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">${svg("")}`,
    svg('<image href="https://exemplo.com/a.png" width="10" height="10"/>'),
    svg('<image xlink:href="//exemplo.com/a.png"/>'),
    svg('<use href="outro.svg#p"/>'),
    svg('<image href="file:///etc/passwd"/>'),
    svg('<image href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/>'),
    svg('<rect fill="url(https://exemplo.com/g.svg#g)"/>'),
    svg("<style>@import url(#a);</style>"),
    svg("<style>.a{fill:url(//exemplo.com/x)}</style>"),
    svg("<style>.a{fill:url(#a</style>"),
    `<?xml-stylesheet href="#s"?>${svg("")}`,
    svg('<animate attributeName="href" values="javascript:alert(1)"/>'),
    svg('<set attributeName="xlink:href" to="#ok"/>'),
    svg('<iframe src="https://exemplo.com"></iframe>'),
  ];
  for (const sample of bad) {
    const problem = svgProblem(sample);
    assert.ok(problem, sample);
    assert.match(problem, /^O logo em SVG .+\. Exporte de novo como SVG simples ou envie em PNG\.$/);
  }
});
