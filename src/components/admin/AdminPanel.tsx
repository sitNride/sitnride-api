import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { DriverProfile, Incident, User } from '@/types';
import {
  UsersIcon, CarIcon, ShieldIcon, AlertTriangleIcon, CheckCircleIcon,
  XCircleIcon, EyeIcon, ClockIcon, TrendingUpIcon, DollarIcon,
  FileTextIcon, UserIcon, RefreshIcon, CreditCardIcon
} from '@/components/ui/Icons';
import StripeSettings from './StripeSettings';
import AdminVehicleReview from './AdminVehicleReview';
import AdminDriverVerification from './AdminDriverVerification';
import AdminDriverReviewDashboard from './AdminDriverReviewDashboard';
import AdminEmergencyEvents from './AdminEmergencyEvents';
import AdminEmergencyContacts from './AdminEmergencyContacts';
import AdminOncallShifts from './AdminOncallShifts';
import AdminOncallNotificationLog from './AdminOncallNotificationLog';
import { AdminTabProvider, useAdminTab, AdminTab } from '@/contexts/AdminTabContext';

const DRIVER_IMAGES = [
  'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769917236846_e9595ad9.png',
  'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769917239150_864a59f1.jpg',
  'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769917256905_eb50f437.png',
  'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769917254111_357273e8.jpg',
];

// Local alias kept so existing typing inside this file (`tab.id as Tab`) still
// compiles; the canonical type now lives in AdminTabContext as AdminTab.
type Tab = AdminTab;







interface DriverWithUser extends DriverProfile {
  user?: User;
}

interface IncidentWithUsers extends Incident {
  reporter?: User;
  reported?: User;
}

