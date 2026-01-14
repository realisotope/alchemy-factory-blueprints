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

  const getZoomLevel = () => {
    const computedZoom = window.getComputedStyle(document.documentElement).zoom;
    return computedZoom && computedZoom !== 'normal' ? parseFloat(computedZoom) : 1;
  };

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const zoomLevel = getZoomLevel();
      const rect = triggerRef.current.getBoundingClientRect();
      const offset = -36;
      const padding = 8;
      const tooltipWidth = 150;
      const tooltipHeight = 40;
      
      let top = 0;
      let left = 0;

      const adjustedTop = rect.top / zoomLevel;
      const adjustedLeft = rect.left / zoomLevel;
      const adjustedRight = rect.right / zoomLevel;
      const adjustedBottom = rect.bottom / zoomLevel;
      const adjustedWidth = rect.width / zoomLevel;
      const adjustedHeight = rect.height / zoomLevel;

      switch (position) {
        case 'top':
          top = adjustedTop - tooltipHeight - offset;
          left = adjustedLeft + adjustedWidth / 2;
          break;
        case 'bottom':
          top = adjustedBottom + offset;
          left = adjustedLeft + adjustedWidth / 2;
          break;
        case 'left':
          top = adjustedTop + adjustedHeight / 2;
          left = adjustedLeft - offset;
          break;
        case 'right':
          top = adjustedTop + adjustedHeight / 2;
          left = adjustedRight + offset;
          break;
      }

      const viewportWidth = window.innerWidth / zoomLevel;
      const viewportHeight = window.innerHeight / zoomLevel;

      // Check horizontal bounds
      if (left - tooltipWidth / 2 < padding) {
        left = adjustedRight + offset;
      } else if (left + tooltipWidth / 2 > viewportWidth - padding) {
        left = adjustedLeft - offset;
      }

      // Check vertical bounds
      if (top < padding) {
        top = adjustedBottom + offset;
      } else if (top + tooltipHeight > viewportHeight - padding) {
        top = adjustedTop - tooltipHeight - offset;
      }

      setTooltipPos({ top, left });
    }
  }, [isVisible, position, triggerRef]);

  // Recalculate tooltip position on scroll/resize
  useEffect(() => {
    if (!isVisible) return;

    const handleScroll = () => {
      if (triggerRef.current) {
        const zoomLevel = getZoomLevel();
        const rect = triggerRef.current.getBoundingClientRect();
        const offset = 8;
        
        const adjustedTop = rect.top / zoomLevel;
        const adjustedLeft = rect.left / zoomLevel;
        const adjustedRight = rect.right / zoomLevel;
        const adjustedHeight = rect.height / zoomLevel;
        const adjustedWidth = rect.width / zoomLevel;
        
        let top = 0;
        let left = 0;

        switch (position) {
          case 'top':
            top = adjustedTop - 40 - offset;
            left = adjustedLeft + adjustedWidth / 2;
            break;
          case 'bottom':
            top = adjustedTop + adjustedHeight + offset;
            left = adjustedLeft + adjustedWidth / 2;
            break;
          case 'left':
            top = adjustedTop + adjustedHeight / 2;
            left = adjustedLeft - offset;
            break;
          case 'right':
            top = adjustedTop + adjustedHeight / 2;
            left = adjustedRight + offset;
            break;
        }

        setTooltipPos({ top, left });
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
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
