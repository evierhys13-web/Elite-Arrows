import React from 'react';

export function Skeleton({ width, height, borderRadius = '8px', className = '' }) {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{ 
        width: width || '100%', 
        height: height || '20px',
        borderRadius,
      }}
    />
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <Skeleton width="50px" height="50px" borderRadius="50%" />
        <div className="skeleton-card-info">
          <Skeleton width="60%" height="16px" />
          <Skeleton width="40%" height="14px" />
        </div>
      </div>
      <div className="skeleton-card-lines">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height="14px" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width="80px" height="16px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} width="80px" height="18px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ items = 5 }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default Skeleton;