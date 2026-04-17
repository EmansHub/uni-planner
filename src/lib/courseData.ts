import { supabase } from "./supabase";

export type CourseSection = {
  crn: string;
  course_id: string;
  section: string;
  section_type: string;
  instructor: string | null;
  room: string | null;
  credits: number;
};

export type CourseMeeting = {
  crn: string;
  day: string;
  start_time: string;
  end_time: string;
};

export type SectionWithMeetings = CourseSection & {
  meetings: CourseMeeting[];
};

export async function fetchSectionsWithMeetings(): Promise<SectionWithMeetings[]> {
  const { data: sections, error: sectionsError } = await supabase
    .from("course_sections")
    .select("*")
    .order("course_id", { ascending: true });

  if (sectionsError) {
    throw new Error(sectionsError.message);
  }

  const { data: meetings, error: meetingsError } = await supabase
    .from("course_section_meetings")
    .select("*");

  if (meetingsError) {
    throw new Error(meetingsError.message);
  }

  const meetingsByCrn: Record<string, CourseMeeting[]> = {};

  for (const meeting of meetings ?? []) {
    if (!meetingsByCrn[meeting.crn]) {
      meetingsByCrn[meeting.crn] = [];
    }
    meetingsByCrn[meeting.crn].push(meeting);
  }

  return (sections ?? []).map((section) => ({
    ...section,
    meetings: meetingsByCrn[section.crn] ?? [],
  }));
}
