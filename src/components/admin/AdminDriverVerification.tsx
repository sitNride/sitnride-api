import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { DriverVerification, DriverVerificationLog, User } from '@/types';
import {
  CheckCircleIcon, XCircleIcon, ClockIcon, EyeIcon, RefreshIcon,
  AlertCircleIcon, UserIcon, CarIcon, ShieldIcon, CameraIcon, FileTextIcon, SearchIcon
} from '@/components/ui/Icons';

interface VerificationWithUser extends DriverVerification {
  user?: User;
}

const AdminDriverVerification: React.FC = () => {
  const { user } = useAuth();
  const [verifications, setVerifications] = useState<VerificationWithUser[]>([]);
  const [logs, setLogs] = useState<DriverVerificationLog[]>([]);
  const [selected, setSelected] = useState<VerificationWithUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [updateFields, setUpdateFields] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadVerifications();
  }, []);

  const loadVerifications = async () => {
    setIsLoading(true);

    const { data } = await supabase
      .from('driver_verifications')
      .select('*')
      .order('submitted_at', { ascending: true });

    if (data) {
      // Fetch user data for each verification
      const userIds = data.map(v => v.user_id);
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds);

      const enriched = data.map(v => ({
        ...v,
        user: users?.find(u => u.id === v.user_id),
      }));

      // Sort alphabetically by driver name
      enriched.sort((a, b) => {
        const nameA = a.user?.full_name || '';
        const nameB = b.user?.full_name || '';
        return nameA.localeCompare(nameB);
      });

      setVerifications(enriched);
    }
    setIsLoading(false);
  };

  const loadLogs = async (verificationId: string) => {
    const { data } = await supabase
      .from('driver_verification_logs')
      .select('*')
      .eq('verification_id', verificationId)
      .order('created_at', { ascending: false });

    if (data) setLogs(data);
  };

  const handleSelectVerification = async (v: VerificationWithUser) => {
    setSelected(v);
    setAdminNotes('');
    setRejectionReason('');
    setUpdateFields('');
    await loadLogs(v.id);
  };

  const handleApprove = async () => {
    if (!selected || !user) return;
    setActionLoading(true);

    try {
      // Update verification status
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
          notes: adminNotes || 'Driver approved',
        });

      // Update local state
      setVerifications(prev => prev.map(v =>
        v.id === selected.id ? { ...v, verification_status: 'approved' } : v
      ));
      setSelected(null);
      await loadVerifications();
    } catch (err) {
      console.error('Approve error:', err);
    }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!selected || !user || !rejectionReason.trim()) return;
    setActionLoading(true);

    try {
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

      await supabase
        .from('driver_profiles')
        .update({
          status: 'rejected',
          admin_notes: `Verification rejected: ${rejectionReason}`,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selected.driver_id);

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

      setVerifications(prev => prev.map(v =>
        v.id === selected.id ? { ...v, verification_status: 'rejected' } : v
      ));
      setSelected(null);
      await loadVerifications();
    } catch (err) {
      console.error('Reject error:', err);
    }
    setActionLoading(false);
  };

  const handleRequestUpdate = async () => {
    if (!selected || !user || !updateFields.trim()) return;
    setActionLoading(true);

    try {
      await supabase
        .from('driver_verifications')
        .update({
          verification_status: 'needs_update',
          update_requested_fields: updateFields,
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id);

      await supabase
        .from('driver_verification_logs')
        .insert({
          verification_id: selected.id,
          driver_id: selected.driver_id,
          action: 'update_requested',
          performed_by: user.id,
          notes: adminNotes || null,
          reason: updateFields,
        });

      setVerifications(prev => prev.map(v =>
        v.id === selected.id ? { ...v, verification_status: 'needs_update' } : v
      ));
      setSelected(null);
      await loadVerifications();
    } catch (err) {
      console.error('Update request error:', err);
    }
    setActionLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      incomplete: 'bg-gray-100 text-gray-700',
      pending_review: 'bg-amber-100 text-amber-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      needs_update: 'bg-orange-100 text-orange-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircleIcon size={14} className="text-green-600" />;
      case 'rejected': return <XCircleIcon size={14} className="text-red-600" />;
      case 'pending_review': return <ClockIcon size={14} className="text-amber-600" />;
      case 'needs_update': return <AlertCircleIcon size={14} className="text-orange-600" />;
      default: return <ClockIcon size={14} className="text-gray-400" />;
    }
  };

  const filteredVerifications = verifications
    .filter(v => statusFilter === 'all' || v.verification_status === statusFilter)
    .filter(v => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (v.user?.full_name || '').toLowerCase().includes(q) ||
             (v.user?.email || '').toLowerCase().includes(q);
    });

  const pendingCount = verifications.filter(v => v.verification_status === 'pending_review').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshIcon className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total', count: verifications.length, color: 'bg-gray-100 text-gray-700' },
          { label: 'Pending Review', count: pendingCount, color: 'bg-amber-100 text-amber-700' },
          { label: 'Approved', count: verifications.filter(v => v.verification_status === 'approved').length, color: 'bg-green-100 text-green-700' },
          { label: 'Rejected', count: verifications.filter(v => v.verification_status === 'rejected').length, color: 'bg-red-100 text-red-700' },
          { label: 'Needs Update', count: verifications.filter(v => v.verification_status === 'needs_update').length, color: 'bg-orange-100 text-orange-700' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by driver name or email..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending_review', 'approved', 'rejected', 'needs_update', 'incomplete'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Verifications Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Driver</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Submitted</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Documents</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredVerifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No verifications found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredVerifications.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {v.profile_photo_url ? (
                          <img src={v.profile_photo_url} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <UserIcon className="text-gray-400" size={20} />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{v.user?.full_name || 'Unknown'}</p>
                          <p className="text-sm text-gray-500">{v.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {v.submitted_at ? (
                        <div>
                          <p>{new Date(v.submitted_at).toLocaleDateString()}</p>
                          <p className="text-xs">{new Date(v.submitted_at).toLocaleTimeString()}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not submitted</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(v.verification_status)}`}>
                        {getStatusIcon(v.verification_status)}
                        {v.verification_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {v.profile_photo_url && <span title="Profile Photo"><UserIcon size={14} className="text-green-600" /></span>}
                        {v.license_front_url && <span title="License"><FileTextIcon size={14} className="text-green-600" /></span>}
                        {v.insurance_document_url && <span title="Insurance"><ShieldIcon size={14} className="text-green-600" /></span>}
                        {v.vehicle_photo_url && <span title="Vehicle Photo"><CarIcon size={14} className="text-green-600" /></span>}
                        {v.camera_acknowledgment && <span title="Camera Ack"><CameraIcon size={14} className="text-green-600" /></span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleSelectVerification(v)}
                        className="flex items-center gap-1 px-3 py-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors text-sm font-medium"
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

      {/* Review Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white p-6 border-b flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Driver Verification Review</h2>
                <p className="text-sm text-gray-500">{selected.user?.full_name} — {selected.user?.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <XCircleIcon size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium ${getStatusBadge(selected.verification_status)}`}>
                  {getStatusIcon(selected.verification_status)}
                  {selected.verification_status.replace(/_/g, ' ')}
                </span>
                {selected.submitted_at && (
                  <span className="text-sm text-gray-500">
                    Submitted: {new Date(selected.submitted_at).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Profile Photo */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><UserIcon size={18} /> Profile Photo</h4>
                {selected.profile_photo_url ? (
                  <img src={selected.profile_photo_url} alt="Profile" className="w-32 h-32 rounded-xl object-cover border" />
                ) : (
                  <p className="text-gray-400 text-sm">Not uploaded</p>
                )}
              </div>

              {/* License */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><FileTextIcon size={18} /> Driver's License</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Front</p>
                    {selected.license_front_url ? (
                      <img src={selected.license_front_url} alt="License Front" className="rounded-lg border w-full" />
                    ) : (
                      <p className="text-gray-400 text-sm">Not uploaded</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Back</p>
                    {selected.license_back_url ? (
                      <img src={selected.license_back_url} alt="License Back" className="rounded-lg border w-full" />
                    ) : (
                      <p className="text-gray-400 text-sm">Not uploaded</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Insurance */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><ShieldIcon size={18} /> Proof of Insurance</h4>
                {selected.insurance_document_url ? (
                  <img src={selected.insurance_document_url} alt="Insurance" className="rounded-lg border max-w-sm" />
                ) : (
                  <p className="text-gray-400 text-sm">Not uploaded</p>
                )}
              </div>

              {/* Vehicle Info */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><CarIcon size={18} /> Vehicle Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-gray-500">Make</p><p className="font-medium">{selected.vehicle_make || 'N/A'}</p></div>
                  <div><p className="text-gray-500">Model</p><p className="font-medium">{selected.vehicle_model || 'N/A'}</p></div>
                  <div><p className="text-gray-500">Year</p><p className="font-medium">{selected.vehicle_year || 'N/A'}</p></div>
                  <div><p className="text-gray-500">License Plate</p><p className="font-medium">{selected.vehicle_license_plate || 'N/A'}</p></div>
                </div>
                <div className="mt-3">
                  <p className="text-gray-500 text-sm">Vehicle Description</p>
                  <p className="font-medium text-gray-900">{selected.vehicle_description || 'N/A'}</p>
                </div>
              </div>

              {/* Vehicle Photo */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><CameraIcon size={18} /> Vehicle Photo</h4>
                {selected.vehicle_photo_url ? (
                  <img src={selected.vehicle_photo_url} alt="Vehicle" className="rounded-lg border max-w-sm" />
                ) : (
                  <p className="text-gray-400 text-sm">Not uploaded</p>
                )}
              </div>

              {/* Camera Acknowledgment */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><CameraIcon size={18} /> Camera Acknowledgment</h4>
                <div className={`flex items-center gap-2 ${selected.camera_acknowledgment ? 'text-green-700' : 'text-red-600'}`}>
                  {selected.camera_acknowledgment ? <CheckCircleIcon size={18} /> : <XCircleIcon size={18} />}
                  <span className="font-medium">{selected.camera_acknowledgment ? 'Acknowledged' : 'Not acknowledged'}</span>
                </div>
              </div>

              {/* Action Log */}
              {logs.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Action History</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {logs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 text-sm p-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-400 text-xs whitespace-nowrap mt-0.5">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            log.action === 'approved' ? 'bg-green-100 text-green-700' :
                            log.action === 'rejected' ? 'bg-red-100 text-red-700' :
                            log.action === 'update_requested' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          {log.notes && <p className="text-gray-600 mt-1">{log.notes}</p>}
                          {log.reason && <p className="text-gray-500 mt-0.5">Reason: {log.reason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              {selected.verification_status === 'pending_review' && (
                <div className="space-y-4 border-t pt-6">
                  <h4 className="font-semibold text-gray-900">Admin Actions</h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (optional)</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Internal notes about this driver..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason (required for reject)</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Reason for rejection..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Update Request Details (required for update request)</label>
                    <textarea
                      value={updateFields}
                      onChange={(e) => setUpdateFields(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Which documents need to be updated and why..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading ? <RefreshIcon className="animate-spin" size={18} /> : <CheckCircleIcon size={18} />}
                      Approve Driver
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={actionLoading || !rejectionReason.trim()}
                      className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <XCircleIcon size={18} /> Reject
                    </button>
                    <button
                      onClick={handleRequestUpdate}
                      disabled={actionLoading || !updateFields.trim()}
                      className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <AlertCircleIcon size={18} /> Request Update
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Close button */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setSelected(null)}
                className="w-full py-3 text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDriverVerification;
