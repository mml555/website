"use client"
import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function EditProfilePage() {
  const { data: session } = useSession();
  const user = session?.user;
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    // Fetch current user profile from API only once per user
    async function fetchProfile() {
      setFetching(true);
      setError(null);
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data = await res.json();
        setName(data.name || '');
        setEmail(data.email || '');
      } catch (err: any) {
        setError(err.message || 'Failed to fetch profile');
      } finally {
        setFetching(false);
      }
    }
    if (user && fetchedRef.current !== user.id) {
      fetchedRef.current = user.id;
      fetchProfile();
    }
  }, [user]);

  if (!user) {
    return <div className="flex justify-center items-center min-h-screen">You must be logged in.</div>;
  }

  if (fetching) {
    return <div className="flex justify-center items-center min-h-screen">Loading profile...</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update profile');
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8">Edit Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="block font-semibold mb-1">Name</label>
              <input
                id="name"
                className="w-full border rounded px-3 py-2"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block font-semibold mb-1">Email</label>
              <input
                id="email"
                className="w-full border rounded px-3 py-2"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <div className="text-red-600">{error}</div>}
            {success && <div className="text-green-600">Profile updated!</div>}
            <div className="flex gap-2 mt-4">
              <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
              <Button type="button" variant="outline" onClick={() => router.push('/account')}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 