import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { ArrowLeft, Edit2, CheckCircle2, Trash2, AlertTriangle, Undo } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface SavedPlanViewProps {
  planId: string;
}

export function SavedPlanView({ planId }: SavedPlanViewProps) {
  const navigate = useNavigate();
  // The saved view keeps a local copy so small changes can update immediately.
  const [plan, setPlan] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [electiveCreditLimits, setElectiveCreditLimits] = useState<Record<string, number>>({});
  const maxHistorySize = 10;

  const formatSemesterName = (semesterId: string) => {
    // Saved semester keys are stored as machine-readable IDs like fall-2025.
    const [type, year] = semesterId.split('-');

    if (!type || !year) return semesterId;

    const nextYear = String(parseInt(year) + 1).slice(-2);

    return `${type.charAt(0).toUpperCase() + type.slice(1)} ${year}/${nextYear}`;
  };

  const loadSavedPlan = async () => {
    // Load the saved plan and all persisted child rows needed for display.
    const { data, error } = await supabase
      .from('degree_plans')
      .select(`
        id,
        name,
        is_default,
        has_overload,
        degree_plan_semesters (
          semester_key,
          display_order,
          completed,
          is_summer,
          degree_plan_semester_courses (
            course_id,
            display_order,
            elective_category,
            courses (
              id,
              name,
              credits,
              semester_hours,
              required_hours,
              must_be_alone
            )
          )
        ),
        degree_plan_completed_courses (
          course_id,
          courses (
            id,
            name,
            credits,
            semester_hours,
            required_hours,
            must_be_alone
          )
        ),
        degree_plan_repeat_courses (
          course_id
        ),
        degree_plan_override_courses (
          course_id
        )
      `)
      .eq('id', Number(planId))
      .single();

    if (error || !data) {
      console.error('Error loading saved plan:', error);
      toast.error('Failed to load saved plan');
      setPlan(null);
      return;
    }

    // Rebuild semesters in the exact order saved by the planner.
    const semestersArray = (data.degree_plan_semesters || [])
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((sem: any) => ({
        id: sem.semester_key,
        name: formatSemesterName(sem.semester_key),
        completed: sem.completed,
        isSummer: sem.is_summer,
        courses: (sem.degree_plan_semester_courses || [])
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((row: any) => {
            const courseInfo = Array.isArray(row.courses) ? row.courses[0] : row.courses;

            return {
              id: courseInfo.id,
              code: courseInfo.id.replace(/([A-Z]+)(\d+)/, '$1 $2'),
              name: courseInfo.name,
              credits: courseInfo.credits,
              semesterHours: courseInfo.semester_hours ?? undefined,
              requiredHours: courseInfo.required_hours ?? undefined,
              mustBeAlone: courseInfo.must_be_alone ?? false,
              electiveCategory: row.elective_category || undefined,
            };
          }),
      }));

    // Completed courses are separate from semester courses so past progress remains visible.
    const completedCoursesData = (data.degree_plan_completed_courses || []).map((row: any) => {
      const courseInfo = Array.isArray(row.courses) ? row.courses[0] : row.courses;

      return {
        id: courseInfo.id,
        code: courseInfo.id.replace(/([A-Z]+)(\d+)/, '$1 $2'),
        name: courseInfo.name,
        credits: courseInfo.credits,
        semesterHours: courseInfo.semester_hours ?? undefined,
        requiredHours: courseInfo.required_hours ?? undefined,
        mustBeAlone: courseInfo.must_be_alone ?? false,
      };
    });

    // Use an object keyed by semester ID for fast updates when toggling completion.
    const semestersObject = semestersArray.reduce((acc: any, sem: any) => {
      acc[sem.id] = sem;
      return acc;
    }, {});



    // Load the program code separately because the main query focuses on saved plan rows.
    const { data: planMeta, error: planMetaError } = await supabase
      .from('degree_plans')
      .select('degree_program_code')
      .eq('id', Number(planId))
      .single();

    if (planMetaError || !planMeta) {
      console.error('Error loading plan program code:', planMetaError);
      toast.error('Failed to load saved plan courses');
      return;
    }

    // Load the full curriculum to detect courses missing from the saved semester layout.
    const { data: curriculumRows, error: curriculumError } = await supabase
      .from('curriculum_section_courses')
      .select(`
        course_category,
        course_id,
        courses (
          id,
          name,
          credits,
          semester_hours,
          required_hours,
          must_be_alone
        )
      `)
      .eq('degree_program_code', planMeta.degree_program_code);

    if (curriculumError) {
      console.error('Error loading curriculum courses:', curriculumError);
      toast.error('Failed to load saved plan courses');
      return;
    }

    // Course objects from the curriculum are used for missing-course warnings.
    const allCourses = (curriculumRows || [])
      .map((row: any) => {
        const courseInfo = Array.isArray(row.courses) ? row.courses[0] : row.courses;
        if (!courseInfo) return null;

        return {
          id: courseInfo.id,
          code: courseInfo.id.replace(/([A-Z]+)(\d+)/, '$1 $2'),
          name: courseInfo.name,
          credits: courseInfo.credits,
          semesterHours: courseInfo.semester_hours ?? undefined,
          requiredHours: courseInfo.required_hours ?? undefined,
          mustBeAlone: courseInfo.must_be_alone ?? false,
          electiveCategory: row.course_category.toLowerCase().includes('elective')
            ? row.course_category
            : undefined,
        };
      })
      .filter(Boolean);

    setPlan({
      // Keep database shape converted to the frontend planning shape.
      id: String(data.id),
      name: data.name,
      semesters: semestersObject,
      allCourses,
      completedCoursesData,
      originalCompletedIds: completedCoursesData.map((c: any) => c.id),
      restrictions: {
        hasOverload: !!data.has_overload,
        repeatCourseIds: (data.degree_plan_repeat_courses || []).map((r: any) => r.course_id),
        overrideCourses: (data.degree_plan_override_courses || []).map((r: any) => ({
          courseId: r.course_id,
          proofImage: '',
          verified: true,
        })),
      },
    });
  };

  const loadElectiveCreditLimits = async () => {
    // Elective limits are needed when summarizing saved plan credits.
    const { data: planMeta, error: planMetaError } = await supabase
      .from('degree_plans')
      .select('degree_program_code')
      .eq('id', Number(planId))
      .single();

    if (planMetaError || !planMeta) {
      console.error('Error loading plan program code for elective limits:', planMetaError);
      return;
    }

    const { data, error } = await supabase
      .from('curriculum_sections')
      .select('course_category, required_credits')
      .eq('degree_program_code', planMeta.degree_program_code);

    if (error) {
      console.error('Error loading elective credit limits:', error);
      return;
    }

    const limits: Record<string, number> = {};

    (data || []).forEach((row: any) => {
      if (String(row.course_category).toLowerCase().includes('elective')) {
        limits[row.course_category] = row.required_credits || 0;
      }
    });

    setElectiveCreditLimits(limits);
  };

  useEffect(() => {
    // A new selected plan should start with a fresh undo stack.
    loadSavedPlan();
    loadElectiveCreditLimits();
    setHistory([]);
  }, [planId]);

  const saveToHistory = (currentPlan: any) => {
    // Store a deep copy so later state updates do not mutate undo snapshots.
    setHistory(prev => {
      const newHistory = [JSON.parse(JSON.stringify(currentPlan)), ...prev];
      return newHistory.slice(0, maxHistorySize);
    });
  };

  const handleUndo = async () => {
    if (history.length === 0) return;

    // Undo restores the most recent snapshot persisted before an edit.
    const previousPlan = history[0];
    const previousSemesters = Object.values(previousPlan.semesters || {}) as any[];

    // Clear current rows before restoring the previous snapshot.
    const { error: deleteCourseRowsError } = await supabase
      .from('degree_plan_semester_courses')
      .delete()
      .eq('degree_plan_id', Number(planId));

    if (deleteCourseRowsError) {
      console.error('Error clearing semester courses during undo:', deleteCourseRowsError);
      toast.error('Failed to undo change');
      return;
    }

    const { error: deleteSemestersError } = await supabase
      .from('degree_plan_semesters')
      .delete()
      .eq('degree_plan_id', Number(planId));

    if (deleteSemestersError) {
      console.error('Error clearing semesters during undo:', deleteSemestersError);
      toast.error('Failed to undo change');
      return;
    }

    // Reinsert semesters from the undo snapshot.
    const semesterRows = previousSemesters.map((semester: any, index: number) => ({
      degree_plan_id: Number(planId),
      semester_key: semester.id,
      display_order: index,
      completed: semester.completed,
      is_summer: !!semester.isSummer,
    }));

    if (semesterRows.length > 0) {
      const { error: insertSemestersError } = await supabase
        .from('degree_plan_semesters')
        .insert(semesterRows);

      if (insertSemestersError) {
        console.error('Error restoring semesters during undo:', insertSemestersError);
        toast.error('Failed to undo change');
        return;
      }
    }

    // Reinsert saved courses from the undo snapshot.
    const semesterCourseRows = previousSemesters.flatMap((semester: any) =>
      (semester.courses || [])
        .filter((course: any) => !course.isElectiveOption && !String(course.id).startsWith('temp-placeholder-'))
        .map((course: any, index: number) => ({
          degree_plan_id: Number(planId),
          semester_key: semester.id,
          course_id: course.id,
          display_order: index,
          elective_category: course.electiveCategory || null,
        }))
    );

    if (semesterCourseRows.length > 0) {
      const { error: insertSemesterCoursesError } = await supabase
        .from('degree_plan_semester_courses')
        .insert(semesterCourseRows);

      if (insertSemesterCoursesError) {
        console.error('Error restoring semester courses during undo:', insertSemesterCoursesError);
        toast.error('Failed to undo change');
        return;
      }
    }

    // Remove the used snapshot and reload from the database.
    setHistory(prev => prev.slice(1));

    await loadSavedPlan();

    toast.success('Change undone');
  };

  const handleToggleSemesterComplete = async (semesterId: string) => {
    if (!plan) return;

    // Save current state before changing completion so the action can be undone.
    saveToHistory(plan);

    const currentSemester = plan.semesters[semesterId];
    if (!currentSemester) return;

    // Completion is stored per semester so saved plans can track progress over time.
    const newCompletedValue = !currentSemester.completed;

    const { error } = await supabase
      .from('degree_plan_semesters')
      .update({ completed: newCompletedValue })
      .eq('degree_plan_id', Number(planId))
      .eq('semester_key', semesterId);

    if (error) {
      console.error('Error updating semester completion:', error);
      toast.error('Failed to update semester status');
      return;
    }

    const updatedSemesters = {
      ...plan.semesters,
      [semesterId]: {
        ...currentSemester,
        completed: newCompletedValue,
      },
    };

    const updatedPlan = {
      ...plan,
      semesters: updatedSemesters,
    };

    setPlan(updatedPlan);

    if (newCompletedValue) {
      // Celebrate only when a semester is newly completed.
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    toast.success(
      `Semester marked as ${newCompletedValue ? 'completed' : 'incomplete'}`
    );
  };

  const handleDeleteCourse = async (semesterId: string, courseId: string) => {
    if (!plan) return;

    saveToHistory(plan);

    const updatedSemesters = { ...plan.semesters };

    const allCoursesInPlan = plan.allCourses || [];

    // Build a reverse prerequisite lookup so dependent courses are removed together.
    const coursePrereqMap = new Map<string, string[]>();
    allCoursesInPlan.forEach((course: any) => {
      if (course.prerequisites && course.prerequisites.length > 0) {
        coursePrereqMap.set(course.id, course.prerequisites);
      }
    });

    // Removing a prerequisite also removes any planned courses that depend on it.
    const coursesToRemove = new Set<string>([courseId]);

    const findDependentCourses = (prereqId: string) => {
      coursePrereqMap.forEach((prerequisites, courseIdToCheck) => {
        if (prerequisites.includes(prereqId) && !coursesToRemove.has(courseIdToCheck)) {
          coursesToRemove.add(courseIdToCheck);
          findDependentCourses(courseIdToCheck);
        }
      });
    };

    findDependentCourses(courseId);

    const removedCourseNames: string[] = [];

    // Apply the removal across every semester before writing back to Supabase.
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

    // Rebuild semester-course rows after removing the selected course and dependents.
    const { error: deleteError } = await supabase
      .from('degree_plan_semester_courses')
      .delete()
      .eq('degree_plan_id', Number(planId));

    if (deleteError) {
      console.error('Error clearing semester courses:', deleteError);
      toast.error('Failed to remove course from saved plan');
      return;
    }

    // Convert the local semester object back into rows for the join table.
    const remainingRows = Object.values(updatedSemesters).flatMap((semester: any, semIndex: number) =>
      semester.courses
        .filter((course: any) => !course.isElectiveOption && !course.id.startsWith('temp-placeholder-'))
        .map((course: any, courseIndex: number) => ({
          degree_plan_id: Number(planId),
          semester_key: semester.id,
          course_id: course.id,
          display_order: courseIndex,
          elective_category: course.electiveCategory || null,
        }))
    );

    if (remainingRows.length > 0) {
      const { error: insertError } = await supabase
        .from('degree_plan_semester_courses')
        .insert(remainingRows);

      if (insertError) {
        console.error('Error rebuilding semester courses:', insertError);
        toast.error('Failed to update saved plan');
        return;
      }
    }

    const updatedPlan = { ...plan, semesters: updatedSemesters };
    setPlan(updatedPlan);

    if (removedCourseNames.length === 1) {
      toast.success('Course removed from plan');
    } else {
      toast.success(`Removed ${removedCourseNames.length} courses: ${removedCourseNames.join(', ')}`);
    }
  };

  const handleEdit = () => {
    // Session storage lets the planner know it should load this saved plan for editing.
    sessionStorage.setItem('editingPlanId', planId);
    sessionStorage.setItem('returnTo', 'saved-plan-view');
    navigate('/drag-drop-planning');
  };

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4 flex items-center justify-center">
        <p>Loading plan...</p>
      </div>
    );
  }

  const getCappedCredits = (courses: any[]) => {
    let regularCredits = 0;
    const electiveTotals: Record<string, number> = {};

    courses.forEach((course) => {
      if (!course || course.credits === 0) return;

      if (course.electiveCategory) {
        electiveTotals[course.electiveCategory] =
          (electiveTotals[course.electiveCategory] || 0) + course.credits;
      } else {
        regularCredits += course.credits;
      }
    });

    // Elective credits count only up to each category's required credit limit.
    const cappedElectiveCredits = Object.entries(electiveTotals).reduce(
      (sum, [category, total]) => {
        const limit = electiveCreditLimits[category] ?? total;
        return sum + Math.min(total, limit);
      },
      0
    );

    return regularCredits + cappedElectiveCredits;
  };

  const semesters = Object.values(plan.semesters) as any[];
  // These summary counts are derived from the loaded plan each render.
  const totalCourses = semesters.reduce((sum, semester) => sum + semester.courses.length, 0);
  const totalCredits = getCappedCredits(
    semesters.flatMap((semester: any) => semester.courses)
  );
  const completedSemesters = semesters.filter(s => s.completed).length;

  // Unassigned required courses indicate the saved plan is incomplete.
  const allCourses = plan.allCourses || [];
  const completedCourseIds = new Set(
    (plan.completedCoursesData || []).map((c: any) => c.id)
  );

  const assignedCourseIds = new Set(
    semesters.flatMap((sem: any) => sem.courses.map((c: any) => c.id))
  );

  // Electives are ignored because placeholders are resolved during planning.
  const unassignedCourses = allCourses.filter(
    (course: any) =>
      !assignedCourseIds.has(course.id) &&
      !completedCourseIds.has(course.id) &&
      !course.electiveCategory
  );

  const unassignedCount = unassignedCourses.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
      <div className="container mx-auto max-w-6xl">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate('/plan-selection')}
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
          {/* Warn when required non-elective courses are missing from semesters. */}
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
            // Semester cards use capped credits so electives are summarized correctly.
            const semesterCredits = getCappedCredits(semester.courses);

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
