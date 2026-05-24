import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { DriverVerification, User } from '@/types';
import {
  CheckCircleIcon, XCircleIcon, ClockIcon, EyeIcon, RefreshIcon,
  UserIcon, CarIcon, ShieldIcon, CameraIcon, FileTextIcon, SearchIcon
} from '@/components/ui/Icons';

interface DriverApplication extends DriverVerification {
  user?: User;
}

const AdminDriverReviewDashboard: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [selected, setSelected] = useState<DriverApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setIsLoading(true);

    const { data } = await supabase
      .from('driver_verifications')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (data) {
      const userIds = data.map(v => v.user_id);
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds);

      const enriched: DriverApplication[] = data.map(v => ({
        ...v,
        user: users?.find(u => u.id === v.user_id),
      }));

      setApplications(enriched);
    }
    setIsLoading(false);
  };

  const handleSelectApplication = (app: DriverApplication) => {
    setSelected(app);
    setAdminNotes('');
    setRejectionReason('');
  };

  const handleApprove = async () => {
    if (!selected || !user) return;
    setActionLoading(true);

    try {
      // Update verification status to approved
      await supabase
        .from('driver_verifications')
        .update({
          verification_status: 'approved',
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id);

      // Update driver profile status to approved
      await supabase
        .from('driver_profiles')
        .update({
          status: 'approved',
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selected.driver_id);

      // Log the action
      await supabase
        .from('driver_verification_logs')
        .insert({
          verification_id: selected.id,
          driver_id: selected.driver_id,
          action: 'approved',
          performed_by: user.id,
          notes: adminNotes || 'Driver approved via Review Dashboard',
        });

      // Update local state
      setApplications(prev => prev.map(a =>
        a.id === selected.id ? { ...a, verification_status: 'approved' } : a
      ));
      setSelected(null);
      setAdminNotes('');
    } catch (err) {
      console.error('Approve error:', err);
    }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!selected || !user || !rejectionReason.trim()) return;
    setActionLoading(true);

    try {
      // Update verification status to rejected
      await supabase
        .from('driver_verifications')
        .update({
          verification_status: 'rejected',
          rejection_reason: rejectionReason,
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id);

      // Update driver profile status to rejected
      await supabase
        .from('driver_profiles')
        .update({
          status: 'rejected',
          admin_notes: `Verification rejected: ${rejectionReason}`,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selected.driver_id);

      // Log the action
      await supabase
        .from('driver_verification_logs')
        .insert({
          verification_id: selected.id,
          driver_id: selected.driver_id,
          action: 'rejected',
          performed_by: user.id,
          notes: adminNotes || null,
          reason: rejectionReason,
        });

      // Update local state
      setApplications(prev => prev.map(a =>
        a.id === selected.id ? { ...a, verification_status: 'rejected' } : a
      ));
      setSelected(null);
      setAdminNotes('');
      setRejectionReason('');
    } catch (err) {
      console.error('Reject error:', err);
    }
    setActionLoading(false);
  };

  // Map verification_status to display labels
  const getDisplayStatus = (status: string): string => {
    switch (status) {
      case 'pending_review': return 'Pending';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'needs_update': return 'Needs Update';
      case 'incomplete': return 'Incomplete';
      default: return status.replace(/_/g, ' ');
    }
  };

  const getStatusBadgeStyle = (status: string): string => {
    switch (status) {
      case 'pending_review': return 'bg-amber-100 text-amber-700';
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'needs_update': return 'bg-orange-100 text-orange-700';
      case 'incomplete': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircleIcon size={14} className="text-green-600" />;
      case 'rejected': return <XCircleIcon size={14} className="text-red-600" />;
      case 'pending_review': return <ClockIcon size={14} className="text-amber-600" />;
      case 'needs_update': return <ClockIcon size={14} className="text-orange-600" />;
      default: return <ClockIcon size={14} className="text-gray-400" />;
    }
  };

  const filteredApplications = applications
    .filter(a => statusFilter === 'all' || a.verification_status === statusFilter)
    .filter(a => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (a.user?.full_name || '').toLowerCase().includes(q) ||
             (a.user?.email || '').toLowerCase().includes(q);
    });

  const pendingCount = applications.filter(a => a.verification_status === 'pending_review').length;
  const approvedCount = applications.filter(a => a.verification_status === 'approved').length;
  const rejectedCount = applications.filter(a => a.verification_status === 'rejected').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshIcon className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Driver Review Dashboard</h2>
        <p className="text-gray-500 mt-1">Review and manage submitted driver applications. Approve or reject drivers based on their uploaded documents and information.</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileTextIcon className="text-gray-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Applications</p>
              <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <ClockIcon className="text-amber-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Review</p>
              <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircleIcon className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-2xl font-bold text-green-700">{approvedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircleIcon className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Rejected</p>
              <p className="text-2xl font-bold text-red-700">{rejectedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by driver name or email..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending_review', label: 'Pending' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
          ].map(filter => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === filter.key
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {filter.label}
              {filter.key === 'pending_review' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Driver Name</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Email</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Submission Date</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Documents</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {searchQuery || statusFilter !== 'all'
                      ? 'No driver applications match your current filters.'
                      : 'No driver applications have been submitted yet.'}
                  </td>
                </tr>
              ) : (
                filteredApplications.map(app => (
                  <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {app.profile_photo_url ? (
                          <img src={app.profile_photo_url} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <UserIcon className="text-gray-400" size={20} />
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{app.user?.full_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{app.user?.email || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {app.submitted_at ? (
                        <div>
                          <p>{new Date(app.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                          <p className="text-xs text-gray-400">{new Date(app.submitted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not submitted</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeStyle(app.verification_status)}`}>
                        {getStatusIcon(app.verification_status)}
                        {getDisplayStatus(app.verification_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {app.profile_photo_url && (
                          <span title="Profile Photo" className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                            <UserIcon size={12} className="text-green-600" />
                          </span>
                        )}
                        {app.license_front_url && (
                          <span title="Driver's License" className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                            <FileTextIcon size={12} className="text-green-600" />
                          </span>
                        )}
                        {app.insurance_document_url && (
                          <span title="Insurance" className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                            <ShieldIcon size={12} className="text-green-600" />
                          </span>
                        )}
                        {app.vehicle_photo_url && (
                          <span title="Vehicle Photo" className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                            <CarIcon size={12} className="text-green-600" />
                          </span>
                        )}
                        {app.camera_acknowledgment && (
                          <span title="Camera Acknowledged" className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                            <CameraIcon size={12} className="text-green-600" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleSelectApplication(app)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors text-sm font-medium"
                      >
                        <EyeIcon size={16} /> Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Review Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white p-6 border-b flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Driver Application Review</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selected.user?.full_name || 'Unknown Driver'} — {selected.user?.email || 'No email'}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XCircleIcon size={24} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Application Status & Submission Info */}
              <div className="flex flex-wrap items-center gap-4">
                <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium ${getStatusBadgeStyle(selected.verification_status)}`}>
                  {getStatusIcon(selected.verification_status)}
                  {getDisplayStatus(selected.verification_status)}
                </span>
                {selected.submitted_at && (
                  <span className="text-sm text-gray-500">
                    Submitted: {new Date(selected.submitted_at).toLocaleString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                )}
                {selected.reviewed_at && (
                  <span className="text-sm text-gray-400">
                    Reviewed: {new Date(selected.reviewed_at).toLocaleString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                )}
              </div>

              {/* Profile Photo */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <UserIcon size={18} className="text-gray-700" /> Profile Photo
                </h4>
                {selected.profile_photo_url ? (
                  <img
                    src={selected.profile_photo_url}
                    alt="Driver Profile Photo"
                    className="w-32 h-32 rounded-xl object-cover border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setImagePreview({ url: selected.profile_photo_url!, label: 'Profile Photo' })}
                  />
                ) : (
                  <p className="text-gray-400 text-sm italic">Not uploaded</p>
                )}
              </div>

              {/* Driver's License */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileTextIcon size={18} className="text-gray-700" /> Driver's License
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Front</p>
                    {selected.license_front_url ? (
                      <img
                        src={selected.license_front_url}
                        alt="License Front"
                        className="rounded-lg border border-gray-200 w-full cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setImagePreview({ url: selected.license_front_url!, label: 'License Front' })}
                      />
                    ) : (
                      <div className="h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                        <p className="text-gray-400 text-sm italic">Not uploaded</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Back</p>
                    {selected.license_back_url ? (
                      <img
                        src={selected.license_back_url}
                        alt="License Back"
                        className="rounded-lg border border-gray-200 w-full cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setImagePreview({ url: selected.license_back_url!, label: 'License Back' })}
                      />
                    ) : (
                      <div className="h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                        <p className="text-gray-400 text-sm italic">Not uploaded</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Proof of Insurance */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ShieldIcon size={18} className="text-gray-700" /> Proof of Insurance
                </h4>
                {selected.insurance_document_url ? (
                  <img
                    src={selected.insurance_document_url}
                    alt="Insurance Document"
                    className="rounded-lg border border-gray-200 max-w-sm cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setImagePreview({ url: selected.insurance_document_url!, label: 'Proof of Insurance' })}
                  />
                ) : (
                  <p className="text-gray-400 text-sm italic">Not uploaded</p>
                )}
              </div>

              {/* Vehicle Photos & Description */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CarIcon size={18} className="text-gray-700" /> Vehicle Information
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-gray-500">Make</p>
                    <p className="font-medium text-gray-900">{selected.vehicle_make || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Model</p>
                    <p className="font-medium text-gray-900">{selected.vehicle_model || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Year</p>
                    <p className="font-medium text-gray-900">{selected.vehicle_year || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">License Plate</p>
                    <p className="font-medium text-gray-900">{selected.vehicle_license_plate || 'N/A'}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-gray-500 text-sm">Vehicle Description</p>
                  <p className="font-medium text-gray-900 mt-1">{selected.vehicle_description || 'No description provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Vehicle Photo</p>
                  {selected.vehicle_photo_url ? (
                    <img
                      src={selected.vehicle_photo_url}
                      alt="Vehicle"
                      className="rounded-lg border border-gray-200 max-w-sm cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setImagePreview({ url: selected.vehicle_photo_url!, label: 'Vehicle Photo' })}
                    />
                  ) : (
                    <div className="h-32 bg-gray-200 rounded-lg flex items-center justify-center max-w-sm">
                      <p className="text-gray-400 text-sm italic">Not uploaded</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Acknowledgments */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CameraIcon size={18} className="text-gray-700" /> Acknowledgments
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {selected.camera_acknowledgment ? (
                      <CheckCircleIcon size={20} className="text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircleIcon size={20} className="text-gray-300 flex-shrink-0" />
                    )}
                    <div>
                      <p className={`font-medium ${selected.camera_acknowledgment ? 'text-gray-900' : 'text-gray-400'}`}>
                        Camera Responsibility Acknowledgment
                      </p>
                      <p className="text-xs text-gray-500">
                        Driver acknowledges responsibility for in-vehicle video-only camera operation and footage storage.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Previous Admin Notes / Rejection Reason (if any) */}
              {(selected.admin_notes || selected.rejection_reason) && (
                <div className="bg-blue-50 rounded-xl p-5">
                  <h4 className="font-semibold text-gray-900 mb-2">Previous Review Notes</h4>
                  {selected.admin_notes && (
                    <div className="mb-2">
                      <p className="text-sm text-gray-500">Admin Notes</p>
                      <p className="text-gray-700 text-sm mt-1">{selected.admin_notes}</p>
                    </div>
                  )}
                  {selected.rejection_reason && (
                    <div>
                      <p className="text-sm text-gray-500">Rejection Reason</p>
                      <p className="text-red-700 text-sm mt-1">{selected.rejection_reason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Action Section — only for pending applications */}
              {selected.verification_status === 'pending_review' && (
                <div className="border-t pt-6 space-y-4">
                  <h4 className="font-semibold text-gray-900 text-lg">Admin Decision</h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (optional)</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Internal notes about this application..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason (required to reject)</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Reason for rejection (required if rejecting)..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? (
                        <RefreshIcon className="animate-spin" size={18} />
                      ) : (
                        <CheckCircleIcon size={18} />
                      )}
                      Approve Driver
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={actionLoading || !rejectionReason.trim()}
                      className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircleIcon size={18} />
                      Reject Driver
                    </button>
                  </div>
                </div>
              )}

              {/* Status message for already-reviewed applications */}
              {selected.verification_status === 'approved' && (
                <div className="border-t pt-6">
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                    <CheckCircleIcon size={24} className="text-green-600" />
                    <div>
                      <p className="font-semibold text-green-800">This driver has been approved.</p>
                      <p className="text-sm text-green-600">The driver may access driver features on the platform.</p>
                    </div>
                  </div>
                </div>
              )}

              {selected.verification_status === 'rejected' && (
                <div className="border-t pt-6">
                  <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl">
                    <XCircleIcon size={24} className="text-red-600" />
                    <div>
                      <p className="font-semibold text-red-800">This driver has been rejected.</p>
                      <p className="text-sm text-red-600">The driver may not access driver features on the platform.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 p-4 border-t bg-gray-50">
              <button
                onClick={() => setSelected(null)}
                className="w-full py-3 text-gray-600 hover:text-gray-900 transition-colors font-medium rounded-xl hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setImagePreview(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-xl overflow-hidden shadow-2xl">
              <div className="p-3 border-b flex items-center justify-between">
                <p className="font-medium text-gray-900 text-sm">{imagePreview.label}</p>
                <button
                  onClick={() => setImagePreview(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircleIcon size={20} />
                </button>
              </div>
              <div className="p-2">
                <img
                  src={imagePreview.url}
                  alt={imagePreview.label}
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDriverReviewDashboard;
