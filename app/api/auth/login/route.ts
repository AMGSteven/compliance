import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    // Get the correct password from environment variables
    // If it's not available, use the hardcoded one that was specified in .env.local
    const correctPassword = process.env.ADMIN_PASSWORD || '123456';
    
    console.log('Using admin password:', correctPassword ? '[password is set]' : '[password not found]');
    
    // Check if the password is correct
    if (password === correctPassword) {
      // Set authentication cookie in the response
      const response = NextResponse.json(
        { success: true, message: 'Authentication successful' },
        { status: 200 }
      );
      
      response.cookies.set({
        name: 'auth-token',
        value: 'authenticated',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
      });
      
      return response;
    } else {
      // Invalid password
      return NextResponse.json(
        { success: false, message: 'Invalid password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during authentication' },
      { status: 500 }
    );
  }
}

// Add a logout route
export async function DELETE() {
  // Clear the auth cookie
  const response = NextResponse.json(
    { success: true, message: 'Logged out successfully' },
    { status: 200 }
  );
  
  // Clear the auth cookie
  response.cookies.delete('auth-token');
  
  return response;
}
