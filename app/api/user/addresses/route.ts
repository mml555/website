import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  listUserAddresses,
  createUserAddress,
  updateUserAddress,
  deleteUserAddress
} from '@/lib/api/userAddress'

// GET: List all addresses for the authenticated user
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  try {
    const addresses = await listUserAddresses(userId)
    return NextResponse.json(addresses)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : error }, { status: 500 })
  }
}

// POST: Create a new address for the authenticated user
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const data = await req.json()
  try {
    const address = await createUserAddress(userId, data)
    return NextResponse.json(address, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : error }, { status: 400 })
  }
}

// PUT: Update an address (requires address id)
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const data = await req.json()
  try {
    const address = await updateUserAddress(userId, data)
    return NextResponse.json(address)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : error }, { status: 400 })
  }
}

// DELETE: Remove an address (requires address id)
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { id } = await req.json()
  try {
    await deleteUserAddress(userId, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : error }, { status: 400 })
  }
} 