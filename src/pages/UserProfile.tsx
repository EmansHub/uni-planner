import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ArrowLeft, Edit2 } from 'lucide-react';
import type { User } from '../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface UserProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
}

  const generateEnrollmentSemesters = () => {
    const semesters: string[] = [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    let currentAcademicYearStart = year;

    if (month < 7) {
      currentAcademicYearStart = year - 1;
    }
    
    // Build list from past → current only
    for (let y = currentAcademicYearStart - 4; y <= currentAcademicYearStart; y++) {
      semesters.push(`Fall ${y}`);
      semesters.push(`Spring ${y + 1}`);
    }

    return semesters;
  };

export function UserProfile({ user, onUpdateUser }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [major, setMajor] = useState(user.major);
  const [enrollmentSemester, setEnrollmentSemester] = useState(user.enrollmentSemester);
  const [gender, setGender] = useState(user.gender || '');
  const [degreePrograms, setDegreePrograms] = useState<{ code: string; name: string }[]>([]);
  const navigate = useNavigate();

  const loadDegreePrograms = async () => {
    const { data, error } = await supabase
        .from('degree_programs')
        .select('code, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading degree programs:', error);
        toast.error('Failed to load majors');
        return;
      }

      setDegreePrograms(data || []);
  };

  React.useEffect(() => {
    loadDegreePrograms();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSave = async () => {
    if (!name || !major || !enrollmentSemester || !gender) {
      toast.error('Please fill in all fields');
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;

    if (!authUser) {
      toast.error('You must be logged in');
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({
        name,
        major,
        enrollment_semester: enrollmentSemester,
        gender,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authUser.id);

    if (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
      return;
    }

    const updatedUser = {
      ...user,
      name,
      major,
      enrollmentSemester,
      gender,
    };

    onUpdateUser(updatedUser);
    setIsEditing(false);
    toast.success('Profile updated successfully!');
  };

  const handleCancel = () => {
    setName(user.name);
    setMajor(user.major);
    setEnrollmentSemester(user.enrollmentSemester);
    setGender(user.gender || '');
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
      <div className="container mx-auto max-w-2xl">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>User Profile</CardTitle>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Avatar className="w-24 h-24">
                <AvatarFallback className="bg-[#1B3A52] text-white text-2xl">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="bg-slate-100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="major">Major</Label>
                {isEditing ? (
                  <Select value={major} onValueChange={setMajor}>
                    <SelectTrigger id="major">
                      <SelectValue />
                    </SelectTrigger>
                      <SelectContent>
                        {degreePrograms.map((program) => (
                          <SelectItem key={program.code} value={program.code}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={degreePrograms.find((program) => program.code === major)?.name || major}
                    disabled
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="enrollment">Enrollment Semester</Label>
                {isEditing ? (
                  <Select value={enrollmentSemester} onValueChange={setEnrollmentSemester}>
                    <SelectTrigger id="enrollment">
                      <SelectValue />
                    </SelectTrigger>
                      <SelectContent>
                        {generateEnrollmentSemesters().map((semester) => (
                          <SelectItem key={semester} value={semester}>
                            {semester}
                          </SelectItem>
                        ))}
                      </SelectContent>
                  </Select>
                ) : (
                  <Input value={enrollmentSemester} disabled />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                {isEditing ? (
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select your gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={gender} disabled />
                )}
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input value="••••••••" disabled className="bg-slate-100" />
                  <Button
                    variant="outline"
                    onClick={() => navigate('/edit-password')}
                  >
                    Change
                  </Button>
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleSave}>
                  Save Changes
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
