/**
 * =============================================================================
 * LOGIN PAGE COMPONENT
 * =============================================================================
 * 
 * This component handles user login functionality via backend API.
 * 
 * HOW IT WORKS:
 * 1. User enters email and password
 * 2. Frontend sends credentials to backend API
 * 3. Backend validates and creates session
 * 4. Frontend receives user data and navigates to dashboard
 * 
 * AUTHENTICATION:
 * - Uses API-based authentication (backend not yet implemented)
 * - Session management handled by backend (cookies/JWT)
 * 
 * =============================================================================
 */



import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ArrowLeft } from 'lucide-react';
import type { Page, User } from '../App';
import { toast } from 'sonner';
import { HelpChatbot } from '../components/HelpChatbot';
import { supabase } from '../lib/supabase';


// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface LoginPageProps {
  onNavigate: (page: Page) => void;  // Function to navigate to other pages
  onLogin: (user: User) => void;     // Function to call when login succeeds
}

// =============================================================================
// LOGIN PAGE COMPONENT
// =============================================================================

export function LoginPage({ onNavigate, onLogin }: LoginPageProps) {
  // ---------------------------------------------------------------------------
  // STATE MANAGEMENT
  // ---------------------------------------------------------------------------
  
  const [email, setEmail] = useState('');           // User's email input
  const [password, setPassword] = useState('');     // User's password input
  const [chatbotOpen, setChatbotOpen] = useState(false);  // Help chatbot visibility
  const [loading, setLoading] = useState(false);    // Loading state during login

  // ---------------------------------------------------------------------------
  // LOGIN HANDLER
  // ---------------------------------------------------------------------------
  

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      const user = data.user;

      toast.success('Login successful!');

      onLogin({
        email: user.email ?? email,
        name: user.user_metadata?.name ?? 'User',
        major: user.user_metadata?.major ?? '',
        enrollmentSemester: user.user_metadata?.enrollmentSemester ?? '',
        password,
        gender: user.user_metadata?.gender ?? '',
      });
    } catch (error) {
      console.error('[AUTH] Login error:', error);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Enter key press in input fields
   * Allows user to login by pressing Enter
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Main container with gradient background */}
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
        
        {/* Login card */}
        <Card className="w-full max-w-md shadow-xl">
          
          {/* Card header with title and back button */}
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit mb-2"
              onClick={() => onNavigate('welcome')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <CardTitle>Login</CardTitle>
            <CardDescription>Enter your credentials to access Uni Planner</CardDescription>
          </CardHeader>
          
          {/* Card content with form fields */}
          <CardContent className="space-y-4">
            
            {/* Email input field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@pmu.edu.sa"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>

            {/* Password input field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>

            {/* Login button */}
            <Button 
              className="w-full" 
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>

            {/* Forgot password link */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-sm text-blue-600 hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            {/* Register link */}
            <div className="text-center text-sm">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="text-blue-600 hover:underline font-medium"
              >
                Register here
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Help chatbot - can be opened from any page */}
      <HelpChatbot 
        isOpen={chatbotOpen} 
        onToggle={() => setChatbotOpen(!chatbotOpen)} 
      />
    </>
  );
}
