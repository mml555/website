import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { hash } from "bcryptjs"
import { randomBytes } from "crypto"
import { sendPasswordResetEmail } from "@/lib/email"

// Request password reset
export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      )
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString("hex")

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: resetToken,
      },
    })

    // Send reset email
    await sendPasswordResetEmail(email, resetToken)

    return NextResponse.json(
      { message: "Password reset email sent" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Password reset request error:", error)
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    )
  }
}

// Reset password with token
export async function PUT(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json(
        { message: "Token and password are required" },
        { status: 400 }
      )
    }

    // Find user with reset token
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    })

    if (!user) {
      return NextResponse.json(
        { message: "Invalid reset token" },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await hash(password, 12)

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        verificationToken: null,
      },
    })

    return NextResponse.json(
      { message: "Password reset successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    )
  }
} 