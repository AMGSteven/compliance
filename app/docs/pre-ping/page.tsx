'use client';

import { useState } from 'react';

export default function PrePingDocumentation() {
  const [testResponse, setTestResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testPrePing = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/leads/pre-ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 70942646-125b-4ddd-96fc-b9a142c698b8' // Test token
        },
        body: JSON.stringify({
          phone: '6507769592',
          state: 'TX',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          list_id: 'test-list',
          dialer_type: 'internal'
        })
      });
      
      const data = await response.json();
      setTestResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setTestResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Pre-Ping API Documentation</h1>
        <p className="text-lg text-gray-600">
          The Pre-Ping API allows you to validate leads before submission, checking for duplicates and compliance violations without storing the lead data.
        </p>
      </div>

      {/* API Overview */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">API Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium text-gray-900">Endpoint</h3>
            <code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/leads/pre-ping</code>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Authentication</h3>
            <p className="text-sm text-gray-600">Bearer Token (same as lead submission API)</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Response Time</h3>
            <p className="text-sm text-gray-600">Typically 500ms - 2 seconds</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Rate Limits</h3>
            <p className="text-sm text-gray-600">Same as main API (no additional restrictions)</p>
          </div>
        </div>
      </div>

      {/* Request Format */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Request Format</h2>
        
        <h3 className="text-lg font-medium text-gray-900 mb-2">Required Fields</h3>
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <ul className="space-y-2 text-sm">
            <li><code className="text-red-600">phone</code> - Phone number (any format, will be normalized)</li>
          </ul>
        </div>

        <h3 className="text-lg font-medium text-gray-900 mb-2">Optional Fields</h3>
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <ul className="space-y-2 text-sm">
            <li><code>state</code> - 2-letter state code (recommended for routing validation)</li>
            <li><code>email</code> - Email address (used for duplicate checking)</li>
            <li><code>firstName</code> - First name</li>
            <li><code>lastName</code> - Last name</li>
            <li><code>list_id</code> - Target list ID for bid estimation</li>
            <li><code>dialer_type</code> - Either "internal" or "pitch_bpo" (affects state validation)</li>
          </ul>
        </div>

        <h3 className="text-lg font-medium text-gray-900 mb-2">Example Request</h3>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X POST https://compliance.juicedmedia.io/api/leads/pre-ping \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "phone": "(555) 123-4567",
    "state": "TX",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "dialer_type": "internal"
  }'`}
        </pre>
      </div>

      {/* Response Format */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Response Format</h2>
        
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Success Response</h3>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "success": true,
  "accepted": true,
  "rejection_reasons": [],
  "estimated_bid": 0.50,
  "checks": {
    "duplicate": { "isCompliant": true },
    "state": { "isCompliant": true },
    "internalDNC": { "isCompliant": true },
    "synergyDNC": { "isCompliant": true },
    "tcpaLitigator": { "isCompliant": true },
    "blacklistDNC": { "isCompliant": true },
    "webrecon": { "isCompliant": true }
  },
  "processing_time_ms": 850
}`}
          </pre>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Rejection Response</h3>
          <pre className="bg-gray-900 text-red-400 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "success": true,
  "accepted": false,
  "rejection_reasons": [
    "Duplicate lead (last seen 5 days ago)",
    "Synergy DNC: internal_dnc"
  ],
  "estimated_bid": 0.00,
  "checks": {
    "duplicate": { 
      "isCompliant": false, 
      "reason": "Duplicate lead found within 30 days",
      "details": { "lastSeen": "2024-01-02", "daysSince": 5 }
    },
    "state": { "isCompliant": true },
    "internalDNC": { "isCompliant": true },
    "synergyDNC": { 
      "isCompliant": false, 
      "reason": "internal_dnc",
      "details": { "flags": ["internal_dnc"] }
    },
    "tcpaLitigator": { "isCompliant": true },
    "blacklistDNC": { "isCompliant": true },
    "webrecon": { "isCompliant": true }
  },
  "processing_time_ms": 1200
}`}
          </pre>
        </div>
      </div>

      {/* Compliance Checks */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Compliance Checks Performed</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">✅ Duplicate Check</h3>
            <p className="text-sm text-gray-600">Checks for duplicate leads within 30-day window using phone and email</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">✅ State Validation</h3>
            <p className="text-sm text-gray-600">Validates state against allowed states for selected dialer type</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">✅ Internal DNC</h3>
            <p className="text-sm text-gray-600">Checks against internal Do Not Call database</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">✅ Synergy DNC</h3>
            <p className="text-sm text-gray-600">Comprehensive DNC and litigator checking via Synergy API</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">✅ TCPA Litigators</h3>
            <p className="text-sm text-gray-600">Checks against known TCPA litigator database</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">✅ Blacklist DNC</h3>
            <p className="text-sm text-gray-600">Additional blacklist validation</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">✅ Webrecon</h3>
            <p className="text-sm text-gray-600">Advanced compliance scoring and validation</p>
          </div>
        </div>
      </div>

      {/* Integration Guide */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Integration Guide</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">1. Pre-validate before submission</h3>
            <p className="text-sm text-gray-600">Call the pre-ping API before spending resources on data collection or lead submission</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">2. Handle rejection gracefully</h3>
            <p className="text-sm text-gray-600">Use rejection reasons to provide feedback to users or adjust targeting</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">3. Cache results temporarily</h3>
            <p className="text-sm text-gray-600">Results are valid for 15-30 minutes for the same phone number</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">4. Monitor processing times</h3>
            <p className="text-sm text-gray-600">Use the processing_time_ms field to optimize your integration timing</p>
          </div>
        </div>
      </div>

      {/* Test Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Test the API</h2>
        <button
          onClick={testPrePing}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg font-medium transition-colors mb-4"
        >
          {loading ? 'Testing...' : 'Run Test Pre-Ping'}
        </button>
        
        {testResponse && (
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Response:</h3>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto max-h-96">
              {testResponse}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
