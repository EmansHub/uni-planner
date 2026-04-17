
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { GraduationCap } from 'lucide-react';
import type { Page } from '../App';
import { HelpChatbot } from '../components/HelpChatbot';

export function WelcomePage() {
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                
                <div className="bg-[#E87722] p-4 rounded-full">
                  <GraduationCap className="w-12 h-12 text-white" />
                </div> 

                
              </div>
              <CardTitle className="text-3xl ">Uni Planner</CardTitle>
              <CardDescription className="text-slate-500">
                Plan your academic journey and schedule your semesters with ease
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate('/login')}
              >
                Login
              </Button>

              <Button 
                className="w-full" 
                variant="outline" 
                size="lg"
                onClick={() => navigate('/register')}
              >
                Register
              </Button>
              
              <Button 
                className="w-full" 
                variant="ghost" 
                size="lg"
                onClick={() => navigate('/forgot-password')}
              >
                Forgot Password
              </Button>
            </CardContent>
          </Card>
        </div>
        <div className="pb-6 text-center">
          <p className="text-slate-600">Every success story begins with a good plan</p>
        </div>
      </div>
       <HelpChatbot isOpen={chatbotOpen} onToggle={() => setChatbotOpen(!chatbotOpen)} /> 
    </>
  );
}