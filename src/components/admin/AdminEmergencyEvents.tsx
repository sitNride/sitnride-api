import React, { useState, useEffect, useMemo } from 'react';
import { database as supabase } from '@/lib/database';
import {
  AlertTriangleIcon, RefreshIcon, MapPinIcon, ClockIcon,
} from '@/components/ui/Icons';

type EventType = 'sms_support' | 'call_support' | 'call_911';
type Role = 'driver' | 'rider';

interface EmergencyEvent {
  id: string;
  ride_id: string | null;
  user_id: string | null;
  role: Role | null;
  event_type: EventType | null;
  message: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
}

const EVENT_TYPES: { id: EventType; label: string; className: string }[] = [
  { id: 'sms_support', label: 'SMS Support', className: 'bg-blue-100 text-blue-700' },
  { id: 'call_support', label: 'Call Support', className: 'bg-amber-100 text-amber-700' },
  { id: 'call_911', label: 'Call 911', className: 'bg-red-100 text-red-700' },
];

const ROLES: { id: Role; label: string }[] = [
  { id: 'driver', label: 'Driver' },
  { id: 'rider', label: 'Rider' },
];

const PAGE_SIZE = 25;

const AdminEmergencyEvents: React.FC = () => {
  const [events, setEvents] = useState<EmergencyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('emergency_events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (eventTypeFilter !== 'all') {
        query = query.eq('event_type', eventTypeFilter);
      }
      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) {
        console.error('Failed to load emergency events', error);
        setEvents([]);
        setTotalCount(0);
      } else {
        setEvents((data as EmergencyEvent[]) || []);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Failed to load emergency events', err);
      setEvents([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, eventTypeFilter, roleFilter]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [eventTypeFilter, roleFilter]);

  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return events;
    return events.filter((e) => {
      const ride = (e.ride_id || '').toLowerCase();
      const user = (e.user_id || '').toLowerCase();
      return ride.includes(term) || user.includes(term);
    });
  }, [events, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const getEventBadge = (eventType: string | null) => {
    const match = EVENT_TYPES.find((t) => t.id === eventType);
    return match ? match.className : 'bg-gray-100 text-gray-700';
  };

  const getEventLabel = (eventType: string | null) => {
    const match = EVENT_TYPES.find((t) => t.id === eventType);
    return match ? match.label : (eventType || 'Unknown');
  };

  const truncate = (text: string | null, max = 12) => {
    if (!text) return '—';
    return text.length > max ? `${text.slice(0, max)}…` : text;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangleIcon className="text-red-600" size={22} />
            Emergency Events
          </h2>
          <p className="text-sm text-gray-500">
            Audit log of every Safety Center action taken by drivers and riders.
          </p>
        </div>
        <button
          onClick={loadEvents}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          <RefreshIcon size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type:</span>
          <button
            onClick={() => setEventTypeFilter('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              eventTypeFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {EVENT_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setEventTypeFilter(t.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                eventTypeFilter === t.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Role:</span>
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              roleFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRoleFilter(r.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                roleFilter === r.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by ride_id or user_id..."
          className="w-full md:w-96 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshIcon className="animate-spin text-gray-400" size={28} />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-16 text-center">
            <AlertTriangleIcon className="mx-auto text-gray-300" size={40} />
            <p className="mt-3 text-gray-500">
              {totalCount === 0
                ? 'No emergency events recorded yet.'
                : 'No events match your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">When</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Role</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Event Type</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Ride ID</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">User ID</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEvents.map((event) => {
                  const hasLocation =
                    typeof event.location_lat === 'number' &&
                    typeof event.location_lng === 'number';
                  const mapsUrl = hasLocation
                    ? `https://www.google.com/maps/search/?api=1&query=${event.location_lat},${event.location_lng}`
                    : null;

                  return (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <ClockIcon size={14} className="text-gray-400" />
                          <span title={new Date(event.created_at).toISOString()}>
                            {new Date(event.created_at).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {event.role ? (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              event.role === 'driver'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {event.role}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getEventBadge(event.event_type)}`}
                        >
                          {getEventLabel(event.event_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {event.ride_id ? (
                          <code
                            className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
                            title={event.ride_id}
                          >
                            {truncate(event.ride_id, 14)}
                          </code>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {event.user_id ? (
                          <code
                            className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
                            title={event.user_id}
                          >
                            {truncate(event.user_id, 14)}
                          </code>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {mapsUrl ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors text-sm font-medium"
                          >
                            <MapPinIcon size={14} />
                            Open in Maps
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">No location</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-gray-500">
            Showing{' '}
            <span className="font-medium text-gray-700">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)}
            </span>{' '}
            of <span className="font-medium text-gray-700">{totalCount}</span> events
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page <span className="font-medium">{page + 1}</span> of{' '}
              <span className="font-medium">{totalPages}</span>
            </span>
            <button
              onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
              disabled={page + 1 >= totalPages || isLoading}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEmergencyEvents;
