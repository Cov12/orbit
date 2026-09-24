/**
 * Migration: consolidate the separate "Media" and "Documents" sidebar entries
 * into a single "Files" entry (#24). Idempotent — safe to re-run.
 *
 * The sidebar is DB-driven and seeded only at sub-account creation (no
 * reconcile), so existing sub-accounts keep the two legacy entries until this
 * runs. New sub-accounts already seed a single "Files" entry.
 *
 * Run with: npx tsx scripts/migrate-files-sidebar.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const subaccounts = await db.subAccount.findMany({
    include: { SidebarOption: true },
  })

  console.log(`Found ${subaccounts.length} subaccounts`)

  let updated = 0

  for (const sub of subaccounts) {
    const legacy = sub.SidebarOption.filter(
      o => o.name === 'Media' || o.name === 'Documents'
    )
    const hasFiles = sub.SidebarOption.some(o => o.name === 'Files')

    if (legacy.length === 0 && hasFiles) {
      console.log(`  ✓ ${sub.name} — already consolidated`)
      continue
    }

    if (!hasFiles) {
      await db.subAccountSidebarOption.create({
        data: {
          name: 'Files',
          icon: 'database',
          link: `/subaccount/${sub.id}/files`,
          subAccountId: sub.id,
        },
      })
      console.log(`  + ${sub.name} — added Files`)
    }

    if (legacy.length) {
      await db.subAccountSidebarOption.deleteMany({
        where: { id: { in: legacy.map(o => o.id) } },
      })
      console.log(
        `  - ${sub.name} — removed ${legacy.map(o => o.name).join(', ')}`
      )
    }

    updated++
  }

  console.log(`\nDone! Updated ${updated} subaccounts.`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
