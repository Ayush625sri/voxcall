"use client";

import { useEffect, useState, useRef } from "react";
import { useCall } from "@/lib/call-context";
import { useAuth } from "@/lib/auth-context";
import { Mic, MicOff, Video as VideoIcon, VideoOff, Phone } from "lucide-react";

export default function ActiveCallView() {
  const { user } = useAuth();
  const {
    activeCall,
    endCall,
    localStream,
    remoteStream,
    toggleMute,
    toggleVideo,
  } = useCall();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Setup local video
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      const videoTracks = localStream.getVideoTracks();
      console.log(
        "Local video tracks:",
        videoTracks.length,
        videoTracks[0]?.enabled
      );
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);
  // Setup remote video
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Timer
  useEffect(() => {
    if (!activeCall || activeCall.status !== "active") return;

    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall]);

  // Remote audio level detection with audio element
  useEffect(() => {
    if (!remoteStream) return;

    const audioTracks = remoteStream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const audio = document.createElement("audio");
    audio.srcObject = remoteStream;
    audio.autoplay = true;
    audio.volume = 1.0;
    document.body.appendChild(audio);

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(remoteStream);

    source.connect(analyser);
    analyser.fftSize = 256;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationId: number;

    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setRemoteSpeaking(average > 25);
      animationId = requestAnimationFrame(checkAudioLevel);
    };

    audio
      .play()
      .then(() => {
        console.log("Remote audio playing");
        checkAudioLevel();
      })
      .catch((e) => {
        console.error("Audio play failed:", e);
      });

    return () => {
      cancelAnimationFrame(animationId);
      audioContext.close();
      audio.remove();
    };
  }, [remoteStream]);

  // Local audio level detection
  useEffect(() => {
    if (!localStream) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const audioTracks = localStream.getAudioTracks();

    if (audioTracks.length === 0) return;

    const source = audioContext.createMediaStreamSource(localStream);
    source.connect(analyser);
    analyser.fftSize = 256;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationId: number;

    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setLocalSpeaking(!isMuted && average > 25);
      animationId = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();

    return () => {
      cancelAnimationFrame(animationId);
      audioContext.close();
    };
  }, [localStream, isMuted]);

  useEffect(() => {
    if (activeCall && activeCall.status === "active") {
      setIsMuted(false);
      setIsVideoOff(false);
    }
  }, [activeCall?.id]);

  useEffect(() => {
    setDuration(0);
  }, [activeCall?.id]);

  if (!activeCall || !user) return null;
  const shouldShow =
    activeCall.status === "active" ||
    (activeCall.status === "ringing" && activeCall.callerId === user.uid);

  if (!shouldShow) return null;

  const handleEndCall = async () => {
    await endCall(activeCall.id);
  };

  const handleToggleMute = () => {
    const muted = toggleMute();
    setIsMuted(muted);
  };

  const handleToggleVideo = () => {
    const videoOff = toggleVideo();
    setIsVideoOff(videoOff);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const isVideo = activeCall.type === "video";
  const otherPersonName =
    activeCall.callerId === user.uid
      ? activeCall.receiverName
      : activeCall.callerName;

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col items-center justify-center">
      {/* Participants Grid */}
      <div className="flex-1 w-[100%]  flex flex-col sm:flex-row sm:items-center justify-center gap-8 p-8">
        {/* Current User */}
        <div className="flex flex-col items-center">
          {isVideo && localStream ? (
            <div
              className={`relative w-48 h-48 rounded-2xl overflow-hidden transition-all ${
                localSpeaking
                  ? "ring-4 ring-green-500"
                  : "ring-4 ring-transparent"
              }`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {isVideoOff && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center text-4xl text-white">
                    {user.displayName[0].toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`w-48 h-48 bg-gray-700 rounded-2xl flex items-center justify-center text-6xl text-white transition-all ${
                localSpeaking
                  ? "ring-4 ring-green-500"
                  : "ring-4 ring-transparent"
              }`}
            >
              {user.displayName[0].toUpperCase()}
            </div>
          )}
          <p className="text-white font-medium mt-4 text-lg">
            {user.displayName} (You)
          </p>
          {isMuted && <p className="text-red-400 text-sm mt-1">Muted</p>}
          {localSpeaking && (
            <p className="text-green-400 text-sm mt-1">Speaking...</p>
          )}
        </div>

        {/* Other User */}
        <div className="flex flex-col items-center">
          {isVideo && remoteStream ? (
            <div
              className={`relative w-48 h-48 rounded-2xl overflow-hidden transition-all ${
                remoteSpeaking
                  ? "ring-4 ring-green-500"
                  : "ring-4 ring-transparent"
              }`}
            >
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Check if remote video track is disabled */}
              {remoteStream.getVideoTracks()[0]?.enabled === false && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center text-4xl text-white">
                    {otherPersonName[0].toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`w-48 h-48 bg-blue-600 rounded-2xl flex items-center justify-center text-6xl text-white transition-all ${
                remoteSpeaking
                  ? "ring-4 ring-green-500"
                  : "ring-4 ring-transparent"
              }`}
            >
              {otherPersonName[0].toUpperCase()}
            </div>
          )}
          <p className="text-white font-medium mt-4 text-lg">
            {otherPersonName}
          </p>
          {remoteSpeaking && (
            <p className="text-green-400 text-sm mt-1">Speaking...</p>
          )}
        </div>
      </div>

      {/* Timer / Status */}
      <div className="text-center pb-4">
        {activeCall.status === "ringing" ? (
          <p className="text-gray-400 text-xl">Connecting...</p>
        ) : activeCall.status === "declined" ? (
          <p className="text-red-400 text-xl">Call Declined</p>
        ) : (
          <p className="text-gray-400 text-xl">{formatDuration(duration)}</p>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-gray-800 w-[100%]">
        <div className="flex justify-center gap-4">
          <button
            onClick={handleToggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            className={`p-4 rounded-full ${
              isMuted ? "bg-red-600" : "bg-gray-700"
            } text-white hover:opacity-80 transition`}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          {isVideo && (
            <button
              onClick={handleToggleVideo}
              title={isVideoOff ? "Turn on camera" : "Turn off camera"}
              className={`p-4 rounded-full ${
                isVideoOff ? "bg-red-600" : "bg-gray-700"
              } text-white hover:opacity-80 transition`}
            >
              {isVideoOff ? (
                <VideoOff className="w-6 h-6" />
              ) : (
                <VideoIcon className="w-6 h-6" />
              )}
            </button>
          )}

          <button
            onClick={handleEndCall}
            title="End call"
            className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition"
          >
            <Phone className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
