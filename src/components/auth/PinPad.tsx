'use client';

// src/components/auth/PinPad.tsx
// PIN entry component with numeric keypad

import { useState, useCallback } from 'react';
import { cn } from '@/src/lib/utils';

interface PinPadProps {
  onSubmit: (pin: string) => void;
  disabled?: boolean;
  error?: string;
  maxLength?: number;
}

export function PinPad({ onSubmit, disabled, error, maxLength = 4 }: PinPadProps) {
  const [pin, setPin] = useState('');

  const handleDigit = useCallback((digit: string) => {
    if (disabled) return;
    if (pin.length >= maxLength) return;
    
    const newPin = pin + digit;
    setPin(newPin);
    
    // Auto-submit when complete
    if (newPin.length === maxLength) {
      onSubmit(newPin);
      setPin('');
    }
  }, [pin, maxLength, onSubmit, disabled]);

  const handleBackspace = useCallback(() => {
    if (disabled) return;
    setPin(p => p.slice(0, -1));
  }, [disabled]);

  const handleClear = useCallback(() => {
    if (disabled) return;
    setPin('');
  }, [disabled]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* PIN Display */}
      <div className="flex gap-3">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all",
              i < pin.length
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                : "border-zinc-700 bg-zinc-800/50 text-zinc-600"
            )}
          >
            {i < pin.length ? '●' : ''}
          </div>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-red-400 text-sm animate-pulse">{error}</p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigit(digit)}
            disabled={disabled}
            className={cn(
              "w-16 h-16 rounded-xl text-2xl font-semibold transition-all",
              "bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600",
              "border border-zinc-700 hover:border-zinc-600",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {digit}
          </button>
        ))}
        
        {/* Bottom row */}
        <button
          onClick={handleClear}
          disabled={disabled}
          className={cn(
            "w-16 h-16 rounded-xl text-sm font-medium transition-all",
            "bg-zinc-800/50 hover:bg-zinc-700 active:bg-zinc-600",
            "border border-zinc-700 hover:border-zinc-600 text-zinc-400",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          Borrar
        </button>
        
        <button
          onClick={() => handleDigit('0')}
          disabled={disabled}
          className={cn(
            "w-16 h-16 rounded-xl text-2xl font-semibold transition-all",
            "bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600",
            "border border-zinc-700 hover:border-zinc-600",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          0
        </button>
        
        <button
          onClick={handleBackspace}
          disabled={disabled}
          className={cn(
            "w-16 h-16 rounded-xl text-xl transition-all",
            "bg-zinc-800/50 hover:bg-zinc-700 active:bg-zinc-600",
            "border border-zinc-700 hover:border-zinc-600 text-zinc-400",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
