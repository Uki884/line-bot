const migrations = await glob(['prisma/migrations/*/migration.sql'])

await $`mkdir -p ./.wrangler/migrations`

for (let i =0; i < migrations.length; i++) {
  const migrationName = migrations[i].replace('prisma/migrations/', '').split('/')[0]
  await $`cp ${migrations[i]} .wrangler/migrations/${migrationName}.sql`
}

await $`npx wrangler d1 migrations apply line-app`