import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { Vehicle } from '@/types';
import {
  CarIcon, CameraIcon, CheckCircleIcon, ChevronRightIcon, ChevronLeftIcon,
  UploadIcon, ShieldIcon, AlertTriangleIcon, ClockIcon, XCircleIcon, RefreshIcon
} from '@/components/ui/Icons';

const CURRENT_YEAR = new Date().getFullYear();
const MIN_VEHICLE_YEAR = CURRENT_YEAR - 15;

interface VehicleInspectionProps {
  onComplete: () => void;
}

// Step 1: Vehicle Details
const VehicleDetailsStep: React.FC<{
  vehicle: Vehicle | null;
  onNext: (data: Partial<Vehicle>) => void;
}> = ({ vehicle, onNext }) => {
  const [formData, setFormData] = useState({
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    year: vehicle?.year?.toString() || '',
    color: vehicle?.color || '',
    license_plate: vehicle?.license_plate || '',
    vin: vehicle?.vin || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.make.trim()) newErrors.make = 'Vehicle make is required';
    if (!formData.model.trim()) newErrors.model = 'Vehicle model is required';
    if (!formData.year) newErrors.year = 'Vehicle year is required';
    if (!formData.color.trim()) newErrors.color = 'Vehicle color is required';
    if (!formData.license_plate.trim()) newErrors.license_plate = 'License plate is required';
    if (!formData.vin.trim()) newErrors.vin = 'VIN is required';
    
    if (formData.vin.trim() && formData.vin.trim().length !== 17) {
      newErrors.vin = 'VIN must be exactly 17 characters';
    }

    const year = parseInt(formData.year);
    if (year && year < MIN_VEHICLE_YEAR) {
      newErrors.year = `Vehicle must be ${CURRENT_YEAR - MIN_VEHICLE_YEAR} years old or newer (${MIN_VEHICLE_YEAR} or later)`;
    }
    if (year && year > CURRENT_YEAR + 1) {
      newErrors.year = 'Invalid vehicle year';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onNext({
        make: formData.make.trim(),
        model: formData.model.trim(),
        year: parseInt(formData.year),
        color: formData.color.trim(),
        license_plate: formData.license_plate.trim().toUpperCase(),
        vin: formData.vin.trim().toUpperCase(),
      });
    }
  };

  const years = Array.from({ length: CURRENT_YEAR + 1 - MIN_VEHICLE_YEAR + 1 }, (_, i) => CURRENT_YEAR + 1 - i);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <CarIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Vehicle Details</h2>
        <p className="mt-2 text-gray-600">
          Provide your vehicle information for inspection verification
        </p>
      </div>

      {/* Age Requirement Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ShieldIcon className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">Vehicle Age Requirement</p>
            <p className="mt-1">
              Vehicles must be model year {MIN_VEHICLE_YEAR} or newer (no older than 15 years) to qualify for the sitNride platform.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Make <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="make"
              value={formData.make}
              onChange={handleChange}
              placeholder="e.g. Toyota"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                errors.make ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.make && <p className="text-red-500 text-sm mt-1">{errors.make}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              placeholder="e.g. Camry"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                errors.model ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.model && <p className="text-red-500 text-sm mt-1">{errors.model}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year <span className="text-red-500">*</span></label>
            <select
              name="year"
              value={formData.year}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                errors.year ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select Year</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {errors.year && <p className="text-red-500 text-sm mt-1">{errors.year}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="color"
              value={formData.color}
              onChange={handleChange}
              placeholder="e.g. Silver"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                errors.color ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.color && <p className="text-red-500 text-sm mt-1">{errors.color}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">License Plate <span className="text-red-500">*</span></label>
          <input
            type="text"
            name="license_plate"
            value={formData.license_plate}
            onChange={handleChange}
            placeholder="e.g. ABC 1234"
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
              errors.license_plate ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.license_plate && <p className="text-red-500 text-sm mt-1">{errors.license_plate}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vehicle Identification Number (VIN) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="vin"
            value={formData.vin}
            onChange={handleChange}
            placeholder="17-character VIN"
            maxLength={17}
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono tracking-wider uppercase ${
              errors.vin ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <p className="text-xs text-gray-500 mt-1">
            Found on your registration, insurance card, or driver-side dashboard
          </p>
          {errors.vin && <p className="text-red-500 text-sm mt-1">{errors.vin}</p>}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full py-4 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
      >
        Continue to Vehicle Photos <ChevronRightIcon size={20} />
      </button>
    </div>
  );
};

// Step 2: Vehicle Photos
const VehiclePhotosStep: React.FC<{
  vehicle: Vehicle | null;
  onNext: (photos: Record<string, string>) => void;
  onBack: () => void;
}> = ({ vehicle, onNext, onBack }) => {
  const { driverProfile } = useAuth();
  const [photos, setPhotos] = useState<Record<string, string>>({
    front: vehicle?.photo_front_url || '',
    back: vehicle?.photo_back_url || '',
    interior: vehicle?.photo_interior_url || '',
    odometer: vehicle?.photo_odometer_url || '',
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = {
    front: useRef<HTMLInputElement>(null),
    back: useRef<HTMLInputElement>(null),
    interior: useRef<HTMLInputElement>(null),
    odometer: useRef<HTMLInputElement>(null),
  };

  const photoLabels: Record<string, { title: string; description: string }> = {
    front: { title: 'Front View', description: 'Clear photo of the front of your vehicle' },
    back: { title: 'Rear View', description: 'Clear photo of the back of your vehicle' },
    interior: { title: 'Interior View', description: 'Photo showing the passenger area and seats' },
    odometer: { title: 'Odometer Reading', description: 'Current mileage displayed on your dashboard' },
  };

  const handleFileUpload = async (file: File, photoType: string) => {
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setUploading(photoType);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${driverProfile?.id}/vehicle-${photoType}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(fileName);

      setPhotos(prev => ({ ...prev, [photoType]: urlData.publicUrl }));
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload photo. Please try again.');
    }
    setUploading(null);
  };

  const allPhotosUploaded = Object.values(photos).every(url => url !== '');

  const handleSubmit = () => {
    if (allPhotosUploaded) {
      onNext(photos);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <CameraIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Vehicle Photos</h2>
        <p className="mt-2 text-gray-600">
          Upload clear photos of your vehicle for inspection review
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangleIcon className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Photo Requirements</p>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>Photos must be clear and well-lit</li>
              <li>Vehicle must be clean and presentable</li>
              <li>License plate must be visible in front/rear photos</li>
              <li>Interior must show clean, damage-free passenger area</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(photoLabels).map(([key, label]) => (
          <div key={key}>
            <p className="text-sm font-medium text-gray-700 mb-1">{label.title} <span className="text-red-500">*</span></p>
            <p className="text-xs text-gray-500 mb-2">{label.description}</p>
            <input
              ref={fileInputRefs[key as keyof typeof fileInputRefs]}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], key)}
            />
            <div
              onClick={() => fileInputRefs[key as keyof typeof fileInputRefs].current?.click()}
              className={`aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
                photos[key]
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-orange-500 hover:bg-orange-50'
              }`}
            >
              {uploading === key ? (
                <div className="flex flex-col items-center">
                  <RefreshIcon className="animate-spin text-orange-600" size={32} />
                  <p className="text-sm text-orange-600 mt-2">Uploading...</p>
                </div>
              ) : photos[key] ? (
                <div className="relative w-full h-full">
                  <img src={photos[key]} alt={label.title} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="text-white" size={16} />
                  </div>
                </div>
              ) : (
                <>
                  <UploadIcon className="text-gray-400" size={28} />
                  <p className="text-xs text-gray-500 mt-2 text-center px-2">Tap to upload</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeftIcon size={20} /> Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!allPhotosUploaded || !!uploading}
          className={`flex-1 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            allPhotosUploaded && !uploading
              ? 'bg-orange-600 hover:bg-orange-700'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Continue <ChevronRightIcon size={20} />
        </button>
      </div>
    </div>
  );
};

// Step 3: Safety Checklist
const SafetyChecklistStep: React.FC<{
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}> = ({ onSubmit, onBack, submitting }) => {
  const [checks, setChecks] = useState<Record<string, boolean>>({
    brakes: false,
    tires: false,
    lights: false,
    seatbelts: false,
    mirrors: false,
    horn: false,
    wipers: false,
    exhaust: false,
    doors: false,
    ac: false,
  });

  const checkLabels: Record<string, string> = {
    brakes: 'Brakes are in good working condition',
    tires: 'All tires have adequate tread depth and are properly inflated',
    lights: 'All headlights, taillights, brake lights, and turn signals work',
    seatbelts: 'All seatbelts function properly for driver and passengers',
    mirrors: 'All mirrors (rearview and side) are intact and adjustable',
    horn: 'Horn is functional',
    wipers: 'Windshield wipers work and windshield is free of major cracks',
    exhaust: 'No excessive exhaust smoke or unusual engine noises',
    doors: 'All doors open, close, and lock properly',
    ac: 'Heating and air conditioning are functional',
  };

  const allChecked = Object.values(checks).every(v => v);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Safety Requirements</h2>
        <p className="mt-2 text-gray-600">
          Confirm your vehicle meets all safety standards required by sitNride
        </p>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangleIcon className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-red-800">
            <p className="font-semibold">Important Safety Notice</p>
            <p className="mt-1">
              By checking each item below, you certify that your vehicle meets these safety standards. 
              Providing false information may result in deactivation from the sitNride platform.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(checkLabels).map(([key, label]) => (
          <label
            key={key}
            className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
              checks[key] ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <input
              type="checkbox"
              checked={checks[key]}
              onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })}
              className="mt-0.5 w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
            />
            <span className={`text-sm ${checks[key] ? 'text-green-800' : 'text-gray-700'}`}>
              {label}
            </span>
          </label>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs text-gray-500 text-center">
          As an independent contractor on the sitNride platform, you are responsible for maintaining 
          your vehicle in safe operating condition at all times. sitNride may conduct periodic 
          vehicle inspections to ensure ongoing compliance.
        </p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeftIcon size={20} /> Back
        </button>
        <button
          onClick={onSubmit}
          disabled={!allChecked || submitting}
          className={`flex-1 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            allChecked && !submitting
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <>
              <RefreshIcon className="animate-spin" size={20} />
              Submitting...
            </>
          ) : (
            <>
              Submit for Review <ChevronRightIcon size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Pending Review Screen
const PendingReviewScreen: React.FC<{ vehicle: Vehicle | null }> = ({ vehicle }) => {
  return (
    <div className="space-y-6 text-center">
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
        <ClockIcon className="text-amber-600" size={40} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Vehicle Inspection Pending</h2>
      <p className="text-gray-600 max-w-md mx-auto">
        Your vehicle inspection has been submitted and is currently under review by our team.
      </p>

      {vehicle && (
        <div className="bg-gray-50 rounded-xl p-6 text-left max-w-md mx-auto">
          <h3 className="font-semibold text-gray-900 mb-3">Submitted Vehicle</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Vehicle</span>
              <span className="font-medium text-gray-900">{vehicle.year} {vehicle.make} {vehicle.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Color</span>
              <span className="font-medium text-gray-900">{vehicle.color}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">License Plate</span>
              <span className="font-medium text-gray-900">{vehicle.license_plate}</span>
            </div>
            {vehicle.vin && (
              <div className="flex justify-between">
                <span className="text-gray-500">VIN</span>
                <span className="font-medium text-gray-900 font-mono text-xs">{vehicle.vin}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-md mx-auto">
        <p className="text-blue-800 text-sm">
          Vehicle inspections are typically reviewed within 1-2 business days. 
          You will be notified once your vehicle has been reviewed.
        </p>
      </div>
    </div>
  );
};

// Rejected Screen
const RejectedScreen: React.FC<{
  vehicle: Vehicle | null;
  onResubmit: () => void;
}> = ({ vehicle, onResubmit }) => {
  return (
    <div className="space-y-6 text-center">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
        <XCircleIcon className="text-red-600" size={40} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Vehicle Inspection Not Approved</h2>
      <p className="text-gray-600 max-w-md mx-auto">
        Your vehicle inspection was not approved. Please review the feedback below and resubmit.
      </p>

      {vehicle?.admin_rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-w-md mx-auto text-left">
          <p className="text-sm font-semibold text-red-800 mb-2">Reason for Rejection:</p>
          <p className="text-sm text-red-700">{vehicle.admin_rejection_reason}</p>
        </div>
      )}

      {vehicle?.inspection_notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-md mx-auto text-left">
          <p className="text-sm font-semibold text-amber-800 mb-2">Reviewer Notes:</p>
          <p className="text-sm text-amber-700">{vehicle.inspection_notes}</p>
        </div>
      )}

      <button
        onClick={onResubmit}
        className="px-8 py-4 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all inline-flex items-center gap-2"
      >
        <RefreshIcon size={20} /> Resubmit Vehicle Inspection
      </button>
    </div>
  );
};

// Main Vehicle Inspection Component
const VehicleInspection: React.FC<VehicleInspectionProps> = ({ onComplete }) => {
  const { driverProfile, vehicle, setVehicle, refreshVehicle } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [vehicleData, setVehicleData] = useState<Partial<Vehicle>>({});
  const [photoData, setPhotoData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // If vehicle already exists and has been submitted, show appropriate screen
  if (vehicle?.inspection_status === 'pending_review') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <span className="text-2xl font-bold text-gray-900">sit<span className="text-orange-600">N</span>ride</span>
            <p className="text-sm text-gray-500 mt-1">Vehicle Inspection</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <PendingReviewScreen vehicle={vehicle} />
          </div>
        </div>
      </div>
    );
  }

  if (vehicle?.inspection_status === 'approved') {
    onComplete();
    return null;
  }

  const handleVehicleDetails = (data: Partial<Vehicle>) => {
    setVehicleData(data);
    setCurrentStep(2);
  };

  const handlePhotos = (photos: Record<string, string>) => {
    setPhotoData(photos);
    setCurrentStep(3);
  };

  const handleSubmitInspection = async () => {
    if (!driverProfile) return;
    setSubmitting(true);

    try {
      const inspectionData = {
        make: vehicleData.make,
        model: vehicleData.model,
        year: vehicleData.year,
        color: vehicleData.color,
        license_plate: vehicleData.license_plate,
        vin: vehicleData.vin,
        photo_front_url: photoData.front,
        photo_back_url: photoData.back,
        photo_interior_url: photoData.interior,
        photo_odometer_url: photoData.odometer,
        inspection_status: 'pending_review',
        inspection_submitted_at: new Date().toISOString(),
        safety_checklist_completed: true,
        is_active: true,
        is_approved: false,
      };

      if (vehicle) {
        // Update existing vehicle
        const { data, error } = await supabase
          .from('vehicles')
          .update(inspectionData)
          .eq('id', vehicle.id)
          .select()
          .single();

        if (error) throw error;
        if (data) setVehicle(data);
      } else {
        // Create new vehicle
        const { data, error } = await supabase
          .from('vehicles')
          .insert({
            driver_id: driverProfile.id,
            ...inspectionData,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setVehicle(data);
      }

      setCurrentStep(4); // Show pending review
    } catch (error) {
      console.error('Error submitting inspection:', error);
    }
    setSubmitting(false);
  };

  const handleResubmit = () => {
    setCurrentStep(1);
    setVehicleData({
      make: vehicle?.make || '',
      model: vehicle?.model || '',
      year: vehicle?.year,
      color: vehicle?.color || '',
      license_plate: vehicle?.license_plate || '',
      vin: vehicle?.vin || '',
    });
  };

  const steps = [
    { number: 1, title: 'Vehicle Details' },
    { number: 2, title: 'Vehicle Photos' },
    { number: 3, title: 'Safety Check' },
  ];

  const renderStep = () => {
    if (vehicle?.inspection_status === 'rejected' && currentStep === 1) {
      return <RejectedScreen vehicle={vehicle} onResubmit={handleResubmit} />;
    }

    switch (currentStep) {
      case 1:
        return <VehicleDetailsStep vehicle={vehicle} onNext={handleVehicleDetails} />;
      case 2:
        return <VehiclePhotosStep vehicle={vehicle} onNext={handlePhotos} onBack={() => setCurrentStep(1)} />;
      case 3:
        return <SafetyChecklistStep onSubmit={handleSubmitInspection} onBack={() => setCurrentStep(2)} submitting={submitting} />;
      case 4:
        return <PendingReviewScreen vehicle={vehicle} />;
      default:
        return <VehicleDetailsStep vehicle={vehicle} onNext={handleVehicleDetails} />;
    }
  };

  // If vehicle was rejected, show rejected screen first
  if (vehicle?.inspection_status === 'rejected' && currentStep === 1) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <span className="text-2xl font-bold text-gray-900">sit<span className="text-orange-600">N</span>ride</span>
            <p className="text-sm text-gray-500 mt-1">Vehicle Inspection</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <RejectedScreen vehicle={vehicle} onResubmit={() => {
              // Reset to step 1 with existing data pre-filled
              setVehicleData({});
              setPhotoData({});
              setCurrentStep(1);
              // Clear the rejection by updating the vehicle locally
              if (vehicle) {
                setVehicle({ ...vehicle, inspection_status: 'not_submitted' });
              }
            }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-2xl font-bold text-gray-900">sit<span className="text-orange-600">N</span>ride</span>
          <p className="text-sm text-gray-500 mt-1">Vehicle Inspection</p>
        </div>

        {/* Progress */}
        {currentStep <= 3 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Step {currentStep} of 3</span>
              <span className="text-sm text-gray-500">{steps[currentStep - 1]?.title}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-600 transition-all duration-300"
                style={{ width: `${(currentStep / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default VehicleInspection;
