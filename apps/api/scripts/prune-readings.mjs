import { PrismaService } from '../dist/common/prisma/prisma.service.js';
const days = Number(process.env.READINGS_RETENTION_DAYS ?? 90);
if (!Number.isFinite(days) || days < 7) throw new Error('READINGS_RETENTION_DAYS debe ser >= 7.');
const prisma = new PrismaService();
try {
  await prisma.$connect();
  const result = await prisma.fieldReading.deleteMany({ where: { measuredAt: { lt: new Date(Date.now() - days * 86400000) } } });
  console.log(`Lecturas fuera de retención eliminadas: ${result.count}.`);
} finally { await prisma.$disconnect(); }
