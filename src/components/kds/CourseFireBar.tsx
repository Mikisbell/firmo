'use client';

/**
 * CourseFireBar - Bottom bar for firing courses in KDS
 *
 * Shows course statuses and fire button for the selected order.
 *
 * @module components/kds/CourseFireBar
 */

import { useState } from 'react';
import { Flame, Check, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CourseStatusReport } from '@/src/core/services/course-fire.service';

interface CourseFireBarProps {
  report: CourseStatusReport;
  onFire: (orderId: string, course: number) => Promise<void>;
}

const STATE_STYLES: Record<string, string> = {
  COMPLETED: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
  ACTIVE: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
  HELD: 'bg-zinc-700/50 border-zinc-600 text-zinc-400',
  EMPTY: 'bg-zinc-800/50 border-zinc-700 text-zinc-500',
};

const STATE_LABELS: Record<string, string> = {
  COMPLETED: 'Completado',
  ACTIVE: 'En curso',
  HELD: 'Retenido',
  EMPTY: 'Vacío',
};

export function CourseFireBar({ report, onFire }: CourseFireBarProps) {
  const [firingCourse, setFiringCourse] = useState<number | null>(null);

  if (report.courses.length === 0) return null;

  const handleFire = async (course: number) => {
    setFiringCourse(course);
    try {
      await onFire(report.orderId, course);
      toast.success(`Tiempo ${course} disparado`);
    } catch (err: any) {
      toast.error(err.message || 'Error al disparar tiempo');
    } finally {
      setFiringCourse(null);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 border-t border-zinc-700 backdrop-blur-sm z-40">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3 overflow-x-auto">
          <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">
            Orden #{report.orderId.slice(-4)}
          </span>

          {report.courses.map((cs) => {
            const canFire = cs.state === 'HELD';
            const isFiring = firingCourse === cs.course;

            return (
              <div
                key={cs.course}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${STATE_STYLES[cs.state]}`}
              >
                {/* Course indicator */}
                <div className="flex items-center gap-1.5">
                  {cs.state === 'COMPLETED' && <Check size={14} />}
                  {cs.state === 'HELD' && <Lock size={14} />}
                  <span className="text-sm font-bold">T{cs.course}</span>
                  <span className="text-xs opacity-70">{cs.label}</span>
                </div>

                {/* Progress */}
                <span className="text-xs font-mono">
                  {cs.completedCount}/{cs.totalCount}
                </span>

                {/* Fire button */}
                {canFire && (
                  <button
                    onClick={() => handleFire(cs.course)}
                    disabled={isFiring}
                    className="flex items-center gap-1 px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded transition-colors disabled:opacity-50 min-h-[28px]"
                  >
                    {isFiring ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Flame size={12} />
                    )}
                    Disparar
                  </button>
                )}

                {/* Status label for non-fireable */}
                {!canFire && (
                  <span className="text-[10px] opacity-50">
                    {STATE_LABELS[cs.state]}
                  </span>
                )}
              </div>
            );
          })}

          {/* Parallel items indicator */}
          {report.parallelItems.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300">
              <span className="text-sm font-bold">||</span>
              <span className="text-xs">
                {report.parallelItems.length} paralelo{report.parallelItems.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CourseFireBar;
