import { useEffect } from 'react';

/**
 * Hook to lock/unlock body scroll when modal/overlay is open.
 * Automatically restores scroll on unmount.
 * @param isOpen - Whether the modal is open
 */
export function useScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (isOpen) {
      // Store the current scroll position
      const scrollY = window.scrollY;
      
      // Prevent scroll on body
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
      
      // Cleanup function
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);
}
