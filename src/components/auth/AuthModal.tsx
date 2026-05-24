import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { XIcon, CarIcon, UserIcon, EyeIcon, EyeOffIcon, CheckCircleIcon, ShieldIcon, MailIcon } from '@/components/ui/Icons';


interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'login' | 'signup';
  initialRole?: UserRole;
}


const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose,
  onSuccess,
  initialMode = 'login',
  initialRole = 'rider'
}) => {
  const { login, signup, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [contractorAccepted, setContractorAccepted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showCreateAccountHint, setShowCreateAccountHint] = useState(false);

  // Reset contractor acceptance when role changes
  useEffect(() => {
    setContractorAccepted(false);
  }, [role]);

  // Sync with initial props when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setRole(initialRole);
      setContractorAccepted(false);
      setError('');
      setResetSent(false);
      setShowCreateAccountHint(false);
    }
  }, [isOpen, initialMode, initialRole]);

  if (!isOpen) return null;

  const formatPhoneNumber = (value: string) => {
    // Strip non-numeric characters
    const cleaned = value.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const isPhoneValid = (phoneStr: string) => {
    const cleaned = phoneStr.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email) {
      setError('Please enter your email address');
      setIsLoading(false);
      return;
    }

    const result = await resetPassword(email);
    if (result.success) {
      setResetSent(true);
    } else {
      setError(result.error || 'Failed to send reset email');
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowCreateAccountHint(false);
    setIsLoading(true);

    if (mode === 'signup') {
      // Validate phone number
      if (!phone || !isPhoneValid(phone)) {
        setError('Please enter a valid 10-digit phone number');
        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setIsLoading(false);
        return;
      }

      // Require contractor disclosure for drivers
      if (role === 'driver' && !contractorAccepted) {
        setError('You must acknowledge the independent contractor disclosure to continue');
        setIsLoading(false);
        return;
      }

      const result = await signup(email, password, fullName, role, phone);
      if (!result.success) {
        setError(result.error || 'Signup failed');
      } else {
        if (onSuccess) {
          onSuccess();
        } else {
          onClose();
        }
      }
    } else {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Login failed');
        // Show the create account hint when login fails
        setShowCreateAccountHint(true);
      } else {
        if (onSuccess) {
          onSuccess();
        } else {
          onClose();
        }
      }
    }
    setIsLoading(false);
  };

  const switchToMode = (newMode: 'login' | 'signup' | 'forgot') => {
    setMode(newMode);
    setError('');
    setResetSent(false);
    setShowCreateAccountHint(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-orange-600 to-orange-800 p-6 text-white">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <XIcon size={20} />
          </button>
          <div className="flex items-center mb-2">
            <span className="text-2xl font-bold text-white">sit<span className="text-orange-300">N</span>ride</span>
          </div>

          <h2 className="text-2xl font-bold">
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h2>
          <p className="text-orange-200 mt-1">
            {mode === 'login' 
              ? 'Sign in to continue' 
              : mode === 'signup' 
                ? 'Join the sitNride community' 
                : 'We\'ll send you a reset link'}
          </p>
        </div>

        {/* Forgot Password Mode */}
        {mode === 'forgot' && (
          <div className="p-6 space-y-4">
            {resetSent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircleIcon className="text-green-600" size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Check Your Email</h3>
                  <p className="text-gray-600 text-sm mt-2">
                    If an account exists for <strong>{email}</strong>, we've sent a password reset link. 
                    Please check your inbox and spam folder.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => switchToMode('login')}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all"
                >
                  Back to Sign In
                </button>
                <p className="text-sm text-gray-500">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchToMode('signup')}
                    className="text-orange-600 hover:underline font-medium"
                  >
                    Create one
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <MailIcon className="text-blue-600 flex-shrink-0" size={20} />
                  <p className="text-blue-800 text-sm">
                    Enter the email address associated with your account and we'll send you a link to reset your password.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all ${
                    isLoading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <div className="text-center text-sm text-gray-600 space-y-2">
                  <div>
                    Remember your password?{' '}
                    <button
                      type="button"
                      onClick={() => switchToMode('login')}
                      className="text-orange-600 hover:underline font-medium"
                    >
                      Sign in
                    </button>
                  </div>
                  <div>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchToMode('signup')}
                      className="text-orange-600 hover:underline font-medium"
                    >
                      Create one
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Login / Signup Modes */}
        {mode !== 'forgot' && (
          <>
            {/* Role Selection (Signup only) */}
            {mode === 'signup' && (
              <div className="p-4 bg-gray-50 border-b">
                <p className="text-sm text-gray-600 mb-3">I want to:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('rider')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      role === 'rider' 
                        ? 'border-orange-600 bg-orange-50 text-orange-700' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <UserIcon size={20} />
                    <span className="font-medium">Get a Ride</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('driver')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      role === 'driver' 
                        ? 'border-green-600 bg-green-50 text-green-700' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <CarIcon size={20} />
                    <span className="font-medium">Drive & Earn</span>
                  </button>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Show create account hint when login fails */}
              {showCreateAccountHint && mode === 'login' && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-orange-800 text-sm font-medium mb-2">Can't sign in?</p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => switchToMode('signup')}
                      className="w-full py-2 px-3 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                    >
                      Create a New Account
                    </button>
                    <button
                      type="button"
                      onClick={() => switchToMode('forgot')}
                      className="w-full py-2 px-3 bg-white border border-orange-300 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors"
                    >
                      Reset My Password
                    </button>
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    placeholder="John Doe"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                  required
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    placeholder="(555) 123-4567"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-400">Required for ride notifications and safety</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}

              {/* Forgot Password Link (Login only) */}
              {mode === 'login' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => switchToMode('forgot')}
                    className="text-sm text-orange-600 hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Independent Contractor Disclosure for Drivers */}
              {mode === 'signup' && role === 'driver' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <ShieldIcon className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="font-semibold text-green-900 text-sm">Independent Contractor Disclosure</p>
                      <p className="text-green-800 text-xs mt-1">
                        By signing up as a driver on sitNride, you acknowledge that you are an <strong>independent contractor</strong>, 
                        not an employee of sitNride or Digital Media Connect Pro LLC. You control when, where, and how long you work. 
                        sitNride is a technology platform that connects riders with independent drivers.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-green-200">
                    <input
                      type="checkbox"
                      checked={contractorAccepted}
                      onChange={(e) => setContractorAccepted(e.target.checked)}
                      className="mt-1 w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                    />
                    <span className="text-green-800 text-xs">
                      I understand and acknowledge that I will be an independent contractor on the sitNride platform, not an employee. 
                      I control my own schedule and driving activity.
                    </span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || (mode === 'signup' && role === 'driver' && !contractorAccepted)}
                className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
                  role === 'driver' && mode === 'signup'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                } ${isLoading || (mode === 'signup' && role === 'driver' && !contractorAccepted) ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>

              <div className="text-center text-sm text-gray-600">
                {mode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchToMode('signup')}
                      className="text-orange-600 hover:underline font-medium"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchToMode('login')}
                      className="text-orange-600 hover:underline font-medium"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </form>
          </>
        )}

        {/* Platform Notice */}
        <div className="px-6 pb-6">
          <p className="text-xs text-gray-500 text-center">
            sitNride is a technology platform connecting riders with independent drivers.
            sitNride does not provide transportation services.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
