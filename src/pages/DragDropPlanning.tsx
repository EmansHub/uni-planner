import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft, GripVertical, Settings, Sparkles, Save, ChevronLeft, ChevronRight, Plus, X, CheckCircle2, Home, Info } from 'lucide-react';
import type { Page, Course, User } from '../App';
import { toast } from 'sonner';

interface DragDropPlanningProps {
  onNavigate: (page: Page) => void;
  user: User;
  planId?: string | null;
}

interface Semester {
  id: string;
  name: string;
  courses: Course[];
  completed: boolean;
  isSummer?: boolean;
}

interface Restrictions {
  hasOverload: boolean;
  repeatCourseIds: string[];
  overrideCourses: Array<{
    courseId: string;
    proofImage: string;
    verified: boolean;
  }>;
}

// Courses with semester-specific availability
const FALL_ONLY_COURSES = [
  'COSC 3332', // Discrete Structures and Combinatorial Analysis
  'COSC 4361', // Operating Systems
  'COSC 4461', // Programming Languages
];

const SPRING_ONLY_COURSES = [
  'COSC 2312', // Web Programming
  'COSC 3351', // Algorithms
  'COSC 3361', // Computer Networks
  'COSC 3411', // Systems Programming
  'COSC 4362', // Artificial Intelligence
  'COSC 4363', // Theory of Computation
];

