import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { DriverVerification } from '@/types';
import {
  CheckCircleIcon, UploadIcon, UserIcon, CarIcon, ShieldIcon,
  CameraIcon, ClockIcon, AlertCircleIcon, FileTextIcon, XCircleIcon, RefreshIcon
} from '@/components/ui/Icons';

interface DriverVerificationPageProps {
  onComplete?: () => void;
}

const DriverVerificationPage: React.FC<DriverVerificationPageProps> = ({ onComplete }) => {
  const { user, driverProfile, logout } = useAuth();
  const [verification, setVerification] = useState<DriverVerification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Form state
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [licenseFront, setLicenseFront] = useState<string | null>(null);
  const [licenseBack, setLicenseBack] = useState<string | null>(null);
  const [insuranceDoc, setInsuranceDoc] = useState<string | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [cameraAck, setCameraAck] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // File input refs
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const licenseFrontRef = useRef<HTMLInputElement>(null);
  const licenseBackRef = useRef<HTMLInputElement>(null);
  const insuranceDocRef = useRef<HTMLInputElement>(null);
  const vehiclePhotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadVerification();
  }, []);

  const loadVerification = async () => {
    if (!user || !driverProfile) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from('driver_verifications')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();


    if (data && !error) {
      setVerification(data);
      // Pre-fill form from existing data
      setProfilePhoto(data.profile_photo_url || null);
      setLicenseFront(data.license_front_url || driverProfile.license_front_url || null);
      setLicenseBack(data.license_back_url || driverProfile.license_back_url || null);
      setInsuranceDoc(data.insurance_document_url || null);
      setVehiclePhoto(data.vehicle_photo_url || null);
      setVehicleMake(data.vehicle_make || '');
      setVehicleModel(data.vehicle_model || '');
      setVehicleYear(data.vehicle_year?.toString() || '');
      setVehiclePlate(data.vehicle_license_plate || '');
      setVehicleDescription(data.vehicle_description || '');
      setCameraAck(data.camera_acknowledgment || false);
    } else {
      // Create new verification record
      const { data: newVerification } = await supabase
        .from('driver_verifications')
        .insert({
          driver_id: driverProfile.id,
          user_id: user.id,
          verification_status: 'incomplete',
          // Pre-fill from existing onboarding data
          license_front_url: driverProfile.license_front_url || null,
          license_back_url: driverProfile.license_back_url || null,
        })
        .select()
        .single();

      if (newVerification) {
        setVerification(newVerification);
        setLicenseFront(driverProfile.license_front_url || null);
        setLicenseBack(driverProfile.license_back_url || null);
      }
    }
    setIsLoading(false);
  };

  const handleFileUpload = async (file: File, field: string) => {
    if (!driverProfile || !verification) return;
    setUploading(field);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${driverProfile.id}/verification-${field}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(fileName);

      const url = urlData.publicUrl;

      // Update local state
      switch (field) {
        case 'profile_photo': setProfilePhoto(url); break;
        case 'license_front': setLicenseFront(url); break;
        case 'license_back': setLicenseBack(url); break;
        case 'insurance_doc': setInsuranceDoc(url); break;
        case 'vehicle_photo': setVehiclePhoto(url); break;
      }

      // Save to DB immediately
      const dbField = field === 'profile_photo' ? 'profile_photo_url'
        : field === 'license_front' ? 'license_front_url'
        : field === 'license_back' ? 'license_back_url'
        : field === 'insurance_doc' ? 'insurance_document_url'
        : 'vehicle_photo_url';

      await supabase
        .from('driver_verifications')
        .update({ [dbField]: url, updated_at: new Date().toISOString() })
        .eq('id', verification.id);

      // Clear error for this field
      setErrors(prev => ({ ...prev, [field]: '' }));
    } catch (err) {
      console.error('Upload error:', err);
    }
    setUploading(null);
  };

  const saveProgress = async () => {
    if (!verification) return;
    setIsSaving(true);

    await supabase
      .from('driver_verifications')
      .update({
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_year: vehicleYear ? parseInt(vehicleYear) : null,
        vehicle_license_plate: vehiclePlate,
        vehicle_description: vehicleDescription,
        camera_acknowledgment: cameraAck,
        updated_at: new Date().toISOString(),
      })
      .eq('id', verification.id);

    setIsSaving(false);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!profilePhoto) newErrors.profile_photo = 'Profile photo is required';
    if (!licenseFront) newErrors.license_front = 'License front photo is required';
    if (!licenseBack) newErrors.license_back = 'License back photo is required';
    if (!insuranceDoc) newErrors.insurance_doc = 'Insurance document is required';
    if (!vehicleMake.trim()) newErrors.vehicle_make = 'Vehicle make is required';
    if (!vehicleModel.trim()) newErrors.vehicle_model = 'Vehicle model is required';
    if (!vehicleYear.trim()) newErrors.vehicle_year = 'Vehicle year is required';
    if (!vehiclePlate.trim()) newErrors.vehicle_plate = 'License plate is required';
    if (!vehicleDescription.trim()) newErrors.vehicle_description = 'Vehicle description is required';
    if (!vehiclePhoto) newErrors.vehicle_photo = 'Vehicle photo is required';
    if (!cameraAck) newErrors.camera_ack = 'Camera acknowledgment is required';

    if (vehicleYear) {
      const year = parseInt(vehicleYear);
      if (year < 2010 || year > new Date().getFullYear() + 1) {
        newErrors.vehicle_year = 'Vehicle must be 2010 or newer';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !verification || !driverProfile || !user) return;
    setIsSaving(true);

    try {
      // Update verification record
      await supabase
        .from('driver_verifications')
        .update({
          verification_status: 'pending_review',
          vehicle_make: vehicleMake,
          vehicle_model: vehicleModel,
          vehicle_year: parseInt(vehicleYear),
          vehicle_license_plate: vehiclePlate,
          vehicle_description: vehicleDescription,
          camera_acknowledgment: cameraAck,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', verification.id);

      // Log the submission
      await supabase
        .from('driver_verification_logs')
        .insert({
          verification_id: verification.id,
          driver_id: driverProfile.id,
          action: 'submitted',
          performed_by: user.id,
          notes: 'Driver submitted verification for review',
        });

      // Update driver profile status
      await supabase
        .from('driver_profiles')
        .update({ status: 'pending_background_check' })
        .eq('id', driverProfile.id);

      // Refresh verification data
      setVerification({
        ...verification,
        verification_status: 'pending_review',
        submitted_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Submit error:', err);
    }
    setIsSaving(false);
  };

  const handleResubmit = async () => {
    if (!validate() || !verification || !driverProfile || !user) return;
    setIsSaving(true);

    try {
      await supabase
        .from('driver_verifications')
        .update({
          verification_status: 'pending_review',
          vehicle_make: vehicleMake,
          vehicle_model: vehicleModel,
          vehicle_year: parseInt(vehicleYear),
          vehicle_license_plate: vehiclePlate,
          vehicle_description: vehicleDescription,
          camera_acknowledgment: cameraAck,
          rejection_reason: null,
          update_requested_fields: null,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', verification.id);

      await supabase
        .from('driver_verification_logs')
        .insert({
          verification_id: verification.id,
          driver_id: driverProfile.id,
          action: 'resubmitted',
          performed_by: user.id,
          notes: 'Driver resubmitted verification after update request',
        });

      setVerification({
        ...verification,
        verification_status: 'pending_review',
        submitted_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Resubmit error:', err);
    }
    setIsSaving(false);
  };

  // Checklist items for progress tracking
  const checklistItems = [
    { key: 'profile_photo', label: 'Profile Photo', done: !!profilePhoto },
    { key: 'license_front', label: 'License (Front)', done: !!licenseFront },
    { key: 'license_back', label: 'License (Back)', done: !!licenseBack },
    { key: 'insurance_doc', label: 'Proof of Insurance', done: !!insuranceDoc },
    { key: 'vehicle_info', label: 'Vehicle Information', done: !!vehicleMake && !!vehicleModel && !!vehicleYear && !!vehiclePlate },
    { key: 'vehicle_desc', label: 'Vehicle Description', done: !!vehicleDescription.trim() },
    { key: 'vehicle_photo', label: 'Vehicle Photo', done: !!vehiclePhoto },
    { key: 'camera_ack', label: 'Camera Acknowledgment', done: cameraAck },
  ];
  const completedCount = checklistItems.filter(i => i.done).length;
  const totalCount = checklistItems.length;
  const allComplete = completedCount === totalCount;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2009 }, (_, i) => currentYear + 1 - i);

  const isEditable = !verification || verification.verification_status === 'incomplete' || verification.verification_status === 'needs_update' || verification.verification_status === 'rejected';
  const isPending = verification?.verification_status === 'pending_review';
  const isApproved = verification?.verification_status === 'approved';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshIcon className="animate-spin text-green-600 mx-auto" size={40} />
          <p className="mt-4 text-gray-600">Loading verification...</p>
        </div>
      </div>
    );
  }

  // Approved state
  if (isApproved) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircleIcon className="text-green-600" size={40} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Verification Approved!</h2>
          <p className="mt-2 text-gray-600">
            Your driver verification has been approved. You can now proceed to set up your vehicle and start earning.
          </p>
          <button
            onClick={onComplete}
            className="mt-6 w-full py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Pending Review state
  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <span className="text-2xl font-bold text-gray-900">sit<span className="text-green-600">N</span>ride</span>
            <p className="text-sm text-gray-500 mt-1">Driver Verification</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <ClockIcon className="text-amber-600" size={40} />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Verification Under Review</h2>

            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-amber-800 font-medium text-sm">Status: Pending Review</span>
            </div>

            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-800">
                <ClockIcon size={20} />
                <span className="font-semibold">Typical review time: 24–48 hours</span>
              </div>
              <p className="mt-2 text-sm text-green-700">
                Most driver applications are reviewed within 24–48 hours. You will be notified by email and on your dashboard when your verification is complete.
              </p>
            </div>

            <p className="mt-4 text-gray-600 text-sm">
              Submitted: {verification?.submitted_at ? new Date(verification.submitted_at).toLocaleString() : 'N/A'}
            </p>

            <div className="mt-6 bg-gray-50 rounded-xl p-4 text-left">
              <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
              <div className="space-y-3">
                {[
                  { num: '1', title: 'Document Review', desc: 'Our team verifies your documents and photos' },
                  { num: '2', title: 'Background Check', desc: 'We run a safety background check' },
                  { num: '3', title: 'Approval Notification', desc: "You'll receive an email when approved" },
                ].map(step => (
                  <div key={step.num} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-green-600 font-semibold text-sm">{step.num}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{step.title}</p>
                      <p className="text-sm text-gray-600">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={logout}
              className="mt-6 px-6 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Upload box component
  const UploadBox = ({ field, label, value, inputRef, accept = 'image/*', hint }: {
    field: string; label: string; value: string | null;
    inputRef: React.RefObject<HTMLInputElement>; accept?: string; hint?: string;
  }) => (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], field)}
      />
      <div
        onClick={() => isEditable && inputRef.current?.click()}
        className={`relative aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden ${
          !isEditable ? 'cursor-default opacity-70' :
          value ? 'border-green-500 bg-green-50 cursor-pointer' : 
          errors[field] ? 'border-red-400 bg-red-50 cursor-pointer' :
          'border-gray-300 hover:border-green-500 hover:bg-green-50 cursor-pointer'
        }`}
      >
        {uploading === field ? (
          <div className="text-center">
            <RefreshIcon className="animate-spin text-green-600 mx-auto" size={28} />
            <p className="text-sm text-green-600 mt-2">Uploading...</p>
          </div>
        ) : value ? (
          <>
            <img src={value} alt={label} className="w-full h-full object-cover rounded-xl" />
            {isEditable && (
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                <p className="text-white text-sm font-medium">Click to replace</p>
              </div>
            )}
          </>
        ) : (
          <>
            <UploadIcon className="text-gray-400" size={28} />
            <p className="text-sm text-gray-500 mt-2">Click to upload</p>
          </>
        )}
      </div>
      {errors[field] && <p className="text-red-500 text-xs mt-1">{errors[field]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-2xl font-bold text-gray-900">sit<span className="text-green-600">N</span>ride</span>
          <p className="text-sm text-gray-500 mt-1">Driver Verification</p>
        </div>

        {/* Title */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-6 mb-6 text-white">
          <h1 className="text-2xl font-bold">Complete Your Driver Verification to Start Earning</h1>
          <p className="mt-2 text-green-100">
            All items below must be completed before your application can be reviewed and approved.
          </p>
          <div className="mt-4 bg-white/15 rounded-xl p-3 flex items-center gap-2">
            <ClockIcon size={18} />
            <span className="text-sm font-medium">Most applications are reviewed within 24–48 hours after submission.</span>
          </div>
        </div>

        {/* Rejection / Needs Update Banner */}
        {verification?.verification_status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <XCircleIcon className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-red-800">Verification Rejected</p>
                {verification.rejection_reason && (
                  <p className="mt-1 text-sm text-red-700">Reason: {verification.rejection_reason}</p>
                )}
                <p className="mt-2 text-sm text-red-600">Please update the required items and resubmit.</p>
              </div>
            </div>
          </div>
        )}

        {verification?.verification_status === 'needs_update' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-amber-800">Update Requested</p>
                {verification.update_requested_fields && (
                  <p className="mt-1 text-sm text-amber-700">{verification.update_requested_fields}</p>
                )}
                {verification.admin_notes && (
                  <p className="mt-1 text-sm text-amber-600">Admin notes: {verification.admin_notes}</p>
                )}
                <p className="mt-2 text-sm text-amber-600">Please update the requested items and resubmit.</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Checklist */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Verification Checklist</h2>
            <span className="text-sm font-medium text-gray-500">{completedCount}/{totalCount} complete</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-green-600 transition-all duration-300"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {checklistItems.map(item => (
              <div key={item.key} className={`flex items-center gap-2 text-sm ${item.done ? 'text-green-700' : 'text-gray-400'}`}>
                {item.done ? <CheckCircleIcon size={16} className="text-green-600 flex-shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 1: Profile Photo */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <UserIcon className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Profile Photo</h3>
              <p className="text-sm text-gray-500">Clear photo of your face. Must NOT be a photo of your driver's license.</p>
            </div>
          </div>
          <div className="max-w-xs">
            <UploadBox
              field="profile_photo"
              label="Your Profile Photo"
              value={profilePhoto}
              inputRef={profilePhotoRef as React.RefObject<HTMLInputElement>}
              hint="Face clearly visible, well-lit, no sunglasses"
            />
          </div>
        </div>

        {/* Section 2: Driver's License */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <FileTextIcon className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Driver's License (Government ID)</h3>
              <p className="text-sm text-gray-500">Upload front and back. Must be valid and unexpired.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <UploadBox
              field="license_front"
              label="Front of License"
              value={licenseFront}
              inputRef={licenseFrontRef as React.RefObject<HTMLInputElement>}
            />
            <UploadBox
              field="license_back"
              label="Back of License"
              value={licenseBack}
              inputRef={licenseBackRef as React.RefObject<HTMLInputElement>}
            />
          </div>
        </div>

        {/* Section 3: Proof of Insurance */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <ShieldIcon className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Proof of Insurance</h3>
              <p className="text-sm text-gray-500">Upload your current insurance document.</p>
            </div>
          </div>
          <div className="max-w-xs">
            <UploadBox
              field="insurance_doc"
              label="Insurance Document"
              value={insuranceDoc}
              inputRef={insuranceDocRef as React.RefObject<HTMLInputElement>}
              accept="image/*,.pdf"
              hint="Photo or PDF of your current insurance card/document"
            />
          </div>
        </div>

        {/* Section 4: Vehicle Information */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CarIcon className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Vehicle Information</h3>
              <p className="text-sm text-gray-500">Provide details about the vehicle you will drive.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                <input
                  type="text"
                  value={vehicleMake}
                  onChange={(e) => { setVehicleMake(e.target.value); setErrors(prev => ({ ...prev, vehicle_make: '' })); }}
                  placeholder="Honda"
                  disabled={!isEditable}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 ${errors.vehicle_make ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.vehicle_make && <p className="text-red-500 text-xs mt-1">{errors.vehicle_make}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => { setVehicleModel(e.target.value); setErrors(prev => ({ ...prev, vehicle_model: '' })); }}
                  placeholder="Accord"
                  disabled={!isEditable}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 ${errors.vehicle_model ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.vehicle_model && <p className="text-red-500 text-xs mt-1">{errors.vehicle_model}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <select
                  value={vehicleYear}
                  onChange={(e) => { setVehicleYear(e.target.value); setErrors(prev => ({ ...prev, vehicle_year: '' })); }}
                  disabled={!isEditable}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 ${errors.vehicle_year ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Select Year</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {errors.vehicle_year && <p className="text-red-500 text-xs mt-1">{errors.vehicle_year}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Plate Number</label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => { setVehiclePlate(e.target.value); setErrors(prev => ({ ...prev, vehicle_plate: '' })); }}
                  placeholder="ABC 1234"
                  disabled={!isEditable}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 ${errors.vehicle_plate ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.vehicle_plate && <p className="text-red-500 text-xs mt-1">{errors.vehicle_plate}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Description <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Include color, body type, and identifying features. Example: "Silver Honda Accord, 4-door sedan"
              </p>
              <textarea
                value={vehicleDescription}
                onChange={(e) => { setVehicleDescription(e.target.value); setErrors(prev => ({ ...prev, vehicle_description: '' })); }}
                placeholder="Silver Honda Accord, 4-door sedan"
                rows={3}
                disabled={!isEditable}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 ${errors.vehicle_description ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.vehicle_description && <p className="text-red-500 text-xs mt-1">{errors.vehicle_description}</p>}
            </div>
          </div>
        </div>

        {/* Section 5: Vehicle Photo */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CameraIcon className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Vehicle Photo</h3>
              <p className="text-sm text-gray-500">Clear photo of your vehicle. License plate should be visible if possible.</p>
            </div>
          </div>
          <div className="max-w-xs">
            <UploadBox
              field="vehicle_photo"
              label="Vehicle Photo"
              value={vehiclePhoto}
              inputRef={vehiclePhotoRef as React.RefObject<HTMLInputElement>}
              hint="Full exterior view of vehicle, license plate visible"
            />
          </div>
        </div>

        {/* Section 6: Camera Acknowledgment */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CameraIcon className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">In-Car Camera Requirement</h3>
              <p className="text-sm text-gray-500">Drivers must have or be willing to install a forward-facing in-car camera.</p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-green-800">
              For the safety of both drivers and riders, sitNride requires all drivers to have a forward-facing in-car camera installed and operational during rides. This camera may be used for safety purposes, dispute resolution, or lawful requests by authorized officials.
            </p>
          </div>

          <label className={`flex items-start gap-3 cursor-pointer p-4 rounded-xl transition-colors ${cameraAck ? 'bg-green-50 border border-green-200' : errors.camera_ack ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
            <input
              type="checkbox"
              checked={cameraAck}
              onChange={(e) => { setCameraAck(e.target.checked); setErrors(prev => ({ ...prev, camera_ack: '' })); }}
              disabled={!isEditable}
              className="mt-1 w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">
              I acknowledge that I am responsible for providing, installing, and maintaining my own in-car camera. I understand that sitNride does not supply or maintain cameras. I agree that the camera must be safely installed, operational, and available if required for safety, dispute resolution, or lawful requests by authorized officials.
            </span>
          </label>
          {errors.camera_ack && <p className="text-red-500 text-xs mt-2">{errors.camera_ack}</p>}
        </div>

        {/* Driver Requirements Section */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
          <h4 className="font-semibold text-gray-900 mb-2">Driver Requirements</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li className="flex items-start gap-2"><CheckCircleIcon size={16} className="text-green-600 flex-shrink-0 mt-0.5" /> Must be at least 21 years old</li>
            <li className="flex items-start gap-2"><CheckCircleIcon size={16} className="text-green-600 flex-shrink-0 mt-0.5" /> Valid driver's license (unexpired)</li>
            <li className="flex items-start gap-2"><CheckCircleIcon size={16} className="text-green-600 flex-shrink-0 mt-0.5" /> Current auto insurance covering rideshare</li>
            <li className="flex items-start gap-2"><CheckCircleIcon size={16} className="text-green-600 flex-shrink-0 mt-0.5" /> Vehicle 2010 or newer</li>
            <li className="flex items-start gap-2"><CheckCircleIcon size={16} className="text-green-600 flex-shrink-0 mt-0.5" /> Forward-facing in-car camera required</li>
            <li className="flex items-start gap-2"><CheckCircleIcon size={16} className="text-green-600 flex-shrink-0 mt-0.5" /> Pass background check</li>
          </ul>
        </div>

        {/* Support Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-sm text-blue-800">
              If you experience any issues while completing this form or uploading documents, please email us immediately with a detailed description of the problem. A member of our team will review your message and respond within 24 hours.
            </p>
          </div>
        </div>

        {/* Submit Buttons */}

        {isEditable && (
          <div className="space-y-3 mb-8">
            {Object.keys(errors).length > 0 && Object.values(errors).some(e => e) && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircleIcon size={18} />
                  <span className="font-medium text-sm">Please complete all required fields before submitting.</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={saveProgress}
                disabled={isSaving}
                className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <RefreshIcon className="animate-spin" size={18} /> : null}
                Save Progress
              </button>
              <button
                onClick={verification?.verification_status === 'needs_update' || verification?.verification_status === 'rejected' ? handleResubmit : handleSubmit}
                disabled={isSaving || !allComplete}
                className={`flex-1 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                  allComplete && !isSaving ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/25' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {isSaving ? <RefreshIcon className="animate-spin" size={18} /> : <CheckCircleIcon size={18} />}
                {verification?.verification_status === 'needs_update' || verification?.verification_status === 'rejected' ? 'Resubmit Verification' : 'Submit for Review'}
              </button>
            </div>

            {!allComplete && (
              <p className="text-center text-sm text-gray-500">
                Complete all {totalCount} checklist items to submit your verification.
              </p>
            )}
          </div>
        )}

        {/* Sign Out */}
        <div className="text-center pb-8">
          <button onClick={logout} className="text-gray-500 hover:text-gray-700 text-sm transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverVerificationPage;
