import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { 
  ChevronRightIcon, ChevronLeftIcon, CheckCircleIcon, UploadIcon, 
  FileTextIcon, UserIcon, CarIcon, ShieldIcon, CameraIcon, AlertTriangleIcon,
  ClockIcon
} from '@/components/ui/Icons';

interface OnboardingStepProps {
  step: number;
  onNext: () => void;
  onBack: () => void;
}


// Step 1: Independent Contractor Disclosure
const ContractorDisclosure: React.FC<OnboardingStepProps> = ({ onNext }) => {
  const { updateDriverProfile } = useAuth();
  const [agreed, setAgreed] = useState(false);

  const handleContinue = async () => {
    if (agreed) {
      await updateDriverProfile({ contractor_disclosure_accepted: true, onboarding_step: 2 });
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <FileTextIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Independent Contractor Agreement</h2>
        <p className="mt-2 text-gray-600">Please review and acknowledge the following disclosure</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 max-h-80 overflow-y-auto text-sm text-gray-700 space-y-4">
        <p className="font-semibold">INDEPENDENT CONTRACTOR DISCLOSURE</p>
        <p>
          By proceeding with driver registration on sitNride, you acknowledge and agree that:
        </p>
        <ol className="list-decimal list-inside space-y-2">
          <li>You are applying to become an independent contractor, NOT an employee of sitNride or Digital Media Connect Pro LLC.</li>
          <li>sitNride is a technology platform that connects riders with independent drivers. sitNride does not provide transportation services.</li>
          <li>As an independent contractor, you will be responsible for your own taxes, including self-employment tax.</li>
          <li>You will not receive employee benefits such as health insurance, paid time off, or retirement benefits from sitNride.</li>
          <li>You have the freedom to choose when, where, and how long you work.</li>
          <li>You may provide services to other rideshare platforms or businesses.</li>
          <li>You are responsible for maintaining your own vehicle, including insurance, registration, and maintenance.</li>
          <li>sitNride will provide you with a 1099 tax form at the end of each tax year if you earn over $600.</li>
          <li>You understand that your contractor status means you control the manner and means of performing services.</li>
        </ol>
        <p className="font-semibold mt-4">
          By checking the box below, you confirm that you have read, understand, and agree to these terms.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
        />
        <span className="text-gray-700">
          I acknowledge that I am applying to be an independent contractor, not an employee, and I understand the implications of this status.
        </span>
      </label>

      <button
        onClick={handleContinue}
        disabled={!agreed}
        className={`w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
          agreed ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-300 cursor-not-allowed'
        }`}
      >
        Continue <ChevronRightIcon size={20} />
      </button>
    </div>
  );
};

// Step 2: Personal Info
const PersonalInfo: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const { updateDriverProfile, user } = useAuth();
  const [formData, setFormData] = useState({
    date_of_birth: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    ssn_last_four: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.date_of_birth) newErrors.date_of_birth = 'Date of birth is required';
    if (!formData.address) newErrors.address = 'Address is required';
    if (!formData.city) newErrors.city = 'City is required';
    if (!formData.state) newErrors.state = 'State is required';
    if (!formData.zip_code) newErrors.zip_code = 'ZIP code is required';
    if (!formData.ssn_last_four || formData.ssn_last_four.length !== 4) {
      newErrors.ssn_last_four = 'Last 4 digits of SSN required';
    }
    
    // Age check (must be 21+)
    if (formData.date_of_birth) {
      const birthDate = new Date(formData.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 21) {
        newErrors.date_of_birth = 'You must be at least 21 years old to drive';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    if (validate()) {
      await updateDriverProfile({ ...formData, onboarding_step: 3 });
      onNext();
    }
  };

  const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <UserIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Personal Information</h2>
        <p className="mt-2 text-gray-600">We need some basic information to verify your identity</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
          <input
            type="date"
            name="date_of_birth"
            value={formData.date_of_birth}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
              errors.date_of_birth ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.date_of_birth && <p className="text-red-500 text-sm mt-1">{errors.date_of_birth}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="123 Main Street"
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
              errors.address ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                errors.city ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              name="state"
              value={formData.state}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                errors.state ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
            <input
              type="text"
              name="zip_code"
              value={formData.zip_code}
              onChange={handleChange}
              maxLength={5}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                errors.zip_code ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.zip_code && <p className="text-red-500 text-sm mt-1">{errors.zip_code}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SSN (Last 4)</label>
            <input
              type="text"
              name="ssn_last_four"
              value={formData.ssn_last_four}
              onChange={handleChange}
              maxLength={4}
              placeholder="XXXX"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                errors.ssn_last_four ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.ssn_last_four && <p className="text-red-500 text-sm mt-1">{errors.ssn_last_four}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeftIcon size={20} /> Back
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 py-4 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
        >
          Continue <ChevronRightIcon size={20} />
        </button>
      </div>
    </div>
  );
};

// Step 3: License Info
const LicenseInfo: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const { updateDriverProfile } = useAuth();
  const [formData, setFormData] = useState({
    license_number: '',
    license_state: '',
    license_expiry: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.license_number) newErrors.license_number = 'License number is required';
    if (!formData.license_state) newErrors.license_state = 'License state is required';
    if (!formData.license_expiry) newErrors.license_expiry = 'Expiry date is required';
    
    if (formData.license_expiry) {
      const expiry = new Date(formData.license_expiry);
      if (expiry < new Date()) {
        newErrors.license_expiry = 'License must not be expired';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    if (validate()) {
      await updateDriverProfile({ ...formData, onboarding_step: 4 });
      onNext();
    }
  };

  const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <FileTextIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Driver's License</h2>
        <p className="mt-2 text-gray-600">Enter your driver's license information</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
          <input
            type="text"
            name="license_number"
            value={formData.license_number}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
              errors.license_number ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.license_number && <p className="text-red-500 text-sm mt-1">{errors.license_number}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Issuing State</label>
          <select
            name="license_state"
            value={formData.license_state}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
              errors.license_state ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select State</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.license_state && <p className="text-red-500 text-sm mt-1">{errors.license_state}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
          <input
            type="date"
            name="license_expiry"
            value={formData.license_expiry}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
              errors.license_expiry ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.license_expiry && <p className="text-red-500 text-sm mt-1">{errors.license_expiry}</p>}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeftIcon size={20} /> Back
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 py-4 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
        >
          Continue <ChevronRightIcon size={20} />
        </button>
      </div>
    </div>
  );
};

