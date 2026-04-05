import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { authService } from '../services/auth';
import { PageSkeleton } from './Skeleton';

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
  const [onboardingRedirect, setOnboardingRedirect] = useState<string | null>(null);
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

          const onboarding = await authService.getOnboardingStatus();
          if (onboarding.needs_address) {
            setOnboardingRedirect('/register/address');
          } else if (onboarding.needs_registration_document) {
            setOnboardingRedirect('/register/documents');
          } else if (onboarding.needs_email_verification) {
            setOnboardingRedirect('/verify-email');
          } else {
            setOnboardingRedirect(null);
          }
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

  if (onboardingRedirect && onboardingRedirect !== location.pathname) {
    return <Navigate to={onboardingRedirect} replace />;
  }

  // Redirect unverified new users to email verification.
  // Do this before the loading check so they never see protected content.
  if (needsEmailVerification) {
    return <Navigate to="/verify-email" replace />;
  }

  // Show loading while checking restriction (only on first mount)
  if (checking) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <PageSkeleton titleWidth="w-52" withFilters rows={5} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
