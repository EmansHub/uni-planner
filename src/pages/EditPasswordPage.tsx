/**
 * =============================================================================
 * EDIT PASSWORD PAGE
 * =============================================================================
 * 
 * This component allows logged-in users to change their password via API.
 * 
 * HOW IT WORKS:
 * 1. User enters current password (for verification)
 * 2. User enters new password twice
 * 3. Frontend sends to backend API
 * 4. Backend verifies current password and updates to new one
 * 
 * AUTHENTICATION:
 * - Uses API-based password change (backend not yet implemented)
 * - Requires active user session
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

interface EditPasswordPageProps {
  user: User;
  onNavigate: (page: Page) => void;
  onUpdateUser: (user: User) => void;
}

export function EditPasswordPage({ user, onNavigate, onUpdateUser }: EditPasswordPageProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Handle password change
   * Validates and updates password via backend API
   * 
   * TODO: Implement this API endpoint in your backend
   * 
   * API ENDPOINT: POST /api/auth/change-password
   * 
   * Request Body:
   * {
   *   "currentPassword": "oldPassword123",
   *   "newPassword": "newPassword456"
   * }
   * 
   * Expected Response (Success):
   * {
   *   "success": true,
   *   "message": "Password changed successfully"
   * }
   * 
   * Expected Response (Error):
   * {
   *   "success": false,
   *   "error": "Current password is incorrect"
   * }
   * 
   * BACKEND TASKS:
   * 1. Verify user is authenticated (check session/token)
   * 2. Verify current password is correct
   * 3. Validate new password meets requirements
   * 4. Hash new password
   * 5. Update password in database
   * 6. Optionally: invalidate other sessions for security
   */
  const handleChangePassword = async () => {
    // Step 1: Validate all fields are filled
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    // Step 2: Validate new passwords match
    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match');
      return;
    }

    // Step 3: Validate password length
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    // Step 4: Don't allow same password
    if (newPassword === currentPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setLoading(true);

    try {
      // TODO: Replace this placeholder with actual API call
      // Example implementation:
      /*
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookie
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Failed to change password');
        setLoading(false);
        return;
      }

      toast.success('Password changed successfully!');
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      
      // Navigate back to profile
      setTimeout(() => {
        onNavigate('user-profile');
      }, 1000);
      */

      // PLACEHOLDER: Simulate API call for testing
      console.log('[AUTH] Password change:', { 
        email: user.email,
        currentPassword: '***',
        newPassword: '***' 
      });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock success
      toast.success('Password changed successfully! (Mock - API not implemented)');
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      
      // Navigate back to profile
      setTimeout(() => {
        onNavigate('user-profile');
      }, 1000);
      
    } catch (error) {
      console.error('[AUTH] Password change error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <Card className="shadow-lg">
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit mb-2"
              onClick={() => onNavigate('user-profile')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Profile
            </Button>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Update your account password. Make sure to use a strong password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current password field */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* New password field */}
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

            {/* Confirm new password field */}
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                placeholder="Re-enter new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Password requirements hint */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Password Requirements:</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc">
                <li>At least 6 characters long</li>
                <li>Different from your current password</li>
              </ul>
            </div>

            {/* Change password button */}
            <div className="flex gap-2 pt-4">
              <Button 
                className="flex-1" 
                onClick={handleChangePassword}
                disabled={loading}
              >
                {loading ? 'Changing...' : 'Change Password'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => onNavigate('user-profile')}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
