'use client';

/**
 * Textarea multi-linea del Design System.
 * Misma API que Input pero para texto largo.
 * Compatible con react-hook-form via forwardRef.
 */

import { forwardRef, useId } from 'react';
import { cn } from '@/src/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, disabled, rows = 3, ...props }, ref) => {
    const autoId = useId();
    const textareaId = id ?? autoId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-park-gray-300"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error
              ? `${textareaId}-error`
              : hint
                ? `${textareaId}-hint`
                : undefined
          }
          className={cn(
            'min-h-[80px] w-full px-3 py-2 bg-park-gray-900 border rounded-lg text-white placeholder:text-park-gray-500 resize-y',
            'focus:outline-none focus:ring-2 transition-colors',
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-park-gray-700 focus:border-park-brand-500 focus:ring-park-brand-500/20',
            disabled && 'opacity-50 cursor-not-allowed',
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={`${textareaId}-error`} className="text-xs text-red-400">
            {error}
          </p>
        ) : hint ? (
          <p id={`${textareaId}-hint`} className="text-xs text-park-gray-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
