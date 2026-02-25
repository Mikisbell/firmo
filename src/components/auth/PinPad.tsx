'use client';

// src/components/auth/PinPad.tsx
// PIN entry component with numeric keypad
// Supports PINs of 4-6 digits with manual submit button

import React, { useState, useCallback } from 'react';
import { cn } from '@/src/lib/utils';

interface PinPadProps {
  onSubmit: (pin: string) => void;
  disabled?: boolean;
  error?: string;
  maxLength?: number;
  minLength?: number;
}

const PinPad = React.memo(function PinPad({ onSubmit, disabled, error, maxLength = 6, minLength = 4 }: PinPadProps) {
  const [pin, setPin] = useState('');

  const canSubmit = pin.length >= minLength && pin.length <= maxLength;

  const handleSubmit = useCallback(() => {
    if (disabled || !canSubmit) return;
    const submittedPin = pin;
    setPin('');
    onSubmit(submittedPin);
  }, [pin, canSubmit, onSubmit, disabled]);

  const handleDigit = useCallback((digit: string) => {
    if (disabled) return;
    if (pin.length >= maxLength) return;

    const newPin = pin + digit;
    setPin(newPin);

    // Auto-submit when max length reached
    if (newPin.length === maxLength) {
      setPin('');
      onSubmit(newPin);
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
    <div className="flex flex-col items-center gap-6" data-testid="pin-pad">
      {/* PIN Display — 6 boxes */}
      <div className="flex gap-2">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 flex items-center justify-center text-xl sm:text-2xl font-bold transition-all",
              i < pin.length
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                : i < minLength
                  ? "border-zinc-700 bg-zinc-800/50 text-zinc-600"
                  : "border-zinc-700/50 bg-zinc-800/30 text-zinc-700"
            )}
          >
            {i < pin.length ? '●' : ''}
          </div>
        ))}
      </div>

      {/* Hint for PIN length */}
      <p className="text-xs text-zinc-500 -mt-3">
        {pin.length < minLength
          ? `${minLength}-${maxLength} dígitos`
          : pin.length < maxLength
            ? 'Presiona Confirmar o sigue ingresando'
            : ''}
      </p>

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

      {/* Submit button — visible when PIN has enough digits but hasn't auto-submitted */}
      {pin.length >= minLength && pin.length < maxLength && (
        <button
          onClick={handleSubmit}
          disabled={disabled}
          className={cn(
            "w-full py-3 rounded-xl text-base font-semibold transition-all",
            "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          Confirmar
        </button>
      )}
    </div>
  );
});

export default PinPad;
