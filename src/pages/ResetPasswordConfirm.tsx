/**
 * =============================================================================
 * RESET PASSWORD CONFIRM PAGE
 * =============================================================================
 * 
 * This component allows users to set a new password via backend API.
 * User arrives here after clicking reset link in email.
 * 
 * HOW IT WORKS:
 * 1. User clicks reset link in email (contains token)
 * 2. User enters new password twice
 * 3. Frontend sends new password + token to backend API
 * 4. Backend validates token and updates password
 * 
 * AUTHENTICATION:
 * - Uses API-based password reset (backend not yet implemented)
 * - Token validation handled by backend
 * 
 * =============================================================================
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { CheckCircle } from 'lucide-react';
import type { Page } from '../App';
import { toast } from 'sonner';
import { HelpChatbot } from '../components/HelpChatbot';
import { supabase } from '../lib/supabase';


interface ResetPasswordConfirmProps {
  email: string;
  onNavigate: (page: Page) => void;
}

export function ResetPasswordConfirm({ email, onNavigate }: ResetPasswordConfirmProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    // Validate inputs
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {

      // PLACEHOLDER: Simulate API call for testing
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Password updated successfully!');
      onNavigate('login');
      
    } catch (error) {
      console.error('[AUTH] Password reset error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle>Set New Password</CardTitle>
            <CardDescription>
              Create a new password for {email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password (min. 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleResetPassword}
              disabled={loading}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>

            <div className="text-center text-sm text-gray-600">
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="text-blue-600 hover:underline"
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
