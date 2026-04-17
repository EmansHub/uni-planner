
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft } from 'lucide-react';
import type { Page, User } from '../App';
import { toast } from 'sonner';
import { HelpChatbot } from '../components/HelpChatbot';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface RegisterPageProps {
  onNavigate: (page: Page) => void;  // Function to navigate to other pages
  onRegister: (user: User) => void;   // Function to call when registration succeeds
}

// =============================================================================
// REGISTER PAGE COMPONENT
// =============================================================================

export function RegisterPage({ onNavigate, onRegister }: RegisterPageProps) {
  // ---------------------------------------------------------------------------
  // STATE MANAGEMENT
  // ---------------------------------------------------------------------------
  
  const [email, setEmail] = useState('');                         // User's email
  const [name, setName] = useState('');                           // User's full name
  const [major, setMajor] = useState('');                         // User's major
  const [enrollmentSemester, setEnrollmentSemester] = useState(''); // When user enrolled
  const [gender, setGender] = useState('');                       // User's gender
  const [password, setPassword] = useState('');                   // User's password
  const [confirmPassword, setConfirmPassword] = useState('');     // Password confirmation
  const [chatbotOpen, setChatbotOpen] = useState(false);          // Help chatbot visibility
  const [loading, setLoading] = useState(false);                  // Loading state
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    const fetchPrograms = async () => {
      const { data, error } = await supabase
        .from('degree_programs')
        .select('code, name')
        .order('name');

      if (error) {
        console.error('Error fetching programs:', error);
        return;
      }

      setPrograms(data || []);
    };

    fetchPrograms();
  }, []);
  // ---------------------------------------------------------------------------
  // REGISTRATION HANDLER
  // ---------------------------------------------------------------------------
  
  const handleRegister = async () => {
    if (!email || !name || !major || !enrollmentSemester || !password || !confirmPassword || !gender) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            major,
            enrollmentSemester,
            gender,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Account created! Check your email if needed.');

      onRegister({
        email,
        name,
        major,
        enrollmentSemester,
        password,
        gender,
      });

      navigate('/login');

    } catch (error) {
      console.error('[AUTH] Register error:', error);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Enter key press in input fields
   * Allows user to register by pressing Enter
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRegister();
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Main container with gradient background */}
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
        
        {/* Registration card */}
        <Card className="w-full max-w-md shadow-xl">
          
          {/* Card header */}
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit mb-2"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <CardTitle>Register</CardTitle>
            <CardDescription>Create your account to get started</CardDescription>
          </CardHeader>
          
          {/* Card content with form fields */}
          <CardContent className="space-y-4">
            
            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email">PMU Email</Label>
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

            {/* Name field */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>

            {/* Major dropdown */}
            <div className="space-y-2">
              <Label htmlFor="major">Major</Label>
              <Select value={major} onValueChange={setMajor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your major" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.code} value={program.code}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Enrollment semester dropdown */}
            <div className="space-y-2">
              <Label htmlFor="enrollment">Enrollment Semester</Label>
              <Select value={enrollmentSemester} onValueChange={setEnrollmentSemester} disabled={loading}>
                <SelectTrigger id="enrollment">
                  <SelectValue placeholder="Select enrollment semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fall 2024/25">Fall 2024/25</SelectItem>
                  <SelectItem value="Spring 2024/25">Spring 2024/25</SelectItem>
                  <SelectItem value="Fall 2025/26">Fall 2025/26</SelectItem>
                  <SelectItem value="Spring 2025/26">Spring 2025/26</SelectItem>
                  <SelectItem value="Fall 2026/27">Fall 2026/27</SelectItem>
                  <SelectItem value="Spring 2026/27">Spring 2026/27</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gender dropdown */}
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={setGender} disabled={loading}>
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>

            {/* Confirm password field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>

            {/* Register button */}
            <Button 
              className="w-full" 
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Register'}
            </Button>

            {/* Login link */}
            <div className="text-center text-sm">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-blue-600 hover:underline font-medium"
              >
                Login here
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Help chatbot */}
      <HelpChatbot 
        isOpen={chatbotOpen} 
        onToggle={() => setChatbotOpen(!chatbotOpen)} 
      />
    </>
  );
}
