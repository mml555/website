import Link from 'next/link';
import { useSession } from 'next-auth/react';

function ClientAdminGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const user = session?.user;

  if (status === 'loading') {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }
  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">You must be an admin to access this page.</p>
        <Link href="/" className="text-primary underline">Go to Home</Link>
      </div>
    );
  }
  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientAdminGuard>
      <div className="min-h-screen flex bg-gray-50">
        <aside className="w-64 bg-white border-r p-6 flex flex-col gap-6">
          <div className="text-2xl font-bold mb-8">Admin Dashboard</div>
          <nav className="flex flex-col gap-4">
            <Link href="/admin/products" className="hover:text-primary font-medium">Products</Link>
            <Link href="/admin/orders" className="hover:text-primary font-medium">Orders</Link>
          </nav>
        </aside>
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </ClientAdminGuard>
  );
} 