const AdminPanelInner: React.FC = () => {
  const { user, logout } = useAuth();
  const { activeTab, setActiveTab } = useAdminTab();

  const [drivers, setDrivers] = useState<DriverWithUser[]>([]);
  const [incidents, setIncidents] = useState<IncidentWithUsers[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverWithUser | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<IncidentWithUsers | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [resolution, setResolution] = useState('');
  const [stats, setStats] = useState({
    totalDrivers: 0,
    pendingDrivers: 0,
    approvedDrivers: 0,
    totalRiders: 0,
    totalRides: 0,
    totalRevenue: 0,
    openIncidents: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    
    // Load drivers with user info
    const { data: driversData } = await supabase
      .from('driver_profiles')
      .select('*, user:users(*)')
      .order('created_at', { ascending: false });
    
    if (driversData) {
      setDrivers(driversData);
    }

    // Load incidents
    const { data: incidentsData } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (incidentsData) {
      setIncidents(incidentsData);
    }

    // Load stats
    const { count: driverCount } = await supabase
      .from('driver_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: pendingCount } = await supabase
      .from('driver_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_background_check');

    const { count: approvedCount } = await supabase
      .from('driver_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: riderCount } = await supabase
      .from('rider_profiles')
      .select('*', { count: 'exact', head: true });

    const { data: ridesData } = await supabase
      .from('rides')
      .select('platform_fee')
      .eq('status', 'completed');

    const { count: openIncidentCount } = await supabase
      .from('incidents')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'under_review']);

    setStats({
      totalDrivers: driverCount || 0,
      pendingDrivers: pendingCount || 0,
      approvedDrivers: approvedCount || 0,
      totalRiders: riderCount || 0,
      totalRides: ridesData?.length || 0,
      totalRevenue: ridesData?.reduce((sum, r) => sum + (r.platform_fee || 0), 0) || 0,
      openIncidents: openIncidentCount || 0,
    });

    setIsLoading(false);
  };

  const handleApproveDriver = async (driver: DriverWithUser) => {
    await supabase
      .from('driver_profiles')
      .update({ 
        status: 'approved',
        admin_notes: adminNotes,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', driver.id);

    setDrivers(drivers.map(d => 
      d.id === driver.id ? { ...d, status: 'approved' } : d
    ));
    setSelectedDriver(null);
    setAdminNotes('');
  };

  const handleRejectDriver = async (driver: DriverWithUser) => {
    await supabase
      .from('driver_profiles')
      .update({ 
        status: 'rejected',
        admin_notes: adminNotes,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', driver.id);

    setDrivers(drivers.map(d => 
      d.id === driver.id ? { ...d, status: 'rejected' } : d
    ));
    setSelectedDriver(null);
    setAdminNotes('');
  };

  const handleSuspendDriver = async (driver: DriverWithUser) => {
    await supabase
      .from('driver_profiles')
      .update({ 
        status: 'suspended',
        admin_notes: adminNotes,
        is_online: false
      })
      .eq('id', driver.id);

    setDrivers(drivers.map(d => 
      d.id === driver.id ? { ...d, status: 'suspended', is_online: false } : d
    ));
    setSelectedDriver(null);
    setAdminNotes('');
  };

  const handleReactivateDriver = async (driver: DriverWithUser) => {
    await supabase
      .from('driver_profiles')
      .update({ 
        status: 'approved',
        admin_notes: adminNotes
      })
      .eq('id', driver.id);

    setDrivers(drivers.map(d => 
      d.id === driver.id ? { ...d, status: 'approved' } : d
    ));
    setSelectedDriver(null);
    setAdminNotes('');
  };

  const handleResolveIncident = async (incident: IncidentWithUsers, suspendUser: boolean) => {
    await supabase
      .from('incidents')
      .update({ 
        status: 'resolved',
        resolution: resolution,
        admin_notes: adminNotes,
        handled_by: user?.id,
        resolved_at: new Date().toISOString(),
        user_suspended: suspendUser
      })
      .eq('id', incident.id);

    if (suspendUser && incident.reported_against_user_id) {
      // Suspend the reported user
      await supabase
        .from('driver_profiles')
        .update({ status: 'suspended', is_online: false })
        .eq('user_id', incident.reported_against_user_id);

      await supabase
        .from('rider_profiles')
        .update({ is_suspended: true })
        .eq('user_id', incident.reported_against_user_id);
    }

    setIncidents(incidents.map(i => 
      i.id === incident.id ? { ...i, status: 'resolved' } : i
    ));
    setSelectedIncident(null);
    setAdminNotes('');
    setResolution('');
  };

  const filteredDrivers = statusFilter === 'all' 
    ? drivers 
    : drivers.filter(d => d.status === statusFilter);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: 'bg-gray-100 text-gray-700',
      pending_background_check: 'bg-amber-100 text-amber-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      suspended: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl flex items-center justify-center">
              <ShieldIcon className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Admin Panel</h1>
              <p className="text-sm text-gray-500">sitNride Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/admin/diagnostics"
              className="text-sm text-gray-500 hover:text-gray-700 hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Environment diagnostics"
            >
              <ShieldIcon size={16} />
              Diagnostics
            </Link>
            <button
              onClick={loadData}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshIcon size={20} />
            </button>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto">
          {[
            { id: 'drivers', label: 'Driver Approvals', icon: <CarIcon size={18} /> },
            { id: 'review', label: 'Driver Review', icon: <EyeIcon size={18} /> },
            { id: 'verification', label: 'Driver Verification', icon: <UserIcon size={18} /> },
            { id: 'vehicles', label: 'Vehicle Inspections', icon: <ShieldIcon size={18} /> },
            { id: 'incidents', label: 'Incidents', icon: <AlertTriangleIcon size={18} /> },
            { id: 'emergency', label: 'Emergency Events', icon: <AlertTriangleIcon size={18} /> },
            { id: 'oncall', label: 'On-Call Contacts', icon: <ShieldIcon size={18} /> },
            { id: 'schedule', label: 'Shift Schedule', icon: <ClockIcon size={18} /> },
            { id: 'notifications', label: 'Notification Log', icon: <FileTextIcon size={18} /> },
            { id: 'stats', label: 'Statistics', icon: <TrendingUpIcon size={18} /> },

            { id: 'stripe', label: 'Stripe Settings', icon: <CreditCardIcon size={18} /> },
            { id: 'pages', label: 'Pages', icon: <FileTextIcon size={18} /> },
          ].map((tab) => (

            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-orange-600 border-orange-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'drivers' && stats.pendingDrivers > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                  {stats.pendingDrivers}
                </span>
              )}
              {tab.id === 'incidents' && stats.openIncidents > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {stats.openIncidents}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>


      <main className="max-w-7xl mx-auto px-4 py-6">

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshIcon className="animate-spin text-gray-400" size={32} />
          </div>
        ) : (
          <>
            {/* Pages Tab */}
            {activeTab === 'pages' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900">Site Pages</h2>
                <p className="text-gray-600 text-sm">All pages registered in the sitNride application.</p>
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Page Title</th>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">URL Path</th>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Access</th>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[
                          { title: 'Home / Landing Page', path: '/', access: 'Public', description: 'Main landing page with hero, features, and CTA sections' },
                          { title: 'Rider Request Page', path: '/request-ride', access: 'Public', description: 'Public ride request page — no login required' },
                          { title: 'Ride Destination Page', path: '/ride-destination', access: 'Logged-in Riders', description: 'Post-login page for riders to enter pickup and destination details' },
                          { title: 'About Us', path: '/about', access: 'Public', description: 'Company information and mission' },
                          { title: 'Contact Us', path: '/contact', access: 'Public', description: 'Contact page with support email' },
                          { title: 'Terms of Use', path: '/terms', access: 'Public', description: 'Legal terms of use' },
                          { title: 'Privacy Policy', path: '/privacy', access: 'Public', description: 'Privacy policy page' },
                          { title: 'Driver Requirements', path: '/driver-requirements', access: 'Public', description: 'Driver eligibility and requirements' },
                        ].map((page) => (
                          <tr key={page.path} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <p className="font-medium text-gray-900">{page.title}</p>
                            </td>
                            <td className="px-6 py-4">
                              <code className="px-2 py-1 bg-gray-100 rounded text-sm text-orange-600">{page.path}</code>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                page.access === 'Public' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {page.access}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{page.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <CarIcon className="text-orange-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Drivers</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalDrivers}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                      <ClockIcon className="text-amber-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Pending Approval</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.pendingDrivers}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <CheckCircleIcon className="text-green-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Approved Drivers</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.approvedDrivers}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <UsersIcon className="text-purple-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Riders</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalRiders}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <TrendingUpIcon className="text-indigo-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Rides</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalRides}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <DollarIcon className="text-green-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Platform Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                      <AlertTriangleIcon className="text-red-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Open Incidents</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.openIncidents}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Drivers Tab */}
            {activeTab === 'drivers' && (
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {['all', 'pending_background_check', 'approved', 'rejected', 'suspended'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        statusFilter === status
                          ? 'bg-orange-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {status === 'all' ? 'All' : status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Driver</th>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Onboarding</th>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Documents</th>
                          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredDrivers.map((driver, index) => (
                          <tr key={driver.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={DRIVER_IMAGES[index % DRIVER_IMAGES.length]} alt="Driver" className="w-10 h-10 rounded-full object-cover" />
                                <div>
                                  <p className="font-medium text-gray-900">{driver.user?.full_name}</p>
                                  <p className="text-sm text-gray-500">{driver.user?.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(driver.status)}`}>{driver.status.replace(/_/g, ' ')}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-orange-600" style={{ width: `${(driver.onboarding_step / 9) * 100}%` }} />
                                </div>
                                <span className="text-sm text-gray-500">{driver.onboarding_step}/9</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {driver.license_front_url && <span className="text-green-600"><CheckCircleIcon size={16} /></span>}
                                {driver.insurance_confirmed && <span className="text-green-600"><ShieldIcon size={16} /></span>}
                                {driver.background_check_consent && <span className="text-green-600"><FileTextIcon size={16} /></span>}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button onClick={() => setSelectedDriver(driver)} className="flex items-center gap-1 px-3 py-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                                <EyeIcon size={16} /> View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Incidents Tab */}
            {activeTab === 'incidents' && (
              <div className="space-y-4">
                {incidents.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center">
                    <CheckCircleIcon className="mx-auto text-green-500" size={48} />
                    <p className="mt-4 text-gray-600">No incidents reported</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Type</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Description</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Date</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {incidents.map((incident) => (
                            <tr key={incident.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${incident.incident_type === 'safety' ? 'bg-red-100 text-red-700' : incident.incident_type === 'behavior' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{incident.incident_type}</span>
                              </td>
                              <td className="px-6 py-4"><p className="text-gray-900 truncate max-w-xs">{incident.description}</p></td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${incident.status === 'open' ? 'bg-red-100 text-red-700' : incident.status === 'under_review' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{incident.status}</span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">{new Date(incident.created_at).toLocaleDateString()}</td>
                              <td className="px-6 py-4">
                                <button onClick={() => setSelectedIncident(incident)} className="flex items-center gap-1 px-3 py-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                                  <EyeIcon size={16} /> Review
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Emergency Events Tab */}
            {activeTab === 'emergency' && <AdminEmergencyEvents />}

            {/* On-Call Contacts Tab */}
            {activeTab === 'oncall' && <AdminEmergencyContacts />}

            {/* Shift Schedule Tab */}
            {activeTab === 'schedule' && <AdminOncallShifts />}

            {/* Notification Log Tab */}
            {activeTab === 'notifications' && <AdminOncallNotificationLog />}

            {/* Stripe Settings Tab */}
            {activeTab === 'stripe' && <StripeSettings />}


            {/* Vehicle Inspections Tab */}
            {activeTab === 'vehicles' && <AdminVehicleReview />}

            {/* Driver Verification Tab */}

            {activeTab === 'verification' && <AdminDriverVerification />}

            {/* Driver Review Dashboard Tab */}
            {activeTab === 'review' && <AdminDriverReviewDashboard />}

          </>
        )}

      </main>


      {/* Driver Detail Modal */}

      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Driver Details</h2>
              <button
                onClick={() => setSelectedDriver(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Driver Info */}
              <div className="flex items-center gap-4">
                <img
                  src={DRIVER_IMAGES[0]}
                  alt="Driver"
                  className="w-20 h-20 rounded-full object-cover"
                />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedDriver.user?.full_name}</h3>
                  <p className="text-gray-500">{selectedDriver.user?.email}</p>
                  <p className="text-gray-500">{selectedDriver.user?.phone}</p>
                </div>
              </div>

              {/* Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Current Status</p>
                  <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedDriver.status)}`}>
                    {selectedDriver.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Onboarding Progress</p>
                  <p className="mt-1 font-semibold">{selectedDriver.onboarding_step}/9 Steps</p>
                </div>
              </div>

              {/* Personal Info */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Date of Birth</p>
                    <p className="font-medium">{selectedDriver.date_of_birth || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">SSN (Last 4)</p>
                    <p className="font-medium">••••{selectedDriver.ssn_last_four || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Address</p>
                    <p className="font-medium">
                      {selectedDriver.address ? 
                        `${selectedDriver.address}, ${selectedDriver.city}, ${selectedDriver.state} ${selectedDriver.zip_code}` 
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* License Info */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">License Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">License Number</p>
                    <p className="font-medium">{selectedDriver.license_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">State</p>
                    <p className="font-medium">{selectedDriver.license_state || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Expiry</p>
                    <p className="font-medium">{selectedDriver.license_expiry || 'N/A'}</p>
                  </div>
                </div>
                {(selectedDriver.license_front_url || selectedDriver.license_back_url) && (
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    {selectedDriver.license_front_url && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Front</p>
                        <img src={selectedDriver.license_front_url} alt="License Front" className="rounded-lg border" />
                      </div>
                    )}
                    {selectedDriver.license_back_url && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Back</p>
                        <img src={selectedDriver.license_back_url} alt="License Back" className="rounded-lg border" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Consents */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Agreements & Consents</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Contractor Disclosure', value: selectedDriver.contractor_disclosure_accepted },
                    { label: 'Insurance Confirmed', value: selectedDriver.insurance_confirmed },
                    { label: 'Background Check Consent', value: selectedDriver.background_check_consent },
                    { label: 'Camera Policy (Video-Only)', value: selectedDriver.camera_policy_accepted },
                    { label: 'Driver Agreement', value: selectedDriver.driver_agreement_accepted },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      {item.value ? (
                        <CheckCircleIcon className="text-green-600" size={18} />
                      ) : (
                        <XCircleIcon className="text-gray-300" size={18} />
                      )}
                      <span className={item.value ? 'text-gray-900' : 'text-gray-400'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Add notes about this driver..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t bg-gray-50 flex gap-3 flex-wrap">
              {selectedDriver.status === 'pending_background_check' && (
                <>
                  <button
                    onClick={() => handleApproveDriver(selectedDriver)}
                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircleIcon size={20} /> Approve
                  </button>
                  <button
                    onClick={() => handleRejectDriver(selectedDriver)}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircleIcon size={20} /> Reject
                  </button>
                </>
              )}
              {selectedDriver.status === 'approved' && (
                <button
                  onClick={() => handleSuspendDriver(selectedDriver)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
                >
                  Suspend Driver
                </button>
              )}
              {selectedDriver.status === 'suspended' && (
                <button
                  onClick={() => handleReactivateDriver(selectedDriver)}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
                >
                  Reactivate Driver
                </button>
              )}
              <button
                onClick={() => setSelectedDriver(null)}
                className="px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Incident Review</h2>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${
                  selectedIncident.incident_type === 'safety' ? 'bg-red-100 text-red-700' :
                  selectedIncident.incident_type === 'behavior' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedIncident.incident_type}
                </span>
              </div>

              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="mt-1 text-gray-900">{selectedIncident.description}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Reported</p>
                <p className="mt-1 text-gray-900">{new Date(selectedIncident.created_at).toLocaleString()}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resolution</label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Describe the resolution..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Internal notes..."
                />
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 space-y-3">
              <button
                onClick={() => handleResolveIncident(selectedIncident, false)}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
              >
                Resolve (No Action)
              </button>
              <button
                onClick={() => handleResolveIncident(selectedIncident, true)}
                className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
              >
                Resolve & Suspend User
              </button>
              <button
                onClick={() => setSelectedIncident(null)}
                className="w-full py-3 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Top-level AdminPanel — wraps the inner panel in <AdminTabProvider> so any
 * descendant (including <AdminOncallNotificationLog>, <AdminOncallShifts>,
 * <AdminOncallTemplates>, …) can call useAdminTab().goToTab() to switch
 * tabs and pass focus params back to the panel.
 */
const AdminPanel: React.FC = () => (
  <AdminTabProvider initialTab="drivers">
    <AdminPanelInner />
  </AdminTabProvider>
);

export default AdminPanel;
