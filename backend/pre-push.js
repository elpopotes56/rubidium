import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function prepareDb() {
  console.log('🔧 Pre-push: dropping all public views to allow schema changes...');

  // Get all view names in public schema
  const views = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.views 
    WHERE table_schema = 'public'
  `;

  for (const view of views) {
    const name = view.table_name;
    await prisma.$executeRawUnsafe(`DROP VIEW IF EXISTS "public"."${name}" CASCADE`);
    console.log(`  ✅ Dropped view: ${name}`);
  }

  console.log('✅ Pre-push complete.');
}

prepareDb()
  .catch(e => {
    console.error('❌ Pre-push script failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
