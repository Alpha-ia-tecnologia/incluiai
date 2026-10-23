import { PrismaClient } from "@prisma/client";
import { DEMO_RESOURCE_USAGE, RESOURCE_CATALOG } from "./resource-catalog.mjs";

const prisma = new PrismaClient();

// Títulos de versões anteriores do catálogo (o recurso é o mesmo, com o texto revisto).
const RENAMED = { "Chamada sem sino: experiência da EMEF M. Firmina": "Transições sem sino: avisos visuais" };

async function main() {
  for (const [before, after] of Object.entries(RENAMED)) {
    if (await prisma.resource.findFirst({ where: { title: after }, select: { id: true } })) continue;
    await prisma.resource.updateMany({ where: { title: before }, data: { title: after } });
  }

  for (const entry of RESOURCE_CATALOG) {
    const { activities, ...resourceData } = entry;
    let resource = await prisma.resource.findFirst({ where: { title: entry.title } });

    if (resource) {
      // Versões anteriores gravavam o uso da demonstração como se fosse real; quem
      // ainda está exatamente nesses números nunca foi aplicado na plataforma.
      const [demoUsed, demoPositive] = DEMO_RESOURCE_USAGE[entry.title] ?? [];
      const demoNumbers = resource.timesUsed === demoUsed && resource.positiveOutcomes === demoPositive;
      resource = await prisma.resource.update({
        where: { id: resource.id },
        data: {
          description: resourceData.description,
          stage: resourceData.stage,
          skillArea: resourceData.skillArea,
          accessibilityNeed: resourceData.accessibilityNeed,
          resourceType: resourceData.resourceType,
          complexity: resourceData.complexity,
          ...(demoNumbers ? { timesUsed: 0, positiveOutcomes: 0 } : {}),
        },
      });
    } else {
      resource = await prisma.resource.create({ data: resourceData });
    }

    for (const [position, resourceActivity] of activities.entries()) {
      await prisma.resourceActivity.upsert({
        where: {
          resourceId_title: {
            resourceId: resource.id,
            title: resourceActivity.title,
          },
        },
        create: { resourceId: resource.id, position, ...resourceActivity },
        update: { position, ...resourceActivity },
      });
    }
  }
}

main()
  .then(() => console.log("Banco de recursos e atividades atualizado."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
