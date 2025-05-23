'use client';

// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useInView } from 'react-intersection-observer';

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
  total_contacts: number;
  phone_optouts_count: number;
  phone_optins_count: number;
  phone_optins_today: number;
  phone_optouts_today: number;
  email_optouts_count: number;
  email_optins_count: number;
  email_optins_today: number;
  email_optouts_today: number;
  recent_optouts: OptOut[];
  recent_optins: OptIn[];
}

interface OptIn {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  created_at: string;
  trusted_form_cert_url: string;
  traffic_source?: string;
  list_id?: string;
}

interface EmailOptIn {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  date_added: string;
  source: string;
  consent_details?: string;
  status: string;
}

interface EmailOptOut {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  date_added: string;
  reason: string;
  source: string;
  status: string;
}

interface OptOut {
  phone_number: string;
  date_added: string;
  reason: string;
  source: string;
  added_by: string;
}

export default function Home() {
  // All state hooks defined first
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    total_contacts: 0,
    phone_optouts_count: 0,
    phone_optins_count: 0,
    phone_optins_today: 0,
    phone_optouts_today: 0,
    email_optouts_count: 0,
    email_optins_count: 0,
    email_optins_today: 0,
    email_optouts_today: 0,
    recent_optouts: [],
    recent_optins: []
  });
  const [recentOptIns, setRecentOptIns] = useState<OptIn[]>([]);
  const [recentOptOuts, setRecentOptOuts] = useState<OptOut[]>([]);
  const [recentEmailOptIns, setRecentEmailOptIns] = useState<EmailOptIn[]>([]);
  const [recentEmailOptOuts, setRecentEmailOptOuts] = useState<EmailOptOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Custom cursor effect removed
  
  // Intersection observer hooks defined next
  const [statsRef, statsInView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  
  const [optInsRef, optInsInView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  
  const [optOutsRef, optOutsInView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  
  const [emailOptInsRef, emailOptInsInView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  
  const [emailOptOutsRef, emailOptOutsInView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  // Data fetching effect
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch dashboard stats
        try {
          console.log('Fetching dashboard stats...');
          const statsRes = await fetch('/api/dashboard-stats');
          console.log('Stats response status:', statsRes.status);
          
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            console.log('Stats data received:', statsData);
            const data = await statsData;
            console.log('Dashboard stats data:', data);
            setDashboardStats({
              total_contacts: data.total_contacts || 0,
              phone_optouts_count: data.phone_optouts_count || 0,
              phone_optins_count: data.phone_optins_count || 0,
              phone_optins_today: data.phone_optins_today || 0,
              phone_optouts_today: data.phone_optouts_today || 0,
              email_optouts_count: data.email_optouts_count || 0,
              email_optins_count: data.email_optins_count || 0,
              email_optins_today: data.email_optins_today || 0,
              email_optouts_today: data.email_optouts_today || 0,
              recent_optouts: data.recent_optouts || [],
              recent_optins: data.recent_optins || []
            });
          } else {
            console.error('Stats API returned error status:', statsRes.status);
            // Continue with default stats
          }
        } catch (statsError) {
          console.error('Stats API request failed:', statsError);
          // Continue with default stats
        }

        // Fetch opt-ins
        try {
          console.log('Fetching opt-ins...');
          const optInsRes = await fetch('/api/leads/list');
          console.log('OptIns response status:', optInsRes.status);
          
          if (optInsRes.ok) {
            const optInsData = await optInsRes.json();
            console.log('OptIns data received:', optInsData);
            // Handle various response formats
            const leads = Array.isArray(optInsData) ? optInsData : 
                         (optInsData.data ? optInsData.data : 
                         (optInsData.leads || []));
            setRecentOptIns(leads);
          } else {
            console.error('OptIns API returned error status:', optInsRes.status);
            // Keep existing data, don't throw
          }
        } catch (optInsError) {
          console.error('OptIns API request failed:', optInsError);
          // Keep existing data, don't throw
        }

        // Fetch opt-outs
        try {
          console.log('Fetching opt-outs...');
          const optOutsRes = await fetch('/api/dnc/recent');
          console.log('OptOuts response status:', optOutsRes.status);
          
          if (optOutsRes.ok) {
            const optOutsData = await optOutsRes.json();
            console.log('OptOuts data received successfully');
            // Handle both formats: direct array or { data: [...] }
            const optOuts = Array.isArray(optOutsData) ? optOutsData : (optOutsData.data || []);
            setRecentOptOuts(optOuts);
          } else {
            console.error('OptOuts API returned error status:', optOutsRes.status);
            // Keep existing data, don't throw
          }
        } catch (optOutsError) {
          console.error('OptOuts API request failed:', optOutsError);
          // Keep existing data, don't throw
        }
        
        // Fetch email opt-ins
        try {
          console.log('Fetching email opt-ins...');
          const emailOptInsRes = await fetch('/api/email/recent/optins?api_key=test_key_123');
          console.log('Email OptIns response status:', emailOptInsRes.status);
          
          if (emailOptInsRes.ok) {
            const emailOptInsData = await emailOptInsRes.json();
            console.log('Email OptIns data received successfully');
            // Handle both formats: direct array or { data: [...] }
            const emailOptIns = Array.isArray(emailOptInsData) ? emailOptInsData : (emailOptInsData.data || []);
            setRecentEmailOptIns(emailOptIns);
          } else {
            console.error('Email OptIns API returned error status:', emailOptInsRes.status);
            // Keep existing data, don't throw
          }
        } catch (emailOptInsError) {
          console.error('Email OptIns API request failed:', emailOptInsError);
          // Keep existing data, don't throw
        }
        
        // Fetch email opt-outs
        try {
          console.log('Fetching email opt-outs...');
          const emailOptOutsRes = await fetch('/api/email/recent/optouts?api_key=test_key_123');
          console.log('Email OptOuts response status:', emailOptOutsRes.status);
          
          if (emailOptOutsRes.ok) {
            const emailOptOutsData = await emailOptOutsRes.json();
            console.log('Email OptOuts data received successfully');
            // Handle both formats: direct array or { data: [...] }
            const emailOptOuts = Array.isArray(emailOptOutsData) ? emailOptOutsData : (emailOptOutsData.data || []);
            setRecentEmailOptOuts(emailOptOuts);
          } else {
            console.error('Email OptOuts API returned error status:', emailOptOutsRes.status);
            // Keep existing data, don't throw
          }
        } catch (emailOptOutsError) {
          console.error('Email OptOuts API request failed:', emailOptOutsError);
          // Keep existing data, don't throw
        }
      } catch (error: any) {
        // This catch block should only run if there's an unexpected error
        // in the outer try block, not from the individual API calls
        console.error('Unexpected error in data fetching:', { 
          message: error.message,
          stack: error.stack,
          cause: error.cause
        });
        setError('An unexpected error occurred. Please refresh the page.');
      } finally {
        // All data fetching complete (even with errors)
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  
  // Custom cursor effect removed

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col p-8 bg-gradient-to-br from-white to-gray-50">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="loading-gradient h-2 w-60 rounded-full"></div>
          <div className="loading-gradient h-12 w-48 rounded-lg animate-pulse opacity-70"></div>
          <div className="grid grid-cols-4 gap-3 w-full max-w-3xl mt-6">
            {[...Array(4)].map((_, i) => (
              <div 
                key={i} 
                className="h-24 rounded-lg loading-gradient animate-pulse"
                style={{ animationDelay: `${i * 0.1}s` }}
              ></div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col p-8 bg-gradient-to-br from-white to-gray-50">
        <div className="flex items-center justify-center h-64 flex-col">
          <div className="p-6 bg-white rounded-xl shadow-lg border border-red-100 scale-in">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-red-500 text-center font-medium">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 mx-auto block px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-all duration-300"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 bg-gradient-to-br from-white to-gray-50 relative">
      {/* Custom cursor effect removed */}
      <div className="flex justify-end mb-8 fade-in">
        <Link href="/docs/api" className="btn-primary group relative overflow-hidden">
          <span className="relative z-10">View API Docs</span>
          <span className="absolute w-full h-full top-0 left-0 bg-gradient-to-r from-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-all duration-500 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
        </Link>
      </div>

      <div 
        ref={statsRef} 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        {/* Phone-related stats */}
        <div className={`card transform transition-all duration-700 ${statsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{transitionDelay: '0.1s'}}>
          <div className="absolute top-0 right-0 w-16 h-16 bg-teal-50 rounded-bl-xl opacity-50"></div>
          <svg className="w-8 h-8 text-teal-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Total Contacts</h3>
          <p className="text-3xl font-bold bg-gradient-to-r from-teal-500 to-blue-500 bg-clip-text text-transparent">{dashboardStats.total_contacts.toLocaleString()}</p>
        </div>
        <div className={`card transform transition-all duration-700 ${statsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{transitionDelay: '0.2s'}}>
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-xl opacity-50"></div>
          <svg className="w-8 h-8 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Phone Opt-Outs</h3>
          <p className="text-3xl font-bold bg-gradient-to-r from-red-500 to-purple-500 bg-clip-text text-transparent">{(dashboardStats.phone_optouts_count || 0).toLocaleString()}</p>
        </div>
        <div className={`card transform transition-all duration-700 ${statsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{transitionDelay: '0.3s'}}>
          <div className="absolute top-0 right-0 w-16 h-16 bg-green-50 rounded-bl-xl opacity-50"></div>
          <svg className="w-8 h-8 text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Phone Opt-Ins Today</h3>
          <p className="text-3xl font-bold bg-gradient-to-r from-green-500 to-teal-500 bg-clip-text text-transparent">{dashboardStats.phone_optins_today.toLocaleString()}</p>
        </div>
        <div className={`card transform transition-all duration-700 ${statsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{transitionDelay: '0.4s'}}>
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-xl opacity-50"></div>
          <svg className="w-8 h-8 text-blue-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Phone Opt-Outs Today</h3>
          <p className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">{(dashboardStats.phone_optouts_today || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Email-related stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className={`card transform transition-all duration-700 ${statsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{transitionDelay: '0.5s'}}>
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50 rounded-bl-xl opacity-50"></div>
          <svg className="w-8 h-8 text-purple-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Email Opt-Ins</h3>
          <p className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent">{(dashboardStats.email_optins_count || 0).toLocaleString()}</p>
        </div>
        <div className={`card transform transition-all duration-700 ${statsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{transitionDelay: '0.6s'}}>
          <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 rounded-bl-xl opacity-50"></div>
          <svg className="w-8 h-8 text-indigo-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Email Opt-Outs</h3>
          <p className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-transparent">{(dashboardStats.email_optouts_count || 0).toLocaleString()}</p>
        </div>
        <div className={`card transform transition-all duration-700 ${statsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{transitionDelay: '0.7s'}}>
          <div className="absolute top-0 right-0 w-16 h-16 bg-pink-50 rounded-bl-xl opacity-50"></div>
          <svg className="w-8 h-8 text-pink-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Email Opt-Ins Today</h3>
          <p className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">{(dashboardStats.email_optins_today || 0).toLocaleString()}</p>
        </div>
        <div className={`card transform transition-all duration-700 ${statsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{transitionDelay: '0.8s'}}>
          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-xl opacity-50"></div>
          <svg className="w-8 h-8 text-orange-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Email Opt-Outs Today</h3>
          <p className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">{(dashboardStats.email_optouts_today || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 relative mb-8">
        {/* Subtle background effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white to-gray-50 opacity-50 pointer-events-none"></div>
        <div ref={optInsRef} className={`card relative overflow-hidden transition-all duration-700 ${optInsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-blue-500"></div>
          <h2 className="section-title flex items-center">
            <svg className="w-5 h-5 mr-2 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Recent Opt-Ins
          </h2>
          <div className="space-y-6 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {recentOptIns.length > 0 ? (
              recentOptIns.map((optIn) => (
                <div 
                  key={optIn.id} 
                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 transform transition-all duration-500 hover:scale-[1.02] hover:shadow-md"
                  style={{ transitionDelay: '0.05s' }}
                >
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

        <div ref={optOutsRef} className={`card relative overflow-hidden transition-all duration-700 ${optOutsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`} style={{transitionDelay: '0.2s'}}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-red-500"></div>
          <h2 className="section-title flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Recent Opt-Outs
          </h2>
          <div className="space-y-6 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {recentOptOuts.length > 0 ? (
              recentOptOuts.map((optOut) => (
                <div 
                  key={optOut.phone_number} 
                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 transform transition-all duration-500 hover:scale-[1.02] hover:shadow-md"
                  style={{ transitionDelay: '0.05s' }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-red-50 to-red-100 text-red-800 shadow-sm transform transition-all duration-300 hover:scale-105 border border-red-200 border-opacity-40">
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

      {/* Email Opt-Ins and Opt-Outs Section */}
      <h2 className="text-2xl font-bold text-gray-800 mb-6 mt-8">Email Management</h2>
      <div className="grid gap-6 md:grid-cols-2 relative mb-8">
        {/* Subtle background effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white to-gray-50 opacity-50 pointer-events-none"></div>
        
        {/* Email Opt-Ins Card */}
        <div ref={emailOptInsRef} className={`card relative overflow-hidden transition-all duration-700 ${emailOptInsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
          <h2 className="section-title flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email Opt-Ins
          </h2>
          <div className="space-y-6 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {recentEmailOptIns.length > 0 ? (
              recentEmailOptIns.map((emailOptIn) => (
                <div 
                  key={emailOptIn.id} 
                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 transform transition-all duration-500 hover:scale-[1.02] hover:shadow-md"
                  style={{ transitionDelay: '0.05s' }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{emailOptIn.first_name || ''} {emailOptIn.last_name || ''}</h3>
                      <p className="text-sm text-gray-800 font-medium">{emailOptIn.email}</p>
                      <p className="text-sm text-gray-600 mt-1">{emailOptIn.source}</p>
                      {emailOptIn.consent_details && (
                        <p className="text-xs text-gray-500 mt-1">Consent: {emailOptIn.consent_details}</p>
                      )}
                    </div>
                    <time className="text-xs text-gray-400">{new Date(emailOptIn.date_added).toLocaleString()}</time>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No recent email opt-ins</p>
            )}
          </div>
        </div>

        {/* Email Opt-Outs Card */}
        <div ref={emailOptOutsRef} className={`card relative overflow-hidden transition-all duration-700 ${emailOptOutsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`} style={{transitionDelay: '0.2s'}}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-pink-500"></div>
          <h2 className="section-title flex items-center">
            <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Email Opt-Outs
          </h2>
          <div className="space-y-6 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {recentEmailOptOuts.length > 0 ? (
              recentEmailOptOuts.map((emailOptOut) => (
                <div 
                  key={emailOptOut.id} 
                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 transform transition-all duration-500 hover:scale-[1.02] hover:shadow-md"
                  style={{ transitionDelay: '0.05s' }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-red-50 to-red-100 text-red-800 shadow-sm transform transition-all duration-300 hover:scale-105 border border-red-200 border-opacity-40">
                          {emailOptOut.source}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{emailOptOut.email}</p>
                      <p className="text-sm text-gray-600 mt-1">{emailOptOut.reason}</p>
                      {emailOptOut.first_name && emailOptOut.last_name && (
                        <p className="text-xs text-gray-500 mt-1">Name: {emailOptOut.first_name} {emailOptOut.last_name}</p>
                      )}
                    </div>
                    <time className="text-xs text-gray-400">{new Date(emailOptOut.date_added).toLocaleString()}</time>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No recent email opt-outs</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="card relative overflow-hidden transition-all duration-700">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-teal-500"></div>
          <h2 className="section-title flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Recent Leads
          </h2>
          <div className="space-y-6 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {recentOptIns.length > 0 ? (
              recentOptIns.map((lead) => (
                <div 
                  key={lead.id} 
                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 transform transition-all duration-500 hover:scale-[1.02] hover:shadow-md"
                  style={{ transitionDelay: '0.05s' }}
                >
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
                        {lead.traffic_source && (
                          <p className="text-sm text-gray-600 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="font-medium">Traffic Source:</span> {lead.traffic_source}
                          </p>
                        )}
                        {lead.list_id && (
                          <p className="text-sm text-gray-600 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span className="font-medium">List ID:</span> {lead.list_id}
                          </p>
                        )}
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
      {/* Easter egg animation - hidden message that appears after scrolling */}
      <div className="fixed bottom-4 right-4 opacity-0 hover:opacity-100 transition-opacity duration-500">
        <div className="p-2 bg-white rounded-lg shadow-lg border border-purple-100 text-xs text-gray-500">
          Built with 💜 by Juiced Media
        </div>
      </div>
    </main>
  );
}
