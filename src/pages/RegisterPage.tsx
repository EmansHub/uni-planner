/**
 * =============================================================================
 * REGISTER PAGE COMPONENT
 * =============================================================================
 * 
 * This component handles new user registration via backend API.
 * 
 * HOW IT WORKS:
 * 1. User fills in registration form (email, name, major, etc.)
 * 2. Frontend validates input (passwords match, all fields filled, etc.)
 * 3. Sends data to backend API to create account
 * 4. Backend creates user and returns success
 * 5. Automatically logs user in
 * 
 * AUTHENTICATION:
 * - Uses API-based registration (backend not yet implemented)
 * - Session created automatically after successful registration
 * 
 * VALIDATION RULES:
 * - All fields are required
 * - Password must be at least 6 characters
 * - Password and confirm password must match
 * 
 * =============================================================================
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft } from 'lucide-react';
import type { Page, User } from '../App';
import { toast } from 'sonner';
import { HelpChatbot } from '../components/HelpChatbot';

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

  // ---------------------------------------------------------------------------
  // REGISTRATION HANDLER
  // ---------------------------------------------------------------------------
  
  /**
   * Handle registration button click
   * Validates input and creates new user account via API
   * 
   * TODO: Implement this API endpoint in your backend
   * 
   * API ENDPOINT: POST /api/auth/register
   * 
   * Request Body:
   * {
   *   "email": "user@pmu.edu.sa",
   *   "name": "John Doe",
   *   "major": "Computer Science",
   *   "enrollmentSemester": "Fall 2024/25",
   *   "gender": "Male",
   *   "password": "userPassword123"
   * }
   * 
   * Expected Response (Success):
   * {
   *   "success": true,
   *   "user": {
   *     "email": "user@pmu.edu.sa",
   *     "name": "John Doe",
   *     "major": "Computer Science",
   *     "enrollmentSemester": "Fall 2024/25",
   *     "gender": "Male"
   *   },
   *   "message": "Registration successful"
   * }
   * 
   * Expected Response (Error):
   * {
   *   "success": false,
   *   "error": "Email already exists"
   * }
   * 
   * BACKEND TASKS:
   * 1. Validate all fields
   * 2. Check if email already exists in database
   * 3. Hash the password (NEVER store plain text!)
   * 4. Create user record in database
   * 5. Create session (cookie or JWT)
   * 6. Return user data (without password)
   */
  const handleRegister = async () => {
    // Step 1: Validate all fields are filled
    if (!email || !name || !major || !enrollmentSemester || !gender || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    // Step 2: Validate passwords match
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Step 3: Validate password length
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    // Step 4: Set loading state
    setLoading(true);

    try {
      // TODO: Replace this placeholder with actual API call
      // Example implementation:
      /*
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: Include cookies
        body: JSON.stringify({
          email,
          name,
          major,
          enrollmentSemester,
          gender,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Registration successful!
      onRegister(data.user);
      toast.success('Registration successful! Welcome to Uni Planner!');
      */

      // PLACEHOLDER: Simulate API call with mock data for testing
      console.log('[AUTH] Registration attempt:', { 
        email, 
        name, 
        major, 
        enrollmentSemester, 
        gender,
        password: '***' 
      });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful registration for testing purposes
      const mockUser: User = {
        email,
        name,
        major,
        enrollmentSemester,
        password: '',
        gender,
      };
      
      onRegister(mockUser);
      toast.success('Registration successful! (Mock - API not implemented)');
      
    } catch (error) {
      // Handle network or other errors
      console.error('[AUTH] Registration error:', error);
      toast.error('An error occurred during registration. Please check your connection.');
    } finally {
      // Reset loading state
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
              onClick={() => onNavigate('welcome')}
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
              <Select value={major} onValueChange={setMajor} disabled={loading}>
                <SelectTrigger id="major">
                  <SelectValue placeholder="Select your major" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Accounting">Accounting</SelectItem>
                  <SelectItem value="Architecture">Architecture</SelectItem>
                  <SelectItem value="Artificial Intelligence">Artificial Intelligence</SelectItem>
                  <SelectItem value="Business Administration">Business Administration</SelectItem>
                  <SelectItem value="Chemical Engineering">Chemical Engineering</SelectItem>
                  <SelectItem value="Civil Engineering">Civil Engineering</SelectItem>
                  <SelectItem value="Computer Engineering">Computer Engineering</SelectItem>
                  <SelectItem value="Computer Science">Computer Science</SelectItem>
                  <SelectItem value="Cybersecurity">Cybersecurity</SelectItem>
                  <SelectItem value="Electrical Engineering">Electrical Engineering</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Graphic Design">Graphic Design</SelectItem>
                  <SelectItem value="Human Resource Management">Human Resource Management</SelectItem>
                  <SelectItem value="Information Technology">Information Technology</SelectItem>
                  <SelectItem value="Interior Design">Interior Design</SelectItem>
                  <SelectItem value="Law">Law</SelectItem>
                  <SelectItem value="Management Information Systems">Management Information Systems</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Mechanical Engineering">Mechanical Engineering</SelectItem>
                  <SelectItem value="Nursing">Nursing</SelectItem>
                  <SelectItem value="Pharmacy">Pharmacy</SelectItem>
                  <SelectItem value="Software Engineering">Software Engineering</SelectItem>
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
                  <SelectItem value="Other">Other</SelectItem>
                  <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
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
                onClick={() => onNavigate('login')}
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
