// User types
export type UserRole = 'rider' | 'driver' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  created_at: string;
}

// Driver types
export type DriverStatus = 'new' | 'pending_background_check' | 'approved' | 'rejected' | 'suspended';
export type DriverOperationalStatus = 'offline' | 'online' | 'on_ride';

export interface DriverProfile {
  id: string;
  user_id: string;
  status: DriverStatus;
  
  // Personal Info
  date_of_birth?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  ssn_last_four?: string;
  
  // License Info
  license_number?: string;
  license_state?: string;
  license_expiry?: string;
  license_front_url?: string;
  license_back_url?: string;
  
  // Insurance
  insurance_confirmed: boolean;
  insurance_document_url?: string;
  
  // Consents
  contractor_disclosure_accepted: boolean;
  background_check_consent: boolean;
  camera_policy_accepted: boolean;
  driver_agreement_accepted: boolean;
  
  // Onboarding
  onboarding_step: number;
  onboarding_completed: boolean;
  
  // Operational
  is_online: boolean;
  current_location_lat?: number;
  current_location_lng?: number;
  
  // Earnings
  total_earnings: number;
  available_balance: number;
  
  // Stripe Connect (for driver payouts)
  stripe_account_id?: string;
  stripe_onboarding_complete?: boolean;
  stripe_payouts_enabled?: boolean;
  stripe_charges_enabled?: boolean;
  
  // Ratings
  average_rating?: number;
  total_ratings?: number;
  
  // Admin
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}



// Rider types
export interface RiderProfile {
  id: string;
  user_id?: string;
  safety_disclosure_accepted?: boolean;
  has_payment_method?: boolean;
  payment_method_id?: string;
  payment_method_last_four?: string;
  payment_method_brand?: string;
  stripe_customer_id?: string;
  stripe_payment_method_id?: string;
  is_active?: boolean;
  is_suspended?: boolean;
  has_completed_onboarding?: boolean;
}



// Vehicle types
export type VehicleInspectionStatus = 'not_submitted' | 'pending_review' | 'approved' | 'rejected';

export interface Vehicle {
  id: string;
  driver_id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  license_plate: string;
  vin?: string;
  
  // Vehicle photos
  photo_front_url?: string;
  photo_back_url?: string;
  photo_interior_url?: string;
  photo_odometer_url?: string;
  photo_url?: string;
  
  // Inspection status
  inspection_status: VehicleInspectionStatus;
  inspection_submitted_at?: string;
  inspection_reviewed_at?: string;
  inspection_reviewed_by?: string;
  inspection_notes?: string;
  admin_rejection_reason?: string;
  
  // Safety checklist
  safety_checklist_completed?: boolean;
  
  is_active: boolean;
  is_approved: boolean;
}


// Ride types
export type RideStatus = 
  | 'requested' 
  | 'searching' 
  | 'accepted' 
  | 'driver_arrived' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled' 
  | 'no_driver_found' 
  | 'driver_no_show';

export type PaymentStatus = 'pending' | 'authorized' | 'charged' | 'refunded' | 'failed';

export interface Ride {
  id: string;
  rider_id: string;
  driver_id?: string;
  vehicle_id?: string;
  
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  
  estimated_distance_miles: number;
  actual_distance_miles?: number;
  estimated_duration_minutes: number;
  actual_duration_minutes?: number;
  
  base_fee: number;
  per_mile_rate: number;
  per_minute_rate?: number;
  distance_charge?: number;
  time_charge?: number;
  estimated_total: number;
  final_total?: number;
  driver_earnings?: number;
  platform_fee?: number;
  tip_amount?: number;
  bonus_amount?: number;
  // Shared ride fields
  rider_count?: number;
  cost_per_person?: number;
  shared_ride_multiplier?: number;

  // Surge pricing fields
  surge_multiplier?: number;
  surge_amount?: number;
  surge_zone_id?: string;

  
  status: RideStatus;
  payment_status: PaymentStatus;
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;


  requested_at: string;
  accepted_at?: string;
  driver_arrived_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  is_rated?: boolean;
}




// Rating types
export interface RideRating {
  id: string;
  ride_id: string;
  rider_id: string;
  driver_id: string;
  rating: number;
  feedback?: string;
  created_at: string;
}



// Incident types
export type IncidentType = 'safety' | 'behavior' | 'vehicle' | 'payment' | 'other';
export type IncidentStatus = 'open' | 'under_review' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  ride_id?: string;
  reported_by_user_id: string;
  reported_against_user_id?: string;
  incident_type: IncidentType;
  description: string;
  status: IncidentStatus;
  admin_notes?: string;
  resolution?: string;
  user_suspended: boolean;
  created_at: string;
}

// Payout types
export type PayoutType = 'instant' | 'weekly';
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Payout {
  id: string;
  driver_id: string;
  amount: number;
  payout_type: PayoutType;
  bonus_amount: number;
  status: PayoutStatus;
  stripe_transfer_id?: string;
  created_at: string;
  completed_at?: string;
}


// Ride offer types
export type RideOfferStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface RideOffer {
  id: string;
  ride_id: string;
  driver_id: string;
  status: RideOfferStatus;
  offered_at: string;
  responded_at?: string;
  expires_at: string;
}


// Driver Verification types
export type VerificationStatus = 'incomplete' | 'pending_review' | 'approved' | 'rejected' | 'needs_update';

export interface DriverVerification {
  id: string;
  driver_id: string;
  user_id: string;
  verification_status: VerificationStatus;
  
  // Profile Photo
  profile_photo_url?: string;
  
  // Driver's License
  license_front_url?: string;
  license_back_url?: string;
  
  // Insurance
  insurance_document_url?: string;
  
  // Vehicle Information
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_license_plate?: string;
  vehicle_description?: string;
  
  // Vehicle Photo
  vehicle_photo_url?: string;
  
  // Camera acknowledgment
  camera_acknowledgment: boolean;
  
  // Admin review
  admin_notes?: string;
  rejection_reason?: string;
  update_requested_fields?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  
  // Timestamps
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DriverVerificationLog {
  id: string;
  verification_id: string;
  driver_id: string;
  action: 'submitted' | 'approved' | 'rejected' | 'update_requested' | 'resubmitted' | 'auto_check_passed' | 'auto_check_failed';
  performed_by?: string;
  notes?: string;
  reason?: string;
  created_at: string;
}

// App state types
export interface AppState {
  user: User | null;
  driverProfile: DriverProfile | null;
  riderProfile: RiderProfile | null;
  vehicle: Vehicle | null;
  currentRide: Ride | null;
  currentOffer: RideOffer | null;
}
