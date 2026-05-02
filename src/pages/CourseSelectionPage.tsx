import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, CheckCircle2, Home, Upload, RotateCcw } from 'lucide-react';
import type { User } from '../App';
import { Collapsible, CollapsibleContent } from '../ui/collapsible';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import { TranscriptUpload } from '../components/TranscriptUpload';
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase';

interface CourseSelectionPageProps {
  user: User;
  onContinue: (planID: string | null) => void;
}

interface CourseSection {
  title: string;
  courses: Course[];
  isElective?: boolean;
  electiveNote?: string;
  maxElectives?: number;
  displayOrder?: number;
  requiredCredits?: number;
}

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  department: string;
  semesterHours?: number;
  isPrepCourse?: boolean;
  prerequisites?: string[];
  requiredHours?: number;
  mustBeAlone?: boolean;
  isElectiveOption?: boolean;
  electiveCategory?: string;
  maxElectivesAllowed?: number;
}

export function CourseSelectionPage({ user, onContinue }: CourseSelectionPageProps) {
  const navigate = useNavigate();
  const [courseSections, setCourseSections] = useState<CourseSection[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [currentCourses, setCurrentCourses] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showTranscriptUpload, setShowTranscriptUpload] = useState(false);
  const [completedCourses, setCompletedCourses] = useState<Set<string>>(new Set());

  const loadCourseSections = async () => {
  setLoadingCourses(true);

    const { data: sectionMetaRows, error: sectionMetaError } = await supabase
    .from('curriculum_sections')
    .select('degree_program_code, course_category, required_credits, display_order')
    .eq('degree_program_code', user.major);

    if (sectionMetaError) {
    console.error('Error loading curriculum sections:', sectionMetaError);
    toast.error('Failed to load curriculum sections');
    setLoadingCourses(false);
    return;
    }

    const sectionMetaMap = new Map<string, { requiredCredits: number; displayOrder: number }>();

    (sectionMetaRows || []).forEach((row: any) => {
    sectionMetaMap.set(row.course_category, {
      requiredCredits: row.required_credits,
      displayOrder: row.display_order ?? 99,
    });
    });

    const { data: sectionRows, error: sectionError } = await supabase
      .from('curriculum_section_courses')
      .select(`
        degree_program_code,
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
      .eq('degree_program_code', user.major);

    if (sectionError) {
      console.error('Error loading curriculum courses:', sectionError);
      toast.error('Failed to load curriculum');
      setLoadingCourses(false);
      return;
    }

    const { data: prereqRows, error: prereqError } = await supabase
      .from('course_prerequisites')
      .select('course_id, prerequisite_course_id');

    if (prereqError) {
      console.error('Error loading prerequisites:', prereqError);
      toast.error('Failed to load prerequisites');
      setLoadingCourses(false);
      return;
    }

    const prereqMap = new Map<string, string[]>();

    (prereqRows || []).forEach((row: any) => {
      const current = prereqMap.get(row.course_id) || [];
      current.push(row.prerequisite_course_id);
      prereqMap.set(row.course_id, current);
    });

    const grouped = new Map<string, Course[]>();

    (sectionRows || []).forEach((row: any) => {
      const courseInfo = Array.isArray(row.courses) ? row.courses[0] : row.courses;
      if (!courseInfo) return;

      const course: Course = {
        id: courseInfo.id,
        code: courseInfo.id.replace(/([A-Z]+)(\d+)/, '$1 $2'),
        name: courseInfo.name,
        credits: courseInfo.credits,
        department: courseInfo.id.replace(/\d+/g, ''),
        semesterHours: courseInfo.semester_hours ?? undefined,
        isPrepCourse: courseInfo.credits === 0,
        prerequisites: prereqMap.get(courseInfo.id) || undefined,
        requiredHours: courseInfo.required_hours ?? undefined,
        mustBeAlone: courseInfo.must_be_alone ?? false,
      };

      const existing = grouped.get(row.course_category) || [];
      existing.push(course);
      grouped.set(row.course_category, existing);
    });

      const builtSections: CourseSection[] = Array.from(grouped.entries()).map(
        ([title, courses]) => {
          const meta = sectionMetaMap.get(title);
          const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);

          const isElective =
            title.toLowerCase().includes('elective');

          let maxElectives: number | undefined;
          let electiveNote: string | undefined;

          if (isElective && meta?.requiredCredits) {
            const sampleCredits = courses.find(c => c.credits > 0)?.credits || 3;
            maxElectives = Math.ceil(meta.requiredCredits / sampleCredits);
            electiveNote = `${maxElectives} required (${meta.requiredCredits} credits total)`;
          }

          return {
            title,
            courses,
            isElective,
            electiveNote,
            maxElectives,
            displayOrder: meta?.displayOrder ?? 99,
            requiredCredits: meta?.requiredCredits ?? totalCredits,
          };
        }
      );

    builtSections.sort((a, b) => {
      const orderA = a.displayOrder ?? 99;
      const orderB = b.displayOrder ?? 99;

      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });
    
    setCourseSections(builtSections);
    setExpandedSections(
      new Set(builtSections.filter(s => !s.isElective).map(s => s.title))
    );
    setLoadingCourses(false);
  };

  useEffect(() => {
    loadCourseSections();
  }, []);

  const toggleCompleted = (courseId: string) => {
    const newCompleted = new Set(completedCourses);
    if (newCompleted.has(courseId)) {
      newCompleted.delete(courseId);
    } else {
      newCompleted.add(courseId);
      // Remove from current if adding to completed
      const newCurrent = new Set(currentCourses);
      newCurrent.delete(courseId);
      setCurrentCourses(newCurrent);
    }
    setCompletedCourses(newCompleted);
  };

  const toggleCurrent = (courseId: string, sectionTitle: string) => {
    const section = courseSections.find(s => s.title === sectionTitle);
    
    // If it's an elective section with limits, check the limit
    if (section?.isElective && section.maxElectives) {
      const sectionCourseIds = section.courses.map(c => c.id);
      const selectedInSection = Array.from(currentCourses).filter(id => 
        sectionCourseIds.includes(id)
      ).length;
      const completedInSection = Array.from(completedCourses).filter(id => 
        sectionCourseIds.includes(id)
      ).length;
      
      // If trying to select a new course and already at limit
      if (!currentCourses.has(courseId) && 
          selectedInSection + completedInSection >= section.maxElectives) {
        toast.error(`You can only select ${section.maxElectives} course(s) from ${sectionTitle}`);
        return;
      }
    }

    const newCurrent = new Set(currentCourses);
    if (newCurrent.has(courseId)) {
      newCurrent.delete(courseId);
    } else {
      newCurrent.add(courseId);
      // Remove from completed if adding to current
      const newCompleted = new Set(completedCourses);
      newCompleted.delete(courseId);
      setCompletedCourses(newCompleted);
    }
    setCurrentCourses(newCurrent);
  };

  const markSectionCompleted = (section: CourseSection) => {
    const newCompleted = new Set(completedCourses);
    const newCurrent = new Set(currentCourses);
    
    // If it's an elective section with limits, only mark up to the limit
    if (section.isElective && section.maxElectives) {
      const sectionCourseIds = section.courses.map(c => c.id);
      const alreadyCompleted = Array.from(completedCourses).filter(id => 
        sectionCourseIds.includes(id)
      ).length;
      
      if (alreadyCompleted >= section.maxElectives) {
        toast.info(`Already completed the required ${section.maxElectives} course(s) from ${section.title}`);
        return;
      }
      
      const needed = section.maxElectives - alreadyCompleted;
      const coursesToMark = section.courses.slice(0, needed);
      
      coursesToMark.forEach(course => {
        if (!newCompleted.has(course.id)) {
          newCompleted.add(course.id);
          newCurrent.delete(course.id);
        }
      });
      
      toast.success(`Marked ${needed} course(s) as completed from ${section.title}`);
    } else {
      // For non-elective sections, mark all
      section.courses.forEach(course => {
        newCompleted.add(course.id);
        newCurrent.delete(course.id);
      });
      toast.success(`Marked all courses as completed in ${section.title}`);
    }
    
    setCompletedCourses(newCompleted);
    setCurrentCourses(newCurrent);
  };

  const clearSection = (section: CourseSection) => {
    const sectionCourseIds = section.courses.map(c => c.id);

    const newCompleted = new Set(
      Array.from(completedCourses).filter(id => !sectionCourseIds.includes(id))
    );

    const newCurrent = new Set(
      Array.from(currentCourses).filter(id => !sectionCourseIds.includes(id))
    );

    setCompletedCourses(newCompleted);
    setCurrentCourses(newCurrent);

    toast.info(`Cleared selections in ${section.title}`);
  };

  const toggleSection = (sectionTitle: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionTitle)) {
      newExpanded.delete(sectionTitle);
    } else {
      newExpanded.add(sectionTitle);
    }
    setExpandedSections(newExpanded);
  };
  

  const handleAuditUpload = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("http://127.0.0.1:5000/read-degree-audit", {
      method: "POST",
      body: formData,
    });

    const data: {
      completed_courses: string[];
      in_progress_courses: string[];
    } = await response.json();

    const allCourses = courseSections.flatMap(section => section.courses);

    const newCompleted = new Set(completedCourses);
    const newCurrent = new Set(currentCourses);

    data.completed_courses.forEach((courseId) => {
      const match = allCourses.find(course => course.id === courseId);

      if (match) {
        newCompleted.add(match.id);
        newCurrent.delete(match.id);
      }
    });

    data.in_progress_courses.forEach((courseId) => {
      const match = allCourses.find(course => course.id === courseId);

      if (match && !newCompleted.has(match.id)) {
        newCurrent.add(match.id);
      }
    });

    setCompletedCourses(newCompleted);
    setCurrentCourses(newCurrent);

    toast.success(
      `Audit read: ${newCompleted.size} completed, ${newCurrent.size} in progress`
    );
  } catch (error) {
    console.error("Audit upload error:", error);
    toast.error("Failed to read degree audit");
  }
};

  const handleCoursesExtracted = (extractedCourses: any[]) => {
  const newCompleted = new Set(completedCourses);
  const allCourses = courseSections.flatMap(s => s.courses);

  let matchedCount = 0;

  extractedCourses.forEach(extractedCourse => {
    const matchingCourse = allCourses.find(
      c => c.code === extractedCourse.code || c.id === extractedCourse.id
    );

    if (matchingCourse) {
      newCompleted.add(matchingCourse.id);
      matchedCount++;
    }
  });

  setCompletedCourses(newCompleted);

  if (matchedCount > 0) {
    toast.success(`Successfully matched ${matchedCount} course(s) from your degree audit`);
  } else {
    toast.info('No matching courses found. You may need to add them manually.');
  }
};

  const getCappedCredits = (courses: Course[], section?: CourseSection) => {
    const total = courses.reduce((sum, course) => sum + course.credits, 0);

    if (!section?.isElective || !section.requiredCredits) {
      return total;
    }

    return Math.min(total, section.requiredCredits);
  };

  const handleNext = () => {
    // Build the list of courses to show in drag-drop
    const coursesToShow: Course[] = [];
    
    courseSections.forEach(section => {
      if (section.isElective && section.maxElectives) {
        // For electives with limits, only include selected ones and create placeholders for unfulfilled
        const sectionCourseIds = section.courses.map(c => c.id);
        const completedInSection = section.courses.filter(c => completedCourses.has(c.id));
        const currentInSection = section.courses.filter(c => currentCourses.has(c.id));
        
        // Add the specific courses that are in progress
        currentInSection.forEach(course => {
          if (!completedCourses.has(course.id)) {
            coursesToShow.push(course);
          }
        });
        
        // Calculate how many more are needed
        const totalSelected = completedInSection.length + currentInSection.length;
        const stillNeeded = section.maxElectives - totalSelected;
        
        // Create placeholder courses for unfulfilled requirements
        for (let i = 0; i < stillNeeded; i++) {
          const placeholderId = `PLACEHOLDER_${section.title.replace(/\s/g, '_')}_${i}`;
          const credits = section.courses[0]?.credits || 3; // Use credit from first course in section
          
          coursesToShow.push({
            id: placeholderId,
            code: section.title,
            name: section.maxElectives === 1 
              ? `Select from ${section.title}` 
              : `Select from ${section.title} (${i + 1} of ${stillNeeded})`,
            credits: credits,
            department: 'ELECTIVE',
            isElectiveOption: true, // Mark as elective option
            electiveCategory: section.title, // Store the category name
            maxElectivesAllowed: section.maxElectives, // Store the max allowed
          });
        }
      } else {
        // For required courses, show all that aren't completed
        const requiredNotCompleted = section.courses.filter(c => 
          !completedCourses.has(c.id)
        );
        coursesToShow.push(...requiredNotCompleted);
      }
    });
    
    // Collect all completed courses with their full data
    const completedCoursesData = courseSections
      .flatMap(s => s.courses)
      .filter(c => completedCourses.has(c.id));
    
    const completedIds = Array.from(completedCourses);
    
    // Collect all available elective options (not placeholders, just the actual elective courses)
    const allElectiveOptions: Course[] = [];
    courseSections.forEach(section => {
      if (section.isElective) {
        section.courses.forEach(course => {
          allElectiveOptions.push({
            ...course,
            electiveCategory: section.title,
            maxElectivesAllowed: section.maxElectives
          });
        });
      }
    });
    onContinue(null);

    navigate('/drag-drop-planning', {
      state: {
        completedCourseIds: completedIds,
        currentCourseIds: Array.from(currentCourses),
        allCourses: coursesToShow,
        completedCoursesData,
        allElectiveOptions,
        originalCompletedIds: completedIds,
      },
    });
  };

  const totalCredits = courseSections.flatMap(s => s.courses).reduce((sum, c) => sum + c.credits, 0);
  const completedCredits = courseSections.reduce((sum, section) => {
    const selectedCourses = section.courses.filter(c => completedCourses.has(c.id));
    return sum + getCappedCredits(selectedCourses, section);
  }, 0);
  const currentCredits = courseSections.reduce((sum, section) => {
    const selectedCourses = section.courses.filter(c => currentCourses.has(c.id));
    return sum + getCappedCredits(selectedCourses, section);
  }, 0);

  if (loadingCourses) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4 flex items-center justify-center">
        <p>Loading curriculum...</p>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
      <div className="container mx-auto max-w-5xl">
        <div className="flex gap-2 mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/plan-selection')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
          >
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Select Your Current Progress</CardTitle>
                <p className="text-slate-600">
                  Mark the courses you've already completed and the ones you're currently taking
                </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Total credits in curriculum: {totalCredits}
                  </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTranscriptUpload(true)}
                className="flex-shrink-0"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Degree Audit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[500px] pr-4 overflow-y-auto">
              <div className="space-y-4">
                {courseSections.map((section, sectionIndex) => {
                  const sectionCompleted = section.courses.filter(c => completedCourses.has(c.id)).length;
                  const sectionCurrent = section.courses.filter(c => currentCourses.has(c.id)).length;
                  const sectionTotal = section.courses.length;
                  const isExpanded = expandedSections.has(section.title);
                  const sectionCredits = section.courses.reduce((sum, c) => sum + c.credits, 0);

                  return (
                    <div key={section.title}>
                      {sectionIndex > 0 && <Separator className="my-4" />}
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg text-slate-900">
                                {section.title}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                {sectionCredits} credits
                              </Badge>
                              {section.isElective && section.electiveNote && (
                                <Badge variant="secondary" className="text-xs">
                                  {section.electiveNote}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              {section.title === 'Preparation Program' ? (
                                <span className="text-xs">
                                  Optional courses (0 degree credits, but count as semester hours). Required unless exempted by exam.
                                </span>
                              ) : section.isElective && section.maxElectives ? (
                                `${sectionCompleted + sectionCurrent} of ${section.maxElectives} required selected`
                              ) : (
                                `${sectionCompleted} of ${sectionTotal} courses completed`
                              )}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {!section.isElective && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markSectionCompleted(section)}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Mark All Completed
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="px-2"
                                  onClick={() => clearSection(section)}
                                  title="Clear section"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                            
                            {section.isElective ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleSection(section.title)}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-4 h-4 mr-1" />
                                    Hide
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-4 h-4 mr-1" />
                                    Show
                                  </>
                                )}
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <Collapsible open={section.isElective ? isExpanded : true}>
                          <CollapsibleContent>
                            <div className="space-y-2 mt-2">
                              {section.courses.map((course) => {
                                const isCompleted = completedCourses.has(course.id);
                                const isCurrent = currentCourses.has(course.id);
                                
                                return (
                                  <Card key={course.id} className="p-3">
                                    <div className="flex items-start gap-4">
                                      <div className="flex flex-col gap-2 mt-1">
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            id={`completed-${course.id}`}
                                            checked={isCompleted}
                                            onCheckedChange={() => toggleCompleted(course.id)}
                                          />
                                          <label
                                            htmlFor={`completed-${course.id}`}
                                            className="text-xs cursor-pointer"
                                          >
                                            Completed
                                          </label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            id={`current-${course.id}`}
                                            checked={isCurrent}
                                            onCheckedChange={() => toggleCurrent(course.id, section.title)}
                                          />
                                          <label
                                            htmlFor={`current-${course.id}`}
                                            className="text-xs cursor-pointer"
                                          >
                                            In Progress
                                          </label>
                                        </div>
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <h4 className="text-sm">{course.code}</h4>
                                              {course.isPrepCourse && (
                                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                  PREP
                                                </Badge>
                                              )}
                                            </div>
                                            <p className="text-xs text-slate-600">{course.name}</p>
                                            {course.isPrepCourse && (
                                              <p className="text-xs text-amber-600 mt-1">
                                                Not counted toward 137 degree credits
                                              </p>
                                            )}
                                            {course.prerequisites && course.prerequisites.length > 0 && (
                                              <p className="text-xs text-slate-500 mt-1">
                                                Prerequisites: {course.prerequisites.join(', ')}
                                              </p>
                                            )}
                                            {course.requiredHours && (
                                              <p className="text-xs text-foreground mt-1">
                                                Requires {course.requiredHours === 30 ? 'Sophomore' : course.requiredHours === 60 ? 'Junior' : course.requiredHours === 90 ? 'Senior' : `${course.requiredHours}-hour`} standing ({course.requiredHours} hours)
                                              </p>
                                            )}
                                            {course.mustBeAlone && (
                                              <p className="text-xs text-orange-600 mt-1">
                                                Must be taken alone in a semester
                                              </p>
                                            )}
                                          </div>
                                          <Badge 
                                            variant={course.isPrepCourse ? "outline" : "secondary"} 
                                            className="text-xs"
                                          >
                                            {course.isPrepCourse 
                                              ? `${course.semesterHours}h (0cr)` 
                                              : `${course.credits} cr`}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-slate-600">
                <div>Completed: {completedCourses.size} courses ({completedCredits} credits)</div>
                <div>Currently Taking: {currentCourses.size} courses ({currentCredits} credits)</div>
              </div>
              <Button size="lg" onClick={handleNext}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <TranscriptUpload
        open={showTranscriptUpload}
        onClose={() => setShowTranscriptUpload(false)}
        onCoursesExtracted={handleCoursesExtracted}
        onAuditRead={(completed, inProgress) => {
          setCompletedCourses(new Set(completed));
          setCurrentCourses(new Set(inProgress));
        }}
      />
    </div>
  );
}