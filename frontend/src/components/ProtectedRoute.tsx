import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { authService } from '../services/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// These paths are part of the registration flow itself — exempt from the
// email-verified guard so users can finish onboarding before verifying.
const EXEMPT_FROM_EMAIL_GUARD = [
  '/verify-email',
  '/register/address',
  '/register/documents',
];

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = authService.isAuthenticated();
  const [checking, setChecking] = useState(true);
  const location = useLocation();

  // Email verification guard — only blocks users whose email_verified is
  // strictly false (new accounts). null/undefined = grandfathered existing user.
  const storedUser = authService.getCurrentUserFromStorage();
  const needsEmailVerification =
    isAuthenticated &&
    storedUser?.email_verified === false &&
    !EXEMPT_FROM_EMAIL_GUARD.includes(location.pathname);

  useEffect(() => {
    // Check restriction status when component mounts and periodically
    const checkRestriction = async () => {
      if (isAuthenticated) {
        try {
          await authService.checkRestrictionStatus();
        } catch (error) {
          // Error is handled by API interceptor
          // User will be logged out if restricted
        }
      }
      setChecking(false);
    };

    checkRestriction();

    // Check every 30 seconds while user is on the page
    const interval = setInterval(() => {
      if (isAuthenticated) {
        authService.checkRestrictionStatus().catch(() => {
          // Error handled by interceptor
        });
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect unverified new users to email verification.
  // Do this before the loading check so they never see protected content.
  if (needsEmailVerification) {
    return <Navigate to="/verify-email" replace />;
  }

  // Show loading while checking restriction (only on first mount)
  if (checking) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p>Loading...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return <>{children}</>;
}
