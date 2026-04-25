from scraper import scrape_courses
from supabase_client import supabase


def get_existing_courses_map():
    response = supabase.table("courses").select("id, name, credits").execute()

    courses_map = {}
    for row in response.data:
        course_id = row.get("id")
        if course_id is not None:
            courses_map[course_id] = row

    return courses_map

def run_pmu_sync():
    scraped = scrape_courses()

    sections_data = scraped.get("sections_data", [])
    meetings_data = scraped.get("meetings_data", [])
    
    print("SYNC DEBUG - sections_data:", len(sections_data))
    print("SYNC DEBUG - meetings_data:", len(meetings_data))

    if not sections_data:
        return {
            "message": "No sections were scraped",
            "courses_updated": 0,
            "sections_upserted": 0,
            "meetings_upserted": 0,
            "missing_courses": []
        }

    existing_courses = get_existing_courses_map()

    # Only allow sections for courses that already exist in courses table
    valid_course_ids = set()
    missing_courses = []

    for section in sections_data:
        course_id = section.get("course_id")
        course_title = section.get("course_title")

        if course_id in existing_courses:
            valid_course_ids.add(course_id)
        else:
            missing_courses.append({
                "id": course_id,
                "name": course_title
            })

    # Deduplicate missing courses by id
    missing_courses_map = {}
    for item in missing_courses:
        course_id = item.get("id")
        if course_id:
            missing_courses_map[course_id] = item
    missing_courses = list(missing_courses_map.values())

    course_response = None

    # Keep only sections whose course already exists in courses table
    enriched_sections = []
    valid_crns = set()

    for section in sections_data:
        course_id = section.get("course_id")
        crn = section.get("crn")

        if course_id in valid_course_ids and crn:
            valid_crns.add(crn)

            section_type = section.get("section_type")
            section_credits = 0 if section_type == "LAB" else existing_courses[course_id]["credits"]

            enriched_sections.append({
                "crn": crn,
                "course_id": course_id,
                "section": section.get("section"),
                "section_type": section_type,
                "instructor": section.get("instructor"),
                "room": section.get("room"),
                "credits": section_credits,
                "gender": section.get("gender")
            })

    # Deduplicate sections by CRN
    sections_map = {}
    for item in enriched_sections:
        crn = item.get("crn")
        if crn:
            sections_map[crn] = item
    enriched_sections = list(sections_map.values())

    # Keep only meetings whose section is being inserted
    filtered_meetings = [
        meeting for meeting in meetings_data
        if meeting.get("crn") in valid_crns
    ]

    # Deduplicate meetings by (crn, day, start_time)
    meetings_map = {}
    for item in filtered_meetings:
        key = (item.get("crn"), item.get("day"), item.get("start_time"))
        if all(key):
            meetings_map[key] = item
    filtered_meetings = list(meetings_map.values())

    if not enriched_sections:
        return {
            "message": "No valid sections matched existing courses",
            "courses_updated": len(course_response.data) if course_response and course_response.data else 0,
            "sections_upserted": 0,
            "meetings_upserted": 0,
            "missing_courses": missing_courses
        }

    # Clear old scraped offerings first
    clear_meetings_response = supabase.table("course_section_meetings").delete().neq("crn", "").execute()
    clear_sections_response = supabase.table("course_sections").delete().neq("crn", "").execute()

    section_response = supabase.table("course_sections").insert(enriched_sections).execute()
    meeting_response = supabase.table("course_section_meetings").insert(filtered_meetings).execute()

    return {
        "message": "PMU sync finished successfully",
        "courses_updated": len(course_response.data) if course_response and course_response.data else 0,
        "sections_upserted": len(section_response.data) if section_response.data else 0,
        "meetings_upserted": len(meeting_response.data) if meeting_response.data else 0,
        "scraped_course_count": len(valid_course_ids),
        "scraped_section_count": len(enriched_sections),
        "scraped_meeting_count": len(filtered_meetings),
        "missing_courses": missing_courses
    }