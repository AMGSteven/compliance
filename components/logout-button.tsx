'use client';

import { useState } from 'react';

export default function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await fetch('/api/auth/login', { method: 'DELETE' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
    >
      {isLoggingOut ? 'Logging out...' : 'Logout'}
    </button>
  );
}
