'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import AuthForm from '@/components/AuthForm';

export default function SignupPage() {
  const { signup } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-8 text-gray-600">Create VoxCall Account</h1>
        <AuthForm mode="signup" onSubmit={signup} />
        <p className="mt-4 text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}