import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../lib/ThemeContext';


// Custom styled tooltip component
export default function Tooltip({ children, title, position = 'top' }) {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  if (!title) return children;

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const offset = -2;
      const padding = 8;
      
      let top = 0;
      let left = 0;
      let finalPosition = position;

      // Calculate initial position based on requested position
      switch (position) {
        case 'top':
          top = rect.top - offset + window.scrollY;
          left = rect.left + rect.width / 2 + window.scrollX;
          break;
        case 'bottom':
          top = rect.bottom + offset + window.scrollY;
          left = rect.left + rect.width / 2 + window.scrollX;
          break;
        case 'left':
          top = rect.top + rect.height / 2 + window.scrollY;
          left = rect.left - offset + window.scrollX;
          break;
        case 'right':
          top = rect.top + rect.height / 2 + window.scrollY;
          left = rect.right + offset + window.scrollX;
          break;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const tooltipWidth = 150;
      const tooltipHeight = 40;

      // Check horizontal bounds
      if (left - tooltipWidth / 2 < padding) {
        left = rect.right + offset + window.scrollX;
        finalPosition = 'right';
      } else if (left + tooltipWidth / 2 > viewportWidth - padding) {
        left = rect.left - offset + window.scrollX;
        finalPosition = 'left';
      }

      // Check vertical bounds
      if (top - tooltipHeight < padding) {
        top = rect.bottom + offset + window.scrollY;
        finalPosition = 'bottom';
      } else if (top + tooltipHeight > viewportHeight - padding) {
        top = rect.top - offset + window.scrollY;
        finalPosition = 'top';
      }

      setTooltipPos({ top, left });
    }
  }, [isVisible, position]);

  const positionClasses = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  const arrowStyles = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-8 border-x-8 border-x-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-8 border-x-8 border-x-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-8 border-y-8 border-y-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-8 border-y-8 border-y-transparent',
};

  const arrowBorderColor = {
    top: { borderTopColor: theme.colors.cardBorder },
    bottom: { borderBottomColor: theme.colors.cardBorder },
    left: { borderLeftColor: theme.colors.cardBorder },
    right: { borderRightColor: theme.colors.cardBorder },
  };

  return (
    <>
      <div 
        ref={triggerRef}
        className="relative inline-flex"
        onMouseEnter={() => {
          setIsVisible(true);
        }}
        onMouseLeave={() => {
          setIsVisible(false);
        }}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {children}
      </div>

      {isVisible && createPortal(
        <div
          className={`fixed ${positionClasses[position]} pointer-events-none z-[9999] whitespace-nowrap px-3 py-1.5 rounded text-sm font-medium`}
          style={{
            top: `${tooltipPos.top}px`,
            left: `${tooltipPos.left}px`,
            backgroundColor: theme.colors.cardBg,
            color: theme.colors.textPrimary,
            border: `1px solid ${theme.colors.cardBorder}`,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          }}
        >
          {title}
          <div
            className={`absolute ${arrowStyles[position]}`}
            style={arrowBorderColor[position]}
          />
        </div>,
        document.body
      )}
    </>
  );
}
