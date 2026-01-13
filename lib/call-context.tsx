"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { ref, onValue, set, remove } from "firebase/database";
import { db, rtdb } from "./firebase";
import { useAuth } from "./auth-context";
import { Call } from "@/types";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

interface SignalingOffer {
  offer: RTCSessionDescriptionInit;
  from: string;
}

interface CallContextType {
  activeCall: Call | null;
  incomingCall: Call | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  initiateCall: (
    receiverId: string,
    receiverName: string,
    type: "voice" | "video"
  ) => Promise<string>;
  acceptCall: (callId: string) => Promise<void>;
  declineCall: (callId: string) => Promise<void>;
  endCall: (callId: string) => Promise<void>;
  toggleMute: () => boolean;
  toggleVideo: () => boolean;
}

const CallContext = createContext<CallContextType>({} as CallContextType);

export const useCall = () => useContext(CallContext);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const answerListener = useRef<(() => void) | null>(null);
  const candidatesListener = useRef<(() => void) | null>(null);

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;

    const callsQuery = query(
      collection(db, "calls"),
      where("receiverId", "==", user.uid),
      where("status", "==", "ringing")
    );

    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const callData = {
            id: change.doc.id,
            ...data,
            startTime: data.startTime?.toDate() || new Date(),
          } as Call;
          setIncomingCall(callData);
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  // Clear incoming call if caller cancels
  useEffect(() => {
    if (!incomingCall || !user) return;

    const unsubscribe = onSnapshot(
      doc(db, "calls", incomingCall.id),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.status === "ended") {
            setIncomingCall(null);
          }
        }
      }
    );

    return () => unsubscribe();
  }, [incomingCall?.id, user]);
  // Monitor active call status
  useEffect(() => {
    if (!user || !activeCall) return;

    const unsubscribe = onSnapshot(
      doc(db, "calls", activeCall.id),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setActiveCall({
            ...activeCall,
            status: data.status,
            startTime: data.startTime?.toDate() || activeCall.startTime,
          });
        }
      }
    );

    return () => unsubscribe();
  }, [activeCall?.id, user]);

  useEffect(() => {
    if (!user || !activeCall) return;

    const unsubscribe = onSnapshot(
      doc(db, "calls", activeCall.id),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          // Update status
          if (data.status !== activeCall.status) {
            if (data.status === "ended") {
              // Cleanup
              if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
                setLocalStream(null);
              }
              if (peerConnection.current) {
                peerConnection.current.close();
                peerConnection.current = null;
              }
              if (answerListener.current) answerListener.current();
              if (candidatesListener.current) candidatesListener.current();
              setRemoteStream(null);
              setActiveCall(null);
            } else {
              setActiveCall({
                ...activeCall,
                status: data.status,
                startTime: data.startTime?.toDate() || activeCall.startTime,
              });
            }
          }
        }
      }
    );

    return () => unsubscribe();
  }, [activeCall?.id, user]);

  const initializeMedia = async (isVideo: boolean) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideo,
    });
    setLocalStream(stream);
    return stream;
  };

  const createPeerConnection = (peerId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Push to array instead of overwriting
        const candidateRef = ref(
          rtdb,
          `signaling/${peerId}/candidates/${Date.now()}`
        );
        set(candidateRef, {
          candidate: event.candidate.toJSON(),
          from: user!.uid,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind, event.streams);
      console.log("Track received:", {
        kind: event.track.kind,
        enabled: event.track.enabled,
        readyState: event.track.readyState,
        muted: event.track.muted,
        streams: event.streams.length,
      });

      if (event.streams[0]) {
        console.log(
          "Stream tracks:",
          event.streams[0].getTracks().map((t) => ({
            kind: t.kind,
            enabled: t.enabled,
            readyState: t.readyState,
          }))
        );
        setRemoteStream(event.streams[0]);
      }
      // setRemoteStream(event.streams[0]);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE state:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
    };

    peerConnection.current = pc;
    return pc;
  };

  const initiateCall = async (
    receiverId: string,
    receiverName: string,
    type: "voice" | "video"
  ) => {
    if (!user) throw new Error("Not authenticated");

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    pendingCandidates.current = [];

    const callData: Omit<Call, "id"> = {
      callerId: user.uid,
      callerName: user.displayName,
      receiverId,
      receiverName,
      type,
      status: "ringing",
      startTime: new Date(),
    };

    const docRef = await addDoc(collection(db, "calls"), callData);

    // Initialize WebRTC
    const stream = await initializeMedia(type === "video");
    const pc = createPeerConnection(receiverId);

    stream.getTracks().forEach((track) => {
      console.log("Adding track:", track.kind, track.enabled, track.readyState);
      pc.addTrack(track, stream);
    });

    console.log(
      "Senders:",
      pc.getSenders().map((s) => ({
        track: s.track?.kind,
        enabled: s.track?.enabled,
      }))
    );
    setActiveCall({ id: docRef.id, ...callData });

    await remove(ref(rtdb, `signaling/${receiverId}`));
    await remove(ref(rtdb, `signaling/${user.uid}`));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await set(ref(rtdb, `signaling/${receiverId}/offer`), {
      offer: offer,
      from: user.uid,
    });

    // Listen for answer
    const answerRef = ref(rtdb, `signaling/${user.uid}/answer`);
    answerListener.current = onValue(answerRef, async (snapshot) => {
      const data = snapshot.val();
      if (
        data &&
        data.from === receiverId &&
        pc.signalingState === "have-local-offer"
      ) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        for (const candidate of pendingCandidates.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (error) {
            console.error("Error adding queued candidate:", error);
          }
        }
        pendingCandidates.current = [];
        await remove(answerRef);
      }
    });
    // Listen for ICE candidates
    const candidatesRef = ref(rtdb, `signaling/${user.uid}/candidates`);
    candidatesListener.current = onValue(candidatesRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && peerConnection.current?.signalingState !== "closed") {
        for (const key in data) {
          const candidateData = data[key];
          if (candidateData.from === receiverId) {
            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(
                  new RTCIceCandidate(candidateData.candidate)
                );
              } else {
                pendingCandidates.current.push(candidateData.candidate);
              }
            } catch (error) {
              console.error("Error adding ICE candidate:", error);
            }
          }
        }
      }
    });
    return docRef.id;
  };

  const acceptCall = async (callId: string) => {
    if (!incomingCall || !user) return;

    // Cleanup existing connections
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    pendingCandidates.current = [];

    const updatedCall = {
      ...incomingCall,
      status: "active" as const,
      startTime: new Date(),
    };

    await updateDoc(doc(db, "calls", callId), {
      status: "active",
      startTime: new Date(),
    });

    setActiveCall(updatedCall);
    const callerId = incomingCall.callerId;
    const isVideo = incomingCall.type === "video";
    setIncomingCall(null);

    const pc = createPeerConnection(callerId);

    // Get offer FIRST, then clear
    const offerSnapshot = await new Promise<SignalingOffer | null>(
      (resolve) => {
        const offerRef = ref(rtdb, `signaling/${user.uid}/offer`);
        onValue(offerRef, (snapshot) => resolve(snapshot.val()), {
          onlyOnce: true,
        });
      }
    );

    if (offerSnapshot && offerSnapshot.from === callerId) {
      await pc.setRemoteDescription(
        new RTCSessionDescription(offerSnapshot.offer)
      );

      const stream = await initializeMedia(isVideo);

      stream.getTracks().forEach((track) => {
        console.log(
          "Adding track:",
          track.kind,
          track.enabled,
          track.readyState
        );
        pc.addTrack(track, stream);
      });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await set(ref(rtdb, `signaling/${callerId}/answer`), {
        answer: answer,
        from: user.uid,
      });

      // ICE candidate listener
      const candidatesRef = ref(rtdb, `signaling/${user.uid}/candidates`);
      candidatesListener.current = onValue(candidatesRef, async (snapshot) => {
        const data = snapshot.val();
        if (data && peerConnection.current?.signalingState !== "closed") {
          for (const key in data) {
            const candidateData = data[key];
            if (candidateData.from === callerId) {
              try {
                await pc.addIceCandidate(
                  new RTCIceCandidate(candidateData.candidate)
                );
              } catch (error) {
                console.error("Error adding ICE candidate:", error);
              }
            }
          }
        }
      });

      await remove(ref(rtdb, `signaling/${user.uid}/offer`));
    }
  };
  const declineCall = async (callId: string) => {
    if (answerListener.current) answerListener.current();
    if (candidatesListener.current) candidatesListener.current();

    await updateDoc(doc(db, "calls", callId), {
      status: "declined",
      endTime: new Date(),
    });
    setIncomingCall(null);
  };

  const endCall = async (callId: string) => {
    if (answerListener.current) {
      answerListener.current();
      answerListener.current = null;
    }
    if (candidatesListener.current) {
      candidatesListener.current();
      candidatesListener.current = null;
    }
    const endTime = new Date();
    const call = activeCall;
    const duration = call?.startTime
      ? Math.floor(
          (endTime.getTime() - new Date(call.startTime).getTime()) / 1000
        )
      : 0;

    await updateDoc(doc(db, "calls", callId), {
      status: "ended",
      endTime,
      duration,
    });

    // Cleanup WebRTC
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (user) {
      await remove(ref(rtdb, `signaling/${user.uid}`));
    }
    setRemoteStream(null);
    setActiveCall(null);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled;
      }
    }
    return false;
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return !videoTrack.enabled;
      }
    }
    return false;
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        localStream,
        remoteStream,
        initiateCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleVideo,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}
