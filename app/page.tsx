'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  trusted_form_cert_url: string;
  created_at: string;
}

interface DNCEntry {
  phone_number: string;
  date_added: string;
  reason: string;
  source: string;
  added_by: string;
}

interface DashboardStats {
  totalContacts: number;
  activeOptOuts: number;
  optInsToday: number;
  optOutsToday: number;
}

interface OptIn {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  created_at: string;
  trusted_form_cert_url: string;
}

interface OptOut {
  phone_number: string;
  date_added: string;
  reason: string;
  source: string;
  added_by: string;
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    activeOptOuts: 0,
    optInsToday: 0,
    optOutsToday: 0
  });
  const [recentOptIns, setRecentOptIns] = useState<OptIn[]>([]);
  const [recentOptOuts, setRecentOptOuts] = useState<OptOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, optInsRes, optOutsRes] = await Promise.all([
          fetch('/api/dashboard-stats'),
          fetch('/api/leads/list'),
          fetch('/api/dnc/recent')
        ]);

        if (!statsRes.ok || !optInsRes.ok || !optOutsRes.ok) {
          throw new Error('One or more API requests failed');
        }

        const statsData = await statsRes.json();
        const optInsData = await optInsRes.json();
        const optOutsData = await optOutsRes.json();

        setStats(statsData);
        setRecentOptIns(optInsData || []);
        setRecentOptOuts(optOutsData || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col p-8">
        <div className="flex items-center justify-center h-64">
          <div className="loading-gradient h-2 w-40 rounded-full"></div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-red-500">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8">
      <div className="flex justify-end mb-8">
        <Link href="/docs/api" className="btn-primary">
          View API Docs
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Total Contacts</h3>
          <p className="text-3xl font-bold">{stats.totalContacts.toLocaleString()}</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Active Opt-Outs</h3>
          <p className="text-3xl font-bold">{stats.activeOptOuts.toLocaleString()}</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Opt-Ins Today</h3>
          <p className="text-3xl font-bold">{stats.optInsToday.toLocaleString()}</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Opt-Outs Today</h3>
          <p className="text-3xl font-bold">{stats.optOutsToday.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="section-title">Recent Opt-Ins</h2>
          <div className="space-y-6 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {recentOptIns.length > 0 ? (
              recentOptIns.map((optIn) => (
                <div key={optIn.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{optIn.first_name} {optIn.last_name}</h3>
                      <p className="text-sm text-gray-600">{optIn.phone}</p>
                      <p className="text-sm text-gray-500">{optIn.email}</p>
                    </div>
                    <time className="text-xs text-gray-400">{new Date(optIn.created_at).toLocaleString()}</time>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <a href={optIn.trusted_form_cert_url} target="_blank" rel="noopener noreferrer" 
                       className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      View TrustedForm Certificate
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No recent opt-ins</p>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Recent Opt-Outs</h2>
          <div className="space-y-6 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {recentOptOuts.length > 0 ? (
              recentOptOuts.map((optOut) => (
                <div key={optOut.phone_number} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {optOut.source}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{optOut.phone_number}</p>
                      <p className="text-sm text-gray-600 mt-1">{optOut.reason}</p>
                      <p className="text-xs text-gray-500 mt-1">Added by: {optOut.added_by}</p>
                    </div>
                    <time className="text-xs text-gray-400">{new Date(optOut.date_added).toLocaleString()}</time>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No recent opt-outs</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="card">
          <h2 className="section-title">Recent Leads</h2>
          <div className="space-y-6 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {recentOptIns.length > 0 ? (
              recentOptIns.map((lead) => (
                <div key={lead.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{lead.first_name} {lead.last_name}</h3>
                      <div className="mt-1 space-y-1">
                        <p className="text-sm text-gray-600 flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {lead.phone}
                        </p>
                        <p className="text-sm text-gray-600 flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {lead.email}
                        </p>
                      </div>
                    </div>
                    <time className="text-xs text-gray-400">{new Date(lead.created_at).toLocaleString()}</time>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <a href={lead.trusted_form_cert_url} target="_blank" rel="noopener noreferrer" 
                       className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      View TrustedForm Certificate
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No recent leads</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