// Step 4: License Photo Upload
const LicensePhotoUpload: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const { updateDriverProfile, driverProfile } = useAuth();
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File, side: 'front' | 'back') => {
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${driverProfile?.id}/${side}-${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('driver-documents')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(fileName);

      if (side === 'front') {
        setFrontImage(urlData.publicUrl);
      } else {
        setBackImage(urlData.publicUrl);
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
    setUploading(false);
  };

  const handleContinue = async () => {
    if (frontImage && backImage) {
      await updateDriverProfile({ 
        license_front_url: frontImage, 
        license_back_url: backImage,
        onboarding_step: 5 
      });
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <UploadIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">License Photos</h2>
        <p className="mt-2 text-gray-600">Upload clear photos of your driver's license (required)</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Front of License</p>
          <input
            ref={frontInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'front')}
          />
          <div
            onClick={() => frontInputRef.current?.click()}
            className={`aspect-[3/2] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
              frontImage ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-orange-500 hover:bg-orange-50'
            }`}
          >
            {frontImage ? (
              <img src={frontImage} alt="Front" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <>
                <UploadIcon className="text-gray-400" size={32} />
                <p className="text-sm text-gray-500 mt-2">Click to upload</p>
              </>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Back of License</p>
          <input
            ref={backInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'back')}
          />
          <div
            onClick={() => backInputRef.current?.click()}
            className={`aspect-[3/2] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
              backImage ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-orange-500 hover:bg-orange-50'
            }`}
          >
            {backImage ? (
              <img src={backImage} alt="Back" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <>
                <UploadIcon className="text-gray-400" size={32} />
                <p className="text-sm text-gray-500 mt-2">Click to upload</p>
              </>
            )}
          </div>
        </div>
      </div>

      {uploading && (
        <div className="text-center text-orange-600">Uploading...</div>
      )}

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeftIcon size={20} /> Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!frontImage || !backImage || uploading}
          className={`flex-1 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            frontImage && backImage && !uploading ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Continue <ChevronRightIcon size={20} />
        </button>
      </div>
    </div>
  );
};

// Step 5: Vehicle Info
const VehicleInfo: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const { driverProfile, updateDriverProfile, setVehicle } = useAuth();
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: '',
    color: '',
    license_plate: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.make) newErrors.make = 'Make is required';
    if (!formData.model) newErrors.model = 'Model is required';
    if (!formData.year) newErrors.year = 'Year is required';
    if (!formData.color) newErrors.color = 'Color is required';
    if (!formData.license_plate) newErrors.license_plate = 'License plate is required';
    
    const year = parseInt(formData.year);
    if (year < 2010 || year > new Date().getFullYear() + 1) {
      newErrors.year = 'Vehicle must be 2010 or newer';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    if (validate() && driverProfile) {
      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          driver_id: driverProfile.id,
          make: formData.make,
          model: formData.model,
          year: parseInt(formData.year),
          color: formData.color,
          license_plate: formData.license_plate,
        })
        .select()
        .single();

      if (data && !error) {
        setVehicle(data);
        await updateDriverProfile({ onboarding_step: 6 });
        onNext();
      }
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2009 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <CarIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Vehicle Information</h2>
        <p className="mt-2 text-gray-600">Tell us about the vehicle you'll be driving</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
            <input
              type="text"
              name="make"
              value={formData.make}
              onChange={handleChange}
              placeholder="Toyota"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                errors.make ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.make && <p className="text-red-500 text-sm mt-1">{errors.make}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              placeholder="Camry"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                errors.model ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.model && <p className="text-red-500 text-sm mt-1">{errors.model}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <input
              type="text"
              name="color"
              value={formData.color}
              onChange={handleChange}
              placeholder="Silver"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                errors.color ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.color && <p className="text-red-500 text-sm mt-1">{errors.color}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
          <input
            type="text"
            name="license_plate"
            value={formData.license_plate}
            onChange={handleChange}
            placeholder="ABC 1234"
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
              errors.license_plate ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.license_plate && <p className="text-red-500 text-sm mt-1">{errors.license_plate}</p>}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeftIcon size={20} /> Back
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 py-4 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
        >
          Continue <ChevronRightIcon size={20} />
        </button>
      </div>
    </div>
  );
};

// Step 6: Insurance Confirmation
const InsuranceConfirmation: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const { updateDriverProfile } = useAuth();
  const [confirmed, setConfirmed] = useState(false);

  const handleContinue = async () => {
    if (confirmed) {
      await updateDriverProfile({ insurance_confirmed: true, onboarding_step: 7 });
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Insurance Confirmation</h2>
        <p className="mt-2 text-gray-600">Confirm your vehicle insurance meets our requirements</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangleIcon className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Insurance Requirements:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Valid auto insurance policy</li>
              <li>Minimum liability coverage of $50,000/$100,000</li>
              <li>Policy must cover rideshare driving</li>
              <li>Insurance must be current and not expired</li>
            </ul>
          </div>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
        />
        <span className="text-gray-700">
          I confirm that I have valid auto insurance that meets the above requirements and covers rideshare driving. I understand that I must maintain this coverage while driving for sitNride.
        </span>
      </label>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeftIcon size={20} /> Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!confirmed}
          className={`flex-1 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            confirmed ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Continue <ChevronRightIcon size={20} />
        </button>
      </div>
    </div>
  );
};

// Step 7: Background Check Consent
const BackgroundCheckConsent: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const { updateDriverProfile } = useAuth();
  const [consented, setConsented] = useState(false);

  const handleContinue = async () => {
    if (consented) {
      await updateDriverProfile({ background_check_consent: true, onboarding_step: 8 });
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Background Check</h2>
        <p className="mt-2 text-gray-600">We need your consent to run a background check</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 text-sm text-gray-700 space-y-4 max-h-60 overflow-y-auto">
        <p className="font-semibold">BACKGROUND CHECK AUTHORIZATION</p>
        <p>
          By providing consent, you authorize sitNride and its designated third-party consumer reporting agency to:
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>Conduct a criminal background check</li>
          <li>Verify your driving record (MVR)</li>
          <li>Verify your identity using the information you provided</li>
          <li>Check sex offender registries</li>
          <li>Verify your Social Security Number</li>
        </ul>
        <p>
          This background check will be conducted in accordance with the Fair Credit Reporting Act (FCRA). 
          You have the right to request a copy of any report obtained and to dispute any inaccurate information.
        </p>
        <p>
          Background checks typically take 3-7 business days to complete. You will be notified of the results via email.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="mt-1 w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
        />
        <span className="text-gray-700">
          I authorize sitNride to conduct a background check and understand that my application is subject to approval based on the results.
        </span>
      </label>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeftIcon size={20} /> Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!consented}
          className={`flex-1 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            consented ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Continue <ChevronRightIcon size={20} />
        </button>
      </div>
    </div>
  );
};

// Step 8: Camera Policy (VIDEO-ONLY - LOCKED TEXT)
const CameraPolicy: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const { updateDriverProfile } = useAuth();
  const [accepted, setAccepted] = useState(false);

  const handleContinue = async () => {
    if (accepted) {
      await updateDriverProfile({ camera_policy_accepted: true, onboarding_step: 9 });
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <CameraIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">In-Vehicle Camera Requirement</h2>
        <p className="mt-2 text-gray-600">Mandatory video-only recording policy</p>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-sm text-gray-700 space-y-4">
        <p className="font-semibold text-orange-900">MANDATORY VIDEO-ONLY RECORDING POLICY</p>
        <p>
          <strong>All rides on sitNride are VIDEO RECORDED for safety purposes.</strong> This is a non-negotiable requirement for all drivers on our platform.
        </p>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
          <p className="font-bold text-red-800 flex items-center gap-2">
            <AlertTriangleIcon size={18} />
            IMPORTANT: AUDIO RECORDING IS NOT PERMITTED
          </p>
          <p className="text-red-700 mt-2">
            Recording audio during rides is strictly prohibited. Only video recording is allowed. 
            Violation of this policy will result in immediate deactivation from the platform.
          </p>
        </div>

        <div className="space-y-3 mt-4">
          <p className="font-medium">Recording Requirements:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>VIDEO ONLY</strong> recording must be active during all rides</li>
            <li>Audio recording is NOT permitted</li>
            <li>Recordings are stored securely for 30 days</li>
            <li>Footage is only accessed in case of disputes or safety incidents</li>
          </ul>
        </div>
        <div className="space-y-3">
          <p className="font-medium">Driver Responsibilities:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Ensure video recording device is functioning before each ride</li>
            <li>Do not tamper with or disable recording equipment</li>
            <li>Inform passengers that the ride is being VIDEO recorded (no audio)</li>
            <li>Report any recording equipment issues immediately</li>
          </ul>
        </div>
        <div className="bg-gray-100 rounded-lg p-4 mt-4">
          <p className="font-medium text-gray-900">Video Footage Policy:</p>
          <p className="text-gray-700 mt-1">
            sitNride requires drivers to use in-vehicle cameras for safety. Video footage is owned, stored, and maintained by the driver. sitNride does not continuously collect or store video footage and may request footage from a driver only in the event of a serious incident, dispute, or legal matter.
          </p>
        </div>

        <p className="text-orange-800 font-medium mt-4">
          Failure to comply with the video-only recording policy may result in immediate deactivation from the platform.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
        />
        <span className="text-gray-700">
          I understand and accept the mandatory VIDEO-ONLY recording policy. I agree to maintain active video recording (no audio) during all rides and comply with all recording requirements.
        </span>
      </label>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeftIcon size={20} /> Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!accepted}
          className={`flex-1 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            accepted ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Continue <ChevronRightIcon size={20} />
        </button>
      </div>
    </div>
  );
};

// Step 9: Driver Agreement
const DriverAgreement: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const { updateDriverProfile } = useAuth();
  const [accepted, setAccepted] = useState(false);

  const handleContinue = async () => {
    if (accepted) {
      await updateDriverProfile({ 
        driver_agreement_accepted: true, 
        onboarding_step: 10,
        onboarding_completed: true,
        status: 'pending_background_check'
      });
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <FileTextIcon className="text-orange-600" size={32} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Driver Agreement</h2>
        <p className="mt-2 text-gray-600">Review and accept the driver agreement</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 text-sm text-gray-700 space-y-4 max-h-60 overflow-y-auto">
        <p className="font-semibold">SITNRIDE DRIVER AGREEMENT</p>
        <p>By accepting this agreement, you agree to:</p>
        <ol className="list-decimal list-inside space-y-2">
          <li>Provide safe, reliable transportation to riders</li>
          <li>Maintain a professional demeanor at all times</li>
          <li>Keep your vehicle clean and well-maintained</li>
          <li>Follow all traffic laws and regulations</li>
          <li>Not discriminate against riders for any reason</li>
          <li>Comply with all sitNride policies and guidelines</li>
          <li>Maintain valid insurance and driver's license</li>
          <li>Report any accidents or incidents immediately</li>
          <li>Not drive under the influence of drugs or alcohol</li>
          <li>Respect rider privacy and not share their information</li>
          <li>Maintain VIDEO-ONLY recording during all rides (no audio)</li>
        </ol>
        <p className="font-semibold mt-4">Compensation:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>You will receive 75% of every fare (base pay + per-mile pay)</li>

          <li>Weekly bonus payouts (+5%) for consistent driving</li>
          <li>Instant cash-out available anytime</li>
          <li>Night Shift Bonus: Drivers earn a higher base pay for trips that begin between 12:00 AM and 5:00 AM.</li>
          <li>Weekend Bonus: Drivers earn a higher base pay for trips that begin on Saturdays and Sundays.</li>
        </ul>

        <p className="font-semibold mt-4">Independent Contractor Status:</p>

        <p>
          You acknowledge that you are an independent contractor, not an employee of sitNride or 
          Digital Media Connect Pro LLC. sitNride is a technology platform that connects riders 
          with independent drivers and does not provide transportation services.
        </p>
        <p className="font-semibold mt-4">Termination:</p>
        <p>
          sitNride reserves the right to deactivate your account for violations of this agreement, 
          safety concerns, or policy violations.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
        />
        <span className="text-gray-700">
          I have read, understand, and agree to the sitNride Driver Agreement. I understand that this is a legally binding contract.
        </span>
      </label>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ChevronLeftIcon size={20} /> Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!accepted}
          className={`flex-1 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            accepted ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Submit Application <ChevronRightIcon size={20} />
        </button>
      </div>
    </div>
  );
};

// Step 10: Pending Approval
const PendingApproval: React.FC = () => {
  return (
    <div className="space-y-6 text-center">
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
        <ClockIcon className="text-amber-600" size={40} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Application Submitted!</h2>
      <p className="text-gray-600 max-w-md mx-auto">
        Thank you for applying to drive with sitNride. Your application is now being reviewed.
      </p>
      
      <div className="bg-gray-50 rounded-xl p-6 text-left">
        <h3 className="font-semibold text-gray-900 mb-4">What happens next?</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-orange-600 font-semibold text-sm">1</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Background Check</p>
              <p className="text-sm text-gray-600">Takes 3-7 business days</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-orange-600 font-semibold text-sm">2</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Document Review</p>
              <p className="text-sm text-gray-600">Our team verifies your documents</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-orange-600 font-semibold text-sm">3</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Approval Notification</p>
              <p className="text-sm text-gray-600">You'll receive an email when approved</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-green-800 text-sm">
          We'll send you an email at your registered address once your application has been reviewed.
        </p>
      </div>
    </div>
  );
};

// Main Onboarding Component
const DriverOnboarding: React.FC = () => {
  const { driverProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(driverProfile?.onboarding_step || 1);

  const steps = [
    { number: 1, title: 'Contractor Disclosure' },
    { number: 2, title: 'Personal Info' },
    { number: 3, title: 'License Info' },
    { number: 4, title: 'License Photos' },
    { number: 5, title: 'Vehicle Info' },
    { number: 6, title: 'Insurance' },
    { number: 7, title: 'Background Check' },
    { number: 8, title: 'Camera Policy' },
    { number: 9, title: 'Agreement' },
  ];

  const handleNext = () => {
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const renderStep = () => {
    const props = { step: currentStep, onNext: handleNext, onBack: handleBack };
    
    switch (currentStep) {
      case 1: return <ContractorDisclosure {...props} />;
      case 2: return <PersonalInfo {...props} />;
      case 3: return <LicenseInfo {...props} />;
      case 4: return <LicensePhotoUpload {...props} />;
      case 5: return <VehicleInfo {...props} />;
      case 6: return <InsuranceConfirmation {...props} />;
      case 7: return <BackgroundCheckConsent {...props} />;
      case 8: return <CameraPolicy {...props} />;
      case 9: return <DriverAgreement {...props} />;
      default: return <PendingApproval />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-2xl font-bold text-gray-900">sit<span className="text-orange-600">N</span>ride</span>
          <p className="text-sm text-gray-500 mt-1">Driver Onboarding</p>
        </div>

        {/* Progress Header */}
        {currentStep <= 9 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Step {currentStep} of 9</span>
              <span className="text-sm text-gray-500">{steps[currentStep - 1]?.title}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-600 transition-all duration-300"
                style={{ width: `${(currentStep / 9) * 100}%` }}
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

export default DriverOnboarding;
