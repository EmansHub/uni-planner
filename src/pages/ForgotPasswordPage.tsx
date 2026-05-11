
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { HelpChatbot } from '../components/HelpChatbot';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';


interface ForgotPasswordPageProps {
  onPasswordReset: (email: string) => void;
}

export function ForgotPasswordPage({ onPasswordReset }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();


  const handleResetRequest = async () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

<<<<<<< HEAD
    if (!email.endsWith('@pmu.edu.sa')) {
      toast.error('Please use your PMU email');
      return;
    }

=======
>>>>>>> 86ce3dabae28d96e29462a7e264f6de81a6bdc8e
    setLoading(true);

    try {
      // Send the user back to the app after they open the Supabase reset link.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Password reset email sent!');
      onPasswordReset(email);
      navigate('/reset-link-sent');

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
              onClick={() => navigate('/login')}
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
                onClick={() => navigate('/login')}
                className="text-foreground hover:underline font-medium"
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
