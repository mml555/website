import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPermissions() {
  try {
    // Test SELECT permission
    console.log('Testing SELECT permission...')
    const users = await prisma.user.findMany({ take: 1 })
    console.log('SELECT permission: OK')

    // Test INSERT permission
    console.log('\nTesting INSERT permission...')
    const testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
        role: 'USER'
      }
    })
    console.log('INSERT permission: OK')

    // Test UPDATE permission
    console.log('\nTesting UPDATE permission...')
    await prisma.user.update({
      where: { id: testUser.id },
      data: { name: 'Updated Test User' }
    })
    console.log('UPDATE permission: OK')

    // Test DELETE permission
    console.log('\nTesting DELETE permission...')
    await prisma.user.delete({
      where: { id: testUser.id }
    })
    console.log('DELETE permission: OK')

    console.log('\nAll permission tests passed successfully!')
  } catch (error) {
    console.error('Permission test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPermissions() 