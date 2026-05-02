import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ArrowLeft, Calendar, Download, Copy, Sparkles, ChevronDown, Trash2, Filter, ChevronLeft, ChevronRight, X, RotateCcw, Search } from 'lucide-react';
import type { User } from '../App';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface SemesterScheduleProps {
  user: User;
}

interface CourseSection {
  id: string;
  crn: string;
  courseCode: string;
  courseName: string;
  section: string;
  sectionType: 'LEC' | 'LAB' | 'LEC_LAB';
  instructor: string;
  credits: number;
  days: string[];
  startTime: string;
  endTime: string;
  location: string;
  electiveCategory?: string;
  gender: 'M' | 'F';
}

interface AIScheduleOption {
  id: string;
  sections: CourseSection[];
  skipped_courses?: string[];
}

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const mapMeetingDay = (day: string) => {
  const normalized = String(day).trim().toUpperCase();

  if (normalized === 'U') return 'Sunday';
  if (normalized === 'M') return 'Monday';
  if (normalized === 'T') return 'Tuesday';
  if (normalized === 'W') return 'Wednesday';
  if (normalized === 'R') return 'Thursday';

  return day;
};

export function SemesterSchedule({ user }: SemesterScheduleProps) {
  const navigate = useNavigate();
  // Track which section IDs are added (visible on the grid)
  const [addedSections, setAddedSections] = useState<Set<string>>(new Set());
  // Track which specific sections are chosen (clicked on the grid)
  const [chosenSections, setChosenSections] = useState<Set<string>>(new Set());
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [savedSchedules, setSavedSchedules] = useState<any[]>([]);
  const [courseFilter, setCourseFilter] = useState<'all' | 'degree-plan'>('all');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiScheduleOptions, setAiScheduleOptions] = useState<AIScheduleOption[]>([]);
  const [selectedAIOption, setSelectedAIOption] = useState(0);
  const [previewingAI, setPreviewingAI] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbSections, setDbSections] = useState<CourseSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [curriculumCourseIds, setCurriculumCourseIds] = useState<Set<string>>(new Set());
  const [currentSemester, setCurrentSemester] = useState<{ term: string; label: string; planKey: string } | null>(null);
  const [defaultPlan, setDefaultPlan] = useState<any | null>(null);
  const [prerequisiteMap, setPrerequisiteMap] = useState<Record<string, string[]>>({});

    const loadDefaultPlan = async () => {
    const { data: plan, error: planError } = await supabase
      .from('degree_plans')
      .select('id, name, is_default')
      .eq('is_default', true)
      .single();

    if (planError || !plan) {
      console.error('Error loading default plan:', planError);
      setDefaultPlan(null);
      return;
    }

    const { data: semesters, error: semestersError } = await supabase
      .from('degree_plan_semesters')
      .select('semester_key, completed, is_summer, display_order')
      .eq('degree_plan_id', plan.id)
      .order('display_order', { ascending: true });

    if (semestersError) {
      console.error('Error loading default plan semesters:', semestersError);
      setDefaultPlan(null);
      return;
    }

    const { data: semesterCourses, error: coursesError } = await supabase
      .from('degree_plan_semester_courses')
      .select('semester_key, course_id, elective_category, display_order')
      .eq('degree_plan_id', plan.id)
      .order('display_order', { ascending: true });

    if (coursesError) {
      console.error('Error loading default plan courses:', coursesError);
      setDefaultPlan(null);
      return;
    }

    const { data: completedRows, error: completedError } = await supabase
      .from('degree_plan_completed_courses')
      .select('course_id')
      .eq('degree_plan_id', plan.id);

    if (completedError) {
      console.error('Error loading completed courses:', completedError);
      setDefaultPlan(null);
      return;
    }

    const completedCourseIds = (completedRows || []).map((row: any) =>
      normalizeCourseCode(row.course_id)
    );

    const semestersMap: any = {};

    (semesters || []).forEach((sem: any) => {
      semestersMap[sem.semester_key] = {
        id: sem.semester_key,
        completed: sem.completed,
        isSummer: sem.is_summer,
        courses: [],
      };
    });

    (semesterCourses || []).forEach((row: any) => {
      if (!semestersMap[row.semester_key]) return;

      semestersMap[row.semester_key].courses.push({
        id: row.course_id,
        code: row.course_id.replace(/([A-Z]+)(\d+)/, '$1 $2'),
      });
    });

    setDefaultPlan({
      ...plan,
      semesters: semestersMap,
      completedCourseIds,
    });
  };

  const sectionsSource = dbSections;
  
  const groupedSections = sectionsSource.reduce((acc, section) => {
    if (!acc[section.courseCode]) {
      acc[section.courseCode] = [];
    }
    acc[section.courseCode].push(section);
    return acc;
  }, {} as Record<string, CourseSection[]>);

  // Load saved schedules on mount
  React.useEffect(() => {
    setCurrentSemester(getCurrentSemester());
    loadSavedSchedules();
    loadSections();
    loadCurriculumCourses();
    loadDefaultPlan();
    loadPrerequisites();
  }, []);

  const loadSavedSchedules = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData.user;

        if (!authUser) {
          toast.error('You must be logged in');
          return;
        }

        const { data, error } = await supabase
          .from('saved_schedules')
          .select(`
            id,
            name,
            created_at,
            saved_schedule_sections (
              crn
            )
          `)
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading saved schedules:', error);
          toast.error('Failed to load saved schedules');
          return;
        }

        const formattedSchedules = (data || []).map((schedule: any, index: number) => {
          const sectionRows = schedule.saved_schedule_sections ?? [];

          return {
            id: schedule.id.toString(),
            name: schedule.name || `Schedule ${index + 1}`,
            createdAt: schedule.created_at,
            chosenSectionIds: sectionRows.map((item: any) => item.crn),
            sections: sectionRows.map((item: any) => ({
              crn: item.crn,
            })),
          };
        });

        setSavedSchedules(formattedSchedules);
      } catch (err) {
        console.error('Unexpected loadSavedSchedules error:', err);
        toast.error('Failed to load saved schedules');
      }
    };

    const loadSections = async () => {

      setSectionsLoading(true);

      const { data, error } = await supabase
        .from('course_sections')
        .select(`
          crn,
          course_id,
          section,
          section_type,
          instructor,
          room,
          credits,
          gender,
          courses (
            name
          ),
          course_section_meetings (
            day,
            start_time,
            end_time
          )
        `)
        .order('crn', { ascending: true });

      if (error) {
        console.error('Error loading sections:', error);
        toast.error('Failed to load sections');
        setSectionsLoading(false);
        return;
      }

      const formatted: CourseSection[] = (data || []).map((row: any) => {
        const meetings = row.course_section_meetings || [];
        const days = meetings.map((m: any) => mapMeetingDay(m.day));

        const sortedMeetings = [...meetings].sort((a: any, b: any) =>
          String(a.start_time).localeCompare(String(b.start_time))
        );

        const firstMeeting = sortedMeetings[0];
        const lastMeeting = sortedMeetings[sortedMeetings.length - 1];
        const formatTime = (value: string) => String(value).slice(0, 5);
        const courseInfo = Array.isArray(row.courses) ? row.courses[0] : row.courses;
        const courseName = courseInfo?.name || '';

        return {
          id: row.crn,
          crn: row.crn,
          courseCode: row.course_id.replace(/([A-Z]+)(\d+)/, '$1 $2'),
          courseName: courseName,
          section: row.section,
          sectionType: row.section_type,
          instructor: row.instructor || 'TBA',
          credits: row.credits,
          days,
          startTime: firstMeeting ? formatTime(firstMeeting.start_time) : '00:00',
          endTime: lastMeeting ? formatTime(lastMeeting.end_time) : '00:00',
          location: row.room || 'TBA',
          gender: row.gender,
        };
      });

      const userGenderCode =
        user.gender === 'Female' ? 'F' :
        user.gender === 'Male' ? 'M' :
        user.gender;

      const filteredByGender = formatted.filter(
        section => section.gender === userGenderCode
      );
      setDbSections(filteredByGender);
      setSectionsLoading(false);
    };  

  const loadCurriculumCourses = async () => {
    const userProgramCode = user.major;

    const { data, error } = await supabase
      .from('curriculum_section_courses')
      .select('course_id, degree_program_code')
      .eq('degree_program_code', userProgramCode);

    if (error) {
      console.error('Error loading curriculum courses:', error);
      toast.error('Failed to load curriculum courses');
      return;
    }

    const ids = new Set<string>();

    (data || []).forEach((row: any) => {
      ids.add(normalizeCourseCode(row.course_id));
    });

    setCurriculumCourseIds(ids);
  };

  const loadPrerequisites = async () => {
    const { data, error } = await supabase
      .from('course_prerequisites')
      .select('course_id, prerequisite_course_id');

    if (error) {
      console.error('Error loading prerequisites:', error);
      toast.error('Failed to load prerequisites');
      return;
    }

    const map: Record<string, string[]> = {};

    (data || []).forEach((row: any) => {
      const courseId = row.course_id.replace(/\s/g, '').toUpperCase();
      const prereqId = row.prerequisite_course_id.replace(/\s/g, '').toUpperCase();

      if (!map[courseId]) {
        map[courseId] = [];
      }

      map[courseId].push(prereqId);
    });
    
    setPrerequisiteMap(map);
  };

  const getDefaultDegreePlan = () => {
    return defaultPlan;
  };

  // Helper function to normalize course codes for comparison
  const normalizeCourseCode = (code: string) => {
    return String(code)
      .replace(/"/g, '')
      .replace(/\s+/g, '')
      .toUpperCase();
  };

  const getCurrentSemester = () => {
    const now = new Date();

    const month = now.getMonth() + 1; // 1–12
    const year = now.getFullYear();

    let term: 'Fall' | 'Spring' | 'Summer';
    let academicYearStart = year;
    let planKey = '';

    if (month >= 7 && month <= 10) {
      // July → October
      term = 'Fall';
      academicYearStart = year;
      planKey = `fall-${year}`;
    } else if (month >= 11 || month <= 2) {
      // Nov → Feb
      term = 'Spring';

      if (month <= 2) {
        academicYearStart = year - 1;
        planKey = `spring-${year}`;
      } else {
        academicYearStart = year;
        planKey = `spring-${year + 1}`;
      }
    } else {
      // March → June
      term = 'Summer';
      academicYearStart = year - 1;
      planKey = `summer-${year}`;
    }

    const academicYearEnd = academicYearStart + 1;

    return {
      term,
      label: `${term} ${academicYearStart}/${String(academicYearEnd).slice(2)}`,
      planKey,
    };
  };

  const getNextSemesterCourses = () => {
    const plan = getDefaultDegreePlan();
    if (!plan) return new Set<string>();
    
    const courses = new Set<string>();
    // Get all courses from uncompleted semesters only
    const semesters = Object.values(plan.semesters || {}) as any[];
    
    // Iterate through all semesters and only include courses from uncompleted ones
    for (const semester of semesters) {
      // Skip completed semesters
      if (semester.completed) continue;
      
      // Add courses from uncompleted semesters
      if (semester.courses && semester.courses.length > 0) {
        semester.courses.forEach((course: any) => {
          // Store normalized version for matching
          courses.add(normalizeCourseCode(course.code));
        });
      }
    }
    return courses;
  };

  // Get all courses that exist in the user's degree plan (for filtering "All Courses")
  const getAllPlanCourses = () => {
    const plan = getDefaultDegreePlan();
    if (!plan) return new Set<string>();
    
    const courses = new Set<string>();
    const semesters = Object.values(plan.semesters || {}) as any[];
    
    // Get all courses from the plan (completed and uncompleted)
    for (const semester of semesters) {
      if (semester.courses && semester.courses.length > 0) {
        semester.courses.forEach((course: any) => {
          courses.add(normalizeCourseCode(course.code));
        });
      }
    }
    return courses;
  };
  

  const getCompletedCourses = () => {
    const plan = getDefaultDegreePlan();
    if (!plan) return new Set<string>();

    const courses = new Set<string>();

    // Completed courses marked during course selection
    (plan.completedCourseIds || []).forEach((courseId: string) => {
      courses.add(normalizeCourseCode(courseId));
    });

    // Courses inside semesters marked as completed
    const semesters = Object.values(plan.semesters || {}) as any[];

    for (const semester of semesters) {
      if (!semester.completed) continue;

      if (semester.courses && semester.courses.length > 0) {
        semester.courses.forEach((course: any) => {
          courses.add(normalizeCourseCode(course.id || course.code));
        });
      }
    }

    return courses;
  };

  const getCurrentSemesterCourses = () => {
    const plan = getDefaultDegreePlan();

    if (!plan || !currentSemester) return new Set<string>();

    const semester = plan.semesters?.[currentSemester.planKey];

    if (!semester || !semester.courses) return new Set<string>();

    return new Set(
      semester.courses.map((course: any) =>
        normalizeCourseCode(course.id || course.code)
      )
    );
  };

  const getCurrentlyTakingCourses = () => {
    const plan = getDefaultDegreePlan();

    if (!plan || !currentSemester) return new Set<string>();

    const currentKey = currentSemester.planKey;

    const previousSemesterKey =
      currentKey.startsWith('summer-')
        ? currentKey.replace('summer-', 'spring-')
        : currentKey.startsWith('spring-')
          ? currentKey.replace('spring-', 'fall-')
          : currentKey.replace('fall-', 'summer-');

    const semester = plan.semesters?.[previousSemesterKey];

    if (!semester || !semester.courses) return new Set<string>();

    return new Set(
      semester.courses.map((course: any) =>
        normalizeCourseCode(course.id || course.code)
      )
    );
  };

  const canTakeCourse = (courseCode: string) => {
    const normalizedCode = courseCode.replace(/\s/g, '').toUpperCase();
    const requiredPrereqs = prerequisiteMap[normalizedCode] || [];
    if (!prerequisiteMap) return true;

    if (requiredPrereqs.length === 0) return true;

    const completedCourses = getCompletedCourses();

    return requiredPrereqs.every(prereqId => completedCourses.has(prereqId));
  };

  const getFilteredSections = () => {
    let filtered: Record<string, CourseSection[]> = {};

    const completedCourses = getCompletedCourses();
    const currentlyTakingCourses = getCurrentlyTakingCourses();

    if (courseFilter === 'all') {
      Object.entries(groupedSections).forEach(([courseCode, sections]) => {
        const normalizedCode = courseCode.replace(/\s/g, '').toUpperCase();

        const isInCurriculum = curriculumCourseIds.has(normalizedCode);
        const isCompleted = completedCourses.has(normalizedCode);
        const isCurrentlyTaking = currentlyTakingCourses.has(normalizedCode);
        const prerequisitesMet = canTakeCourse(courseCode);

        if (
          isInCurriculum &&
          !isCompleted && 
          !isCurrentlyTaking &&
          prerequisitesMet
        ) {
          filtered[courseCode] = sections;
        }
      });
    } else {
      const plan = getDefaultDegreePlan();

      if (!plan || !currentSemester) {
        return {};
      }

      const semester = plan.semesters?.[currentSemester.planKey];

      if (!semester || !semester.courses || semester.courses.length === 0) {
        return {};
      }

      const planCourseCodes = new Set(
        semester.courses.map((course: any) =>
          normalizeCourseCode(course.id || course.code)
        )
      );

      Object.entries(groupedSections).forEach(([courseCode, sections]) => {
        const normalizedCode = normalizeCourseCode(courseCode);

        if (planCourseCodes.has(normalizedCode)) {
          filtered[courseCode] = sections;
        }
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const searchFiltered: Record<string, CourseSection[]> = {};

      Object.entries(filtered).forEach(([courseCode, sections]) => {
        const courseName = sections[0]?.courseName.toLowerCase() || '';
        const code = courseCode.toLowerCase();

        if (code.includes(query) || courseName.includes(query)) {
          searchFiltered[courseCode] = sections;
        } else {
          const matchingSections = sections.filter(s =>
            s.instructor.toLowerCase().includes(query)
          );

          if (matchingSections.length > 0) {
            searchFiltered[courseCode] = matchingSections;
          }
        }
      });

      return searchFiltered;
    }

    return filtered;
  };

  const COLOR_PALETTE = [
    { bg: 'bg-blue-100', bgHard: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-900', textHard: 'text-white' },
    { bg: 'bg-green-100', bgHard: 'bg-green-500', border: 'border-green-500', text: 'text-green-900', textHard: 'text-white' },
    { bg: 'bg-purple-100', bgHard: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-900', textHard: 'text-white' },
    { bg: 'bg-orange-100', bgHard: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-900', textHard: 'text-white' },
    { bg: 'bg-pink-100', bgHard: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-900', textHard: 'text-white' },
    { bg: 'bg-cyan-100', bgHard: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-900', textHard: 'text-white' },
    { bg: 'bg-amber-100', bgHard: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-900', textHard: 'text-white' },
    { bg: 'bg-indigo-100', bgHard: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-900', textHard: 'text-white' },
    { bg: 'bg-teal-100', bgHard: 'bg-teal-500', border: 'border-teal-500', text: 'text-teal-900', textHard: 'text-white' },
    { bg: 'bg-rose-100', bgHard: 'bg-rose-500', border: 'border-rose-500', text: 'text-rose-900', textHard: 'text-white' },
  ];

  const getCourseColor = (courseCode: string) => {
    let hash = 0;
    for (let i = 0; i < courseCode.length; i++) {
      hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
  };

  const toggleSection = (sectionId: string) => {
    // Find the section to get its CRN
    const section = sectionsSource.find(s => s.id === sectionId);
    if (!section) return;
    
    // Find all sections with the same CRN (parts of the same course meeting at different times)
    const relatedSections = sectionsSource.filter(s => s.crn === section.crn);
    const relatedIds = relatedSections.map(s => s.id);
    
    const newAdded = new Set(addedSections);
    const newChosen = new Set(chosenSections);
    
    if (newAdded.has(sectionId)) {
      // Remove all related sections
      relatedIds.forEach(id => {
        newAdded.delete(id);
        newChosen.delete(id);
      });
      toast.success('Section removed from schedule');
    } else {
      // Add all related sections
      relatedIds.forEach(id => {
        newAdded.add(id);
      });
      toast.success('Section added to schedule');
    }
    
    setAddedSections(newAdded);
    setChosenSections(newChosen);
  };

  const toggleAllSectionsOfCourse = (courseCode: string) => {
    const sections = groupedSections[courseCode] || [];
    const anySectionAdded = sections.some(s => addedSections.has(s.id));
    
    const newAdded = new Set(addedSections);
    const newChosen = new Set(chosenSections);
    
    if (anySectionAdded) {
      // Remove all sections of this course
      sections.forEach(section => {
        newAdded.delete(section.id);
        newChosen.delete(section.id);
      });
      toast.success(`All ${courseCode} sections removed`);
    } else {
      // Add all sections of this course
      sections.forEach(section => {
        newAdded.add(section.id);
      });
      toast.success(`All ${courseCode} sections added`);
    }
    
    setAddedSections(newAdded);
    setChosenSections(newChosen);
  };

  const handleSectionClick = (section: CourseSection) => {
    const relatedSections = sectionsSource.filter(s => s.crn === section.crn);
    const relatedIds = relatedSections.map(s => s.id);

    const newChosen = new Set(chosenSections);

    if (newChosen.has(section.id)) {
      relatedIds.forEach(id => newChosen.delete(id));
      toast.info('Section unselected');
    } else {
      const courseSections = groupedSections[section.courseCode] || [];

      courseSections.forEach(s => {
        const isSameCourse = s.courseCode === section.courseCode;

        if (!isSameCourse) return;

        // If selected section is LEC_LAB, remove all LEC, LAB, and LEC_LAB for this course
        if (section.sectionType === 'LEC_LAB') {
          newChosen.delete(s.id);
          return;
        }

        // If selected section is LEC or LAB, remove same type and LEC_LAB
        if (s.sectionType === section.sectionType || s.sectionType === 'LEC_LAB') {
          newChosen.delete(s.id);
        }
      });

      relatedIds.forEach(id => newChosen.add(id));
      toast.success(`Selected ${section.courseCode} - ${section.instructor}`);
    }

    setChosenSections(newChosen);
  };

  const hasTimeConflict = (section1: CourseSection, section2: CourseSection) => {
    const hasCommonDay = section1.days.some(day => section2.days.includes(day));
    if (!hasCommonDay) return false;

    const start1 = section1.startTime;
    const end1 = section1.endTime;
    const start2 = section2.startTime;
    const end2 = section2.endTime;

    return (
      (start2 >= start1 && start2 < end1) ||
      (end2 > start1 && end2 <= end1) ||
      (start2 <= start1 && end2 >= end1)
    );
  };

  const getSectionState = (section: CourseSection): 'chosen' | 'possible' | 'impossible' => {
    if (!addedSections.has(section.id)) return 'impossible';

    if (chosenSections.has(section.id)) return 'chosen';

    const courseSections = groupedSections[section.courseCode] || [];

    const blockedBySameCourseChoice = courseSections.some(s => {
      if (s.id === section.id) return false;
      if (!chosenSections.has(s.id)) return false;

      // If another LEC_LAB is chosen, block all other sections for this course
      if (s.sectionType === 'LEC_LAB') return true;

      // If this section is LEC_LAB, block it when any LEC or LAB is already chosen
      if (section.sectionType === 'LEC_LAB') return true;

      // Normal rule: LEC blocks other LEC, LAB blocks other LAB
      return s.sectionType === section.sectionType;
    });

    if (blockedBySameCourseChoice) return 'impossible';

    const chosenSectionsList = sectionsSource.filter(s => chosenSections.has(s.id));
    for (const chosenSection of chosenSectionsList) {
      if (hasTimeConflict(section, chosenSection)) {
        return 'impossible';
      }
    }

    return 'possible';
  };

  const getVisibleSections = () => {
    return sectionsSource.filter(section => addedSections.has(section.id));
  };

  const getAddedCourses = () => {
    const courses = new Set<string>();
    addedSections.forEach(sectionId => {
      const section = sectionsSource.find(s => s.id === sectionId);
      if (section) courses.add(section.courseCode);
    });
    return courses;
  };

  const getTotalCreditHours = () => {
    const chosenSectionsList = sectionsSource.filter(s => chosenSections.has(s.id));
    // Remove duplicates by CRN to avoid counting credits multiple times
    const uniqueCRNs = new Map<string, CourseSection>();
    chosenSectionsList.forEach(section => {
      if (!uniqueCRNs.has(section.crn)) {
        uniqueCRNs.set(section.crn, section);
      }
    });
    return Array.from(uniqueCRNs.values()).reduce((total, section) => total + section.credits, 0);
  };

  const getLecLabWarnings = () => {
    const chosenSectionsList = sectionsSource.filter(s => chosenSections.has(s.id));
    const warnings: string[] = [];

    const chosenByCourse = new Map<string, CourseSection[]>();

    chosenSectionsList.forEach(section => {
      const existing = chosenByCourse.get(section.courseCode) || [];

      if (!existing.some(s => s.crn === section.crn)) {
        existing.push(section);
        chosenByCourse.set(section.courseCode, existing);
      }
    });

    chosenByCourse.forEach((sections, courseCode) => {
      const hasLecture = sections.some(s => s.sectionType === 'LEC');
      const hasLab = sections.some(s => s.sectionType === 'LAB');
      const hasCombined = sections.some(s => s.sectionType === 'LEC_LAB');

      const allCourseSections = sectionsSource.filter(s => s.courseCode === courseCode);
      const courseHasLabs = allCourseSections.some(s => s.sectionType === 'LAB');
      const courseHasLectures = allCourseSections.some(s => s.sectionType === 'LEC');

      if (hasCombined) return;

      if (courseHasLabs && courseHasLectures) {
        if (hasLecture && !hasLab) {
          warnings.push(`${courseCode}: Please select a lab.`);
        }

        if (hasLab && !hasLecture) {
          warnings.push(`${courseCode}: Please select a lecture.`);
        }
      }
    });

    return warnings;
  };

  const handleCopyCRNs = () => {
    const chosenSectionsList = sectionsSource.filter(s => chosenSections.has(s.id));
    // Remove duplicates by CRN (since sections with same CRN are now selected together)
    const uniqueCRNs = new Map<string, CourseSection>();
    chosenSectionsList.forEach(section => {
      if (!uniqueCRNs.has(section.crn)) {
        uniqueCRNs.set(section.crn, section);
      }
    });
    const crns = Array.from(uniqueCRNs.values()).map(s => `${s.courseCode} ${s.courseName}: ${s.crn}`).join('\n');
    if (crns) {
      navigator.clipboard.writeText(crns);
      toast.success('CRNs copied to clipboard!');
    } else {
      toast.error('No sections selected');
    }
  };

  const handlePrintSchedule = () => {
    // Add print styles temporarily
    const style = document.createElement('style');
    style.id = 'print-styles';
    style.textContent = `
      @media print {
        @page {
          size: landscape;
          margin: 0.5in;
        }

        body * {
          visibility: hidden;
        }

        #weekly-schedule-print,
        #weekly-schedule-print * {
          visibility: visible;
        }

        #weekly-schedule-print {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          max-width: none;
          box-shadow: none;
          border: none;
        }

        #weekly-schedule-print .h-\\[calc\\(100vh-260px\\)\\] {
          height: auto !important;
          overflow: visible !important;
        }

        #weekly-schedule-print .overflow-auto {
          overflow: visible !important;
        }

        #weekly-schedule-print .grid {
          page-break-inside: avoid;
        }

        button {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Print
    window.print();
    
    // Remove print styles after a delay
    setTimeout(() => {
      const styleElement = document.getElementById('print-styles');
      if (styleElement) {
        styleElement.remove();
      }
    }, 1000);
    
    toast.success('Opening print dialog...');
  };

  const handleSaveSchedule = async () => {
    const chosenSectionsList = sectionsSource.filter(s => chosenSections.has(s.id));

    const validationErrors: string[] = [];

    const chosenByCourse = new Map<string, CourseSection[]>();
    chosenSectionsList.forEach(section => {
      const existing = chosenByCourse.get(section.courseCode) || [];
      if (!existing.some(s => s.crn === section.crn)) {
        existing.push(section);
        chosenByCourse.set(section.courseCode, existing);
      }
    });

    chosenByCourse.forEach((sections, courseCode) => {
      const hasLecture = sections.some(s => s.sectionType === 'LEC');
      const hasLab = sections.some(s => s.sectionType === 'LAB');
      const hasCombined = sections.some(s => s.sectionType === 'LEC_LAB');

      const allCourseSections = sectionsSource.filter(s => s.courseCode === courseCode);
      const courseHasLabs = allCourseSections.some(s => s.sectionType === 'LAB');

      // LEC_LAB counts as complete by itself
      if (hasCombined) return;

      if (courseHasLabs) {
        if (hasLecture && !hasLab) {
          validationErrors.push(`${courseCode}: You must select a lab section to go with the lecture`);
        } else if (hasLab && !hasLecture) {
          validationErrors.push(`${courseCode}: You must select a lecture section to go with the lab`);
        }
      }
    });

    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast.error(error, { duration: 5000 }));
      return;
    }

    const chosenCrns = Array.from(
      new Set(chosenSectionsList.map(section => section.crn))
    );

    if (chosenCrns.length === 0) {
      toast.error('No sections selected');
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;

    if (!authUser) {
      toast.error('You must be logged in');
      return;
    }

    const scheduleName = `Schedule ${savedSchedules.length + 1}`;

    const { data: savedSchedule, error: scheduleError } = await supabase
      .from('saved_schedules')
      .insert({
        user_id: authUser.id,
        name: scheduleName,
      })
      .select()
      .single();

    if (scheduleError || !savedSchedule) {
      console.error('Error saving schedule:', scheduleError);
      toast.error('Failed to save schedule');
      return;
    }

    const sectionRows = chosenCrns.map(crn => ({
      saved_schedule_id: savedSchedule.id,
      crn,
    }));

    const { error: sectionsError } = await supabase
      .from('saved_schedule_sections')
      .insert(sectionRows);

    if (sectionsError) {
      console.error('Error saving schedule sections:', sectionsError);
      toast.error('Failed to save schedule sections');
      return;
    }

    await loadSavedSchedules();
    toast.success('Schedule saved successfully!');
  };

  const handleLoadSchedule = (schedule: any) => {
    const chosenCrns = new Set(schedule.chosenSectionIds || []);

    const matchingSectionIds = sectionsSource
      .filter(section => chosenCrns.has(section.crn))
      .map(section => section.id);

    const chosenIds = new Set(matchingSectionIds);

    setAddedSections(chosenIds);
    setChosenSections(chosenIds);
    toast.success('Schedule loaded!');
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    const { error } = await supabase
      .from('saved_schedules')
      .delete()
      .eq('id', Number(scheduleId));

    if (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
      return;
    }

    await loadSavedSchedules();
    toast.success('Schedule deleted!');
  };

  const handleResetSchedule = () => {
    setAddedSections(new Set());
    setChosenSections(new Set());
    toast.success('Schedule reset! Start building a new schedule.');
  };

  const handleGenerateAISchedule = async () => {
    setAiGenerating(true);

  const response = await fetch("http://127.0.0.1:5000/generate-schedule", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    course_ids: Array.from(getAddedCourses()).map((code) =>
    normalizeCourseCode(code)
  ),
    preferences: aiPrompt,
  }),
});

const data = await response.json();

console.log("Backend schedule result:", data);

if (!data.options || data.options.length === 0) {
  setAiScheduleOptions([]);
  setAiGenerating(false);

  data.explanations.forEach((reason: string) => {
  toast.error(reason, {
    duration: 10000,
    style: {
      whiteSpace: "normal",
      wordBreak: "break-word",
      maxWidth: "500px",
      lineHeight: "1.4",
    },
  });
});

  return;
}

const backendOptions: AIScheduleOption[] = data.options.map((option: any, index: number) => {
  const optionSections = option.sections
    .map((backendSection: any) => {
      const crn = backendSection.crn;
      return sectionsSource.find((section) => section.crn === crn);
    })
    .filter(Boolean) as CourseSection[];

  //show skipped courses
  if (option.skipped_courses && option.skipped_courses.length > 0) {
    toast.warning(
  <div className="whitespace-normal break-words max-w-md leading-snug">
    Option {index + 1}: Removed {option.skipped_courses.join(", ")} due to time conflicts.
  </div>,
  { duration: 6000 }
);
  }

  return {
    id: `backend-option-${index}`,
    sections: optionSections,
    skipped_courses: option.skipped_courses || [],
  };
});

setAiScheduleOptions(backendOptions);
setSelectedAIOption(0);
setAiGenerating(false);
toast.success(`Generated ${backendOptions.length} schedule option(s)!`);
return;
    
    // If no sections added, automatically add sections from degree plan or all courses
    let sectionsToUse = new Set(addedSections);
    let autoAddedMessage = '';
    
    if (sectionsToUse.size === 0) {
      const nextSemesterCourses = getNextSemesterCourses();
      
      if (nextSemesterCourses.size > 0) {
        // Add all sections from degree plan courses
        Object.entries(groupedSections).forEach(([courseCode, sections]) => {
          const normalizedCode = normalizeCourseCode(courseCode);
          if (nextSemesterCourses.has(normalizedCode)) {
            sections.forEach(section => sectionsToUse.add(section.id));
          }
        });
        autoAddedMessage = 'Using courses from your Degree Plan. ';
      } else {
        // Add all sections from all courses
        Object.values(groupedSections).forEach(sections => {
          sections.forEach(section => sectionsToUse.add(section.id));
        });
        autoAddedMessage = 'Using all available courses. ';
      }
      
      // Update the state
      setAddedSections(sectionsToUse);
    }
    
    toast.info(autoAddedMessage + 'AI is generating optimal schedules...');
    
    setTimeout(() => {
      // Generate 3 different schedule options
      const options: AIScheduleOption[] = [];
      const addedCoursesList = getAddedCourses();
      
      for (let i = 0; i < 3; i++) {
        const scheduleSections: CourseSection[] = [];
        const chosenIds = new Set<string>();
        
        addedCoursesList.forEach(courseCode => {
          const sections = groupedSections[courseCode] || [];
          const addedCourseSections = sections.filter(s => sectionsToUse.has(s.id));
          
          // Apply different strategies for each option
          let filtered = [...addedCourseSections];
          
          if (i === 0) {
            // Option 1: Prefer MW classes
            filtered.sort((a, b) => {
              const aMW = a.days.includes('Monday') && a.days.includes('Wednesday');
              const bMW = b.days.includes('Monday') && b.days.includes('Wednesday');
              if (aMW && !bMW) return -1;
              if (!aMW && bMW) return 1;
              return 0;
            });
          } else if (i === 1) {
            // Option 2: Prefer TTh classes
            filtered.sort((a, b) => {
              const aTTh = a.days.includes('Tuesday') && a.days.includes('Thursday');
              const bTTh = b.days.includes('Tuesday') && b.days.includes('Thursday');
              if (aTTh && !bTTh) return -1;
              if (!aTTh && bTTh) return 1;
              return 0;
            });
          } else {
            // Option 3: Prefer compact schedule
            filtered.sort((a, b) => {
              const aStart = parseInt(a.startTime.replace(':', ''));
              const bStart = parseInt(b.startTime.replace(':', ''));
              return aStart - bStart;
            });
          }
          
          // Pick first non-conflicting section
          for (const section of filtered) {
            const hasConflict = scheduleSections.some(chosen => hasTimeConflict(section, chosen));
            if (!hasConflict) {
              scheduleSections.push(section);
              chosenIds.add(section.id);
              break;
            }
          }
        });
        
        if (scheduleSections.length > 0) {
          options.push({
            id: `option-${i}`,
            sections: scheduleSections,
          });
        }
      }
      
      setAiScheduleOptions(options);
      setSelectedAIOption(0);
      setAiGenerating(false);
      toast.success(`Generated ${options.length} schedule options!`);
    }, 1500);
  };

  const handleApplyAISchedule = () => {
    if (aiScheduleOptions.length === 0) return;

    const selectedOption = aiScheduleOptions[selectedAIOption];
    if (!selectedOption) return;

    const sectionIds = new Set(selectedOption.sections.map(s => s.id));

    setAddedSections(sectionIds);
    setChosenSections(sectionIds);
    setShowAIDialog(false);
    setAiScheduleOptions([]);
    setAiPrompt('');
    setPreviewingAI(false);
    toast.success('Schedule applied! You can now edit it.');
  };

  const handleCancelAI = () => {
    setShowAIDialog(false);
    setAiScheduleOptions([]);
    setAiPrompt('');
    setPreviewingAI(false);
    setAiGenerating(false);
  };

  const getTimeSlotPosition = (time: string) => {
    return TIME_SLOTS.indexOf(time);
  };

  // Convert time string (HH:MM) to minutes since start of day (08:00)
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const startOfDay = 8 * 60; // 08:00 in minutes
    return totalMinutes - startOfDay;
  };

  const getCourseHeight = (startTime: string, endTime: string) => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const durationMinutes = endMinutes - startMinutes;
    // Each 30-minute slot is 17px tall (balanced compact view)
    return (durationMinutes / 30) * 17;
  };

  const getCourseTopPosition = (startTime: string, slotTime: string) => {
    const slotMinutes = timeToMinutes(slotTime);
    const startMinutes = timeToMinutes(startTime);
    const offsetMinutes = startMinutes - slotMinutes;
    // Convert minutes to pixels (17px per 30 minutes)
    return (offsetMinutes / 30) * 17 + 2; // +2 for padding
  };

  if (sectionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4 flex items-center justify-center">
        <p>Loading sections...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
      <div className="container mx-auto max-w-7xl">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl">Semester Schedule</h1>
            <p className="text-slate-600">
              {currentSemester ? currentSemester.label : 'Upcoming Semester'}
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  Saved Schedules
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                {savedSchedules.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    No saved schedules yet
                  </div>
                ) : (
                  <>
                    {savedSchedules.map((schedule, index) => (
                      <DropdownMenuItem
                        key={schedule.id}
                        className="flex items-center justify-between p-3 cursor-pointer"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => handleLoadSchedule(schedule)}
                        >
                          <div className="font-medium text-sm">
                            {schedule.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {schedule.sections?.length || 0} courses • {new Date(schedule.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSchedule(schedule.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={showAIDialog} onOpenChange={(open) => {
              if (!open) handleCancelAI();
              else setShowAIDialog(open);
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Generate
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>AI Schedule Generator</DialogTitle>
                  <DialogDescription>
                    Describe your preferences (optional) and we'll generate optimal schedule options for you
                  </DialogDescription>
                </DialogHeader>
                
                {aiScheduleOptions.length === 0 ? (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-prompt">Your Preferences (Optional)</Label>
                      <Textarea
                        id="ai-prompt"
                        placeholder="e.g., I prefer morning classes, no Friday classes, prefer Dr. Johnson, compact schedule with minimal gaps..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        rows={5}
                        className="resize-none"
                      />
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={handleGenerateAISchedule}
                      disabled={aiGenerating}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {aiGenerating ? 'Generating...' : 'Generate Schedules'}
                    </Button>
                    
                    {addedSections.size === 0 && (
                      <p className="text-sm text-center text-slate-500">
                        No courses selected. AI will use your Degree Plan courses or all available courses.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Generated Schedule Options ({aiScheduleOptions.length})</h3>
                      <Button variant="ghost" size="sm" onClick={() => setAiScheduleOptions([])}>
                        <X className="w-4 h-4 mr-1" />
                        Start Over
                      </Button>
                    </div>

                    {/* Carousel */}
                    <div className="relative">
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setSelectedAIOption(prev => Math.max(0, prev - 1))}
                          disabled={selectedAIOption === 0}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>

                        <Card 
                          className="flex-1 cursor-pointer transition-all hover:shadow-lg"
                          onClick={() => setPreviewingAI(!previewingAI)}
                        >
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">
                                Option {selectedAIOption + 1}
                              </CardTitle>
                              <Badge variant="secondary">
                                {aiScheduleOptions[selectedAIOption]?.sections.length} courses
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {!previewingAI ? (
                              <div className="space-y-3">
                                {(aiScheduleOptions[selectedAIOption]?.sections || []).map((section) => {
                                  const color = getCourseColor(section.courseCode);
                                  return (
                                    <div 
                                      key={section.id}
                                      className={`p-3 rounded-lg border ${color.border} ${color.bg}`}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="font-medium">
                                            {section.courseName
                                              ? `${section.courseCode} - ${section.courseName}`
                                              : section.courseCode}
                                          </div>
                                          <div className="text-sm text-slate-600 mt-1">  {section.sectionType} {section.section} • {section.instructor}</div>
                                          <div className="text-xs text-slate-500 mt-1">
                                            {section.days.map(d => d.substring(0, 3)).join(', ')} • {section.startTime} - {section.endTime}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {aiScheduleOptions[selectedAIOption]?.skipped_courses &&
                                aiScheduleOptions[selectedAIOption].skipped_courses.length > 0 && (
                                <div className="text-sm text-red-500 mt-2 whitespace-normal break-words">
                                Skipped: {aiScheduleOptions[selectedAIOption].skipped_courses.join(", ")} (time conflict)
                                </div>
                                )}
                                <p className="text-xs text-center text-slate-500 mt-4">
                                  Click card to preview on weekly grid
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-sm text-center text-slate-600">Visual Preview</p>
                                {/* Mini Weekly Grid Preview */}
                                <div className="border rounded-lg overflow-hidden bg-white">
                                  <div className="grid grid-cols-6 gap-px bg-slate-200">
                                    <div className="bg-slate-50 p-1 text-xs"></div>
                                    {DAYS.map(day => (
                                      <div key={day} className="bg-slate-50 p-1 text-xs text-center">
                                        {day.substring(0, 3)}
                                      </div>
                                    ))}
                                    
                                    {['08:00', '10:00', '12:00', '14:00', '16:00'].flatMap(time => [
                                      <div key={`time-${time}`} className="bg-white p-1 text-xs text-slate-500">{time}</div>,
                                      ...DAYS.map(day => {
                                        const sectionsAtTime = (aiScheduleOptions[selectedAIOption]?.sections || []).filter(
                                          (s: CourseSection) =>
                                            s.days.includes(day) &&
                                            s.startTime <= time &&
                                            s.endTime > time
                                        );
                                        const section = sectionsAtTime?.[0];
                                        const color = section ? getCourseColor(section.courseCode) : null;
                                        
                                        return (
                                          <div key={`${time}-${day}`} className="bg-white p-1 relative min-h-[30px]">
                                            {section && (
                                              <div className={`text-[8px] p-1 rounded ${color?.bgHard} ${color?.textHard}`}>
                                                {section.courseCode}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    ])}
                                  </div>
                                </div>
                                <p className="text-xs text-center text-slate-500 mt-2">
                                  Click card again to see course details
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setSelectedAIOption(prev => Math.min(aiScheduleOptions.length - 1, prev + 1))}
                          disabled={selectedAIOption === aiScheduleOptions.length - 1}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex justify-center gap-2 mt-4">
                        {aiScheduleOptions.map((_, index) => (
                          <div
                            key={index}
                            className={`h-2 w-2 rounded-full transition-all ${
                              index === selectedAIOption ? 'bg-[#E87722] w-6' : 'bg-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button variant="outline" className="flex-1" onClick={handleCancelAI}>
                        Cancel
                      </Button>
                      <Button className="flex-1" onClick={handleApplyAISchedule}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Apply Schedule
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={handleResetSchedule} disabled={addedSections.size === 0}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyCRNs} disabled={chosenSections.size === 0}>
              <Copy className="w-4 h-4 mr-2" />
              Copy CRNs
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrintSchedule} disabled={chosenSections.size === 0}>
              <Download className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button size="sm" onClick={handleSaveSchedule} disabled={chosenSections.size === 0}>
              Save Schedule
            </Button>
          </div>
        </div>

        {/* HORIZONTAL LAYOUT - Courses LEFT, Schedule Grid RIGHT */}
        <div className="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-6">
          
          {/* LEFT SIDE - Section List */}
          <Card className="h-fit md:sticky md:top-4">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle>Available Sections</CardTitle>
              </div>
              
              <Tabs value={courseFilter} onValueChange={(v) => setCourseFilter(v as 'all' | 'degree-plan')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="all">All Courses</TabsTrigger>
                  <TabsTrigger value="degree-plan">
                    <Filter className="w-3 h-3 mr-1" />
                    Degree Plan
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by course code, name, or instructor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <p className="text-xs text-slate-600 mt-2">Click sections to add/remove from schedule</p>
            </CardHeader>
            <CardContent>
              <div className="h-[calc(100vh-340px)] overflow-y-auto pr-2"> 
                <div className="space-y-2">
                  {Object.entries(getFilteredSections()).length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      {courseFilter === 'degree-plan' 
                        ? 'No courses found from uncompleted semesters in your starred degree plan. Make sure you have a starred plan with uncompleted courses.'
                        : 'No courses available'
                      }
                    </div>
                  ) : (
                    Object.entries(getFilteredSections()).map(([courseCode, sections]) => {
                    const color = getCourseColor(courseCode);
                    
                    return (
                      <div key={courseCode} className="space-y-1.5">
                        <div 
                          className="flex items-center gap-2 px-2 cursor-pointer hover:bg-slate-50 rounded py-1 transition-colors group"
                          onClick={() => toggleAllSectionsOfCourse(courseCode)}
                          title="Click to add/remove all sections"
                        >
                          <div className={`w-2.5 h-2.5 rounded-sm ${color.bg} border ${color.border}`}></div>
                          <h4 className="font-medium text-xs flex-1">{courseCode} - {sections[0].courseName}</h4>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {sections[0].credits} cr
                          </Badge>
                          <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            {sections.some(s => addedSections.has(s.id)) ? 'Remove all' : 'Add all'}
                          </span>
                        </div>
                        
                        {sections.map(section => {
                          const isAdded = addedSections.has(section.id);
                          
                          return (
                            <div
                              key={section.id}
                              onClick={() => toggleSection(section.id)}
                              className={`border rounded-lg p-2 ml-4 cursor-pointer transition-all ${
                                isAdded 
                                  ? `${color.bg} ${color.border} shadow-sm` 
                                  : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-medium">
                                    {section.sectionType} {section.section} • CRN: {section.crn}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                                    {section.days.map(d => d.substring(0, 3)).join(', ')}
                                  </Badge>
                                </div>
                                <p className="text-[10px] text-slate-600">{section.instructor}</p>
                                <p className="text-[10px] text-slate-500">
                                  {section.startTime} - {section.endTime}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                  )}
                </div>
              </div> 
            </CardContent>
          </Card>

          {/* RIGHT SIDE - Schedule Grid */}
          <Card id="weekly-schedule-print">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Weekly Schedule</CardTitle>
                <Badge variant="secondary">
                  {getTotalCreditHours()} credit hour{getTotalCreditHours() !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  {addedSections.size === 0 
                    ? 'Select sections from the list to build your schedule'
                    : 'Click on sections in the grid to select them'
                  }
                </p>
                {getLecLabWarnings().length > 0 && (
                  <div className="space-y-1">
                    {getLecLabWarnings().map((warning) => (
                      <p key={warning} className="text-xs text-orange-600">
                        ⚠️ {warning}
                      </p>
                    ))}
                  </div>
                )}
                {addedSections.size > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {Array.from(getAddedCourses()).sort().map(courseCode => {
                      const color = getCourseColor(courseCode);
                      const sections = groupedSections[courseCode] || [];
                      const chosenSection = sections.find(s => chosenSections.has(s.id));
                      
                      return (
                        <div key={courseCode} className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-sm ${color.bg} border ${color.border}`}></div>
                          <div className="flex flex-col">
                            <span className="text-xs font-medium">{courseCode}</span>
                            {chosenSection && (
                              <span className="text-[10px] text-slate-500">
                                {chosenSection.sectionType} {chosenSection.section} • {chosenSection.instructor}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <div className="h-[calc(100vh-260px)] overflow-auto">
                <div className="relative pb-2">
                  <div className="grid grid-cols-[45px_repeat(5,1fr)] gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-white p-0.5"></div>
                    {DAYS.map(day => (
                      <div key={day} className="bg-slate-50 p-1 text-center">
                        <span className="text-[10px]">{day.substring(0, 3)}</span>
                      </div>
                    ))}

                    {TIME_SLOTS.flatMap(time => [
                      <div key={`time-${time}`} className="bg-white p-1 text-[10px] text-slate-500 text-right">
                        {time}
                      </div>,
                      ...DAYS.map(day => {
                        // Get all sections for this day that start at or within this time slot
                        // A time slot represents a 60-minute period starting at 'time' (now showing only full hours)
                        const timeMinutes = timeToMinutes(time);
                        const nextSlotMinutes = timeMinutes + 60;
                        
                        const sectionsAtTimeAndDay = getVisibleSections()
                          .filter(section => {
                            if (!section.days.includes(day)) return false;
                            const sectionStartMinutes = timeToMinutes(section.startTime);
                            // Include section if it starts within this 60-minute slot
                            return sectionStartMinutes >= timeMinutes && sectionStartMinutes < nextSlotMinutes;
                          });
                        
                        // Build overlap groups: find all sections on this day that overlap with each other
                        const allSectionsOnDay = getVisibleSections().filter(s => s.days.includes(day));
                        const overlapGroups = new Map<string, Set<string>>(); // section.id -> Set of overlapping section IDs
                        
                        allSectionsOnDay.forEach(section => {
                          const sectionStart = timeToMinutes(section.startTime);
                          const sectionEnd = timeToMinutes(section.endTime);
                          
                          const overlappingIds = new Set<string>([section.id]);
                          
                          allSectionsOnDay.forEach(otherSection => {
                            if (otherSection.id === section.id) return;
                            
                            const otherStart = timeToMinutes(otherSection.startTime);
                            const otherEnd = timeToMinutes(otherSection.endTime);
                            
                            // Check if time ranges overlap
                            if (sectionStart < otherEnd && sectionEnd > otherStart) {
                              overlappingIds.add(otherSection.id);
                            }
                          });
                          
                          overlapGroups.set(section.id, overlappingIds);
                        });
                        
                        // Merge overlap groups to ensure consistency
                        // If A overlaps with B and B overlaps with C, then A, B, C should all be in the same group
                        const processedSections = new Set<string>();
                        const finalOverlapGroups = new Map<string, string[]>(); // section.id -> sorted array of all IDs in group
                        
                        allSectionsOnDay.forEach(section => {
                          if (processedSections.has(section.id)) return;
                          
                          // Find all sections in this overlap group using BFS
                          const group = new Set<string>();
                          const queue = [section.id];
                          
                          while (queue.length > 0) {
                            const currentId = queue.shift()!;
                            if (group.has(currentId)) continue;
                            
                            group.add(currentId);
                            processedSections.add(currentId);
                            
                            const overlappingIds = overlapGroups.get(currentId);
                            if (overlappingIds) {
                              overlappingIds.forEach(id => {
                                if (!group.has(id)) {
                                  queue.push(id);
                                }
                              });
                            }
                          }
                          
                          // Sort the group for consistent ordering
                          const sortedGroup = Array.from(group).sort();
                          
                          // Assign this sorted group to all sections in it
                          sortedGroup.forEach(id => {
                            finalOverlapGroups.set(id, sortedGroup);
                          });
                        });
                        
                        const totalSections = sectionsAtTimeAndDay.length;
                        
                        return (
                          <div key={`${time}-${day}`} className="bg-white p-0.5 min-h-[34px] relative">
                            {sectionsAtTimeAndDay.map((section, index) => {
                              const state = getSectionState(section);
                              const color = getCourseColor(section.courseCode);
                              
                              let bgClass = color.bg;
                              let textClass = color.text;
                              let opacity = 'opacity-100';
                              let cursor = 'cursor-pointer';
                              
                              if (state === 'chosen') {
                                bgClass = color.bgHard;
                                textClass = color.textHard;
                              } else if (state === 'impossible') {
                                opacity = 'opacity-30';
                                cursor = 'cursor-not-allowed';
                              } else {
                                // possible
                                opacity = 'opacity-70';
                              }

                              // Get the overlap group for this section
                              const overlapGroup = finalOverlapGroups.get(section.id) || [section.id];
                              const numOverlaps = overlapGroup.length;
                              const overlapIndex = overlapGroup.indexOf(section.id);
                              const widthPercent = numOverlaps > 1 ? 100 / numOverlaps : 100;
                              const leftPercent = numOverlaps > 1 ? (100 / numOverlaps) * overlapIndex : 0;

                              return (
                                <div
                                  key={section.id}
                                  onClick={() => {
                                    if (state !== 'impossible') {
                                      handleSectionClick(section);
                                    }
                                  }}
                                  className={`absolute ${bgClass} border-l-2 ${color.border} rounded p-0.5 text-xs overflow-hidden ${cursor} hover:shadow-lg transition-all ${opacity} group`}
                                  style={{
                                    height: `${getCourseHeight(section.startTime, section.endTime)}px`,
                                    width: `calc(${widthPercent}% - ${totalSections > 1 ? '4px' : '6px'})`,
                                    left: `calc(${leftPercent}% + 2px)`,
                                    top: `${getCourseTopPosition(section.startTime, time)}px`,
                                    zIndex: state === 'chosen' ? 20 : 10,
                                  }}
                                  title={state === 'chosen' ? 'Click to unselect' : state === 'possible' ? 'Click to select' : 'Unavailable'}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSection(section.id);
                                    }}
                                    className={`absolute top-0 right-0 w-3 h-3 ${textClass} opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 hover:scale-110`}
                                    title="Remove from schedule"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                  <div className={`font-medium text-[8px] leading-tight ${textClass}`}>{section.courseName}</div>
                                  <div className={`${textClass} truncate text-[7px] leading-tight`}>{section.instructor}</div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })
                    ])}
                  </div>
                </div>
              </div> 
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
