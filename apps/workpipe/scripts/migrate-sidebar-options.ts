/**
 * Migration Script: Add Calendar, Services, Documents sidebar entries
 * to existing subaccounts that were created before these options existed.
 *
 * Run with: npx tsx scripts/migrate-sidebar-options.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const NEW_OPTIONS = [
  { name: 'Calendar', icon: 'calendar' as const, linkSuffix: '/calendar' },
  { name: 'Services', icon: 'clipboardIcon' as const, linkSuffix: '/services' },
  { name: 'Documents', icon: 'database' as const, linkSuffix: '/documents' },
]

async function main() {
  const subaccounts = await db.subAccount.findMany({
    include: { SidebarOption: true },
  })

  console.log(`Found ${subaccounts.length} subaccounts`)

  let totalAdded = 0

  for (const sub of subaccounts) {
    const existingNames = sub.SidebarOption.map(o => o.name)
    const missing = NEW_OPTIONS.filter(o => !existingNames.includes(o.name))

    if (missing.length === 0) {
      console.log(`  ✓ ${sub.name} — already has all options`)
      continue
    }

    for (const opt of missing) {
      await db.subAccountSidebarOption.create({
        data: {
          name: opt.name,
          icon: opt.icon,
          link: `/subaccount/${sub.id}${opt.linkSuffix}`,
          subAccountId: sub.id,
        },
      })
      console.log(`  + ${sub.name} — added ${opt.name}`)
      totalAdded++
    }
  }

  console.log(`\nDone! Added ${totalAdded} sidebar options.`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
