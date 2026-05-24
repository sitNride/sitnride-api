import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import LandingPage from '@/components/landing/LandingPage';
import DriverVerificationPage from '@/components/driver/DriverVerificationPage';
import DriverOnboarding from '@/components/driver/DriverOnboarding';
import DriverDashboard from '@/components/driver/DriverDashboard';
import RiderOnboarding from '@/components/rider/RiderOnboarding';
import RiderDashboard from '@/components/rider/RiderDashboard';
import AdminPanel from '@/components/admin/AdminPanel';
import PermissionsScreen from '@/components/permissions/PermissionsScreen';
import VehicleInspection from '@/components/driver/VehicleInspection';
import { RefreshIcon } from '@/components/ui/Icons';
import { VerificationStatus } from '@/types';

const AppContent: React.FC = () => {
  const { 
    user, 
    driverProfile, 
    riderProfile, 
    vehicle, 
    isLoading, 
    needsOnboarding,
    completeOnboarding,
    refreshDriverProfile, 
    refreshRiderProfile, 
    refreshVehicle 
  } = useAuth();
  const [riderOnboardingComplete, setRiderOnboardingComplete] = useState(false);
  // Always show landing page first - user must explicitly navigate away
  const [showLandingPage, setShowLandingPage] = useState(true);
  // Track whether permissions have been requested this session
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissionsComplete, setPermissionsComplete] = useState(false);

  // Driver verification state
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationChecked, setVerificationChecked] = useState(false);

  // Check if permissions have been completed before (stored in localStorage)
  useEffect(() => {
    if (user) {
      const permKey = `sitnride_permissions_${user.id}`;
      const completed = localStorage.getItem(permKey);
      if (completed === 'true') {
        setPermissionsComplete(true);
      }
    }
  }, [user]);

  // Reset verification state when user changes (e.g., logout then different driver logs in)
  useEffect(() => {
    setVerificationChecked(false);
    setVerificationStatus(null);
    setVerificationLoading(false);
  }, [user?.id]);

  // Load driver verification status when a driver user is detected
  useEffect(() => {
    if (user && user.role === 'driver' && driverProfile && !verificationChecked) {
      loadVerificationStatus();
    }
  }, [user, driverProfile, verificationChecked]);


  const loadVerificationStatus = async () => {
    if (!user) return;
    setVerificationLoading(true);

    try {
      const { data, error } = await supabase
        .from('driver_verifications')
        .select('verification_status')
        .eq('user_id', user.id)
        .maybeSingle();


      if (data && !error) {
        setVerificationStatus(data.verification_status as VerificationStatus);
      } else {
        // No verification record exists yet — driver needs to complete verification
        setVerificationStatus('incomplete');
      }
    } catch (err) {
      // If there's an error (e.g., table doesn't exist), treat as incomplete
      setVerificationStatus('incomplete');
    }

    setVerificationChecked(true);
    setVerificationLoading(false);
  };

  // Handler for when user successfully authenticates or chooses to go to their dashboard
  const handleEnterApp = () => {
    if (user && !permissionsComplete) {
      // Show permissions screen for new users
      setShowPermissions(true);
      setShowLandingPage(false);
    } else {
      setShowLandingPage(false);
    }
  };

  const handlePermissionsComplete = () => {
    if (user) {
      const permKey = `sitnride_permissions_${user.id}`;
      localStorage.setItem(permKey, 'true');
    }
    setPermissionsComplete(true);
    setShowPermissions(false);
  };

  // Called when driver verification is approved and driver clicks "Continue"
  const handleVerificationComplete = () => {
    setVerificationStatus('approved');
    refreshDriverProfile();
  };

  // Called when rider completes onboarding
  const handleRiderOnboardingComplete = async () => {
    await completeOnboarding();
    await refreshRiderProfile();
    setRiderOnboardingComplete(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshIcon className="animate-spin text-orange-600 mx-auto" size={40} />
          <p className="mt-4 text-gray-600">Loading sitNride...</p>
        </div>
      </div>
    );
  }

  // Always show landing page first (homepage is the default)
  // User must click a button to proceed to their dashboard/onboarding
  if (showLandingPage) {
    return <LandingPage onAuthSuccess={handleEnterApp} />;
  }

  // Not logged in - show landing page (fallback)
  if (!user) {
    return <LandingPage onAuthSuccess={handleEnterApp} />;
  }

  // Show permissions screen if not yet completed
  if (showPermissions && !permissionsComplete) {
    return (
      <PermissionsScreen
        userRole={user.role}
        onComplete={handlePermissionsComplete}
      />
    );
  }

  // Admin user
  if (user.role === 'admin') {
    return <AdminPanel />;
  }

  // Driver user
  if (user.role === 'driver') {
    // Step 0: Wait for verification status to load
    if (verificationLoading || !verificationChecked) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <RefreshIcon className="animate-spin text-green-600 mx-auto" size={40} />
            <p className="mt-4 text-gray-600">Checking verification status...</p>
          </div>
        </div>
      );
    }

    // Step 1: Driver must complete verification FIRST (before onboarding)
    // Show DriverVerificationPage if verification is not yet approved
    if (verificationStatus !== 'approved') {
      return (
        <DriverVerificationPage 
          onComplete={handleVerificationComplete}
        />
      );
    }

    // Step 2: After verification is approved, check if onboarding is complete
    if (!driverProfile || !driverProfile.onboarding_completed) {
      return <DriverOnboarding />;
    }
    
    // Step 3: Check if vehicle inspection is needed (after onboarding, before going online)
    // Vehicle must be approved before driver can access the full dashboard
    const vehicleApproved = vehicle?.inspection_status === 'approved' && vehicle?.is_approved;
    const vehicleNotSubmitted = !vehicle || vehicle.inspection_status === 'not_submitted' || !vehicle.inspection_status;
    const vehiclePending = vehicle?.inspection_status === 'pending_review';
    const vehicleRejected = vehicle?.inspection_status === 'rejected';
    
    if (vehicleNotSubmitted || vehiclePending || vehicleRejected) {
      return (
        <VehicleInspection 
          onComplete={() => {
            refreshVehicle();
          }} 
        />
      );
    }
    
    // Step 4: Show driver dashboard (vehicle is approved)
    return <DriverDashboard />;
  }

  // Rider user
  if (user.role === 'rider') {
    // ONLY show onboarding if needsOnboarding flag is true
    // This flag is ONLY set during signup, NEVER during login
    if (needsOnboarding) {
      return (
        <RiderOnboarding 
          onComplete={handleRiderOnboardingComplete} 
        />
      );
    }
    
    // Show rider dashboard (existing user logged in, or onboarding completed)
    return <RiderDashboard />;
  }

  // Fallback
  return <LandingPage onAuthSuccess={handleEnterApp} />;
};

const AppLayout: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default AppLayout;
