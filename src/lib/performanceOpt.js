import { useEffect, useRef, useState, useCallback } from 'react';

export function useLazyImage(src, options = {}) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) return;

    const img = new Image();

    const handleLoad = () => {
      setLoaded(true);
      if (ref.current) {
        ref.current.src = src;
      }
    };

    const handleError = () => {
      setError(true);
    };

    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);
    img.src = src;

    return () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
  }, [src]);

  return { ref, loaded, error };
}

export function LazyImage({
  src,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23333" width="400" height="300"/%3E%3Ctext x="50%" y="50%" font-size="16" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ELoading...%3C/text%3E%3C/svg%3E',
  alt = '',
  className = '',
  onLoad,
  onError,
  ...props
}) {
  const { ref, loaded, error } = useLazyImage(src);

  return (
    <img
      ref={ref}
      src={placeholder}
      alt={alt}
      className={className}
      onLoad={onLoad}
      onError={onError}
      style={{
        opacity: loaded ? 1 : 0.7,
        transition: 'opacity 0.3s ease-in-out'
      }}
      {...props}
    />
  );
}



export function useResizeObserver(options = {}) {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!('ResizeObserver' in window)) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setSize({ width, height });
      }
    });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return { ref, size };
}

export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit = 100) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function prefetchImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function scheduleIdleTask(callback, options = {}) {
  if ('requestIdleCallback' in window) {
    return requestIdleCallback(callback, options);
  }

  return setTimeout(callback, 1);
}

export function cancelIdleTask(id) {
  if ('cancelIdleCallback' in window) {
    cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

export default {
  useLazyImage,
  useResizeObserver,
  debounce,
  throttle,
  prefetchImage,
  scheduleIdleTask,
  cancelIdleTask,
  LazyImage
};
