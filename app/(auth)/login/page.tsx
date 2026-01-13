'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import AuthForm from '@/components/AuthForm';

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-gray-600">Login to VoxCall</h1>
        <AuthForm mode="login" onSubmit={login} />
        <p className="mt-4 text-sm text-gray-400">
          {`Don't have an account?`}{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}