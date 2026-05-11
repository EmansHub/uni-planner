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
import type { User } from '../App';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface DragDropPlanningProps {
  user: User;
  planId?: string | null;
  onPlanSaved?: (planId: string) => void;
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


export function DragDropPlanning({ user, planId, onPlanSaved }: DragDropPlanningProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [coursesToTake, setCoursesToTake] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
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
  const [totalRequiredCredits, setTotalRequiredCredits] = useState(0);
  const [courseOfferingRules, setCourseOfferingRules] = useState<Record<string, string[]>>({});
  const [electiveCreditLimits, setElectiveCreditLimits] = useState<Record<string, number>>({});
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [aiPlanWarnings, setAiPlanWarnings] = useState<string[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const getCourseElectiveCategory = (course: Course) => {
  if (course.electiveCategory) return course.electiveCategory;

  const matchingElective = availableElectives.find(
    elective => elective.id === course.id
  );

  return matchingElective?.electiveCategory;
};

const getCappedDegreeCredits = (
    courses: Course[],
    options?: { excludeRepeats?: boolean }
  ) => {
    let regularCredits = 0;
    const electiveTotals: Record<string, number> = {};

    courses.forEach((course) => {
      if (!course || course.isPrepCourse) return;

      if (options?.excludeRepeats && restrictions.repeatCourseIds.includes(course.id)) {
        return;
      }

      const electiveCategory = getCourseElectiveCategory(course);

      if (electiveCategory && electiveCategory.toLowerCase().includes('elective')) {
        electiveTotals[electiveCategory] =
          (electiveTotals[electiveCategory] || 0) + (course.credits || 0);
      } else {
        regularCredits += course.credits || 0;
      }
    });

    const cappedElectiveCredits = Object.entries(electiveTotals).reduce(
      (sum, [category, total]) => {
        const limit = electiveCreditLimits[category] ?? total;
        return sum + Math.min(total, limit);
      },
      0
    );

    return regularCredits + cappedElectiveCredits;
  };

  const getTotalCompletedCredits = () => {
    const completedSemesterCourses = semesters
      .filter((semester) => semester.completed)
      .flatMap((semester) => semester.courses);

    const allCompletedCourses = [
      ...completedCourses,
      ...completedSemesterCourses,
    ];

    const uniqueCompletedCourses = Array.from(
      new Map(allCompletedCourses.map((course) => [course.id, course])).values()
    );

    return getCappedDegreeCredits(uniqueCompletedCourses);
  };
  
  const loadPlanFromSupabase = async (targetPlanId: string) => {
    const { data: planRow, error: planError } = await supabase
      .from('degree_plans')
      .select(`
        id,
        name,
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
      .eq('id', Number(targetPlanId))
      .single();
      
    if (planError || !planRow) {
      console.error('Error loading saved plan:', planError);
      toast.error('Failed to load saved plan');
      setLoadingPlan(false);
      return;
    }

    const { data: prereqRows, error: prereqError } = await supabase
      .from('course_prerequisites')
      .select('course_id, prerequisite_course_id');

    if (prereqError) {
      console.error('Error loading prerequisites for saved plan:', prereqError);
      toast.error('Failed to load prerequisites');
      setLoadingPlan(false);
      return;
    }

    const prereqMap = new Map<string, string[]>();

    (prereqRows || []).forEach((row: any) => {
      const current = prereqMap.get(row.course_id) || [];
      current.push(row.prerequisite_course_id);
      prereqMap.set(row.course_id, current);
    });

    const mapCourseRow = (courseInfo: any, electiveCategory?: string): Course => ({
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
      electiveCategory: electiveCategory || undefined,
    });


    const loadedSemesters: Semester[] = (planRow.degree_plan_semesters || [])
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((sem: any) => ({
        id: sem.semester_key,
        name: sem.semester_key,
        completed: sem.completed,
        isSummer: sem.is_summer,
        courses: (sem.degree_plan_semester_courses || [])
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((courseRow: any) => {
            const courseInfo = Array.isArray(courseRow.courses)
              ? courseRow.courses[0]
              : courseRow.courses;

            return mapCourseRow(courseInfo, courseRow.elective_category);
          }),
      }));

    const loadedCompletedCourses: Course[] = (planRow.degree_plan_completed_courses || []).map((row: any) => {
      const courseInfo = Array.isArray(row.courses) ? row.courses[0] : row.courses;
      return mapCourseRow(courseInfo);
    });

    setSemesters(loadedSemesters);
    setPlanName(planRow.name);
    setCompletedCourses(loadedCompletedCourses);

    setRestrictions({
      hasOverload: !!planRow.has_overload,
      repeatCourseIds: (planRow.degree_plan_repeat_courses || []).map((row: any) => row.course_id),
      overrideCourses: (planRow.degree_plan_override_courses || []).map((row: any) => ({
        courseId: row.course_id,
        proofImage: '',
        verified: true,
      })),
    });

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
      .eq('degree_program_code', user.major);

    if (curriculumError) {
      console.error('Error loading curriculum for saved plan:', curriculumError);
      toast.error('Failed to rebuild saved plan courses');
      setLoadingPlan(false);
      return;
    }

    const nonElectiveCourses: Course[] = [];
    const electiveCourses: Course[] = [];

    (curriculumRows || []).forEach((row: any) => {
      const courseInfo = Array.isArray(row.courses) ? row.courses[0] : row.courses;
      if (!courseInfo) return;

      const isElectiveCategory = row.course_category.toLowerCase().includes('elective');

      const builtCourse: Course = {
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
        electiveCategory: isElectiveCategory ? row.course_category : undefined,
      };

      if (isElectiveCategory) {
        electiveCourses.push(builtCourse);
      } else {
        nonElectiveCourses.push(builtCourse);
      }
    });

    const plannedCourseIds = new Set<string>();
    const plannedCourseCodes = new Set<string>();

    loadedSemesters.forEach((sem) => {
      sem.courses.forEach((course) => {
        plannedCourseIds.add(String(course.id).replace(/\s+/g, '').toUpperCase());
        plannedCourseCodes.add(String(course.code).replace(/\s+/g, '').toUpperCase());
      });
    });

    const completedCourseIds = new Set<string>();
    const completedCourseCodes = new Set<string>();

    loadedCompletedCourses.forEach((course) => {
      completedCourseIds.add(String(course.id).replace(/\s+/g, '').toUpperCase());
      completedCourseCodes.add(String(course.code).replace(/\s+/g, '').toUpperCase());
    });

    const dedupedMap = new Map<string, Course>();

    nonElectiveCourses.forEach((course) => {
      const normalizedId = String(course.id).replace(/\s+/g, '').toUpperCase();
      const normalizedCode = String(course.code).replace(/\s+/g, '').toUpperCase();

      const alreadyPlanned =
        plannedCourseIds.has(normalizedId) || plannedCourseCodes.has(normalizedCode);

      const alreadyCompleted =
        completedCourseIds.has(normalizedId) || completedCourseCodes.has(normalizedCode);

      if (!alreadyPlanned && !alreadyCompleted) {
        if (!dedupedMap.has(normalizedId)) {
          dedupedMap.set(normalizedId, course);
        }
      }
    });

  const remainingNonElectives = Array.from(dedupedMap.values());

  setCoursesToTake(remainingNonElectives);
  setAvailableElectives(electiveCourses);
  setLoadingPlan(false);
  };

  const loadTotalRequiredCredits = async () => {
    const { data, error } = await supabase
      .from('curriculum_sections')
      .select('required_credits')
      .eq('degree_program_code', user.major);

    if (error) {
      console.error('Error loading total required credits:', error);
      return;
    }

    const total = (data || []).reduce(
      (sum: number, row: any) => sum + (row.required_credits || 0),
      0
    );

    setTotalRequiredCredits(total);
  };

  const loadElectiveCreditLimits = async () => {
    const { data, error } = await supabase
      .from('curriculum_sections')
      .select('course_category, required_credits')
      .eq('degree_program_code', user.major);

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
    const initializePage = async () => {
      setLoadingPlan(true);

      await loadOfferingRules();
      await loadTotalRequiredCredits();
      await loadElectiveCreditLimits();
      
      // If editing existing plan → load from DB
      if (planId) {
        await loadPlanFromSupabase(planId);
        return;
      }

      const state = location.state as any;

      if (!state && !planId) {
        toast.error('Please start from course selection first.');
        navigate('/course-selection');
        return;
      }

      const completedCourseIds = state?.completedCourseIds || [];
      const currentCourseIds = state?.currentCourseIds || [];
      const allCourses = state?.allCourses || [];
      const completedCoursesData = state?.completedCoursesData || [];
      const allElectiveOptions = state?.allElectiveOptions || [];
      setCompletedCourses(completedCoursesData);
      setAvailableElectives(allElectiveOptions);

      const currentCoursesObjects = allCourses.filter((course: Course) =>
        currentCourseIds.includes(course.id)
      );

      const remaining = allCourses.filter(
        (course: Course) =>
          !completedCourseIds.includes(course.id) &&
          !currentCourseIds.includes(course.id)
      );

      const defaultSemesters = generateDefaultSemesters();

      const firstSemesterId = defaultSemesters[0]?.id;

      const semestersWithCurrentCourses = defaultSemesters.map((sem) =>
        sem.id === firstSemesterId
          ? { ...sem, courses: currentCoursesObjects }
          : sem
      );

      setSemesters(semestersWithCurrentCourses);
      setCoursesToTake(remaining);
      setLoadingPlan(false);
    };

    initializePage();
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
    const plannedCourses = semesters.flatMap((semester) => semester.courses);

    return getCappedDegreeCredits(plannedCourses, {
      excludeRepeats: true,
    });
  };

  const getRemainingCredits = () => {
    const totalRequired = totalRequiredCredits;
    const completedCredits = getTotalCompletedCredits();
    const plannedCredits = getTotalPlannedCredits();
    const remaining = Math.max(0, totalRequired - completedCredits - plannedCredits);

    return remaining;
  };

  const getMaxCredits = (semester: Semester, isNextSemester: boolean = false) => {
  if (semester.isSummer) {
    return 9;
  }

  return (isNextSemester && restrictions.hasOverload) ? 22 : 20;
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

  const loadOfferingRules = async () => {
    const { data, error } = await supabase
      .from('course_offering_rules')
      .select('course_id, term');

    if (error) {
      console.error('Error loading course offering rules:', error);
      return;
    }

    const map: Record<string, string[]> = {};

    (data || []).forEach((row: any) => {
      if (!map[row.course_id]) {
        map[row.course_id] = [];
      }
      map[row.course_id].push(row.term);
    });

    setCourseOfferingRules(map);
  };

  const generateDefaultSemesters = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();

    let startType: 'fall' | 'spring';
    let startYear: number;

    if (month >= 1 && month < 8) {
      startType = 'spring';
      startYear = year;
    } else if (month === 8 && day < 15) {
      startType = 'spring';
      startYear = year;
    } else {
      startType = 'fall';
      startYear = year;
    }

    const generated: Semester[] = [];

    let type = startType;
    let semesterYear = startYear;

    while (generated.length < 12) {
      generated.push({
        id: `${type}-${semesterYear}`,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${semesterYear}`,
        courses: [],
        completed: false,
        isSummer: false,
      });

      if (type === 'spring') {
        type = 'fall';
      } else {
        type = 'spring';
        semesterYear += 1;
      }
    }

    return generated;
  };

  const getAvailableSummerSemesters = () => {
    return semesters
      .filter((semester) => semester.id.includes('spring'))
      .map((springSemester) => {
        const year = parseInt(springSemester.id.split('-')[1]);
        const summerId = `summer-${year}`;

        return {
          id: summerId,
          label: formatSemesterName(summerId),
          exists: semesters.some((semester) => semester.id === summerId),
        };
      })
      .filter((summer) => !summer.exists);
  };

  const addSemester = (semesterType: 'fall' | 'spring' | 'summer', selectedSummerId?: string) => {
    if (semesterType === 'summer') {
      if (!selectedSummerId) {
        toast.error('Please select which summer semester to add.');
        return;
      }

      if (semesters.some(s => s.id === selectedSummerId)) {
        toast.error(`${formatSemesterName(selectedSummerId)} already exists`);
        return;
      }

      const year = parseInt(selectedSummerId.split('-')[1]);

      const newSemester: Semester = {
        id: selectedSummerId,
        name: `Summer ${year}`,
        courses: [],
        completed: false,
        isSummer: true,
      };

      const springId = `spring-${year}`;
      const springIndex = semesters.findIndex(s => s.id === springId);

      if (springIndex === -1) {
        toast.error('Cannot add summer without its spring semester.');
        return;
      }

      const newSemesters = [...semesters];
      newSemesters.splice(springIndex + 1, 0, newSemester);

      setSemesters(newSemesters);
      toast.success(`Added ${formatSemesterName(selectedSummerId)}`);
    }
    else {
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
          year = new Date().getFullYear();
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
  const isCourseAllowedInSemester = (courseId: string, semesterId: string) => {
    const rules = courseOfferingRules[courseId];

    if (!rules || rules.length === 0) {
      return true;
    }

    if (semesterId.includes('fall')) {
      return rules.includes('fall');
    }

    if (semesterId.includes('spring')) {
      return rules.includes('spring');
    }

    if (semesterId.includes('summer')) {
      return rules.includes('summer');
    }

    return true;
  };

  const handleDrop = (targetSemester: string) => {
    if (!draggedCourse || !draggedFromSemester) return;

  const normalizedDraggedCourseId = String(draggedCourse.id)
    .replace(/\s+/g, '')
    .toUpperCase();

  if (targetSemester !== 'available' && normalizedDraggedCourseId === 'ASSE4311') {
    const sortedSemesters = [...semesters].sort(
      (a, b) => getSemesterOrder(a.id) - getSemesterOrder(b.id)
    );

    const semestersAfterTarget = sortedSemesters.filter(
      semester =>
        getSemesterOrder(semester.id) > getSemesterOrder(targetSemester) &&
        semester.courses.length > 0
    );

    if (semestersAfterTarget.length === 0) {
      toast.error('ASSE 4311 cannot be planned in the very last semester.');
      setDraggedCourse(null);
      setDraggedFromSemester(null);
      setDragOverSemester(null);
      return;
    }
  }

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

    // Check semester-specific course availability from DB
    if (targetSemester !== 'available') {
      if (!isCourseAllowedInSemester(draggedCourse.id, targetSemester)) {
        toast.error(`${draggedCourse.code} is not offered in ${formatSemesterName(targetSemester)}.`);
        setDraggedCourse(null);
        setDraggedFromSemester(null);
        setDragOverSemester(null);
        return;
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
      const canOverride = restrictions.overrideCourses.some(
        override => override.courseId === draggedCourse.id && override.verified
      );

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

      // Check if target semester would exceed max CREDITS
      if (targetSemester !== 'available') {
        const targetSem = semesters.find(s => s.id === targetSemester);

        if (targetSem) {
          const currentCredits = getTotalCredits(targetSem);
          const courseCredits = draggedCourse.isPrepCourse ? 0 : draggedCourse.credits;

          const sortedSemesters = [...semesters].sort(
            (a, b) => getSemesterOrder(a.id) - getSemesterOrder(b.id)
          );

          const isNextSemester = sortedSemesters[0]?.id === targetSem.id;
          const maxCredits = getMaxCredits(targetSem, isNextSemester);

          if (currentCredits + courseCredits > maxCredits) {
            toast.error(`Cannot add course. This would exceed the ${maxCredits} credit limit for ${formatSemesterName(targetSem.id)}.`);
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

const handleGeneratePlan = async () => {
  try {
    setIsGeneratingPlan(true);
    toast.info('AI is generating degree plan...');

const promptLower = aiPrompt.toLowerCase();

const explicitlyNoSummer =
  promptLower.includes("no summer") ||
  promptLower.includes("without summer") ||
  promptLower.includes("do not include summer") ||
  promptLower.includes("don't include summer") ||
  promptLower.includes("dont include summer");

const wantsSummerForAI =
  !explicitlyNoSummer &&
  (
    promptLower.includes("summer") ||
    promptLower.includes("fast") ||
    promptLower.includes("graduate faster")
  );

const buildPlanningSlotsForAI = (includeSummer: boolean): Semester[] => {
  const baseSemesters = generateDefaultSemesters();

  const hasCurrentCourses = semesters[0]?.courses.length > 0;
  const slots = hasCurrentCourses ? baseSemesters.slice(1) : baseSemesters;

  if (!includeSummer) {
    return slots.filter(
      (semester) =>
        !semester.isSummer &&
        !semester.id.startsWith("summer-")
    );
  }

  const withSummer: Semester[] = [];

  slots.forEach((semester) => {
    if (semester.isSummer || semester.id.startsWith("summer-")) {
      return;
    }

    withSummer.push(semester);

    if (semester.id.startsWith("spring-")) {
      const year = semester.id.split("-")[1];

      withSummer.push({
        id: `summer-${year}`,
        name: `Summer ${year}`,
        completed: false,
        isSummer: true,
        courses: [],
      });
    }
  });

  return withSummer;
};

const aiSemesterSlots = buildPlanningSlotsForAI(wantsSummerForAI);
      
   const response = await fetch("http://127.0.0.1:5000/generate-degree-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        degree_program_code: user.major,
        completed_courses: completedCourses.map((course) => course.id),
        current_courses: semesters[0]?.courses.map((course) => course.id) || [],
        preferences: aiPrompt,
        include_summer: wantsSummerForAI,
        semester_slots: aiSemesterSlots.map((semester) => ({
        id: semester.id,
        term: semester.isSummer
          ? "summer"
          : semester.id.startsWith("fall-")
            ? "fall"
            : "spring",
        })),
      }),
    });

    const data = await response.json();

    console.log("Backend degree plan result:", data);

    setAiPlanWarnings(data.warnings || []);

    if (!data.plan || data.plan.length === 0) {
      toast.error(data.message || "No degree plan generated.");
      return;
    }

    const allKnownCourses = [
      ...coursesToTake,
      ...completedCourses,
      ...semesters.flatMap((semester) => semester.courses),
      ...availableElectives,
    ];

    const courseMap = new Map<string, Course>();

    allKnownCourses.forEach((course) => {
      courseMap.set(course.id.replace(/\s+/g, '').toUpperCase(), course);
    });

    const defaultSemesters = aiSemesterSlots.slice(0, data.plan.length);

    const backendPlan = data.plan.map((semesterCourseIds: string[], index: number) => {
      const baseSemester =
        defaultSemesters[index] || {
          id: `generated-${index + 1}`,
          name: `Semester ${index + 1}`,
          completed: false,
          isSummer: false,
          courses: [],
        };

      const courses = semesterCourseIds
        .map((courseId) =>
          courseMap.get(courseId.replace(/\s+/g, '').toUpperCase())
        )
        .filter(Boolean) as Course[];

      return {
        ...baseSemester,
        courses,
      };
    });

    const finalPlan = backendPlan;

    const cleanedPlan = finalPlan.filter(
      (sem: Semester) => sem.courses.length > 0
    );

    setGeneratedPlans([cleanedPlan]);
    setCurrentPlanIndex(0);
    toast.success("AI degree plan generated!");

  } catch (error) {
    console.error("AI degree plan error:", error);
    toast.error("Failed to generate degree plan.");
  } finally {
    setIsGeneratingPlan(false);
  }
};

  const handleApplyPlan = () => {
    if (generatedPlans.length > 0) {
      const currentSemester = semesters[0];

      const finalPlan =
        currentSemester && currentSemester.courses.length > 0
          ? [currentSemester, ...generatedPlans[currentPlanIndex]]
          : generatedPlans[currentPlanIndex];

      setSemesters(finalPlan);

      setCoursesToTake([]);
      setShowAIDialog(false);
      setGeneratedPlans([]);
      setAiPrompt('');
      toast.success('Degree plan applied!');
    }
  };

  const savePlanToSupabase = async () => {
    if (!planName.trim()) {
      toast.error('Please enter a plan name');
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;

    if (!authUser) {
      toast.error('You must be logged in');
      return;
    }

    const existingPlanId = planId ? Number(planId) : null;

    // 1. Create or update main degree plan row
    let savedPlanId = existingPlanId;

    if (savedPlanId) {
      const { error: updatePlanError } = await supabase
        .from('degree_plans')
        .update({
          name: planName,
          degree_program_code: user.major,
          has_overload: restrictions.hasOverload,
        })
        .eq('id', savedPlanId);

      if (updatePlanError) {
        console.error('Error updating degree plan:', updatePlanError);
        toast.error('Failed to update plan');
        return;
      }

      // Clear old child rows before re-inserting
      await supabase.from('degree_plan_semester_courses').delete().eq('degree_plan_id', savedPlanId);
      await supabase.from('degree_plan_semesters').delete().eq('degree_plan_id', savedPlanId);
      await supabase.from('degree_plan_completed_courses').delete().eq('degree_plan_id', savedPlanId);
      await supabase.from('degree_plan_repeat_courses').delete().eq('degree_plan_id', savedPlanId);
      await supabase.from('degree_plan_override_courses').delete().eq('degree_plan_id', savedPlanId);
    } else {
      const { data: newPlan, error: insertPlanError } = await supabase
        .from('degree_plans')
        .insert({
          user_id: authUser.id,
          name: planName,
          degree_program_code: user.major,
          has_overload: restrictions.hasOverload,
        })
        .select()
        .single();

      if (insertPlanError || !newPlan) {
        console.error('Error creating degree plan:', insertPlanError);
        toast.error('Failed to save plan');
        return;
      }

      savedPlanId = newPlan.id;
    }

    if (!savedPlanId) {
      toast.error('Plan ID missing');
      return;
    }

    // 2. Save semesters
    const semesterRows = semesters.map((semester, index) => ({
      degree_plan_id: savedPlanId,
      semester_key: semester.id,
      display_order: index,
      completed: semester.completed,
      is_summer: !!semester.isSummer,
    }));

    if (semesterRows.length > 0) {
      const { error: semesterError } = await supabase
        .from('degree_plan_semesters')
        .insert(semesterRows);

      if (semesterError) {
        console.error('Error saving semesters:', semesterError);
        toast.error('Failed to save semesters');
        return;
      }
    }

    // 3. Save semester courses
    const semesterCourseRows = semesters.flatMap((semester) =>
      semester.courses
        .filter((course) => !course.isElectiveOption && !course.id.startsWith('temp-placeholder-'))
        .map((course, index) => ({
          degree_plan_id: savedPlanId,
          semester_key: semester.id,
          course_id: course.id,
          display_order: index,
          elective_category: course.electiveCategory || null,
        }))
    );

    if (semesterCourseRows.length > 0) {
      const { error: semesterCourseError } = await supabase
        .from('degree_plan_semester_courses')
        .insert(semesterCourseRows);

      if (semesterCourseError) {
        console.error('Error saving semester courses:', JSON.stringify(semesterCourseError, null, 2));
        console.log('semesterCourseRows:', semesterCourseRows);
        toast.error('Failed to save semester courses');
        return;
      }
    }

    // 4. Save completed courses
    const completedCourseRows = completedCourses.map((course) => ({
      degree_plan_id: savedPlanId,
      course_id: course.id,
    }));

    if (completedCourseRows.length > 0) {
      const { error: completedError } = await supabase
        .from('degree_plan_completed_courses')
        .insert(completedCourseRows);

      if (completedError) {
        console.error('Error saving completed courses:', completedError);
        toast.error('Failed to save completed courses');
        return;
      }
    }

    // 5. Save repeat courses
    const repeatRows = restrictions.repeatCourseIds.map((courseId) => ({
      degree_plan_id: savedPlanId,
      course_id: courseId,
    }));

    if (repeatRows.length > 0) {
      const { error: repeatError } = await supabase
        .from('degree_plan_repeat_courses')
        .insert(repeatRows);

      if (repeatError) {
        console.error('Error saving repeat courses:', repeatError);
        toast.error('Failed to save repeat courses');
        return;
      }
    }

    // 6. Save override courses
    const overrideRows = restrictions.overrideCourses.map((override) => ({
      degree_plan_id: savedPlanId,
      course_id: override.courseId,
    }));

    if (overrideRows.length > 0) {
      const { error: overrideError } = await supabase
        .from('degree_plan_override_courses')
        .insert(overrideRows);

      if (overrideError) {
        console.error('Error saving override courses:', overrideError);
        toast.error('Failed to save override courses');
        return;
      }
    }

    if (onPlanSaved && savedPlanId) {
      onPlanSaved(String(savedPlanId));
    }

    setShowSaveDialog(false);
    toast.success('Plan saved successfully!');

    // redirect to saved plan view
    navigate('/saved-plan-view');
  };

  const handleSavePlan = async () => {
    await savePlanToSupabase();
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

  const handleVerifyProof = async () => {
  if (!uploadedProofImage || !selectedOverrideCourse) return;

  setIsVerifyingProof(true);

  try {
    const response = await fetch(uploadedProofImage);
    const blob = await response.blob();

    const formData = new FormData();
    formData.append("file", blob, "override-proof.png");

    const res = await fetch("http://127.0.0.1:5000/verify-override-proof", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    console.log("OVERRIDE VERIFY RESULT:", data);

    const selectedCourseId = selectedOverrideCourse.id.replace(/\s+/g, "").toUpperCase();
    const detectedCourseId = String(data.course_id || "").replace(/\s+/g, "").toUpperCase();

    if (!data.approved || detectedCourseId !== selectedCourseId) {
      toast.error("Override proof was not approved for this course.");
      setIsVerifyingProof(false);
      return;
    }

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

    // NEW: handle overload approval
    if (data.type === "overload" && data.approved) {
      setRestrictions(prev => ({
        ...prev,
        hasOverload: true
      }));

      toast.success("Overload approved! You can now take up to 22 credits.");

      setShowOverrideUploadDialog(false);
      setUploadedProofImage(null);
      setIsVerifyingProof(false);
      return;
    }

    toast.success(`Override approved for ${selectedOverrideCourse.code}!`);
    setShowOverrideUploadDialog(false);
    setSelectedOverrideCourse(null);
    setUploadedProofImage(null);
    setIsVerifyingProof(false);

  } catch (error) {
    console.error("Override verification error:", error);
    toast.error("Failed to verify override proof");
    setIsVerifyingProof(false);
  }
};

  const removeOverrideCourse = (courseId: string) => {
    setRestrictions(prev => ({
      ...prev,
      overrideCourses: prev.overrideCourses.filter(override => override.courseId !== courseId)
    }));
    toast.success('Override removed');
  };

  const handleBack = () => {
    if (planId) {
      navigate('/saved-plan-view');
    } else {
      const completedSemesterCourses = completedCourses.map((course) => course.id);

      const currentSemesterCourses = semesters
        .flatMap((semester) => semester.courses)
        .map((course) => course.id)
        .filter((id) => !String(id).startsWith('PLACEHOLDER_'));

      navigate('/course-selection', {
        state: {
          restoredCompletedCourseIds: completedSemesterCourses,
          restoredCurrentCourseIds: currentSemesterCourses,
        },
      });
    }
  };

  const filteredCoursesToTake = coursesToTake.filter((course) => {
    const query = courseSearchQuery.toLowerCase().trim();

    if (!query) return true;

    return (
      course.code.toLowerCase().includes(query) ||
      course.name.toLowerCase().includes(query) ||
      course.id.toLowerCase().includes(query)
    );
  });

  if (loadingPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4 flex items-center justify-center">
        <p>Loading degree plan...</p>
      </div>
    );
  }

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
            onClick={() => navigate('/dashboard')}
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
                {getAvailableSummerSemesters().length === 0 ? (
                  <DropdownMenuItem disabled>
                    No summer available
                  </DropdownMenuItem>
                ) : (
                  getAvailableSummerSemesters().map((summer) => (
                    <DropdownMenuItem
                      key={summer.id}
                      onClick={() => addSemester('summer', summer.id)}
                    >
                      {summer.label}
                    </DropdownMenuItem>
                  ))
                )}
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
                      className="text-xs text-foreground hover:text-blue-800 underline ml-6 flex items-center gap-1"
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
                    Describe your preferences (optional) and we'll generate optimal degree plan for you
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {generatedPlans.length === 0 ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="ai-prompt">Your Preferences (Optional)</Label>
                        <Textarea
                          id="ai-prompt"
                          placeholder="e.g., I want to graduate faster, max 16 credits with summer, light plan no summer"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          rows={4}
                        />
                      </div>
                      <Button className="w-full" onClick={handleGeneratePlan}>
                        {isGeneratingPlan ? (
                          <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                               Generating plan...
                          </>
                        ):(
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Plan
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                      <h3 className="font-medium">Generated Degree Plan</h3>
                    </div>

                      <div className="border rounded-lg p-4 bg-slate-50 space-y-3 max-h-96 overflow-y-auto">
                        <p className="text-xs text-slate-500">
                          Preferences: {aiPrompt || "None"}
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            Note: Max academic years in PMU is 6 years total.
                          </p>
                        </p>

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
                  {aiPlanWarnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {aiPlanWarnings.map((warning, index) => (
                      
                        <p key={index} className="text-xs text-red-600 leading-tight">
                        ⚠️ {warning}
                        </p>
                      ))}
                    </div>
                  )}
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
                const sortedSemesters = [...semesters].sort((a, b) => getSemesterOrder(a.id) - getSemesterOrder(b.id));
                const isNextSemester = sortedSemesters[0]?.id === semester.id;
                const maxCredits = getMaxCredits(semester, isNextSemester);
                const isOverloaded = totalCredits > maxCredits;

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
                          className={`min-h-[200px] border-2 border-dashed rounded-lg p-3 transition-all ${dragOverSemester === semester.id
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
                                  className={`bg-white border rounded-lg p-2.5 hover:shadow-md transition-shadow ${isElectiveCourse
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
                <Badge variant="secondary">{filteredCoursesToTake.length} / {coursesToTake.length} courses</Badge>
              </CardTitle>

              <p className="text-sm text-slate-600">Drag courses to semester boxes</p>

              <Input
                type="text"
                placeholder="Search courses..."
                value={courseSearchQuery}
                onChange={(e) => setCourseSearchQuery(e.target.value)}
                className="mt-2"
              />
            </CardHeader>
            <CardContent>
              <div
                className={`h-[calc(100vh-280px)] overflow-y-auto space-y-2 p-2 rounded-lg transition-all ${dragOverSemester === 'available'
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
                {filteredCoursesToTake.map(course => {
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
                      className={`bg-white border rounded-lg p-3 hover:shadow-md transition-shadow ${isElectivePlaceholder
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

                {coursesToTake.length > 0 && filteredCoursesToTake.length === 0 && (
                  <div className="text-center text-slate-400 py-8 pointer-events-none">
                    <p className="text-sm">No courses match your search</p>
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
                          className={`p-3 cursor-pointer transition-all ${isAlreadyPlanned
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
