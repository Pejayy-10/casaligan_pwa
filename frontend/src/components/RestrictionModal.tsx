import { useEffect } from 'react';

interface RestrictionModalProps {
  message: string;
  onClose: () => void;
}

export default function RestrictionModal({ message, onClose }: RestrictionModalProps) {
  useEffect(() => {
    // Auto-close and redirect after 3 seconds
    const timeout = setTimeout(() => {
      onClose();
      // Clear auth and redirect
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }, 3000);

    return () => clearTimeout(timeout);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '90%',
          width: '400px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '4rem',
            marginBottom: '1rem',
            color: '#e74c3c',
          }}
        >
          🚫
        </div>
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            color: '#2c3e50',
          }}
        >
          Account Restricted
        </h2>
        <p
          style={{
            fontSize: '1rem',
            color: '#7f8c8d',
            marginBottom: '1.5rem',
            lineHeight: '1.5',
          }}
        >
          {message}
        </p>
        <div
          style={{
            fontSize: '0.875rem',
            color: '#95a5a6',
            fontStyle: 'italic',
          }}
        >
          You will be logged out automatically in 3 seconds...
        </div>
      </div>
    </div>
  );
}
