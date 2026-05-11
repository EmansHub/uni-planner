import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Calendar, BookOpen, User, LogOut } from 'lucide-react';
import type { User as UserType } from '../App';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  user: UserType;
  onLogout: () => void;
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const navigate = useNavigate();

  // Use initials as the profile button fallback when no avatar image is available.
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50">
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl mb-2">Welcome back, {user.name ? user.name.split(' ')[0] : 'User'}!</h1>
            <p className="text-slate-600">Manage your degree plan and semester schedules</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/user-profile')}
              className="rounded-full"
            >
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-[#1B3A52] text-white">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                await supabase.auth.signOut();
                onLogout();
                navigate('/login');
              }}
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/plan-selection')}
          >
            <CardHeader className="space-y-4">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-[#E87722]" />
              </div>
              <div>
                <CardTitle>Degree Planning</CardTitle>
                <CardDescription>
                  Create and manage your academic degree plans
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg">
                Open Degree Planning
              </Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/semester-schedule')}
          >
            <CardHeader className="space-y-4">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center">
                <Calendar className="w-8 h-8 text-[#1B3A52]" />
              </div>
              <div>
                <CardTitle>Semester Schedule</CardTitle>
                <CardDescription>
                  Plan your class schedule for the current semester
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg" variant="outline">
                Open Semester Schedule
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
