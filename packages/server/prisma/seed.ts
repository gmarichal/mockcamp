import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create default admin user
  const existing = await prisma.user.findUnique({ where: { email: 'admin@mockcamp.local' } })
  if (!existing) {
    const hash = await bcrypt.hash('admin123', 10)
    await prisma.user.create({
      data: {
        email: 'admin@mockcamp.local',
        name: 'Admin',
        passwordHash: hash,
        isAdmin: true,
        mustChangePassword: true,
      },
    })
    console.log('✅ Admin user created: admin@mockcamp.local / admin123')
    console.log('   ⚠️  Password change required on first login')
  } else {
    console.log('ℹ️  Admin user already exists, skipping')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
