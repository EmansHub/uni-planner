
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft } from 'lucide-react';
import type { User } from '../App';
import { toast } from 'sonner';
import { HelpChatbot } from '../components/HelpChatbot';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const generateEnrollmentSemesters = () => {
  const semesters: string[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let startYear = year;
  if (month < 7) startYear = year - 1;

  for (let y = startYear - 4; y <= startYear; y++) {
    const nextYearShort = (y + 1).toString().slice(-2);
    semesters.push(`Fall ${y}/${nextYearShort}`);
    semesters.push(`Spring ${y + 1}/${nextYearShort}`);
  }

  return semesters;
};

// COMPONENT PROPS
interface RegisterPageProps {
  onRegister: (user: User) => void;   // Function to call when registration succeeds
}

// REGISTER PAGE COMPONENT

export function RegisterPage({ onRegister }: RegisterPageProps) {
  
  // STATE MANAGEMENT
  
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

  // REGISTRATION HANDLER
  const handleRegister = async () => {
    if (!email || !name || !major || !enrollmentSemester || !password || !confirmPassword || !gender) {
      toast.error('Please fill in all fields');
      return;
    }

    //if (!email.endsWith('@pmu.edu.sa')) {
    //  toast.error('Please use your PMU email');
    //  return;
    //}

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
            enrollment_semester: enrollmentSemester,
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

  // RENDER
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
                onKeyDown={handleKeyPress}
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
                onKeyDown={handleKeyPress}
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
                  {generateEnrollmentSemesters().map((sem) => (
                    <SelectItem key={sem} value={sem}>
                      {sem}
                    </SelectItem>
                  ))}
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
                onKeyDown={handleKeyPress}
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
                onKeyDown={handleKeyPress}
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
