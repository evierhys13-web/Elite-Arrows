import React from 'react';
import { Link } from 'react-router-dom';

export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <React.Fragment key={item.path || index}>
            {isLast ? (
              <span className="breadcrumb-item current">
                {item.label}
              </span>
            ) : (
              <>
                <Link to={item.path} className="breadcrumb-item">
                  {item.label}
                </Link>
                <span className="breadcrumb-separator">/</span>
              </>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;