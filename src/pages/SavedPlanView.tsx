import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { ArrowLeft, Edit2, CheckCircle2, Trash2, AlertTriangle, Undo } from 'lucide-react';
import type { Page } from '../App';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface SavedPlanViewProps {
  onNavigate: (page: Page) => void;
  planId: string;
}

export function SavedPlanView({ onNavigate, planId }: SavedPlanViewProps) {
  const [plan, setPlan] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const maxHistorySize = 10;

  useEffect(() => {
    const plans = JSON.parse(localStorage.getItem('degreePlans') || '[]');
    const foundPlan = plans.find((p: any) => p.id === planId);
    setPlan(foundPlan);
    setHistory([]); // Reset history when loading a new plan
  }, [planId]);

  const saveToHistory = (currentPlan: any) => {
    setHistory(prev => {
      const newHistory = [JSON.parse(JSON.stringify(currentPlan)), ...prev];
      return newHistory.slice(0, maxHistorySize);
    });
  };

  const handleUndo = () => {
    if (history.length === 0) return;

    const previousPlan = history[0];
    setPlan(previousPlan);
    setHistory(prev => prev.slice(1));

    // Update localStorage
    const plans = JSON.parse(localStorage.getItem('degreePlans') || '[]');
    const planIndex = plans.findIndex((p: any) => p.id === planId);
    if (planIndex !== -1) {
      plans[planIndex] = previousPlan;
      localStorage.setItem('degreePlans', JSON.stringify(plans));
      toast.success('Change undone');
    }
  };

  const handleToggleSemesterComplete = (semesterId: string) => {
    if (!plan) return;

    // Save current state to history
    saveToHistory(plan);

    const updatedSemesters = { ...plan.semesters };
    const wasCompleted = updatedSemesters[semesterId].completed;
    updatedSemesters[semesterId].completed = !updatedSemesters[semesterId].completed;

    const updatedPlan = { ...plan, semesters: updatedSemesters };
    setPlan(updatedPlan);

    // Update localStorage
    const plans = JSON.parse(localStorage.getItem('degreePlans') || '[]');
    const planIndex = plans.findIndex((p: any) => p.id === planId);
    if (planIndex !== -1) {
      plans[planIndex] = updatedPlan;
      localStorage.setItem('degreePlans', JSON.stringify(plans));
      
      // Show confetti only when marking as completed (not when unmarking)
      if (!wasCompleted && updatedSemesters[semesterId].completed) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      
      toast.success('Semester marked as ' + (updatedSemesters[semesterId].completed ? 'completed' : 'incomplete'));
    }
  };

  const handleDeleteCourse = (semesterId: string, courseId: string) => {
    if (!plan) return;

    // Save current state to history
    saveToHistory(plan);

    const updatedSemesters = { ...plan.semesters };
    
    // Get the full course catalog from the plan's allCourses to access prerequisites
    const allCoursesInPlan = plan.allCourses || [];
    
    // Build a map of course ID to prerequisites for quick lookup
    const coursePrereqMap = new Map<string, string[]>();
    allCoursesInPlan.forEach((course: any) => {
      if (course.prerequisites && course.prerequisites.length > 0) {
        coursePrereqMap.set(course.id, course.prerequisites);
      }
    });
    
    // Find all courses that need to be removed (the selected course + its dependents)
    const coursesToRemove = new Set<string>([courseId]);
    
    // Recursive function to find all dependent courses
    const findDependentCourses = (prereqId: string) => {
      // Look through the course prerequisite map for courses that have this as a prerequisite
      coursePrereqMap.forEach((prerequisites, courseIdToCheck) => {
        if (prerequisites.includes(prereqId) && !coursesToRemove.has(courseIdToCheck)) {
          coursesToRemove.add(courseIdToCheck);
          // Recursively find courses that depend on this course
          findDependentCourses(courseIdToCheck);
        }
      });
    };
    
    // Find all courses that depend on the course being deleted
    findDependentCourses(courseId);
    
    // Get course names for the toast message
    const removedCourseNames: string[] = [];
    
    // Remove all courses in the coursesToRemove set from all semesters
    Object.keys(updatedSemesters).forEach((semId) => {
      const semester = updatedSemesters[semId];
      
      semester.courses = semester.courses.filter((c: any) => {
        if (coursesToRemove.has(c.id)) {
          removedCourseNames.push(c.code);
          return false;
        }
        return true;
      });
    });

    const updatedPlan = { ...plan, semesters: updatedSemesters };
    setPlan(updatedPlan);

    // Update localStorage
    const plans = JSON.parse(localStorage.getItem('degreePlans') || '[]');
    const planIndex = plans.findIndex((p: any) => p.id === planId);
    if (planIndex !== -1) {
      plans[planIndex] = updatedPlan;
      localStorage.setItem('degreePlans', JSON.stringify(plans));
      
      // Show appropriate message based on how many courses were removed with undo action
      if (removedCourseNames.length === 1) {
        toast.success('Course removed from plan', {
          action: {
            label: 'Undo',
            onClick: handleUndo,
          },
        });
      } else {
        toast.success(`Removed ${removedCourseNames.length} courses: ${removedCourseNames.join(', ')}`, {
          action: {
            label: 'Undo',
            onClick: handleUndo,
          },
        });
      }
    }
  };

  const handleEdit = () => {
    // Store plan data in session for editing
    if (plan) {
      // Use the stored allCourses from the plan, or collect from semesters as fallback
      let allCourses = plan.allCourses || [];
      
      // Fallback: if plan doesn't have allCourses stored, collect from semesters
      if (!allCourses || allCourses.length === 0) {
        allCourses = [];
        Object.values(plan.semesters).forEach((semester: any) => {
          semester.courses.forEach((course: any) => {
            if (!allCourses.find((c: any) => c.id === course.id)) {
              allCourses.push(course);
            }
          });
        });
      }

      // Get original completed IDs and other data from the plan
      const originalCompletedIds = plan.originalCompletedIds || [];
      const completedCoursesData = plan.completedCoursesData || [];
      const allElectiveOptions = plan.allElectiveOptions || [];

      // Store data for editing
      sessionStorage.setItem('allCourses', JSON.stringify(allCourses));
      sessionStorage.setItem('originalCompletedIds', JSON.stringify(originalCompletedIds));
      sessionStorage.setItem('completedCoursesData', JSON.stringify(completedCoursesData));
      sessionStorage.setItem('allElectiveOptions', JSON.stringify(allElectiveOptions));
      sessionStorage.setItem('editingPlanId', planId);
      sessionStorage.setItem('returnTo', 'saved-plan-view');
    }
    onNavigate('drag-drop-planning');
  };

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4 flex items-center justify-center">
        <p>Loading plan...</p>
      </div>
    );
  }

  const semesters = Object.values(plan.semesters) as any[];
  const totalCourses = semesters.reduce((sum, semester) => sum + semester.courses.length, 0);
  const totalCredits = semesters.reduce(
    (sum, semester) => sum + semester.courses.reduce((s: number, c: any) => s + c.credits, 0),
    0
  );
  const completedSemesters = semesters.filter(s => s.completed).length;

  // Calculate unassigned courses
  const allCourses = plan.allCourses || [];
  const completedCourseIds = plan.originalCompletedIds || [];
  
  // Get all course IDs currently assigned to semesters
  const assignedCourseIds = semesters.flatMap(sem => sem.courses.map((c: any) => c.id));
  
  // Calculate unassigned courses (courses that are in allCourses but not assigned to any semester and not completed)
  const unassignedCourses = allCourses.filter(
    (course: any) => !assignedCourseIds.includes(course.id) && !completedCourseIds.includes(course.id)
  );
  const unassignedCount = unassignedCourses.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
      <div className="container mx-auto max-w-6xl">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => onNavigate('plan-selection')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Plans
        </Button>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl mb-2">{plan.name}</h1>
            <div className="flex gap-2">
              <Badge variant="secondary">{totalCourses} courses</Badge>
              <Badge variant="secondary">{totalCredits} credits</Badge>
              <Badge variant="outline">{completedSemesters} / {semesters.length} semesters completed</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleUndo}
              disabled={history.length === 0}
            >
              <Undo className="w-4 h-4 mr-2" />
              Undo
            </Button>
            <Button onClick={handleEdit}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Plan
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Warning for unassigned courses */}
          {unassignedCount > 0 && (
            <Alert className="border-orange-300 bg-orange-50 py-2 px-4">
              <div className="flex items-center gap-2 flex-nowrap">
                <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
                <p className="text-sm text-orange-900 whitespace-nowrap">
                  <strong>{unassignedCount}</strong> course{unassignedCount !== 1 ? 's are' : ' is'} not assigned to any semester. Click "Edit Plan" to add {unassignedCount !== 1 ? 'them' : 'it'} to your plan.
                </p>
              </div>
            </Alert>
          )}

          {semesters.map((semester: any) => {
            const semesterCredits = semester.courses.reduce((sum: number, c: any) => sum + c.credits, 0);

            return (
              <Card key={semester.id} className={semester.completed ? 'bg-green-50 border-green-200' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {semester.name}
                      {semester.completed && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                    </CardTitle>
                    <div className="flex items-center gap-4">
                      <Badge variant={semester.completed ? 'default' : 'secondary'}>
                        {semesterCredits} credits
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`complete-${semester.id}`}
                          checked={semester.completed}
                          onCheckedChange={() => handleToggleSemesterComplete(semester.id)}
                        />
                        <Label
                          htmlFor={`complete-${semester.id}`}
                          className="cursor-pointer text-sm"
                        >
                          Mark as completed
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {semester.courses.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {semester.courses.map((course: any) => (
                        <div
                          key={course.id}
                          className="bg-white border border-slate-200 rounded-lg p-3 relative group"
                        >
                          <div className={`flex items-start justify-between gap-2 ${!semester.completed ? 'pr-8' : ''}`}>
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{course.code}</h4>
                              <p className="text-xs text-slate-600">{course.name}</p>
                            </div>
                            <Badge variant="outline">{course.credits}cr</Badge>
                          </div>
                          {!semester.completed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                              onClick={() => handleDeleteCourse(semester.id, course.id)}
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 py-4">
                      <p className="text-sm">No courses planned for this semester</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}