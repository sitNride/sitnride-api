import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { Vehicle, User } from '@/types';
import {
  CarIcon, CheckCircleIcon, XCircleIcon, EyeIcon, ClockIcon,
  ShieldIcon, AlertTriangleIcon, RefreshIcon, CameraIcon
} from '@/components/ui/Icons';

interface VehicleWithDriver extends Vehicle {
  driver_profile?: {
    id: string;
    user_id: string;
    user?: User;
  };
}

const AdminVehicleReview: React.FC = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleWithDriver[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithDriver | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [isLoading, setIsLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, driver_profile:driver_profiles(id, user_id, user:users(*))')
      .order('inspection_submitted_at', { ascending: false });

    if (data && !error) {
      setVehicles(data);
    }
    setIsLoading(false);
  };

  const handleApprove = async (vehicle: VehicleWithDriver) => {
    setProcessing(true);
    try {
      await supabase
        .from('vehicles')
        .update({
          inspection_status: 'approved',
          is_approved: true,
          inspection_reviewed_at: new Date().toISOString(),
          inspection_reviewed_by: user?.id,
          inspection_notes: adminNotes || null,
          admin_rejection_reason: null,
        })
        .eq('id', vehicle.id);

      setVehicles(vehicles.map(v =>
        v.id === vehicle.id ? { ...v, inspection_status: 'approved' as const, is_approved: true } : v
      ));
      setSelectedVehicle(null);
      setAdminNotes('');
    } catch (error) {
      console.error('Error approving vehicle:', error);
    }
    setProcessing(false);
  };

  const handleReject = async (vehicle: VehicleWithDriver) => {
    if (!rejectionReason.trim()) {
      return;
    }
    setProcessing(true);
    try {
      await supabase
        .from('vehicles')
        .update({
          inspection_status: 'rejected',
          is_approved: false,
          inspection_reviewed_at: new Date().toISOString(),
          inspection_reviewed_by: user?.id,
          inspection_notes: adminNotes || null,
          admin_rejection_reason: rejectionReason,
        })
        .eq('id', vehicle.id);

      setVehicles(vehicles.map(v =>
        v.id === vehicle.id ? { ...v, inspection_status: 'rejected' as const, is_approved: false } : v
      ));
      setSelectedVehicle(null);
      setAdminNotes('');
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting vehicle:', error);
    }
    setProcessing(false);
  };

  const filteredVehicles = statusFilter === 'all'
    ? vehicles
    : vehicles.filter(v => v.inspection_status === statusFilter);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      not_submitted: 'bg-gray-100 text-gray-700',
      pending_review: 'bg-amber-100 text-amber-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      not_submitted: 'Not Submitted',
      pending_review: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    return labels[status] || status;
  };

  const pendingCount = vehicles.filter(v => v.inspection_status === 'pending_review').length;

  const CURRENT_YEAR = new Date().getFullYear();
  const MIN_YEAR = CURRENT_YEAR - 15;

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Vehicles</p>
          <p className="text-2xl font-bold text-gray-900">{vehicles.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Pending Review</p>
          <p className="text-2xl font-bold text-amber-600">{vehicles.filter(v => v.inspection_status === 'pending_review').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Approved</p>
          <p className="text-2xl font-bold text-green-600">{vehicles.filter(v => v.inspection_status === 'approved').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{vehicles.filter(v => v.inspection_status === 'rejected').length}</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'all', label: 'All' },
          { id: 'pending_review', label: 'Pending Review' },
          { id: 'approved', label: 'Approved' },
          { id: 'rejected', label: 'Rejected' },
          { id: 'not_submitted', label: 'Not Submitted' },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setStatusFilter(filter.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === filter.id
                ? 'bg-orange-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {filter.label}
            {filter.id === 'pending_review' && pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-amber-200 text-amber-800 text-xs rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Vehicles Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshIcon className="animate-spin text-gray-400" size={32} />
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center">
          <CarIcon className="mx-auto text-gray-300" size={48} />
          <p className="mt-4 text-gray-500">No vehicles found with this filter</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Vehicle</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Driver</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Photos</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Submitted</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredVehicles.map((vehicle) => {
                  const yearValid = vehicle.year >= MIN_YEAR;
                  return (
                    <tr key={vehicle.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                          <p className="text-sm text-gray-500">{vehicle.color} · {vehicle.license_plate}</p>
                          {!yearValid && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 mt-1">
                              <AlertTriangleIcon size={12} /> Exceeds 15-year limit
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{(vehicle.driver_profile as any)?.user?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{(vehicle.driver_profile as any)?.user?.email || ''}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(vehicle.inspection_status)}`}>
                          {getStatusLabel(vehicle.inspection_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {vehicle.photo_front_url && <div className="w-2 h-2 bg-green-500 rounded-full" title="Front" />}
                          {vehicle.photo_back_url && <div className="w-2 h-2 bg-green-500 rounded-full" title="Back" />}
                          {vehicle.photo_interior_url && <div className="w-2 h-2 bg-green-500 rounded-full" title="Interior" />}
                          {vehicle.photo_odometer_url && <div className="w-2 h-2 bg-green-500 rounded-full" title="Odometer" />}
                          <span className="text-xs text-gray-500 ml-1">
                            {[vehicle.photo_front_url, vehicle.photo_back_url, vehicle.photo_interior_url, vehicle.photo_odometer_url].filter(Boolean).length}/4
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {vehicle.inspection_submitted_at
                          ? new Date(vehicle.inspection_submitted_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedVehicle(vehicle);
                            setAdminNotes('');
                            setRejectionReason('');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        >
                          <EyeIcon size={16} /> Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vehicle Detail Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Vehicle Inspection Review</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model} — {selectedVehicle.color}
                </p>
              </div>
              <button
                onClick={() => setSelectedVehicle(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
              {/* Vehicle Info */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CarIcon size={18} /> Vehicle Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Make</p>
                    <p className="font-medium text-gray-900">{selectedVehicle.make}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Model</p>
                    <p className="font-medium text-gray-900">{selectedVehicle.model}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Year</p>
                    <p className={`font-medium ${selectedVehicle.year < MIN_YEAR ? 'text-red-600' : 'text-gray-900'}`}>
                      {selectedVehicle.year}
                      {selectedVehicle.year < MIN_YEAR && (
                        <span className="block text-xs text-red-500 mt-0.5">Exceeds 15-year limit</span>
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Color</p>
                    <p className="font-medium text-gray-900">{selectedVehicle.color}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">License Plate</p>
                    <p className="font-medium text-gray-900">{selectedVehicle.license_plate}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">VIN</p>
                    <p className="font-medium text-gray-900 font-mono text-xs">{selectedVehicle.vin || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Vehicle Age Check */}
              <div className={`p-4 rounded-xl border ${
                selectedVehicle.year >= MIN_YEAR
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  {selectedVehicle.year >= MIN_YEAR ? (
                    <>
                      <CheckCircleIcon className="text-green-600" size={24} />
                      <div>
                        <p className="font-semibold text-green-800">Vehicle Age: Meets Requirements</p>
                        <p className="text-sm text-green-700">
                          {CURRENT_YEAR - selectedVehicle.year} years old (maximum 15 years allowed)
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangleIcon className="text-red-600" size={24} />
                      <div>
                        <p className="font-semibold text-red-800">Vehicle Age: Does NOT Meet Requirements</p>
                        <p className="text-sm text-red-700">
                          {CURRENT_YEAR - selectedVehicle.year} years old — exceeds the 15-year maximum
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Safety Checklist */}
              <div className={`p-4 rounded-xl border ${
                selectedVehicle.safety_checklist_completed
                  ? 'bg-green-50 border-green-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-3">
                  {selectedVehicle.safety_checklist_completed ? (
                    <>
                      <ShieldIcon className="text-green-600" size={24} />
                      <div>
                        <p className="font-semibold text-green-800">Safety Checklist: Completed</p>
                        <p className="text-sm text-green-700">Driver confirmed all safety requirements are met</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangleIcon className="text-amber-600" size={24} />
                      <div>
                        <p className="font-semibold text-amber-800">Safety Checklist: Not Completed</p>
                        <p className="text-sm text-amber-700">Driver has not completed the safety checklist</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Vehicle Photos */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CameraIcon size={18} /> Vehicle Photos
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'photo_front_url', label: 'Front View' },
                    { key: 'photo_back_url', label: 'Rear View' },
                    { key: 'photo_interior_url', label: 'Interior' },
                    { key: 'photo_odometer_url', label: 'Odometer' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <p className="text-sm text-gray-500 mb-1">{label}</p>
                      {(selectedVehicle as any)[key] ? (
                        <div
                          className="aspect-[4/3] rounded-xl overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setPhotoModal((selectedVehicle as any)[key])}
                        >
                          <img
                            src={(selectedVehicle as any)[key]}
                            alt={label}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[4/3] rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                          <p className="text-sm text-gray-400">Not uploaded</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Driver Info */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Driver Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Name</p>
                    <p className="font-medium text-gray-900">{(selectedVehicle.driver_profile as any)?.user?.full_name || 'Unknown'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{(selectedVehicle.driver_profile as any)?.user?.email || 'Unknown'}</p>
                  </div>
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes (optional)</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Internal notes about this vehicle..."
                />
              </div>

              {/* Rejection Reason (only shown for rejection) */}
              {selectedVehicle.inspection_status === 'pending_review' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason (required if rejecting)
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Explain why this vehicle is being rejected..."
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t bg-gray-50 flex gap-3 flex-wrap">
              {selectedVehicle.inspection_status === 'pending_review' && (
                <>
                  <button
                    onClick={() => handleApprove(selectedVehicle)}
                    disabled={processing}
                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400"
                  >
                    {processing ? <RefreshIcon className="animate-spin" size={20} /> : <CheckCircleIcon size={20} />}
                    Approve Vehicle
                  </button>
                  <button
                    onClick={() => handleReject(selectedVehicle)}
                    disabled={processing || !rejectionReason.trim()}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400"
                  >
                    {processing ? <RefreshIcon className="animate-spin" size={20} /> : <XCircleIcon size={20} />}
                    Reject Vehicle
                  </button>
                </>
              )}
              {selectedVehicle.inspection_status === 'approved' && (
                <button
                  onClick={() => handleReject(selectedVehicle)}
                  disabled={processing || !rejectionReason.trim()}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-400"
                >
                  Revoke Approval
                </button>
              )}
              {selectedVehicle.inspection_status === 'rejected' && (
                <button
                  onClick={() => handleApprove(selectedVehicle)}
                  disabled={processing}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400"
                >
                  Approve Vehicle
                </button>
              )}
              <button
                onClick={() => setSelectedVehicle(null)}
                className="px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Fullscreen Modal */}
      {photoModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 cursor-pointer"
          onClick={() => setPhotoModal(null)}
        >
          <img
            src={photoModal}
            alt="Vehicle photo"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
};

export default AdminVehicleReview;
