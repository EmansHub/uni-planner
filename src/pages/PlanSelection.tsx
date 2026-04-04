import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { ArrowLeft, Plus, FolderOpen, Trash2, Star } from 'lucide-react';
import type { Page, DegreePlan } from '../App';
import { toast } from 'sonner';

interface PlanSelectionProps {
  onNavigate: (page: Page) => void;
  onSelectPlan: (planId: string | null) => void;
}

export function PlanSelection({ onNavigate, onSelectPlan }: PlanSelectionProps) {
  const [savedPlans, setSavedPlans] = useState<DegreePlan[]>([]);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  useEffect(() => {
    const plans = JSON.parse(localStorage.getItem('degreePlans') || '[]');
    setSavedPlans(plans);
  }, []);

  const handleStartNewPlan = () => {
    // Clear all course selection state when starting a new plan
    sessionStorage.removeItem('completedCourses');
    sessionStorage.removeItem('currentCourses');
    sessionStorage.removeItem('completedCoursesData');
    sessionStorage.removeItem('allCourses');
    sessionStorage.removeItem('editingPlanId');
    
    onSelectPlan(null);
    onNavigate('course-selection');
  };

  const handleSelectPlan = (planId: string) => {
    onSelectPlan(planId);
    onNavigate('saved-plan-view');
  };

  const handleDeletePlan = (planId: string) => {
    const plans = JSON.parse(localStorage.getItem('degreePlans') || '[]');
    const updatedPlans = plans.filter((p: DegreePlan) => p.id !== planId);
    localStorage.setItem('degreePlans', JSON.stringify(updatedPlans));
    
    // If deleted plan was default, clear default
    const defaultPlanId = localStorage.getItem('defaultPlanId');
    if (defaultPlanId === planId) {
      localStorage.removeItem('defaultPlanId');
    }
    
    setSavedPlans(updatedPlans);
    setPlanToDelete(null);
    toast.success('Plan deleted successfully');
  };

  const handleSetDefault = (e: React.MouseEvent, planId: string) => {
    e.stopPropagation();
    localStorage.setItem('defaultPlanId', planId);
    toast.success('Set as default plan');
    // Force re-render
    setSavedPlans([...savedPlans]);
  };

  const isDefaultPlan = (planId: string) => {
    return localStorage.getItem('defaultPlanId') === planId;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
      <div className="container mx-auto max-w-4xl">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => onNavigate('dashboard')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <h1 className="text-3xl mb-8">Degree Planning</h1>

        <div className="grid gap-6">
          {/* Start New Plan */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-dashed border-orange-300 bg-white/50"
            onClick={handleStartNewPlan}
          >
            <CardHeader className="pb-6">
              <div className="flex items-center gap-4">
                <div className="bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center">
                  <Plus className="w-6 h-6 text-[#E87722]" />
                </div>
                <div>
                  <CardTitle>Start a New Plan</CardTitle>
                  <CardDescription>
                    Create a new degree plan from scratch
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Saved Plans */}
          {savedPlans.length > 0 && (
            <>
              <div className="mt-4">
                <h2 className="text-xl mb-4">Saved Plans</h2>
              </div>
              {savedPlans.map((plan) => {
                const totalCourses = Object.values(plan.semesters).reduce(
                  (sum, semester) => sum + semester.courses.length,
                  0
                );
                const completedSemesters = Object.values(plan.semesters).filter(
                  (s) => s.completed
                ).length;
                const isDefault = isDefaultPlan(plan.id);

                return (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer hover:shadow-lg transition-shadow ${
                      isDefault ? 'border-2 border-[#E87722]' : ''
                    }`}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    <CardHeader className="pb-6">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center">
                          <FolderOpen className="w-6 h-6 text-[#1B3A52]" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle>{plan.name}</CardTitle>
                            {isDefault && (
                              <Badge variant="default" className="gap-1">
                                <Star className="w-3 h-3" />
                                Default
                              </Badge>
                            )}
                          </div>
                          <CardDescription>
                            {totalCourses} courses planned • {completedSemesters} semesters completed
                          </CardDescription>
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleSetDefault(e, plan.id)}
                            className={isDefault ? 'text-yellow-600' : 'text-slate-400'}
                          >
                            <Star className={`w-5 h-5 ${isDefault ? 'fill-yellow-600' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlanToDelete(plan.id);
                            }}
                          >
                            <Trash2 className="w-5 h-5 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!planToDelete} onOpenChange={(open) => !open && setPlanToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Plan</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this plan? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => planToDelete && handleDeletePlan(planToDelete)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
