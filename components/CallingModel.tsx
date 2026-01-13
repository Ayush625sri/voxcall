"use client";

import { useCall } from "@/lib/call-context";
import { useAuth } from "@/lib/auth-context";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

export default function CallingModal() {
  const { user } = useAuth();
  const { activeCall, endCall } = useCall();
  const [callStatus, setCallStatus] = useState<"calling" | "declined" | null>(null);

  useEffect(() => {
    if (!activeCall || !user) {
      setCallStatus(null);
      return;
    }

    if (activeCall.callerId === user.uid && activeCall.status === "ringing") {
      setCallStatus("calling");
    } else if (activeCall.status === "declined" && activeCall.callerId === user.uid) {
      setCallStatus("declined");
      
      const timeout = setTimeout(() => {
        setCallStatus(null);
      }, 5000);

      return () => clearTimeout(timeout);
    } else {
      setCallStatus(null);
    }
  }, [activeCall, user]);

  if (!callStatus || !activeCall || !user) return null;

  const handleCancel = async () => {
    await endCall(activeCall.id);
    setCallStatus(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <div className="text-center">
          {callStatus === "calling" && (
            <>
              <div className="mb-6">
                <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-4xl text-white mx-auto mb-4">
                  {activeCall.receiverName[0].toUpperCase()}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {activeCall.receiverName}
                </h2>
                <p className="text-gray-600">Calling...</p>
              </div>
              <button
                onClick={handleCancel}
                title="Cancel call"
                className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </>
          )}

          {callStatus === "declined" && (
            <>
              <div className="w-24 h-24 bg-gray-400 rounded-full flex items-center justify-center text-4xl text-white mx-auto mb-4">
                {activeCall.receiverName[0].toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {activeCall.receiverName}
              </h2>
              <p className="text-red-600 font-medium">User is busy or unavailable</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}