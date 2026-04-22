import React from 'react';

export function Tooltip({ children, content, position = 'top' }) {
  return (
    <div className="tooltip-wrapper">
      {children}
      <div className={`tooltip tooltip-${position}`}>
        {content}
      </div>
    </div>
  );
}

export default Tooltip;