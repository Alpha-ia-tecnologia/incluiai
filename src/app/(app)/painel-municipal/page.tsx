import { redirect } from "next/navigation";

// O painel municipal passou a fazer parte do Painel de indicadores, que
// mostra a rede inteira ou uma escola. O endereço antigo continua válido.
export default function MunicipalDashboard() {
  redirect("/painel");
}
