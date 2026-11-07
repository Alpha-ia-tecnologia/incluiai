import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

// Conexões de saída (IA, e-mail) mais tolerantes a rede lenta. O Node tenta
// IPv6 e IPv4 em paralelo e desiste de cada endereço em 250 ms. Em rede de
// escola, com IPv6 sem rota e IPv4 lento, nenhuma tentativa abre a tempo e a
// chamada à IA falha com "Connection error" (ETIMEDOUT). Com 2,5 s por
// tentativa, a conexão pelo IPv4 abre. Chamado uma vez, ao subir o servidor.
export function tolerateSlowNetwork() {
  setDefaultAutoSelectFamilyAttemptTimeout(2500);
}
