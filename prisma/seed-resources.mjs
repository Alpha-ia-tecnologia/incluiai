import { PrismaClient } from "@prisma/client";
import { RESOURCE_CATALOG } from "./resource-catalog.mjs";

const prisma = new PrismaClient();

async function main() {
  for (const entry of RESOURCE_CATALOG) {
    const { activities, ...resourceData } = entry;
    let resource = await prisma.resource.findFirst({ where: { title: entry.title } });

    if (resource) {
      resource = await prisma.resource.update({
        where: { id: resource.id },
        data: {
          description: resourceData.description,
          stage: resourceData.stage,
          skillArea: resourceData.skillArea,
          accessibilityNeed: resourceData.accessibilityNeed,
          resourceType: resourceData.resourceType,
          complexity: resourceData.complexity,
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
