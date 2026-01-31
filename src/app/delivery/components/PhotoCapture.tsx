'use client';

/**
 * PhotoCapture Component
 * Captura foto de prueba de entrega usando la cámara del dispositivo
 * 
 * Requirements: 4.5
 */

import { useState, useRef, useCallback } from 'react';
import { Camera, X, RotateCcw, Check } from 'lucide-react';

interface PhotoCaptureProps {
  onCapture: (photoDataUrl: string) => void;
  onCancel: () => void;
}

export default function PhotoCapture({ onCapture, onCancel }: PhotoCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Cámara trasera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedPhoto(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const retake = useCallback(() => {
    setCapturedPhoto(null);
    startCamera();
  }, [startCamera]);

  const confirm = useCallback(() => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
    }
  }, [capturedPhoto, onCapture]);

  const handleCancel = useCallback(() => {
    stopCamera();
    onCancel();
  }, [stopCamera, onCancel]);

  // Auto-start camera on mount
  useState(() => {
    startCamera();
  });

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-zinc-900">
        <button
          onClick={handleCancel}
          className="p-2 text-white hover:bg-zinc-800 rounded-lg"
        >
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-white font-medium">Foto de entrega</h2>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Camera/Photo View */}
      <div className="flex-1 relative">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-amber-500 text-black rounded-lg font-medium"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white">Iniciando cámara...</div>
          </div>
        ) : capturedPhoto ? (
          <img
            src={capturedPhoto}
            alt="Foto capturada"
            className="w-full h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="p-4 bg-zinc-900">
        {capturedPhoto ? (
          <div className="flex justify-center gap-4">
            <button
              onClick={retake}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-700 text-white rounded-lg font-medium"
            >
              <RotateCcw className="w-5 h-5" />
              Repetir
            </button>
            <button
              onClick={confirm}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium"
            >
              <Check className="w-5 h-5" />
              Usar foto
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={takePhoto}
              disabled={!stream}
              className="w-16 h-16 bg-white rounded-full flex items-center justify-center disabled:opacity-50"
            >
              <Camera className="w-8 h-8 text-black" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
