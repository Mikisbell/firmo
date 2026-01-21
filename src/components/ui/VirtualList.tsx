/**
 * VirtualList Component (2026 Modern)
 * Efficient rendering of large lists using window virtualization
 * 
 * Features:
 * - Renders only visible items
 * - Supports dynamic item heights
 * - Smooth scrolling
 * - Memory efficient
 * - Works with infinite scroll
 * 
 * Requirements: FASE1 DÍA 4 PARTE 2 - Modernización
 */

'use client';

import { useRef, useState, useEffect, useCallback, ReactNode } from 'react';

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((item: T, index: number) => number);
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  loading?: boolean;
  loadingComponent?: ReactNode;
  emptyComponent?: ReactNode;
}

/**
 * Virtual list component for efficient rendering of large lists
 * 
 * @example
 * <VirtualList
 *   items={employees}
 *   itemHeight={72}
 *   renderItem={(employee) => (
 *     <EmployeeCard key={employee.id} data={employee} />
 *   )}
 *   onEndReached={loadMore}
 *   loading={loading}
 * />
 */
export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 3,
  className = '',
  onEndReached,
  endReachedThreshold = 0.8,
  loading = false,
  loadingComponent,
  emptyComponent,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate item heights
  const getItemHeight = useCallback((item: T, index: number): number => {
    return typeof itemHeight === 'function' ? itemHeight(item, index) : itemHeight;
  }, [itemHeight]);

  // Calculate total height
  const totalHeight = items.reduce((sum, item, index) => {
    return sum + getItemHeight(item, index);
  }, 0);

  // Calculate visible range
  const getVisibleRange = useCallback(() => {
    if (!containerHeight) return { start: 0, end: 0 };

    let startIndex = 0;
    let endIndex = 0;
    let accumulatedHeight = 0;

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(items[i], i);
      if (accumulatedHeight + height > scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
      accumulatedHeight += height;
    }

    // Find end index
    accumulatedHeight = 0;
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(items[i], i);
      accumulatedHeight += height;
      if (accumulatedHeight > scrollTop + containerHeight) {
        endIndex = Math.min(items.length, i + overscan + 1);
        break;
      }
    }

    if (endIndex === 0) endIndex = items.length;

    return { start: startIndex, end: endIndex };
  }, [items, scrollTop, containerHeight, overscan, getItemHeight]);

  const { start, end } = getVisibleRange();

  // Calculate offset for visible items
  const getOffsetTop = useCallback((index: number): number => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(items[i], i);
    }
    return offset;
  }, [items, getItemHeight]);

  const offsetTop = getOffsetTop(start);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    // Check if end reached
    if (onEndReached) {
      const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;
      if (scrollPercentage >= endReachedThreshold && !loading) {
        onEndReached();
      }
    }
  }, [onEndReached, endReachedThreshold, loading]);

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Empty state
  if (items.length === 0 && !loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        {emptyComponent || (
          <p className="text-zinc-400">No hay elementos para mostrar</p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      onScroll={handleScroll}
      style={{ height: '100%' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetTop}px)` }}>
          {items.slice(start, end).map((item, index) => (
            <div key={start + index}>
              {renderItem(item, start + index)}
            </div>
          ))}
        </div>
      </div>
      
      {loading && (
        <div className="flex items-center justify-center p-4">
          {loadingComponent || (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact virtual list for mobile/small spaces
 */
export function VirtualListCompact<T>({
  items,
  itemHeight,
  renderItem,
  className = '',
  loading = false,
}: Pick<VirtualListProps<T>, 'items' | 'itemHeight' | 'renderItem' | 'className' | 'loading'>) {
  return (
    <VirtualList
      items={items}
      itemHeight={itemHeight}
      renderItem={renderItem}
      overscan={2}
      className={className}
      loading={loading}
    />
  );
}
