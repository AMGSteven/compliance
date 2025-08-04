'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Users, Calendar, TrendingUp, Lock } from 'lucide-react';

interface RevenueData {
  list_id: string;
  timeframe: string;
  issued_leads_count: number;
  revenue_per_lead: number;
  total_revenue: number;
  first_lead_date: string | null;
  last_lead_date: string | null;
  query_method: string;
}

export default function IExecuteRevenueDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState('all-time');

  const fetchRevenueData = async (selectedTimeframe: string) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/iexecute/revenue?timeframe=${selectedTimeframe}&password=${password}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch revenue data');
      }
      
      setRevenueData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching revenue data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === 'iexecute1234') {
      setIsAuthenticated(true);
      await fetchRevenueData(timeframe);
    } else {
      setError('Invalid password');
    }
  };

  const handleTimeframeChange = async (newTimeframe: string) => {
    setTimeframe(newTimeframe);
    if (isAuthenticated) {
      await fetchRevenueData(newTimeframe);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTimeframeLabel = (tf: string) => {
    switch (tf) {
      case 'today': return 'Today';
      case 'this-week': return 'This Week';
      case 'this-month': return 'This Month';
      case 'all-time': return 'All Time';
      default: return 'All Time';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">iExecute Revenue Dashboard</CardTitle>
            <p className="text-gray-600 mt-2">Enter password to access revenue data</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                />
              </div>
              {error && (
                <div className="text-red-600 text-sm text-center">{error}</div>
              )}
              <Button type="submit" className="w-full">
                Access Dashboard
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">iExecute Revenue Dashboard</h1>
            <p className="text-gray-600 mt-2">Track your Synergy issued lead revenue</p>
          </div>
          
          <div className="mt-4 md:mt-0">
            <Select value={timeframe} onValueChange={handleTimeframeChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="all-time">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading revenue data...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                <p className="font-medium">Error loading data</p>
                <p className="text-sm mt-1">{error}</p>
                <Button 
                  onClick={() => fetchRevenueData(timeframe)} 
                  className="mt-4"
                  variant="outline"
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Revenue Data */}
        {revenueData && !loading && (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Revenue */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(revenueData.total_revenue)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getTimeframeLabel(timeframe)}
                  </p>
                </CardContent>
              </Card>

              {/* Issued Leads */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Issued Leads</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {revenueData.issued_leads_count.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Synergy issued policies
                  </p>
                </CardContent>
              </Card>

              {/* Revenue Per Lead */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Per Lead</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(revenueData.revenue_per_lead)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Revenue per issued lead
                  </p>
                </CardContent>
              </Card>

              {/* Date Range */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Activity Period</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">
                    {formatDate(revenueData.first_lead_date)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    to {formatDate(revenueData.last_lead_date)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">List ID</span>
                    <span className="text-sm text-gray-600 font-mono">{revenueData.list_id}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Timeframe</span>
                    <span>{getTimeframeLabel(revenueData.timeframe)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Issued Leads</span>
                    <span>{revenueData.issued_leads_count.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Rate per Lead</span>
                    <span>{formatCurrency(revenueData.revenue_per_lead)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 font-bold text-lg">
                    <span>Total Revenue</span>
                    <span className="text-green-600">{formatCurrency(revenueData.total_revenue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Last Updated */}
            <div className="text-center text-sm text-gray-500 mt-8">
              Last updated: {new Date().toLocaleString()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
