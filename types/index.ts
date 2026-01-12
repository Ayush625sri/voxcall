export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
}

export interface ContactRequest {
  id: string;
  fromUid: string;
  fromEmail: string;
  fromDisplayName: string;
  toUid: string;
  toEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

export interface Contact {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  addedAt: Date;
  status: 'active';
}

export interface CallLog {
  id: string;
  callerId: string;
  receiverId: string;
  type: 'voice' | 'video';
  status: 'completed' | 'missed' | 'declined';
  duration: number;
  timestamp: Date;
}

export interface Call {
  id: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'declined' | 'missed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate' | 'end-call';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  callId?: string;
}