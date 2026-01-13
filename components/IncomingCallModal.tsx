'use client';

import { useCall } from '@/lib/call-context';
import { useAuth } from '@/lib/auth-context';
import { Phone, X } from 'lucide-react';

export default function IncomingCallModal() {
  const { user } = useAuth();
  const { incomingCall, acceptCall, declineCall } = useCall();

  if (!incomingCall || !user) return null;

  const handleAccept = async () => {
    await acceptCall(incomingCall.id);
  };

  const handleDecline = async () => {
    await declineCall(incomingCall.id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 text-gray-500">{incomingCall.callerName}</h2>
          <p className="text-gray-600 mb-6">
            Incoming {incomingCall.type} call...
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleAccept}
              className="p-4 bg-green-600 text-white rounded-full hover:bg-green-700"
            >
              <Phone className="w-6 h-6" />
            </button>
            <button
              onClick={handleDecline}
              className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}