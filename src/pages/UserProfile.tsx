import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ArrowLeft, Edit2 } from 'lucide-react';
import type { Page, User } from '../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface UserProfileProps {
  user: User;
  onNavigate: (page: Page) => void;
  onUpdateUser: (user: User) => void;
}

export function UserProfile({ user, onNavigate, onUpdateUser }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [major, setMajor] = useState(user.major);
  const [enrollmentSemester, setEnrollmentSemester] = useState(user.enrollmentSemester);
  const [gender, setGender] = useState(user.gender || '');
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSave = () => {
    if (!name || !major || !enrollmentSemester || !gender) {
      toast.error('Please fill in all fields');
      return;
    }

    const updatedUser = {
      ...user,
      name,
      major,
      enrollmentSemester,
      gender,
    };

    // Update in localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex((u: User) => u.email === user.email);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
      localStorage.setItem('users', JSON.stringify(users));
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }

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
                      <SelectItem value="Marketing & Digital Media">Marketing & Digital Media</SelectItem>
                      <SelectItem value="Mechanical Engineering">Mechanical Engineering</SelectItem>
                      <SelectItem value="Software Engineering">Software Engineering</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={major} disabled />
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
                      <SelectItem value="Fall 2021">Fall 2021</SelectItem>
                      <SelectItem value="Spring 2022">Spring 2022</SelectItem>
                      <SelectItem value="Fall 2022">Fall 2022</SelectItem>
                      <SelectItem value="Spring 2023">Spring 2023</SelectItem>
                      <SelectItem value="Fall 2023">Fall 2023</SelectItem>
                      <SelectItem value="Spring 2024">Spring 2024</SelectItem>
                      <SelectItem value="Fall 2024">Fall 2024</SelectItem>
                      <SelectItem value="Spring 2025">Spring 2025</SelectItem>
                      <SelectItem value="Fall 2025">Fall 2025</SelectItem>
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
