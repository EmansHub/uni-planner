import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { CheckCircle } from 'lucide-react';
import type { Page } from '../App';

interface ResetLinkSentPageProps {
  email: string;
  onNavigate: (page: Page) => void;
}

export function ResetLinkSentPage({ email, onNavigate }: ResetLinkSentPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle>Check Your Email</CardTitle>
          <CardDescription>
            A password reset link has been sent to {email}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Open your email and click the reset link to set a new password.
          </p>

          <Button
            className="w-full"
            variant="outline"
            onClick={() => onNavigate('login')}
          >
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}