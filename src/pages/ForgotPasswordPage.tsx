/**
 * =============================================================================
 * FORGOT PASSWORD PAGE
 * =============================================================================
 * 
 * This component allows users to request a password reset via backend API.
 * 
 * HOW IT WORKS:
 * 1. User enters their email address
 * 2. Frontend sends email to backend API
 * 3. Backend sends password reset email with token/link
 * 4. User clicks link in email to reset password
 * 
 * AUTHENTICATION:
 * - Uses API-based password reset (backend not yet implemented)
 * - Backend should send email with secure reset token
 * 
 * =============================================================================
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ArrowLeft, Mail } from 'lucide-react';
import type { Page } from '../App';
import { toast } from 'sonner';
import { HelpChatbot } from '../components/HelpChatbot';
import { supabase } from '../lib/supabase';


interface ForgotPasswordPageProps {
  onNavigate: (page: Page) => void;
  onPasswordReset: (email: string) => void;
}

export function ForgotPasswordPage({ onNavigate, onPasswordReset }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [loading, setLoading] = useState(false);


  const handleResetRequest = async () => {
    // Validate email
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:5173/reset-password',
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Password reset email sent!');
      onPasswordReset(email);
      
    } catch (error) {
      console.error('[AUTH] Password reset error:', error);
      toast.error('An error occurred. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit mb-2"
              onClick={() => onNavigate('login')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@pmu.edu.sa"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={handleResetRequest}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>

            <div className="text-center text-sm text-gray-600">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="text-blue-600 hover:underline font-medium"
              >
                Back to Login
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <HelpChatbot 
        isOpen={chatbotOpen} 
        onToggle={() => setChatbotOpen(!chatbotOpen)} 
      />
    </>
  );
}
