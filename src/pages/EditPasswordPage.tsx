import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface EditPasswordPageProps {
}

export function EditPasswordPage({}: EditPasswordPageProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validatePasswords = () => {
    if (!newPassword || !confirmNewPassword) {
      toast.error('Please fill in all password fields');
      return false;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (!passwordRegex.test(newPassword)) {
      toast.error('Password must be at least 8 characters and include uppercase, lowercase, and a number');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match');
      return false;
    }

    return true;
  };

  const handleSendVerification = async () => {
    if (!validatePasswords()) return;

    setLoading(true);

    try {
      const { error } = await supabase.auth.reauthenticate();

      if (error) {
        toast.error(error.message);
        return;
      }

      setVerificationSent(true);
      setVerificationCode('');
      toast.success('Verification code sent to your email.');
    } catch (error) {
      console.error('[AUTH] Reauthentication error:', error);
      toast.error('Could not send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePasswords()) return;

    if (!verificationSent) {
      toast.error('Please send the verification code first');
      return;
    }

    if (!verificationCode.trim()) {
      toast.error('Please enter the verification code');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        nonce: verificationCode.trim(),
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Password changed successfully!');

      setNewPassword('');
      setConfirmNewPassword('');
      setVerificationCode('');
      setVerificationSent(false);

      navigate('/user-profile');
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
              onClick={() => navigate('/user-profile')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Profile
            </Button>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Enter your new password, send a verification code to your email, enter the code you, then confirm the change.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password (min. 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>

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

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleSendVerification}
                disabled={loading}
              >
                Send Verification Code
              </Button>
            </div>

            {verificationSent && (
              <div className="space-y-2">
                <Label htmlFor="verificationCode">Verification Code</Label>
                <Input
                  id="verificationCode"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter the code from your email"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={handleChangePassword}
                disabled={loading || !verificationSent}
              >
                {loading ? 'Processing...' : 'Change Password'}
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate('/user-profile')}
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