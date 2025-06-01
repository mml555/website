"use client"
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AccountPage() {
  const { data: session, status } = useSession();
  const user = session?.user;

  if (status === 'loading') {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Account</h1>
        <p className="mb-4">You must be logged in to view your account.</p>
        <Link href="/login"><Button>Login</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8">My Account</h1>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <span className="font-semibold">Name:</span> {user.name || 'N/A'}
          </div>
          <div className="mb-4">
            <span className="font-semibold">Email:</span> {user.email || 'N/A'}
          </div>
          <div className="flex flex-col gap-2 mt-6">
            <Link href="/account/edit"><Button variant="outline">Edit Profile</Button></Link>
            <Link href="/account/change-password"><Button variant="outline">Change Password</Button></Link>
            <Link href="/account/orders"><Button variant="outline">Order History</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 