export function DragDropPlanning({ onNavigate, user, planId }: DragDropPlanningProps) {
  const [coursesToTake, setCoursesToTake] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([
    { id: 'fall-2025', name: 'Fall 2025', courses: [], completed: false },
    { id: 'spring-2026', name: 'Spring 2026', courses: [], completed: false },
    { id: 'fall-2026', name: 'Fall 2026', courses: [], completed: false },
    { id: 'spring-2027', name: 'Spring 2027', courses: [], completed: false },
    { id: 'fall-2027', name: 'Fall 2027', courses: [], completed: false },
    { id: 'spring-2028', name: 'Spring 2028', courses: [], completed: false },
    { id: 'fall-2028', name: 'Fall 2028', courses: [], completed: false },
    { id: 'spring-2029', name: 'Spring 2029', courses: [], completed: false },
  ]);
  const [draggedCourse, setDraggedCourse] = useState<Course | null>(null);
  const [draggedFromSemester, setDraggedFromSemester] = useState<string | null>(null);
  const [dragOverSemester, setDragOverSemester] = useState<string | null>(null);
  const [restrictions, setRestrictions] = useState<Restrictions>({
    hasOverload: false,
    repeatCourseIds: [],
    overrideCourses: [],
  });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [planName, setPlanName] = useState('');
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatedPlans, setGeneratedPlans] = useState<Semester[][]>([]);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
  const [completedCourses, setCompletedCourses] = useState<Course[]>([]);
  const [showOverrideUploadDialog, setShowOverrideUploadDialog] = useState(false);
  const [selectedOverrideCourse, setSelectedOverrideCourse] = useState<Course | null>(null);
  const [uploadedProofImage, setUploadedProofImage] = useState<string | null>(null);
  const [isVerifyingProof, setIsVerifyingProof] = useState(false);
  const [showOverloadInfoDialog, setShowOverloadInfoDialog] = useState(false);
  const [showElectiveDialog, setShowElectiveDialog] = useState(false);
  const [selectedElectivePlaceholder, setSelectedElectivePlaceholder] = useState<Course | null>(null);
  const [selectedElectiveCourse, setSelectedElectiveCourse] = useState<string | null>(null);
  const [availableElectives, setAvailableElectives] = useState<Course[]>([]);
  const [originalElectiveToReplace, setOriginalElectiveToReplace] = useState<Course | null>(null);

  useEffect(() => {
    const editingPlanId = sessionStorage.getItem('editingPlanId');
    
    if (editingPlanId && planId === editingPlanId) {
      const plans = JSON.parse(localStorage.getItem('degreePlans') || '[]');
      const existingPlan = plans.find((p: any) => p.id === editingPlanId);
      
      if (existingPlan) {
        const loadedSemesters = Object.values(existingPlan.semesters) as any[];
        setSemesters(loadedSemesters);
        setPlanName(existingPlan.name);
        
        // Use allCourses from the saved plan (this is the complete original course list)
        const allCoursesFromPlan = existingPlan.allCourses || [];
        const plannedCourseIds = loadedSemesters.flatMap(sem => sem.courses.map((c: any) => c.id));
        const remaining = allCoursesFromPlan.filter((course: Course) => !plannedCourseIds.includes(course.id));
        setCoursesToTake(remaining);
        
        // Calculate completed courses for the restrictions dropdown
        // 1. Courses from completed semesters
        const completedCoursesFromSemesters: Course[] = [];
        loadedSemesters.forEach(sem => {
          if (sem.completed) {
            sem.courses.forEach((course: any) => {
              if (!completedCoursesFromSemesters.find(c => c.id === course.id)) {
                completedCoursesFromSemesters.push(course);
              }
            });
          }
        });
        
        // 2. Courses that were originally marked as "done" when plan was created
        // Use the completedCoursesData from the saved plan
        const originallyCompleted = existingPlan.completedCoursesData || [];
        
        // Merge both lists (avoid duplicates)
        const allCompletedCourses = [...completedCoursesFromSemesters];
        originallyCompleted.forEach((course: Course) => {
          if (!allCompletedCourses.find(c => c.id === course.id)) {
            allCompletedCourses.push(course);
          }
        });
        
        setCompletedCourses(allCompletedCourses);
        
        // Load restrictions if they exist (with backward compatibility)
        if (existingPlan.restrictions) {
          const loadedRestrictions = existingPlan.restrictions;
          
          // Handle backward compatibility for repeatCourseId -> repeatCourseIds
          let repeatCourseIds = loadedRestrictions.repeatCourseIds || [];
          if (loadedRestrictions.repeatCourseId && !loadedRestrictions.repeatCourseIds) {
            // Old format - convert single string to array
            repeatCourseIds = [loadedRestrictions.repeatCourseId];
          }
          
          // Handle both old (string[]) and new (object[]) formats for overrideCourses
          let overrideCourses = loadedRestrictions.overrideCourses || [];
          if (Array.isArray(loadedRestrictions.overrideCourses) && loadedRestrictions.overrideCourses.length > 0) {
            // Check if it's the old format (array of strings)
            if (typeof loadedRestrictions.overrideCourses[0] === 'string') {
              // Convert old format to new format
              overrideCourses = loadedRestrictions.overrideCourses.map((courseId: string) => ({
                courseId,
                proofImage: '',
                verified: true
              }));
            }
          }
          
          setRestrictions({
            hasOverload: loadedRestrictions.hasOverload || false,
            repeatCourseIds,
            overrideCourses
          });
        }
        
        // Load available elective options
        const savedElectiveOptions = existingPlan.allElectiveOptions || [];
        setAvailableElectives(savedElectiveOptions);
        
        // Store data in session for when we save the plan again
        sessionStorage.setItem('allCourses', JSON.stringify(allCoursesFromPlan));
        sessionStorage.setItem('originalCompletedIds', JSON.stringify(existingPlan.originalCompletedIds || []));
        sessionStorage.setItem('completedCoursesData', JSON.stringify(originallyCompleted));
        sessionStorage.setItem('allElectiveOptions', JSON.stringify(savedElectiveOptions));
        
        sessionStorage.removeItem('editingPlanId');
        return;
      }
    }

    const completedCourseIds = JSON.parse(sessionStorage.getItem('completedCourses') || '[]');
    const currentCourseIds = JSON.parse(sessionStorage.getItem('currentCourses') || '[]');
    const allCourses = JSON.parse(sessionStorage.getItem('allCourses') || '[]');
    const completedCoursesData = JSON.parse(sessionStorage.getItem('completedCoursesData') || '[]');
    const allElectiveOptions = JSON.parse(sessionStorage.getItem('allElectiveOptions') || '[]');

    // Store completed courses for restrictions dropdown
    setCompletedCourses(completedCoursesData);
    
    // Store available elective options
    setAvailableElectives(allElectiveOptions);

    // Get courses that are currently being taken
    const currentCoursesObjects = allCourses.filter((course: Course) => currentCourseIds.includes(course.id));
    
    // Get remaining courses (not completed and not currently taking)
    const remaining = allCourses.filter(
      (course: Course) => !completedCourseIds.includes(course.id) && !currentCourseIds.includes(course.id)
    );

    setCoursesToTake(remaining);
    
    // Automatically place currently taken courses in Fall 2025 (current semester)
    if (currentCoursesObjects.length > 0) {
      setSemesters(prev => prev.map(sem =>
        sem.id === 'fall-2025'
          ? { ...sem, courses: currentCoursesObjects }
          : sem
      ));
    }
  }, [planId]);

  const getTotalCredits = (semester: Semester) => {
    // Only count regular courses (not prep courses) toward degree credits
    return semester.courses.reduce((sum, course) => {
      if (course.isPrepCourse) return sum;
      return sum + course.credits;
    }, 0);
  };

  const getSemesterHours = (semester: Semester) => {
    // Count all courses including prep courses for semester hour limits
    return semester.courses.reduce((sum, course) => {
      if (course.isPrepCourse) {
        return sum + (course.semesterHours || 0);
      }
      return sum + course.credits;
    }, 0);
  };

  const getTotalPlannedCredits = () => {
    // Only count regular courses (not prep courses) toward degree credits
    // Exclude repeat courses since the student already has credit for them
    let totalPlanned = 0;
    let skippedRepeatCredits = 0;
    semesters.forEach((semester) => {
      semester.courses.forEach((course) => {
        if (course.isPrepCourse) return;
        // Skip repeat courses - student already has these credits
        if (restrictions.repeatCourseIds.includes(course.id)) {
          console.log('[PLANNED CREDITS] Skipping repeat course:', course.code, course.credits, 'cr', 'Course ID:', course.id);
          skippedRepeatCredits += course.credits;
          return;
        }
        console.log('[PLANNED CREDITS] Counting course:', course.code, course.credits, 'cr', 'ID:', course.id);
        totalPlanned += course.credits;
      });
    });
    console.log('[PLANNED CREDITS] Total Planned:', totalPlanned, 'Skipped Repeat Credits:', skippedRepeatCredits);
    return totalPlanned;
  };

  const getRemainingCredits = () => {
    const totalRequired = user.major === 'Computer Science' ? 137 : 120;
    const completedCredits = getTotalCompletedCredits();
    const plannedCredits = getTotalPlannedCredits();
    const remaining = totalRequired - completedCredits - plannedCredits;
    
    // Debug logging
    console.log('========== REMAINING CREDITS DEBUG ==========');
    console.log('Total Required:', totalRequired);
    console.log('Completed Credits:', completedCredits);
    console.log('Completed Courses:', completedCourses.map(c => `${c.code} (${c.credits}cr)`).join(', '));
    console.log('Planned Credits:', plannedCredits);
    console.log('Repeat Course IDs:', restrictions.repeatCourseIds);
    restrictions.repeatCourseIds.forEach(id => {
      const repeatCourse = completedCourses.find(c => c.id === id);
      console.log('Repeat Course Details:', repeatCourse ? `${repeatCourse.code} (${repeatCourse.credits}cr, ID: ${repeatCourse.id})` : 'NOT FOUND');
    });
    console.log('Calculation:', `${totalRequired} - ${completedCredits} - ${plannedCredits} = ${remaining}`);
    console.log('Remaining:', remaining);
    console.log('==========================================');
    
    return remaining;
  };

  const getMaxCredits = (semester: Semester, isNextSemester: boolean = false) => {
    // Summer semesters have max 9 credits
    if (semester.isSummer) {
      return 9;
    }
    // Overload applies to next semester only if enabled
    return (isNextSemester && restrictions.hasOverload) ? 22 : 20;
  };

  const getTotalCompletedCredits = () => {
    // Only count regular courses (not prep courses)
    return completedCourses.reduce((sum, course) => {
      if (course.isPrepCourse) return sum;
      return sum + course.credits;
    }, 0);
  };

  const getHoursBeforeSemester = (targetSemesterId: string) => {
    // Calculate total hours (completed + planned) before a specific semester
    // This is used for standing requirements (Sophomore=30, Junior=60, Senior=90)
    const completedHours = getTotalCompletedCredits();
    
    // Sort semesters chronologically
    const sortedSemesters = [...semesters].sort((a, b) => getSemesterOrder(a.id) - getSemesterOrder(b.id));
    const targetIndex = sortedSemesters.findIndex(s => s.id === targetSemesterId);
    
    // Get all semesters before the target semester
    const previousSemesters = sortedSemesters.slice(0, targetIndex);
    
    // Sum credits from previous semesters (excluding prep courses)
    const plannedHours = previousSemesters.reduce((sum, sem) => {
      const semCredits = sem.courses.reduce((cSum, course) => {
        if (course.isPrepCourse) return cSum;
        return cSum + course.credits;
      }, 0);
      return sum + semCredits;
    }, 0);
    
    return completedHours + plannedHours;
  };

  const getMaxSemesters = () => {
    // 6 years = max 6 Fall + max 6 Spring
    // Summer semesters don't count toward the 6-year limit
    const fallCount = semesters.filter(s => s.id.includes('fall')).length;
    const springCount = semesters.filter(s => s.id.includes('spring')).length;
    return fallCount >= 6 && springCount >= 6;
  };

  const getSemesterOrder = (semesterId: string): number => {
    // Returns a number for chronological ordering
    // Academic year 2025/26: Fall 2025, Spring 2026, Summer 2026
    // Academic year 2026/27: Fall 2026, Spring 2027, Summer 2027
    const [type, yearStr] = semesterId.split('-');
    const year = parseInt(yearStr);
    
    // Fall starts the academic year: Fall 2025 = 20250
    // Spring/Summer belong to the academic year that started with the previous Fall
    // So Spring 2026 (part of 2025/26) = 20255, Summer 2026 = 20257
    if (type === 'fall') return year * 10;
    if (type === 'spring') return (year - 1) * 10 + 5;
    if (type === 'summer') return (year - 1) * 10 + 7;
    return year * 10;
  };

  const formatSemesterName = (semesterId: string): string => {
    // Format: Fall 2025/26, Spring 2025/26, Summer 2025/26
    const [type, yearStr] = semesterId.split('-');
    const year = parseInt(yearStr);
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    
    if (type === 'fall') {
      // Fall 2025 is part of 2025/26 academic year
      return `${capitalizedType} ${year}/${(year + 1).toString().slice(-2)}`;
    } else if (type === 'spring' || type === 'summer') {
      // Spring 2026 is part of 2025/26 academic year
      return `${capitalizedType} ${year - 1}/${year.toString().slice(-2)}`;
    }
    return `${capitalizedType} ${year}`;
  };

  const addSemester = (semesterType: 'fall' | 'spring' | 'summer') => {
    if (semesterType === 'summer') {
      // Find all spring semesters and check which don't have summer after them
      const springSemesters = semesters.filter(s => s.id.includes('spring'));
      
      if (springSemesters.length === 0) {
        toast.error('No spring semester found. Add a spring semester first.');
        return;
      }

      // Find a spring that doesn't have a summer after it
      let targetSpring = null;
      for (const spring of springSemesters) {
        const year = parseInt(spring.id.split('-')[1]);
        const summerId = `summer-${year}`;
        if (!semesters.find(s => s.id === summerId)) {
          targetSpring = spring;
          break;
        }
      }

      if (!targetSpring) {
        toast.error('All spring semesters already have summer semesters');
        return;
      }

      const year = parseInt(targetSpring.id.split('-')[1]);
      const summerId = `summer-${year}`;

      const newSemester: Semester = {
        id: summerId,
        name: `Summer ${year}`,
        courses: [],
        completed: false,
        isSummer: true,
      };

      // Insert after the spring semester
      const springIndex = semesters.findIndex(s => s.id === targetSpring.id);
      const newSemesters = [...semesters];
      newSemesters.splice(springIndex + 1, 0, newSemester);
      setSemesters(newSemesters);
      toast.success(`Added ${formatSemesterName(summerId)}`);
    } else {
      // Sort semesters chronologically to find the last one
      const sortedSemesters = [...semesters].sort((a, b) => getSemesterOrder(a.id) - getSemesterOrder(b.id));
      const lastSemester = sortedSemesters[sortedSemesters.length - 1];
      
      // Count existing semesters
      const fallCount = semesters.filter(s => s.id.includes('fall')).length;
      const springCount = semesters.filter(s => s.id.includes('spring')).length;

      if (semesterType === 'fall') {
        // Check Fall limit
        if (fallCount >= 6) {
          toast.error('Maximum 6 Fall semesters allowed');
          return;
        }

        // Fall can only be added after Spring or Summer
        const [lastType, lastYearStr] = lastSemester.id.split('-');
        const lastYear = parseInt(lastYearStr);
        
        if (lastType === 'fall') {
          toast.error('Cannot add Fall after Fall. Add Spring first.');
          return;
        }

        // Determine the year for the new Fall semester
        let year: number;
        if (lastType === 'spring') {
          // After Spring 2026, add Fall 2026
          year = lastYear;
        } else if (lastType === 'summer') {
          // After Summer 2026, add Fall 2026
          year = lastYear;
        } else {
          year = 2025; // fallback
        }

        // Check if this Fall already exists
        if (semesters.find(s => s.id === `fall-${year}`)) {
          toast.error(`Fall ${year}/${(year + 1).toString().slice(-2)} already exists`);
          return;
        }

        const newSemesterId = `fall-${year}`;
        const newSemester: Semester = {
          id: newSemesterId,
          name: `Fall ${year}`,
          courses: [],
          completed: false,
        };

        // Insert in chronological order
        const newSemesters = [...semesters, newSemester];
        newSemesters.sort((a, b) => getSemesterOrder(a.id) - getSemesterOrder(b.id));
        
        setSemesters(newSemesters);
        toast.success(`Added ${formatSemesterName(newSemesterId)}`);
      } else if (semesterType === 'spring') {
        // Check Spring limit
        if (springCount >= 6) {
          toast.error('Maximum 6 Spring semesters allowed');
          return;
        }

        // Spring can only be added after Fall
        const [lastType, lastYearStr] = lastSemester.id.split('-');
        const lastYear = parseInt(lastYearStr);
        
        if (lastType === 'spring' || lastType === 'summer') {
          toast.error('Cannot add Spring after Spring/Summer. Add Fall first.');
          return;
        }

        // After Fall 2025, add Spring 2026
        const year = lastYear + 1;

        // Check if this Spring already exists
        if (semesters.find(s => s.id === `spring-${year}`)) {
          toast.error(`Spring ${year - 1}/${year.toString().slice(-2)} already exists`);
          return;
        }

        const newSemesterId = `spring-${year}`;
        const newSemester: Semester = {
          id: newSemesterId,
          name: `Spring ${year}`,
          courses: [],
          completed: false,
        };

        // Insert in chronological order
        const newSemesters = [...semesters, newSemester];
        newSemesters.sort((a, b) => getSemesterOrder(a.id) - getSemesterOrder(b.id));
        
        setSemesters(newSemesters);
        toast.success(`Added ${formatSemesterName(newSemesterId)}`);
      }
    }
  };

  const removeSemester = (semesterId: string) => {
    const semester = semesters.find(s => s.id === semesterId);
    if (!semester) return;
    
    // Summer semesters can always be removed
    if (semester.isSummer) {
      // Move courses back to available
      if (semester.courses.length > 0) {
        setCoursesToTake(prev => [...prev, ...semester.courses]);
      }

      setSemesters(prev => prev.filter(s => s.id !== semesterId));
      toast.success(`Removed ${formatSemesterName(semesterId)}`);
      return;
    }
    
    // For Fall/Spring: Sort semesters chronologically and get the first 8 non-summer semesters
    const sortedSemesters = [...semesters].sort((a, b) => getSemesterOrder(a.id) - getSemesterOrder(b.id));
    const nonSummerSemesters = sortedSemesters.filter(s => !s.isSummer);
    const first8NonSummer = nonSummerSemesters.slice(0, 8);
    
    // Check if this semester is in the first 8 non-summer semesters
    const isInFirst8 = first8NonSummer.some(s => s.id === semesterId);
    
    if (isInFirst8) {
      toast.error('Cannot remove default semesters from the 4-year plan. Only additional semesters can be removed.');
      return;
    }

    // Move courses back to available
    if (semester.courses.length > 0) {
      setCoursesToTake(prev => [...prev, ...semester.courses]);
    }

    setSemesters(prev => prev.filter(s => s.id !== semesterId));
    toast.success(`Removed ${formatSemesterName(semesterId)}`);
  };

  // Elective selection handlers
  const handleElectiveClick = (course: Course) => {
    // Allow clicking on placeholders OR already-selected electives to change them
    if (course.isElectiveOption) {
      // This is a placeholder
      setSelectedElectivePlaceholder(course);
      setOriginalElectiveToReplace(null);
      setSelectedElectiveCourse(null);
      setShowElectiveDialog(true);
    } else if (course.electiveCategory) {
      // This is an already-selected elective that can be changed
      // Store the original course so we can replace it
      setOriginalElectiveToReplace(course);
      
      // Create a temporary placeholder to represent the category
      const tempPlaceholder: Course = {
        id: `temp-placeholder-${course.electiveCategory}`,
        code: course.electiveCategory,
        name: `Select ${course.electiveCategory}`,
        credits: course.credits,
        department: course.department,
        isElectiveOption: true,
        electiveCategory: course.electiveCategory,
      };
      setSelectedElectivePlaceholder(tempPlaceholder);
      setSelectedElectiveCourse(null);
      setShowElectiveDialog(true);
    }
  };

  const handleElectiveSelection = () => {
    if (!selectedElectivePlaceholder || !selectedElectiveCourse) {
      toast.error('Please select an elective course');
      return;
    }

    // Find the selected elective course
    const electiveCourse = availableElectives.find(c => c.id === selectedElectiveCourse);
    
    if (!electiveCourse) {
      toast.error('Could not find selected elective course');
      return;
    }

    // Create a copy with the elective category marked
    const electiveCourseWithCategory = {
      ...electiveCourse,
      electiveCategory: selectedElectivePlaceholder.electiveCategory
    };

    // Determine which ID to replace
    // If we're changing an existing elective, use the original course's ID
    // Otherwise, use the placeholder's ID
    const idToReplace = originalElectiveToReplace 
      ? originalElectiveToReplace.id 
      : selectedElectivePlaceholder.id;

    // Replace the specific placeholder/elective that was clicked
    setCoursesToTake(prev => prev.map(c => 
      c.id === idToReplace ? electiveCourseWithCategory : c
    ));
    setSemesters(prev => prev.map(sem => ({
      ...sem,
      courses: sem.courses.map(c => 
        c.id === idToReplace ? electiveCourseWithCategory : c
      )
    })));
    
    if (originalElectiveToReplace) {
      toast.success(`Changed elective to ${electiveCourse.code} - ${electiveCourse.name}`);
    } else {
      toast.success(`Selected ${electiveCourse.code} - ${electiveCourse.name}`);
    }

    setShowElectiveDialog(false);
    setSelectedElectivePlaceholder(null);
    setSelectedElectiveCourse(null);
    setOriginalElectiveToReplace(null);
  };

  // Simplified drag handlers
  const handleDragStart = (course: Course, source: string) => {
    // Prevent dragging elective placeholders ONLY
    if (course.isElectiveOption) {
      toast.info('Please select a specific elective course first by clicking on it');
      return;
    }
    
    // Selected electives (with electiveCategory but not isElectiveOption) CAN be dragged
    setDraggedCourse(course);
    setDraggedFromSemester(source);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetSemester: string) => {
    if (!draggedCourse || !draggedFromSemester) return;

    // Check if target semester is completed
    if (targetSemester !== 'available') {
      const targetSem = semesters.find(s => s.id === targetSemester);
      if (targetSem?.completed) {
        toast.error('Cannot modify a completed semester');
        setDraggedCourse(null);
        setDraggedFromSemester(null);
        setDragOverSemester(null);
        return;
      }
    }

    // Check if source semester is completed
    if (draggedFromSemester !== 'available') {
      const sourceSem = semesters.find(s => s.id === draggedFromSemester);
      if (sourceSem?.completed) {
        toast.error('Cannot remove courses from a completed semester');
        setDraggedCourse(null);
        setDraggedFromSemester(null);
        setDragOverSemester(null);
        return;
      }
    }

    // Same source, do nothing
    if (draggedFromSemester === targetSemester) {
      setDraggedCourse(null);
      setDraggedFromSemester(null);
      setDragOverSemester(null);
      return;
    }

    // Check semester-specific course availability
    if (targetSemester !== 'available') {
      const semesterType = targetSemester.split('-')[0]; // 'fall', 'spring', or 'summer'
      
      // Check if course is Fall-only and being placed in Spring
      if (FALL_ONLY_COURSES.includes(draggedCourse.code) && semesterType === 'spring') {
        toast.error(`${draggedCourse.code} is only offered in Fall semesters. Please place it in a Fall semester.`);
        setDraggedCourse(null);
        setDraggedFromSemester(null);
        setDragOverSemester(null);
        return;
      }
      
      // Check if course is Spring-only and being placed in Fall
      if (SPRING_ONLY_COURSES.includes(draggedCourse.code) && semesterType === 'fall') {
        toast.error(`${draggedCourse.code} is only offered in Spring semesters. Please place it in a Spring semester.`);
        setDraggedCourse(null);
        setDraggedFromSemester(null);
        setDragOverSemester(null);
        return;
      }
      
      // Summer semesters - check restrictions for both Fall and Spring only courses
      if (semesterType === 'summer') {
        if (FALL_ONLY_COURSES.includes(draggedCourse.code)) {
          toast.error(`${draggedCourse.code} is only offered in Fall semesters and cannot be taken in Summer.`);
          setDraggedCourse(null);
          setDraggedFromSemester(null);
          setDragOverSemester(null);
          return;
        }
        if (SPRING_ONLY_COURSES.includes(draggedCourse.code)) {
          toast.error(`${draggedCourse.code} is only offered in Spring semesters and cannot be taken in Summer.`);
          setDraggedCourse(null);
          setDraggedFromSemester(null);
          setDragOverSemester(null);
          return;
        }
      }
    }

    // Check prerequisites when placing in a semester (not when moving to available)
    if (targetSemester !== 'available' && draggedCourse.prerequisites && draggedCourse.prerequisites.length > 0) {
      const targetSem = semesters.find(s => s.id === targetSemester);
      if (targetSem) {
        // Check if course can override prerequisites
        const canOverride = restrictions.overrideCourses.some(override => override.courseId === draggedCourse.id && override.verified);
        
        if (!canOverride) {
          // Sort semesters chronologically
          const sortedSemesters = [...semesters].sort((a, b) => getSemesterOrder(a.id) - getSemesterOrder(b.id));
          const targetIndex = sortedSemesters.findIndex(s => s.id === targetSemester);
          
          // Get all semesters before the target semester
          const previousSemesters = sortedSemesters.slice(0, targetIndex);
          
          // Get all courses in previous semesters plus completed courses
          const previousCourseIds = new Set([
            ...completedCourses.map(c => c.id),
            ...previousSemesters.flatMap(sem => sem.courses.map(c => c.id))
          ]);
          
          // Check if all prerequisites are satisfied
          const missingPrereqs = draggedCourse.prerequisites.filter(prereqId => !previousCourseIds.has(prereqId));
          
          if (missingPrereqs.length > 0) {
            // Find the prerequisite course names for better error message
            const allCourses = [...coursesToTake, ...completedCourses, ...semesters.flatMap(s => s.courses)];
            const prereqNames = missingPrereqs.map(id => {
              const course = allCourses.find(c => c.id === id);
              return course ? course.code : id;
            }).join(', ');
            
            toast.error(`Cannot add ${draggedCourse.code}. Missing prerequisites: ${prereqNames}. Place them in an earlier semester first.`);
            setDraggedCourse(null);
            setDraggedFromSemester(null);
            setDragOverSemester(null);
            return;
          }
        }
      }
    }

    // Check standing requirements (hour-based prerequisites)
    if (targetSemester !== 'available' && draggedCourse.requiredHours) {
      const canOverride = restrictions.overrideCourses.includes(draggedCourse.id);
      
      if (!canOverride) {
        const hoursBeforeSemester = getHoursBeforeSemester(targetSemester);
        
        if (hoursBeforeSemester < draggedCourse.requiredHours) {
          const standingName = draggedCourse.requiredHours === 30 ? 'Sophomore' : 
                               draggedCourse.requiredHours === 60 ? 'Junior' : 
                               draggedCourse.requiredHours === 90 ? 'Senior' : `${draggedCourse.requiredHours}-hour`;
          toast.error(`Cannot add ${draggedCourse.code}. Requires ${standingName} standing (${draggedCourse.requiredHours} hours). You will have ${hoursBeforeSemester} hours before this semester.`);
          setDraggedCourse(null);
          setDraggedFromSemester(null);
          setDragOverSemester(null);
          return;
        }
      }
    }

    // Check if course must be alone in semester
    if (targetSemester !== 'available' && draggedCourse.mustBeAlone) {
      const targetSem = semesters.find(s => s.id === targetSemester);
      if (targetSem && targetSem.courses.length > 0) {
        toast.error(`${draggedCourse.code} must be taken alone in a separate semester. Please select an empty semester or create a new one.`);
        setDraggedCourse(null);
        setDraggedFromSemester(null);
        setDragOverSemester(null);
        return;
      }
    }

    // Check if target semester already has a course that must be alone
    if (targetSemester !== 'available') {
      const targetSem = semesters.find(s => s.id === targetSemester);
      if (targetSem) {
        const hasAloneCourse = targetSem.courses.some(c => c.mustBeAlone);
        if (hasAloneCourse) {
          const aloneCourse = targetSem.courses.find(c => c.mustBeAlone);
          toast.error(`Cannot add course. ${aloneCourse?.code} must be taken alone in this semester. Please remove it first or use a different semester.`);
          setDraggedCourse(null);
          setDraggedFromSemester(null);
          setDragOverSemester(null);
          return;
        }
      }
    }

    // Check for duplicate courses in target semester
    if (targetSemester !== 'available') {
      const targetSem = semesters.find(s => s.id === targetSemester);
      if (targetSem) {
        const isDuplicate = targetSem.courses.some(c => c.id === draggedCourse.id);
        if (isDuplicate) {
          toast.error(`${draggedCourse.code} is already in ${targetSem.name}. Cannot add the same course twice.`);
          setDraggedCourse(null);
          setDraggedFromSemester(null);
          setDragOverSemester(null);
          return;
        }
      }
    }

    // Check if target semester would exceed max credits (use semester hours for the check)
    if (targetSemester !== 'available') {
      const targetSem = semesters.find(s => s.id === targetSemester);
      if (targetSem) {
        const currentHours = getSemesterHours(targetSem);
        const courseHours = draggedCourse.isPrepCourse ? (draggedCourse.semesterHours || 0) : draggedCourse.credits;
        const isNextSemester = semesters.indexOf(targetSem) === 0;
        const maxCredits = getMaxCredits(targetSem, isNextSemester);
        
        if (currentHours + courseHours > maxCredits) {
          toast.error(`Cannot add course. This would exceed the ${maxCredits} hour limit for ${targetSem.name}.`);
          setDraggedCourse(null);
          setDraggedFromSemester(null);
          setDragOverSemester(null);
          return;
        }
      }
    }

    // Remove from source
    if (draggedFromSemester === 'available') {
      setCoursesToTake(prev => prev.filter(c => c.id !== draggedCourse.id));
    } else {
      setSemesters(prev => prev.map(sem =>
        sem.id === draggedFromSemester
          ? { ...sem, courses: sem.courses.filter(c => c.id !== draggedCourse.id) }
          : sem
      ));
    }

    // Add to target
    if (targetSemester === 'available') {
      setCoursesToTake(prev => [...prev, draggedCourse]);
      toast.success(`Moved ${draggedCourse.code} back to available`);
    } else {
      setSemesters(prev => prev.map(sem =>
        sem.id === targetSemester
          ? { ...sem, courses: [...sem.courses, draggedCourse] }
          : sem
      ));
      const semName = semesters.find(s => s.id === targetSemester)?.name || targetSemester;
      toast.success(`Moved ${draggedCourse.code} to ${semName}`);
    }

    setDraggedCourse(null);
    setDraggedFromSemester(null);
    setDragOverSemester(null);
  };

  const handleGeneratePlan = () => {
    toast.info('AI is generating degree plans...');

    setTimeout(() => {
      // Helper function to check if all prerequisites are satisfied
      const prerequisitesSatisfied = (course: Course, placedCourses: Set<string>): boolean => {
        if (!course.prerequisites || course.prerequisites.length === 0) return true;
        
        // Check if course can override prerequisites
        if (restrictions.overrideCourses.some(override => override.courseId === course.id && override.verified)) return true;
        
        return course.prerequisites.every(prereqId => 
          placedCourses.has(prereqId) || completedCourses.some(c => c.id === prereqId)
        );
      };

      // Helper function to check standing requirements
      const standingRequirementsMet = (course: Course, totalHoursBeforeSemester: number): boolean => {
        if (!course.requiredHours) return true;
        
        // Check if course can override standing requirements
        if (restrictions.overrideCourses.includes(course.id)) return true;
        
        return totalHoursBeforeSemester >= course.requiredHours;
      };

      // Generate a plan with a specific strategy
      const generatePlan = (strategy: 'balanced' | 'frontloaded' | 'backloaded'): Semester[] => {
        // Start with existing courses already in semesters
        const planSemesters: Semester[] = semesters.map(sem => ({ 
          ...sem, 
          courses: [...sem.courses] 
        }));
        const remainingCourses = [...coursesToTake];
        const placedCourseIds = new Set<string>();
        
        // Track courses already placed in semesters
        planSemesters.forEach(sem => {
          sem.courses.forEach(course => {
            placedCourseIds.add(course.id);
          });
        });
        
        // Sort semesters chronologically
        const sortedSemesters = [...planSemesters].sort((a, b) => getSemesterOrder(a.id) - getSemesterOrder(b.id));
        
        for (let semIndex = 0; semIndex < sortedSemesters.length; semIndex++) {
          const semester = sortedSemesters[semIndex];
          const isSummer = semester.isSummer;
          const maxCredits = isSummer ? 9 : 20;
          
          // Calculate total hours before this semester (including completed and courses in previous semesters)
          let hoursBeforeSemester = getTotalCompletedCredits();
          for (let i = 0; i < semIndex; i++) {
            hoursBeforeSemester += sortedSemesters[i].courses.reduce((sum, c) => 
              c.isPrepCourse ? sum : sum + c.credits, 0
            );
          }
          
          // Calculate current hours in this semester (from already placed courses)
          let semesterHours = semester.courses.reduce((sum, c) => {
            return sum + (c.isPrepCourse ? (c.semesterHours || 0) : c.credits);
          }, 0);
          
          // Check if any course must be alone
          const hasAloneCourse = semester.courses.some(c => c.mustBeAlone);
          
          // Determine target credits based on strategy
          let targetCredits = maxCredits;
          if (strategy === 'balanced') {
            targetCredits = isSummer ? 9 : 15;
          } else if (strategy === 'frontloaded') {
            targetCredits = semIndex < sortedSemesters.length / 2 ? maxCredits : (isSummer ? 6 : 12);
          } else if (strategy === 'backloaded') {
            targetCredits = semIndex >= sortedSemesters.length / 2 ? maxCredits : (isSummer ? 6 : 12);
          }
          
          // Skip adding more courses if we already have a course that must be alone
          if (hasAloneCourse) continue;
          
          // Add courses that can be taken
          let changed = true;
          while (changed && semesterHours < targetCredits && remainingCourses.length > 0) {
            changed = false;
            
            for (let i = remainingCourses.length - 1; i >= 0; i--) {
              const course = remainingCourses[i];
              const courseHours = course.isPrepCourse ? (course.semesterHours || 0) : course.credits;
              
              // Check if adding this course would exceed limits
              if (semesterHours + courseHours > maxCredits) continue;
              
              // Check if course must be alone (and semester has other courses)
              if (course.mustBeAlone && semester.courses.length > 0) continue;
              
              // Check semester-specific course availability
              const semesterType = semester.id.split('-')[0]; // 'fall', 'spring', or 'summer'
              if (semesterType === 'fall' && SPRING_ONLY_COURSES.includes(course.code)) continue;
              if (semesterType === 'spring' && FALL_ONLY_COURSES.includes(course.code)) continue;
              if (semesterType === 'summer' && (FALL_ONLY_COURSES.includes(course.code) || SPRING_ONLY_COURSES.includes(course.code))) continue;
              
              // Check prerequisites
              if (!prerequisitesSatisfied(course, placedCourseIds)) continue;
              
              // Check standing requirements
              if (!standingRequirementsMet(course, hoursBeforeSemester)) continue;
              
              // Add course to semester
              semester.courses.push(course);
              semesterHours += courseHours;
              placedCourseIds.add(course.id);
              remainingCourses.splice(i, 1);
              changed = true;
              
              // If course must be alone, stop adding to this semester
              if (course.mustBeAlone) break;
            }
          }
        }
        
        // Map back to original semester order
        return planSemesters.map(sem => {
          const sorted = sortedSemesters.find(s => s.id === sem.id);
          return sorted || sem;
        });
      };

      const plan1 = generatePlan('balanced');
      const plan2 = generatePlan('frontloaded');
      const plan3 = generatePlan('backloaded');

      setGeneratedPlans([plan1, plan2, plan3]);
      setCurrentPlanIndex(0);
      toast.success('Generated 3 plan options!');
    }, 1500);
  };

  const handleApplyPlan = () => {
    if (generatedPlans.length > 0) {
      setSemesters(generatedPlans[currentPlanIndex]);
      setCoursesToTake([]);
      setShowAIDialog(false);
      setGeneratedPlans([]);
      setAiPrompt('');
      toast.success('Degree plan applied!');
    }
  };

  const handleSavePlan = () => {
    if (!planName.trim()) {
      toast.error('Please enter a plan name');
      return;
    }

    // Get all courses and originally completed course IDs from sessionStorage
    const allCourses = JSON.parse(sessionStorage.getItem('allCourses') || '[]');
    const originalCompletedIds = JSON.parse(sessionStorage.getItem('originalCompletedIds') || '[]');
    const completedCoursesData = JSON.parse(sessionStorage.getItem('completedCoursesData') || '[]');
    const allElectiveOptions = JSON.parse(sessionStorage.getItem('allElectiveOptions') || '[]');

    // Get all courses currently in coursesToTake and semesters to build accurate list
    const coursesInPlan = [
      ...coursesToTake,
      ...semesters.flatMap(s => s.courses)
    ];

    // Filter out elective placeholders - only include actual courses and selected electives
    const filteredAllCourses = coursesInPlan.filter((c: any) => !c.isElectiveOption);

    const plan = {
      id: planId || Date.now().toString(),
      name: planName,
      userId: user.email,
      semesters: semesters.reduce((acc, sem) => {
        // Only include semesters that have at least one course
        if (sem.courses && sem.courses.length > 0) {
          acc[sem.id] = sem;
        }
        return acc;
      }, {} as any),
      allCourses: filteredAllCourses, // Store all courses (excluding elective placeholders)
      originalCompletedIds: originalCompletedIds, // Store IDs of courses originally marked as "done"
      completedCoursesData: completedCoursesData, // Store full data of completed courses
      allElectiveOptions: allElectiveOptions, // Store all available elective options
      restrictions: restrictions, // Store plan restrictions including overrides
      createdAt: new Date().toISOString(),
    };

    const existingPlans = JSON.parse(localStorage.getItem('degreePlans') || '[]');
    const planIndex = existingPlans.findIndex((p: any) => p.id === plan.id);

    if (planIndex !== -1) {
      existingPlans[planIndex] = plan;
    } else {
      existingPlans.push(plan);
    }

    localStorage.setItem('degreePlans', JSON.stringify(existingPlans));
    setShowSaveDialog(false);
    setPlanName('');
    toast.success('Plan saved successfully!');
  };

  const handleRepeatCourseChange = (courseId: string) => {
    if (courseId === 'none') return;
    
    // Check if already added
    if (restrictions.repeatCourseIds.includes(courseId)) {
      toast.info('This course is already selected to repeat');
      return;
    }

    // Add to repeat courses array
    setRestrictions(prev => ({ 
      ...prev, 
      repeatCourseIds: [...prev.repeatCourseIds, courseId] 
    }));

    // Add course to available courses if not already there
    const course = completedCourses.find(c => c.id === courseId);
    if (course && !coursesToTake.find(c => c.id === courseId)) {
      setCoursesToTake(prev => [...prev, course]);
    }
  };

  const handleRemoveRepeatCourse = (courseId: string) => {
    // Remove from repeat courses array
    setRestrictions(prev => ({
      ...prev,
      repeatCourseIds: prev.repeatCourseIds.filter(id => id !== courseId)
    }));
    
    // Remove from courses to take
    setCoursesToTake(prev => prev.filter(c => c.id !== courseId));
    
    // Remove from any semester it might be in
    setSemesters(prev => prev.map(semester => ({
      ...semester,
      courses: semester.courses.filter(c => c.id !== courseId)
    })));
    
    toast.success('Repeat course removed');
  };

  const handleSelectOverrideCourse = (courseId: string) => {
    const course = coursesToTake.find(c => c.id === courseId);
    if (course) {
      setSelectedOverrideCourse(course);
      setShowOverrideUploadDialog(true);
    }
  };

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedProofImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVerifyProof = () => {
    if (!uploadedProofImage || !selectedOverrideCourse) return;
    
    setIsVerifyingProof(true);
    toast.info('AI is verifying your override proof...');
    
    // Simulate AI verification (2 seconds)
    setTimeout(() => {
      // For prototype: accept all proofs
      setRestrictions(prev => ({
        ...prev,
        overrideCourses: [
          ...prev.overrideCourses,
          {
            courseId: selectedOverrideCourse.id,
            proofImage: uploadedProofImage,
            verified: true
          }
        ]
      }));
      toast.success(`Override approved for ${selectedOverrideCourse.code}! You can now take this course without completing prerequisites.`);
      setShowOverrideUploadDialog(false);
      setSelectedOverrideCourse(null);
      setUploadedProofImage(null);
      setIsVerifyingProof(false);
    }, 2000);
  };

  const removeOverrideCourse = (courseId: string) => {
    setRestrictions(prev => ({
      ...prev,
      overrideCourses: prev.overrideCourses.filter(override => override.courseId !== courseId)
    }));
    toast.success('Override removed');
  };

  const handleBack = () => {
    const returnTo = sessionStorage.getItem('returnTo');
    if (returnTo === 'saved-plan-view' && planId) {
      sessionStorage.removeItem('returnTo');
      onNavigate('saved-plan-view');
    } else {
      onNavigate('course-selection');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex gap-2 mb-4">
          <Button
            variant="ghost"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            variant="ghost"
            onClick={() => onNavigate('dashboard')}
          >
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl">Degree Plan</h1>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Semester
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => addSemester('fall')}>
                  Fall Semester
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addSemester('spring')}>
                  Spring Semester
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addSemester('summer')}>
                  Summer Semester
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Restrictions
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Plan Restrictions</DialogTitle>
                  <DialogDescription>
                    Configure special permissions and exceptions for your degree plan
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="overload-checkbox"
                        checked={restrictions.hasOverload}
                        onCheckedChange={(checked) =>
                          setRestrictions(prev => ({ ...prev, hasOverload: checked as boolean }))
                        }
                      />
                      <Label htmlFor="overload-checkbox" className="cursor-pointer">
                        Course Overload Permission (For upcoming semester)
                      </Label>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800 underline ml-6 flex items-center gap-1"
                      onClick={() => setShowOverloadInfoDialog(true)}
                    >
                      <Info className="w-3 h-3" />
                      Check if you are eligible for an overload
                    </button>
                  </div>

                  <div className="space-y-3">
                    <Label>Courses to Repeat</Label>
                    <Select
                      value="none"
                      onValueChange={handleRepeatCourseChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select course to repeat" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select a course...</SelectItem>
                        {completedCourses
                          .filter(course => !restrictions.repeatCourseIds.includes(course.id))
                          .map(course => (
                            <SelectItem key={course.id} value={course.id}>
                              {course.code} - {course.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-600">
                      Select completed courses you want to retake (you can select multiple)
                    </p>
                    
                    {/* Display selected repeat courses */}
                    {restrictions.repeatCourseIds.length > 0 && (
                      <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
                        <p className="text-xs text-slate-500 mb-2">Selected courses to repeat:</p>
                        {restrictions.repeatCourseIds.map(courseId => {
                          const course = completedCourses.find(c => c.id === courseId);
                          return course ? (
                            <div key={courseId} className="flex items-center justify-between p-2 bg-white rounded border">
                              <span className="text-sm">{course.code} - {course.name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                                onClick={() => handleRemoveRepeatCourse(courseId)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label>Override Prerequisites</Label>
                    {getTotalCompletedCredits() >= 90 ? (
                      <p className="text-sm text-slate-600">
                        Select a course to request prerequisite override. You'll need to upload proof of approval.
                      </p>
                    ) : (
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                        Prerequisite overrides are only available after completing 90+ credit hours. 
                        You currently have {getTotalCompletedCredits()} credit hours completed.
                      </p>
                    )}
                    
                    {getTotalCompletedCredits() >= 90 && (
                      <>
                      
                      {/* Dropdown to add courses */}
                      <Select
                        value=""
                        onValueChange={handleSelectOverrideCourse}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a course to override..." />
                        </SelectTrigger>
                        <SelectContent>
                          {coursesToTake
                            .filter(course => 
                              course.prerequisites && 
                              course.prerequisites.length > 0 &&
                              !restrictions.overrideCourses.some(override => override.courseId === course.id)
                            )
                            .length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-slate-400">
                              No courses with prerequisites available
                            </div>
                          ) : (
                            coursesToTake
                              .filter(course => 
                                course.prerequisites && 
                                course.prerequisites.length > 0 &&
                                !restrictions.overrideCourses.some(override => override.courseId === course.id)
                              )
                              .map(course => (
                                <SelectItem key={course.id} value={course.id}>
                                  {course.code} - {course.name}
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>

                      {/* Display selected override courses */}
                      {restrictions.overrideCourses.length > 0 && (
                        <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
                          <p className="text-xs text-slate-500">Courses with approved overrides:</p>
                          <div className="space-y-2">
                            {restrictions.overrideCourses.map(override => {
                              const course = [...coursesToTake, ...semesters.flatMap(s => s.courses)].find(c => c.id === override.courseId);
                              return course ? (
                                <div key={override.courseId} className="flex items-center justify-between p-2 bg-white rounded border">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    <span className="text-sm">{course.code} - {course.name}</span>
                                  </div>
                                  <X 
                                    className="w-4 h-4 cursor-pointer hover:text-red-600" 
                                    onClick={() => removeOverrideCourse(override.courseId)}
                                  />
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}
                      </>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Override Prerequisite Upload Dialog */}
            <Dialog open={showOverrideUploadDialog} onOpenChange={(open) => {
              setShowOverrideUploadDialog(open);
              if (!open) {
                setSelectedOverrideCourse(null);
                setUploadedProofImage(null);
                setIsVerifyingProof(false);
              }
            }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload Override Proof</DialogTitle>
                  <DialogDescription>
                    {selectedOverrideCourse && (
                      <>Upload proof of approval to override prerequisites for <strong>{selectedOverrideCourse.code} - {selectedOverrideCourse.name}</strong></>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {selectedOverrideCourse && selectedOverrideCourse.prerequisites && selectedOverrideCourse.prerequisites.length > 0 && (
                    <div className="border rounded-lg p-3 bg-amber-50 border-amber-200">
                      <p className="text-xs text-amber-900 mb-2">
                        <strong>Prerequisites being overridden:</strong>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedOverrideCourse.prerequisites.map((prereqId) => {
                          const prereqCourse = [...coursesToTake, ...semesters.flatMap(s => s.courses), ...completedCourses].find(c => c.id === prereqId);
                          return prereqCourse ? (
                            <Badge key={prereqId} variant="outline" className="text-xs bg-white">
                              {prereqCourse.code}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  
                  {!uploadedProofImage ? (
                    <div className="space-y-3">
                      <Label htmlFor="proof-upload">Approval Document</Label>
                      <p className="text-xs text-slate-600">
                        Upload an image of your prerequisite override approval (PNG, JPG, or PDF screenshot, max 5MB)
                      </p>
                      <Input
                        id="proof-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleProofUpload}
                        className="cursor-pointer"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label>Uploaded Proof</Label>
                      <div className="border rounded-lg p-3 bg-slate-50">
                        <img 
                          src={uploadedProofImage} 
                          alt="Proof of override approval" 
                          className="w-full h-48 object-contain rounded"
                        />
                      </div>
                      
                      {!isVerifyingProof && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setUploadedProofImage(null);
                            // Reset file input
                            const input = document.getElementById('proof-upload') as HTMLInputElement;
                            if (input) input.value = '';
                          }}
                        >
                          Change Image
                        </Button>
                      )}
                    </div>
                  )}

                  {uploadedProofImage && (
                    <Button 
                      className="w-full" 
                      onClick={handleVerifyProof}
                      disabled={isVerifyingProof}
                    >
                      {isVerifyingProof ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          AI Verifying...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Submit for AI Verification
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Overload Information Dialog */}
            <Dialog open={showOverloadInfoDialog} onOpenChange={setShowOverloadInfoDialog}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Course Overload</DialogTitle>
                  <DialogDescription>
                    Course overload may be granted if you meet one of the below criteria:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-3">
                    <div className="border-l-4 border-slate-400 pl-4 py-2 bg-slate-50">
                      <h4 className="font-semibold text-sm mb-2">Non-graduating Students:</h4>
                      <ul className="space-y-1 text-sm text-slate-700">
                        <li>• Full-time: GPA of 3.25 is required. Max Overload: 22</li>
                        <li>• Part-time Senior Standing: GPA of 3.25+ is required. Max Overload: 14</li>
                      </ul>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4 py-2 bg-green-50">
                      <h4 className="font-semibold text-sm mb-2">Graduating Students - last semester:</h4>
                      <ul className="space-y-1 text-sm text-slate-700">
                        <li>• Full-time: GPA of 3.25+ is required to get 24 hours overload.</li>
                        <li>• Full-time: GPA of 2.50-3.24 is required to get 22 hours overload.</li>
                        <li>• Part-time: GPA of 2.50+ is required to get 15 hours overload.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Generate
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>AI Degree Plan Generator</DialogTitle>
                  <DialogDescription>
                    Describe your preferences (optional) and we'll generate optimal degree plans for you
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {generatedPlans.length === 0 ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="ai-prompt">Your Preferences (Optional)</Label>
                        <Textarea
                          id="ai-prompt"
                          placeholder="e.g., I want to take more courses in Fall semesters, balance the workload evenly, prioritize required courses first"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          rows={4}
                        />
                      </div>
                      <Button className="w-full" onClick={handleGeneratePlan}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Plans
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPlanIndex(Math.max(0, currentPlanIndex - 1))}
                          disabled={currentPlanIndex === 0}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm">
                          Option {currentPlanIndex + 1} of {generatedPlans.length}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPlanIndex(Math.min(generatedPlans.length - 1, currentPlanIndex + 1))}
                          disabled={currentPlanIndex === generatedPlans.length - 1}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="border rounded-lg p-4 bg-slate-50 space-y-3 max-h-96 overflow-y-auto">
                        {generatedPlans[currentPlanIndex].map(semester => (
                          <div key={semester.id} className="bg-white p-3 rounded border">
                            <h4 className="font-medium mb-2">{formatSemesterName(semester.id)}</h4>
                            <div className="space-y-1">
                              {semester.courses.map(course => (
                                <div key={course.id} className="flex items-center justify-between text-sm">
                                  <span>{course.code} - {course.name}</span>
                                  <Badge variant="outline" className="text-xs">{course.credits}cr</Badge>
                                </div>
                              ))}
                              {semester.courses.length === 0 && (
                                <p className="text-xs text-slate-400">No courses</p>
                              )}
                            </div>
                            <div className="mt-2 text-xs text-slate-600">
                              Total: {semester.courses.reduce((sum, c) => sum + c.credits, 0)} credits
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setGeneratedPlans([]);
                            setCurrentPlanIndex(0);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button className="flex-1" onClick={handleApplyPlan}>
                          Apply This Plan
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Plan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Degree Plan</DialogTitle>
                  <DialogDescription>
                    Give your plan a name so you can find it later
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="plan-name">Plan Name</Label>
                    <Input
                      id="plan-name"
                      placeholder="e.g., My 4-Year Plan"
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={handleSavePlan}>
                    Save
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* HORIZONTAL LAYOUT - Semesters LEFT, Available Courses RIGHT */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_350px] gap-6">
          
          {/* LEFT SIDE - Semesters in 2x2 grid */}
          <div className="space-y-4">
            <Card className="bg-white/50 backdrop-blur">
              <CardHeader className="py-6">
                <div className="flex items-center justify-between">
                  <CardTitle>Plan Overview</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline">{getTotalCompletedCredits()} completed</Badge>
                    <Badge variant="outline">{getTotalPlannedCredits()} planned</Badge>
                    <Badge variant={getRemainingCredits() <= 0 ? 'default' : 'secondary'}>
                      {Math.max(0, getRemainingCredits())} remaining
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {semesters.map((semester, index) => {
                const totalCredits = getTotalCredits(semester);
                const semesterHours = getSemesterHours(semester);
                // Only first incomplete semester gets overload permission if enabled
                const isNextSemester = index === 0; // Assuming first semester is the next one
                const maxCredits = getMaxCredits(semester, isNextSemester);
                const isOverloaded = semesterHours > maxCredits;

                return (
                  <Card key={semester.id} className={semester.isSummer ? 'border-amber-300 bg-amber-50/50' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {formatSemesterName(semester.id)}
                          {(() => {
                            // Summer semesters can always be removed
                            if (semester.isSummer) {
                              return (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => removeSemester(semester.id)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              );
                            }
                            
                            // For Fall/Spring: Check if this semester is in the first 8 non-summer semesters
                            const sortedSemesters = [...semesters].sort((a, b) => getSemesterOrder(a.id) - getSemesterOrder(b.id));
                            const nonSummerSemesters = sortedSemesters.filter(s => !s.isSummer);
                            const first8NonSummer = nonSummerSemesters.slice(0, 8);
                            const isInFirst8 = first8NonSummer.some(s => s.id === semester.id);
                            
                            return !isInFirst8 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => removeSemester(semester.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            ) : null;
                          })()}
                        </CardTitle>
                        <div className="flex gap-2 items-center">
                          {totalCredits !== semesterHours && (
                            <Badge variant="outline" className="text-xs">
                              {totalCredits}cr
                            </Badge>
                          )}
                          <Badge variant={isOverloaded ? 'destructive' : 'secondary'}>
                            {semesterHours} / {maxCredits} hr
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {semester.completed ? (
                        <div className="min-h-[200px] border-2 border-dashed rounded-lg p-3 bg-green-50/50 border-green-300">
                          <div className="space-y-2">
                            {semester.courses.map(course => (
                              <div
                                key={course.id}
                                className="bg-white border border-green-200 rounded-lg p-2.5 opacity-75"
                              >
                                <div className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <h4 className="font-medium text-sm">{course.code}</h4>
                                          {course.isPrepCourse && (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight">
                                              PREP
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-600 truncate">{course.name}</p>
                                      </div>
                                      <Badge 
                                        variant={course.isPrepCourse ? "secondary" : "outline"} 
                                        className="flex-shrink-0 text-xs"
                                      >
                                        {course.isPrepCourse ? `${course.semesterHours}h` : `${course.credits}cr`}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {semester.courses.length === 0 && (
                              <div className="text-center text-slate-400 py-12">
                                <p className="text-sm">No courses</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`min-h-[200px] border-2 border-dashed rounded-lg p-3 transition-all ${
                            dragOverSemester === semester.id
                              ? 'border-[#E87722] bg-orange-50 shadow-lg'
                              : 'border-slate-300 bg-slate-50/50'
                          }`}
                          onDragOver={handleDragOver}
                          onDragEnter={() => setDragOverSemester(semester.id)}
                          onDragLeave={() => setDragOverSemester(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDrop(semester.id);
                          }}
                        >
                          <div className="space-y-2">
                            {semester.courses.map(course => {
                              const isElectiveCourse = course.electiveCategory && !course.isElectiveOption;
                              return (
                              <div
                                key={course.id}
                                draggable={true}
                                onDragStart={() => handleDragStart(course, semester.id)}
                                onDragEnd={() => {
                                  setDraggedCourse(null);
                                  setDraggedFromSemester(null);
                                  setDragOverSemester(null);
                                }}
                                onClick={() => isElectiveCourse && handleElectiveClick(course)}
                                className={`bg-white border rounded-lg p-2.5 hover:shadow-md transition-shadow ${
                                  isElectiveCourse 
                                    ? 'border-slate-300 bg-slate-50/50 cursor-pointer' 
                                    : 'border-slate-200 cursor-grab active:cursor-grabbing'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  {isElectiveCourse ? (
                                    <Settings className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <GripVertical className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <h4 className={`font-medium text-sm ${isElectiveCourse ? 'text-slate-700' : ''}`}>{course.code}</h4>
                                          {course.isPrepCourse && (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight">
                                              PREP
                                            </Badge>
                                          )}
                                          {isElectiveCourse && (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight bg-slate-100 text-slate-700 border-slate-300">
                                              CLICK TO CHANGE
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-600 truncate">{course.name}</p>
                                        {(course.prerequisites && course.prerequisites.length > 0) || course.requiredHours || course.mustBeAlone ? (
                                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                            {course.prerequisites && course.prerequisites.length > 0 && (
                                              <>Prereqs: {course.prerequisites.map(id => {
                                                const prereq = [...coursesToTake, ...completedCourses, ...semesters.flatMap(s => s.courses)].find(c => c.id === id);
                                                return prereq?.code.split(' ')[1] || id;
                                              }).join(', ')}</>
                                            )}
                                            {course.prerequisites && course.prerequisites.length > 0 && course.requiredHours && ' • '}
                                            {course.requiredHours && (
                                              <>{course.requiredHours === 30 ? 'Sophomore' : course.requiredHours === 60 ? 'Junior' : course.requiredHours === 90 ? 'Senior' : `${course.requiredHours}hr`} standing</>
                                            )}
                                            {course.mustBeAlone && (
                                              <> • Must be alone</>
                                            )}
                                          </p>
                                        ) : null}
                                      </div>
                                      <Badge 
                                        variant={course.isPrepCourse ? "secondary" : "outline"} 
                                        className="flex-shrink-0 text-xs"
                                      >
                                        {course.isPrepCourse ? `${course.semesterHours}h` : `${course.credits}cr`}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                            })}
                            {semester.courses.length === 0 && (
                              <div className="text-center text-slate-400 py-12 pointer-events-none">
                                <p className="text-sm">Drop courses here</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* RIGHT SIDE - Available Courses */}
          <Card className="h-fit md:sticky md:top-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Courses to Take
                <Badge variant="secondary">{coursesToTake.length} courses</Badge>
              </CardTitle>
              <p className="text-sm text-slate-600">Drag courses to semester boxes</p>
            </CardHeader>
            <CardContent>
              <div
                className={`h-[calc(100vh-280px)] overflow-y-auto space-y-2 p-2 rounded-lg transition-all ${
                  dragOverSemester === 'available'
                    ? 'bg-orange-50 border-2 border-dashed border-[#E87722]'
                    : ''
                }`}
                onDragOver={handleDragOver}
                onDragEnter={() => setDragOverSemester('available')}
                onDragLeave={() => setDragOverSemester(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop('available');
                }}
              >
                {coursesToTake.map(course => {
                  const isRepeatCourse = restrictions.repeatCourseIds.includes(course.id);
                  const isElectivePlaceholder = course.isElectiveOption;
                  
                  return (
                    <div
                      key={course.id}
                      draggable={!isElectivePlaceholder}
                      onDragStart={() => !isElectivePlaceholder && handleDragStart(course, 'available')}
                      onDragEnd={() => {
                        setDraggedCourse(null);
                        setDraggedFromSemester(null);
                        setDragOverSemester(null);
                      }}
                      onClick={() => (isElectivePlaceholder || course.electiveCategory) && handleElectiveClick(course)}
                      className={`bg-white border rounded-lg p-3 hover:shadow-md transition-shadow ${
                        isElectivePlaceholder 
                          ? 'border-slate-300 bg-slate-50 cursor-pointer hover:bg-slate-100' 
                          : course.electiveCategory
                            ? 'border-slate-300 bg-slate-50/50 cursor-pointer hover:bg-slate-100'
                            : 'border-slate-200 cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isElectivePlaceholder ? (
                          <Plus className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                        ) : course.electiveCategory ? (
                          <Settings className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <GripVertical className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className={`font-medium text-sm ${isElectivePlaceholder || course.electiveCategory ? 'text-slate-700' : ''}`}>
                                  {course.code}
                                </h4>
                                {isElectivePlaceholder && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight bg-slate-100 text-slate-700 border-slate-300">
                                    CLICK TO SELECT
                                  </Badge>
                                )}
                                {!isElectivePlaceholder && course.electiveCategory && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight bg-slate-100 text-slate-700 border-slate-300">
                                    CLICK TO CHANGE
                                  </Badge>
                                )}
                                {course.isPrepCourse && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight">
                                    PREP
                                  </Badge>
                                )}
                                {isRepeatCourse && (
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0 leading-tight">
                                    REPEAT
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2">{course.name}</p>
                              {(course.prerequisites && course.prerequisites.length > 0) || course.requiredHours || course.mustBeAlone ? (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {course.prerequisites && course.prerequisites.length > 0 && (
                                    <>Prereqs: {course.prerequisites.map(id => {
                                      const prereq = [...coursesToTake, ...completedCourses, ...semesters.flatMap(s => s.courses)].find(c => c.id === id);
                                      return prereq?.code.split(' ')[1] || id;
                                    }).join(', ')}</>
                                  )}
                                  {course.prerequisites && course.prerequisites.length > 0 && course.requiredHours && ' • '}
                                  {course.requiredHours && (
                                    <>{course.requiredHours === 30 ? 'Sophomore' : course.requiredHours === 60 ? 'Junior' : course.requiredHours === 90 ? 'Senior' : `${course.requiredHours}hr`} standing</>
                                  )}
                                  {course.mustBeAlone && (
                                    <> • Must be alone</>
                                  )}
                                </p>
                              ) : null}
                            </div>
                            <Badge 
                              variant={course.isPrepCourse ? "secondary" : "outline"} 
                              className="flex-shrink-0"
                            >
                              {course.isPrepCourse ? `${course.semesterHours}h` : `${course.credits}cr`}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {coursesToTake.length === 0 && (
                  <div className="text-center text-slate-400 py-8 pointer-events-none">
                    <p className="text-sm">All courses planned!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Elective Selection Dialog */}
      <Dialog open={showElectiveDialog} onOpenChange={setShowElectiveDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Elective Course</DialogTitle>
            <DialogDescription>
              {selectedElectivePlaceholder && (
                <>Choose a course from <strong>{selectedElectivePlaceholder.electiveCategory}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedElectivePlaceholder && (
              <>
                <div className="space-y-2">
                  {availableElectives
                    .filter(course => course.electiveCategory === selectedElectivePlaceholder.electiveCategory)
                    .map(course => {
                      // Check if this course is already selected/planned (excluding repeats)
                      const isAlreadyPlanned = [...coursesToTake, ...semesters.flatMap(s => s.courses)]
                        .some(c => c.id === course.id && !restrictions.repeatCourseIds.includes(c.id));
                      
                      // Check if this course is completed
                      const isCompleted = completedCourses.some(c => c.id === course.id);
                      const isMarkedForRepeat = restrictions.repeatCourseIds.includes(course.id);
                      
                      const isSelected = selectedElectiveCourse === course.id;
                      
                      return (
                        <Card 
                          key={course.id} 
                          className={`p-3 cursor-pointer transition-all ${
                            isAlreadyPlanned 
                              ? 'opacity-50 cursor-not-allowed bg-slate-100' 
                              : isSelected 
                                ? 'border-slate-400 border-2 bg-slate-50' 
                                : (isCompleted && !isMarkedForRepeat)
                                  ? 'opacity-50 hover:border-slate-300 hover:shadow-md'
                                  : 'hover:border-slate-300 hover:shadow-md'
                          }`}
                          onClick={() => !isAlreadyPlanned && setSelectedElectiveCourse(course.id)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{course.code}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {course.credits} cr
                                </Badge>
                                {isAlreadyPlanned && (
                                  <Badge variant="secondary" className="text-xs">
                                    Already Planned
                                  </Badge>
                                )}
                                {isCompleted && !isMarkedForRepeat && (
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-300">
                                    Completed
                                  </Badge>
                                )}
                                {isMarkedForRepeat && (
                                  <Badge variant="secondary" className="text-xs">
                                    Retaking
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-600">{course.name}</p>
                              {course.prerequisites && course.prerequisites.length > 0 && (
                                <p className="text-xs text-slate-500 mt-1">
                                  Prerequisites: {course.prerequisites.map(id => {
                                    const prereq = [...coursesToTake, ...completedCourses, ...semesters.flatMap(s => s.courses)].find(c => c.id === id);
                                    return prereq?.code || id;
                                  }).join(', ')}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-5 h-5 text-slate-600 flex-shrink-0" />
                            )}
                          </div>
                        </Card>
                      );
                    })}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowElectiveDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleElectiveSelection}
                    disabled={!selectedElectiveCourse}
                  >
                    Select Course
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
