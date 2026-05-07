from flask import Flask, jsonify
from scraper import scrape_courses
from sync_service import run_pmu_sync
from apscheduler.schedulers.background import BackgroundScheduler
from flask import request
from openai import OpenAI
import os
from flask_cors import CORS
from supabase_client import supabase
import re
from PyPDF2 import PdfReader
import io
import base64
import json


app = Flask(__name__)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
CORS(app)

scheduler = BackgroundScheduler()
# Run once every 24 hours
scheduler.add_job(run_pmu_sync, 'interval', days=1)
scheduler.start()


def get_faq_reply(message: str):
    lower = message.lower().strip()

    if "password" in lower or "reset" in lower:
        return 'To reset your password, click "Forgot Password" on the login page and follow the reset steps.'

    if "profile" in lower or "edit profile" in lower:
        return "You can edit your profile from the user profile page after logging in."

    if "degree plan" in lower or "plan" in lower:
        return "Go to Degree Planning from the dashboard to create, manage, or edit your degree plan."

    if "schedule" in lower or "semester schedule" in lower or "class schedule" in lower:
        return "Go to Semester Schedule from the dashboard to build, save, and manage your semester schedule."

    if "saved schedule" in lower or "saved schedules" in lower:
        return "You can open your saved schedules from the Semester Schedule page."

    if "ai" in lower or "generate" in lower:
        return "Uni Planner includes AI features for generating degree plans and semester schedules based on your needs."

    if "prerequisite" in lower or "prerequisites" in lower:
        return "Prerequisites are course requirements you usually need to complete before taking another course."

    return None

# --- helper function ---
def build_user_context(user_id):
    lines = []

    try:
        user_res = (
            supabase.table("users") 
            .select("id, name, email, major, enrollment_semester") 
            .eq("id", user_id)
            .single() 
            .execute()
        )    

        user = user_res.data
        if user:
            lines.append(f"Student name: {user.get('name')}")
            lines.append(f"Major: {user.get('major')}")
            lines.append(f"Enrollment semester: {user.get('enrollment_semester')}")

        plan_res = (
            supabase.table("degree_plans")
            .select("id, name, degree_program_code, is_default")
            .eq("user_id", user_id)
            .eq("is_default", True)
            .limit(1)
            .execute()
        )
        
        plans = plan_res.data or []
        if plans:
            default_plan = plans[0]
            lines.append(f"Default degree plan: {default_plan.get('name')}")
            
        saved_sched_res = (
            supabase.table("saved_schedules") 
            .select("id", count="exact") 
            .eq("user_id", user_id) 
            .execute()
        )    

        if getattr(saved_sched_res, "count", None) is not None:
            lines.append(f"Saved schedules count: {saved_sched_res.count}")

    except Exception as e:
        lines.append(f"Context load failed: {str(e)}")

    return "\n".join(lines)  


@app.route('/')
def home():
    return jsonify({"message": "Backend is working!"})

@app.route('/test-scraper')
def test_scraper():
    data = scrape_courses()
    return jsonify(data)

@app.route('/sync-pmu-courses')
def sync_pmu_courses():
    try:
        result = run_pmu_sync()
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "message": "PMU sync failed",
            "error": str(e)
        }), 500
        
              
@app.route('/chatbot', methods=['POST'])
def chatbot():
    try:
        data = request.get_json(silent=True) or {}
        user_message = data.get("message", "").strip()
        user_id = data.get("user_id")

        if not user_message:
            return jsonify({"error": "Message is required"}), 400
        
    # 1)FAQ first
        faq_reply = get_faq_reply(user_message)
        if faq_reply:
            return jsonify({"reply": faq_reply})
    
    # 2) Optional personal context
        context_text = ""
        if user_id:
            context_text = build_user_context(user_id)
   
        # 3) AI fallback    
        response = client.responses.create(
            model="gpt-4.1-mini",
            instructions="""
You are the Uni Planner assistant for PMU students.

You help with:
- using the Uni Planner app
- degree planning basics
- semester schedule building
- prerequisites
- saved plans and schedules

Rules:
- Keep answers short, clear, and practical.
- Answer like a helpful student app assistant.
- Use provided user context when available.
- If personal data is not available, say that clearly.
- Prefer app-specific answers over general academic advice.
- Do not invent user-specific data.
""",
            input=f"""
User question:
{user_message}

User context:
{context_text if context_text else "No personal context provided."}
"""
        )
        
        reply_text = response.output_text.strip() if response.output_text else "Sorry, I couldn't generate a reply."

        return jsonify({"reply": reply_text})

    except Exception as e:
        print("CHATBOT ERROR:", str(e))
        return jsonify({"error": str(e)}), 500 
    
    
def interpret_ai_preferences(preferences):
    if not preferences or not preferences.strip():
        return {
            "include_summer": False,
            "avoid_summer": False,
            "pace": "balanced",
            "max_credits": None,
            "min_fall_spring_credits": 10,
            "notes": ""
        }

    try:
        print("GPT DEGREE PLAN PREF CALL STARTED")
        print("USER PREFERENCES SENT TO GPT:", preferences)
        response = client.responses.create(
            model="gpt-4.1-mini",
            instructions="""
You are helping a university planning system interpret student preferences.

Return ONLY valid JSON.
Do not explain.

Fields:
- include_summer: boolean
- avoid_summer: boolean
- pace: "light" | "balanced" | "fast"
- max_credits: number or null
- min_fall_spring_credits: number
- notes: short string

Rules:
If user says "no summer", "without summer", "do not include summer", avoid_summer must be true and include_summer false.
If user says "summer", "fast", or "graduate faster", include_summer can be true unless avoid_summer is true.
Fall/Spring full-time minimum should usually be 10 credits.
""",
            input=preferences
        )

        text = response.output_text.strip()
        print("GPT DEGREE PLAN PREF RAW OUTPUT:", text)
        return json.loads(text)

    except Exception as e:
        print("AI PREFERENCE INTERPRETATION ERROR:", str(e))
        return {
            "include_summer": should_include_summer(preferences),
            "avoid_summer": "no summer" in preferences.lower() or "without summer" in preferences.lower(),
            "pace": "balanced",
            "max_credits": None,
            "min_fall_spring_credits": 10,
            "notes": "Fallback preference parsing used."
        }    
      
    
def get_sections_for_courses(course_ids):
    response = (
        supabase.table("course_sections")
        .select("""
            crn,
            course_id,
            section,
            section_type,
            instructor,
            room,
            credits,
            course_section_meetings (
                day,
                start_time,
                end_time
            )
        """)
        .in_("course_id", course_ids)
        .execute()
    )

    return response.data or []   

def time_to_minutes(time_str):
    hours, minutes, *_ = time_str.split(":")
    return int(hours) * 60 + int(minutes)


def extract_hour(text):
    match = re.search(r'\b(\d{1,2})\b', text.lower())
    if not match:
        return None

    hour = int(match.group(1))

    if "pm" in text.lower() and hour < 12:
        hour += 12

    if "am" in text.lower() and hour == 12:
        hour = 0

    return hour


def section_matches_preferences(section, preferences):
    preferences = preferences.lower()
    meetings = section.get("course_section_meetings", [])

    # morning = before 12 PM
    if "morning" in preferences:
        for meeting in meetings:
            start = time_to_minutes(meeting["start_time"])
            if start >= 12 * 60:
                return False

    # early = before 2 PM
    if "early" in preferences:
        for meeting in meetings:
            start = time_to_minutes(meeting["start_time"])
            if start >= 14 * 60:
                return False

    # no classes before X
    if "no classes before" in preferences or "not before" in preferences:
        hour = extract_hour(preferences)
        if hour is not None:
            for meeting in meetings:
                start = time_to_minutes(meeting["start_time"])
                if start < hour * 60:
                    return False

    # no classes after X
    if "no classes after" in preferences or "not after" in preferences:
        hour = extract_hour(preferences)
        if hour is not None:
            for meeting in meetings:
                end = time_to_minutes(meeting["end_time"])
                if end > hour * 60:
                    return False

    blocked_day_codes = {
        "sunday": ["U", "Sunday"],
        "monday": ["M", "Monday"],
        "tuesday": ["T", "Tuesday"],
        "wednesday": ["W", "Wednesday"],
        "thursday": ["R", "Thursday"],
    }

    blocked_phrases = {
        "sunday": ["no sunday", "free sunday"],
        "monday": ["no monday", "free monday"],
        "tuesday": ["no tuesday", "free tuesday"],
        "wednesday": ["no wednesday", "free wednesday"],
        "thursday": ["no thursday", "free thursday"],
    }

    for day_name, phrases in blocked_phrases.items():
        if any(phrase in preferences for phrase in phrases):
            blocked_codes = blocked_day_codes[day_name]

            for meeting in meetings:
                meeting_day = str(meeting["day"]).strip()
                if meeting_day in blocked_codes:
                    return False

    return True

def meetings_conflict(meetings_a, meetings_b):
    for a in meetings_a:
        for b in meetings_b:
            if a["day"] != b["day"]:
                continue

            a_start = time_to_minutes(a["start_time"])
            a_end = time_to_minutes(a["end_time"])
            b_start = time_to_minutes(b["start_time"])
            b_end = time_to_minutes(b["end_time"])

            if a_start < b_end and b_start < a_end:
                return True

    return False


def can_add_section(schedule_sections, new_section):
    new_meetings = new_section.get("course_section_meetings", [])

    for existing_section in schedule_sections:
        existing_meetings = existing_section.get("course_section_meetings", [])

        if meetings_conflict(existing_meetings, new_meetings):
            return False

    return True

    for section in schedule:
        for meeting in section.get("course_section_meetings", []):
            start = time_to_minutes(meeting["start_time"])
            day = meeting["day"]

            # Prefer later classes (no early mornings)
            if "no classes before" in preferences:
                hour = extract_hour(preferences)
                if hour and start >= hour * 60:
                    score += 2

            # Prefer morning
            if "morning" in preferences:
                if start < 12 * 60:
                    score += 1

            # Prefer no Monday
            if "no monday" in preferences:
                if day not in ["M", "Monday"]:
                    score += 1

    return score


def build_schedule_options(course_ids, sections, max_options=3, allow_partial=True):
    grouped = {}

    for section in sections:
        course_id = section.get("course_id")
        if course_id not in grouped:
            grouped[course_id] = []
        grouped[course_id].append(section)

    all_options = []

    def backtrack(index, current_schedule, skipped_courses):
        if index == len(course_ids):
            if current_schedule:
                all_options.append({
                    "name": f"Option {len(all_options) + 1}",
                    "sections": current_schedule.copy(),
                    "skipped_courses": skipped_courses.copy()
                })
            return

        course_id = course_ids[index]
        course_sections = grouped.get(course_id, [])

        added_any = False

        for section in course_sections:
            if can_add_section(current_schedule, section):
                added_any = True
                current_schedule.append(section)
                backtrack(index + 1, current_schedule, skipped_courses)
                current_schedule.pop()

        if allow_partial and not added_any:
            skipped_courses.append(course_id)
            backtrack(index + 1, current_schedule, skipped_courses)
            skipped_courses.pop()

    backtrack(0, [], [])

    # Sort: prefer schedules with more included courses
    all_options.sort(
        key=lambda option: len(option.get("sections", [])),
        reverse=True
    )

    # Keep options that are actually different
    unique_options = []
    seen_signatures = set()

    for option in all_options:
        crns = sorted(section.get("crn") for section in option.get("sections", []))
        signature = tuple(crns)

        if signature not in seen_signatures:
            seen_signatures.add(signature)
            unique_options.append(option)

        if len(unique_options) >= max_options:
            break

    return unique_options
    
def explain_no_results(course_ids, all_sections, filtered_sections, preferences):
    explanations = []

    sections_by_course = {}
    filtered_by_course = {}

    for course_id in course_ids:
        sections_by_course[course_id] = []
        filtered_by_course[course_id] = []

    for section in all_sections:
        course_id = section.get("course_id")
        if course_id in sections_by_course:
            sections_by_course[course_id].append(section)

    for section in filtered_sections:
        course_id = section.get("course_id")
        if course_id in filtered_by_course:
            filtered_by_course[course_id].append(section)

    for course_id in course_ids:
        original_count = len(sections_by_course.get(course_id, []))
        filtered_count = len(filtered_by_course.get(course_id, []))

        if original_count == 0:
            explanations.append(f"{course_id} has no available sections.")
            continue

        if filtered_count == 0:
            days_found = set()
            earliest_start = None
            latest_end = None

            for section in sections_by_course[course_id]:
                for meeting in section.get("course_section_meetings", []):
                    day = meeting.get("day")
                    start = time_to_minutes(meeting.get("start_time"))
                    end = time_to_minutes(meeting.get("end_time"))

                    days_found.add(day)

                    if earliest_start is None or start < earliest_start:
                        earliest_start = start

                    if latest_end is None or end > latest_end:
                        latest_end = end

            readable_days = {
                "U": "Sunday",
                "M": "Monday",
                "T": "Tuesday",
                "W": "Wednesday",
                "R": "Thursday",
            }

            days_text = ", ".join(
                readable_days.get(day, day) for day in sorted(days_found)
            )

            if "no sunday" in preferences.lower() and "U" in days_found:
                explanations.append(
                    f"{course_id} has sections that meet on Sunday, so they were removed by\nyour no Sunday preference."
                )
            elif "morning" in preferences.lower():
                explanations.append(
                    f"{course_id} does not have sections that fit the morning preference."
                )
            elif "early" in preferences.lower():
                explanations.append(
                    f"{course_id} does not have sections that fit the early classes preference."
                )
            elif "no classes before" in preferences.lower() or "not before" in preferences.lower():
                explanations.append(
                    f"{course_id} has sections that start before your requested time."
                )
            elif "no classes after" in preferences.lower() or "not after" in preferences.lower():
                explanations.append(
                    f"{course_id} has sections that end after your requested time."
                )
            else:
                explanations.append(
                    f"{course_id} has available sections, but none match your \npreferences. Available days: {days_text}."
                )

    if not explanations:
        explanations.append(
            "TThe selected sections match your preferences,\nbut their times overlap."
        )

    return explanations

def get_required_courses_for_program(degree_program_code):
    response = (
        supabase.table("curriculum_section_courses")
        .select("""
            course_id,
            course_category,
            courses (
                id,
                name,
                credits,
                semester_hours,
                semester_hours,
                required_hours,
                must_be_alone
            )
        """)
        .eq("degree_program_code", degree_program_code)
        .execute()
    )
    return response.data or []


def get_completed_courses_for_plan(degree_plan_id):
    response = (
        supabase.table("degree_plan_completed_courses")
        .select("course_id")
        .eq("degree_plan_id", degree_plan_id)
        .execute()
    )
    return [row["course_id"] for row in (response.data or [])]


def get_prerequisites():
    response = (
        supabase.table("course_prerequisites")
        .select("course_id, prerequisite_course_id")
        .execute()
    )

    prereq_map = {}

    for row in response.data or []:
        course_id = row["course_id"]
        prereq_id = row["prerequisite_course_id"]

        if course_id not in prereq_map:
            prereq_map[course_id] = []

        prereq_map[course_id].append(prereq_id)

    return prereq_map
    

@app.route('/generate-schedule', methods=['POST'])
def generate_schedule():
    try:
        data = request.get_json(silent=True) or {}

        course_ids = data.get("course_ids", [])
        preferences = data.get("preferences", "")
        ai_preferences = interpret_ai_preferences(preferences)
        semester_slots = data.get("semester_slots", [])
        
        if "include_summer" in data:
            include_summer = bool(data.get("include_summer"))
        else:
            include_summer = bool(ai_preferences.get("include_summer", False))

        if ai_preferences.get("avoid_summer"):
            include_summer = False

        sections = get_sections_for_courses(course_ids)

        if not sections:
            return jsonify({
                "message": "No sections found for the selected courses.",
                "course_ids": course_ids,
                "preferences": preferences,
                "options": []
            })

        # 1. Try strict preference filtering first
        filtered_sections = [
            section for section in sections
            if section_matches_preferences(section, preferences)
        ]

        strict_options = build_schedule_options(course_ids, filtered_sections)

        if strict_options:
            return jsonify({
                "message": "Schedule options generated using your preferences.",
                "course_ids": course_ids,
                "preferences": preferences,
                "option_count": len(strict_options),
                "options": strict_options,
                "used_fallback": False,
                "explanations": []
            })

        # 2. If strict failed, explain why
        explanations = explain_no_results(
            course_ids,
            sections,
            filtered_sections,
            preferences
        )

        # 3. Try again without preferences, but still conflict-free
        fallback_options = build_schedule_options(course_ids, sections)

        if fallback_options:
            explanations.append(
                "Some preferences could not be fully applied, so these are the closest conflict-free schedules."
            )

            return jsonify({
                "message": "Closest conflict-free schedule options generated.",
                "course_ids": course_ids,
                "preferences": preferences,
                "option_count": len(fallback_options),
                "options": fallback_options,
                "used_fallback": True,
                "explanations": explanations
            })

        # 4. If even fallback fails, no conflict-free schedule exists
        return jsonify({
            "message": "No conflict-free schedule options found.",
            "course_ids": course_ids,
            "preferences": preferences,
            "options": [],
            "used_fallback": False,
            "explanations": explanations,
            "suggestion": "Try selecting fewer courses or different courses."
        })

    except Exception as e:
        print("GENERATE SCHEDULE ERROR:", str(e))
        return jsonify({"error": str(e)}), 500
    
    
def get_curriculum_required_credits(degree_program_code):
    response = (
        supabase.table("curriculum_sections")
        .select("course_category, required_credits")
        .eq("degree_program_code", degree_program_code)
        .execute()
    )

    return {
        row["course_category"]: row["required_credits"]
        for row in (response.data or [])
    }    
    
def get_max_credits_from_preferences(preferences):
    preferences = preferences.lower()

    match = re.search(r'max\s*(\d+)', preferences)
    if match:
        return int(match.group(1))

    match = re.search(r'(\d+)\s*(hours|credits)', preferences)
    if match:
        return int(match.group(1))

    if "heavy" in preferences or "graduate faster" in preferences or "fast" in preferences:
        return 20

    if "light" in preferences:
        return 13

    return 17   

def should_include_summer(preferences):
    preferences = preferences.lower()

    if "no summer" in preferences or "without summer" in preferences:
        return False

    if "summer" in preferences or "fast" in preferences or "graduate faster" in preferences:
        return True

    return False 


def compact_degree_plan(semesters, course_info, max_credits, summer_max_credits=9, include_summer=False):
    changed = True

    while changed:
        changed = False

        for i in range(len(semesters) - 1, 0, -1):
            # only fix normal one-course semesters
            if len(semesters[i]) != 1:
                continue

            course = semesters[i][0]
            course_name = course_info[course]["name"].lower()

            # do NOT move internship
            if "internship" in course_name:
                continue

            credits = course_info[course]["credits"]
            
            for j in range(i):
                # every 3rd semester is summer if summer is included
                target_is_summer = include_summer and j % 3 == 2
                target_max = summer_max_credits if target_is_summer else max_credits
                
                current_credits = sum(course_info[c]["credits"] for c in semesters[j])
                
                if current_credits + credits <= target_max:
                    semesters[j].append(course)
                    semesters.pop(i)
                    changed = True
                    break

            if changed:
                break

    return semesters

def get_course_offering_rules():
        response = (
            supabase.table("course_offering_rules")
            .select("course_id, term")
            .execute()
        )

        rules = {}

        for row in response.data or []:
            course_id = row["course_id"].replace(" ", "").upper()
            term = row["term"]

            if course_id not in rules:
                rules[course_id] = []

            rules[course_id].append(term)

        return rules


@app.route('/generate-degree-plan', methods=['POST'])
def generate_degree_plan():
    try:
        data = request.get_json(silent=True) or {}

        degree_program_code = data.get("degree_program_code")
        completed_courses = data.get("completed_courses", [])
        current_courses = data.get("current_courses", [])
        preferences = data.get("preferences", "")
        semester_slots = data.get("semester_slots", [])
        
        ai_preferences = interpret_ai_preferences(preferences)

        MAX_CREDITS = get_max_credits_from_preferences(preferences)
        
        if "include_summer" in data:
            include_summer = bool(data.get("include_summer"))
        else:
            include_summer = bool(ai_preferences.get("include_summer", False)) 
            
        if ai_preferences.get("avoid_summer"):    
            include_summer = False 
             
        SUMMER_MAX_CREDITS = 9
        MIN_FALL_SPRING_CREDITS = ai_preferences.get("min_fall_spring_credits", 10) or 10
        MAX_PLAN_YEARS = 6
        MAX_PLAN_TERMS = len(semester_slots) if semester_slots else MAX_PLAN_YEARS * (3 if include_summer else 2)

        generation_warnings = []

        if not degree_program_code:
            return jsonify({"error": "degree_program_code is required"}), 400

        all_courses = get_required_courses_for_program(degree_program_code)

        course_info = {}
        required_course_ids = []

        for row in all_courses:
            course_id = row["course_id"].replace(" ", "").upper()
            course_data = row.get("courses") or {}

            course_info[course_id] = {
                "id": course_id,
                "name": course_data.get("name", ""),
                "credits": course_data.get("credits", 3),
                "semester_hours": course_data.get("semester_hours"),
                "required_hours": course_data.get("required_hours"),
                "must_be_alone": course_data.get("must_be_alone", False),
                "category": row.get("course_category", "")
            }

            required_course_ids.append(course_id)

        prereq_map = get_prerequisites()
        offering_rules = get_course_offering_rules()
        required_credits_by_category = get_curriculum_required_credits(degree_program_code)

        completed_set = set([
            c.replace(" ", "").upper()
            for c in completed_courses
        ])

        current_set = set([
            c.replace(" ", "").upper()
            for c in current_courses
        ])

        blocked_set = completed_set.union(current_set)

        internship_courses = []
        senior_project_courses = []

        for course_id, info in course_info.items():
            name = info["name"].lower()

            if "internship" in name:
                internship_courses.append(course_id)

            if "senior project" in name or "capstone" in name:
                senior_project_courses.append(course_id)

        selected_required_courses = []
        category_credit_count = {}

        # Count completed/current elective credits first.
        for course_id in required_course_ids:
            category = course_info[course_id]["category"]
            credits = course_info[course_id]["credits"]

            if "Elective" in category and course_id in blocked_set:
                category_credit_count[category] = category_credit_count.get(category, 0) + credits

        # Select only enough electives based on DB required credits.
        for course_id in required_course_ids:
            if course_id in blocked_set:
                continue

            category = course_info[course_id]["category"]
            credits = course_info[course_id]["credits"]
            required_credits = required_credits_by_category.get(category)

            if required_credits is None:
                selected_required_courses.append(course_id)
                continue

            if "Elective" in category:
                current_category_credits = category_credit_count.get(category, 0)

                if current_category_credits < required_credits:
                    selected_required_courses.append(course_id)
                    category_credit_count[category] = current_category_credits + credits
            else:
                selected_required_courses.append(course_id)

        special_course_ids = set(internship_courses + senior_project_courses)

        remaining_courses = [
            course_id for course_id in selected_required_courses
            if course_id not in special_course_ids
        ]

        def get_term_for_index(index):
            if semester_slots and index < len(semester_slots):
                return semester_slots[index].get("term")

            if include_summer:
                term_cycle = ["fall", "spring", "summer"]
                return term_cycle[index % 3]

            term_cycle = ["fall", "spring"]
            return term_cycle[index % 2]

        def get_course_required_hours(course_id):
            if course_id == "ASSE2111":
                return 30

            return course_info[course_id].get("required_hours") or 0

        def get_semester_credit_limit(term):
            if term == "summer":
                return SUMMER_MAX_CREDITS

            return MAX_CREDITS

        def get_taken_credits(taken_course_ids):
            total = 0

            for course_id in taken_course_ids:
                info = course_info.get(course_id)

                if not info:
                    continue

                total += info.get("credits", 0) or 0

            return total

        def get_semester_credits(course_ids):
            return sum(
                course_info[c].get("credits", 0) or 0
                for c in course_ids
            )
            
        def is_foundation_or_core(course_id):
            category = course_info[course_id]["category"]

            return category in [
                "Preparation Program",
                "Core Curriculum",
                "Degree Specific Core",
                "Natural Science Electives",
                "College Core",
                "Social Science Electives",
            ]    

        def can_place_course(course_id, semester_courses, term, taken_course_ids):
            allowed_terms = offering_rules.get(course_id, [])

            if allowed_terms and term not in allowed_terms:
                return False

            prereqs = prereq_map.get(course_id, [])

            if not all(pr in taken_course_ids for pr in prereqs):
                return False

            credits_before = get_taken_credits(taken_course_ids)
            required_hours = get_course_required_hours(course_id)

            if required_hours and credits_before < required_hours:
                return False

            # Major electives should start around junior year, not freshman/sophomore.
            if course_info[course_id]["category"] == "Major Electives" and credits_before < 60:
                return False
            
            # Prefer not to place more than one Social Science Elective in the same semester
            if course_info[course_id]["category"] == "Social Science Electives":
                has_social_elective = any(
                    course_info[existing_course]["category"] == "Social Science Electives"
                    for existing_course in semester_courses
                )

                if has_social_elective:
                    return False
            

            course_must_be_alone = course_info[course_id].get("must_be_alone", False)

            if course_must_be_alone and len(semester_courses) > 0:
                return False

            for existing_course in semester_courses:
                if course_info[existing_course].get("must_be_alone", False):
                    return False

            current_credits = get_semester_credits(semester_courses)
            course_credits = course_info[course_id].get("credits", 0) or 0
            max_credits = get_semester_credit_limit(term)

            if current_credits + course_credits > max_credits:
                return False

            return True

        def get_course_level(course_id):
            match = re.search(r'(\d{4})', course_id)

            if not match:
                return 9

            number = int(match.group(1))

            if number < 2000:
                return 1
            if number < 3000:
                return 2
            if number < 4000:
                return 3

            return 4


        def get_priority(course_id):
            category = course_info[course_id]["category"]
            required_hours = course_info[course_id].get("required_hours") or 0
            course_level = get_course_level(course_id)

            unlock_count = sum(
                1 for course, prereqs in prereq_map.items()
                if course_id in prereqs
            )

            category_order = {
                "Preparation Program": 1,
                "Core Curriculum": 2,
                "Degree Specific Core": 3,
                "Natural Science Electives": 4,
                "College Core": 5,
                "Social Science Electives": 6,
                "Major Core": 7,
                "Major Electives": 8,
            }

            return (
                course_level,
                category_order.get(category, 10),
                required_hours,
                -unlock_count,
                course_info[course_id]["credits"]
            )
            
        def ai_improve_degree_plan(draft_semesters):
            """
            GPT improves the draft degree plan layout.
            Backend accepts GPT output only if it passes all DB/rule validation.
            """
            if not draft_semesters:
                return draft_semesters

            try:
                planned_course_ids = [
                    course_id
                    for semester in draft_semesters
                    for course_id in semester
                ]

                course_summary = []

                for course_id in planned_course_ids:
                    info = course_info.get(course_id, {})

                    course_summary.append({
                        "id": course_id,
                        "name": info.get("name", ""),
                        "credits": info.get("credits", 0),
                        "category": info.get("category", ""),
                        "required_hours": get_course_required_hours(course_id),
                        "offered_terms": offering_rules.get(course_id, []),
                        "prerequisites": prereq_map.get(course_id, []),
                        "must_be_alone": info.get("must_be_alone", False),
                    })

                semester_summary = []

                for index, semester in enumerate(draft_semesters):
                    semester_summary.append({
                        "index": index,
                        "term": get_term_for_index(index),
                        "courses": semester,
                        "credits": get_semester_credits(semester),
                    })

                ai_input = {
                    "student_preferences": preferences,
                    "rules": {
                        "fall_spring_max_credits": MAX_CREDITS,
                        "summer_max_credits": SUMMER_MAX_CREDITS,
                        "fall_spring_min_preferred_credits": MIN_FALL_SPRING_CREDITS,
                        "max_years": MAX_PLAN_YEARS,
                        "important_notes": [
                            "Do not add new courses.",
                            "Do not remove courses.",
                            "Do not duplicate courses.",
                            "Respect prerequisites.",
                            "Respect required_hours / student standing.",
                            "Respect course offering terms.",
                            "Respect credit limits.",
                            "Prefer core/foundation courses early.",
                            "Avoid Fall/Spring semesters below 10 credits when possible.",
                            "Do not put more than one Social Science Elective in the same semester when possible.",
                            "Major Electives should not be before junior standing."
                        ]
                    },
                    "courses": course_summary,
                    "draft_plan": semester_summary
                }

                print("GPT DEGREE PLAN IMPROVEMENT CALL STARTED")
                print("DRAFT PLAN SENT TO GPT:", json.dumps(ai_input, indent=2))
                
                response = client.responses.create(
                    model="gpt-4.1-mini",
                    instructions="""
You improve a university degree plan.

Return ONLY valid JSON.
No markdown.
No explanation outside JSON.

You must return this schema:
{
  "plan": [
    ["COURSEID1", "COURSEID2"],
    ["COURSEID3"]
  ],
  "notes": "short explanation"
}

Rules:
- Use only the exact course IDs provided.
- Do not add courses.
- Do not remove courses.
- Do not duplicate courses.
- Keep prerequisites before courses that require them.
- Keep courses in terms where they are offered.
- Keep Fall/Spring under the max credit limit.
- Keep Summer under the summer credit limit.
- Prefer 10+ credits in Fall/Spring when possible.
- Prefer foundation/core courses earlier.
- Keep major electives later.
- If you cannot improve safely, return the same draft plan.
""",
                    input=json.dumps(ai_input)
                )

                raw_text = response.output_text.strip()
                print("GPT DEGREE PLAN IMPROVEMENT RAW OUTPUT:", raw_text)
                raw_text = raw_text.replace("```json", "").replace("```", "").strip()

                ai_result = json.loads(raw_text)
                ai_plan = ai_result.get("plan", [])

                if not ai_plan or not isinstance(ai_plan, list):
                    return draft_semesters

                original_flat = sorted(planned_course_ids)
                ai_flat = sorted([
                    str(course_id).replace(" ", "").upper()
                    for semester in ai_plan
                    for course_id in semester
                ])

                # GPT must keep the exact same courses
                if ai_flat != original_flat:
                    generation_warnings.append(
                        "AI plan improvement was rejected because it changed the course list."
                    )
                    return draft_semesters

                # Validate GPT plan using the same backend rules
                validated_semesters = []
                validation_taken = set(blocked_set)

                for index, ai_semester in enumerate(ai_plan):
                    term = get_term_for_index(index)
                    validated_semester = []

                    for raw_course_id in ai_semester:
                        course_id = str(raw_course_id).replace(" ", "").upper()

                        if course_id not in course_info:
                            return draft_semesters

                        if course_id in validated_semester:
                            return draft_semesters

                        if not can_place_course(
                            course_id=course_id,
                            semester_courses=validated_semester,
                            term=term,
                            taken_course_ids=validation_taken
                        ):
                            
                            return draft_semesters

                        validated_semester.append(course_id)

                    if validated_semester:
                        validated_semesters.append(validated_semester)

                        for course_id in validated_semester:
                            validation_taken.add(course_id)

                validated_flat = sorted([
                    course_id
                    for semester in validated_semesters
                    for course_id in semester
                ])

                if validated_flat != original_flat:
                    return draft_semesters

                return validated_semesters

            except Exception as e:
                print("AI DEGREE PLAN IMPROVEMENT ERROR:", str(e))
                generation_warnings.append(
                    "AI improvement fallback used; backend rule-based draft was kept."
                )
                return draft_semesters

        remaining_courses.sort(key=get_priority)

        semesters = []
        taken = set(blocked_set)

        semester_index = 0
        skipped_terms = 0
        max_skipped_terms = 12

        while remaining_courses and semester_index < MAX_PLAN_TERMS:
            semester_courses = []
            current_term = get_term_for_index(semester_index)

            eligible_courses = []
            
            for course in remaining_courses[:]:
                if can_place_course(
                    course_id=course,
                    semester_courses=semester_courses,
                    term=current_term,
                    taken_course_ids=taken
                ):
                    eligible_courses.append(course)
                    
            eligible_courses.sort(
                key=lambda course: (
                    0 if semester_index < 2 and is_foundation_or_core(course) else 1,
                    get_priority(course)

                )
            )
            
            for course in eligible_courses:
                if can_place_course(
                    course_id=course,
                    semester_courses=semester_courses,
                    term=current_term,
                    taken_course_ids=taken
                ):
                    semester_courses.append(course)        

            if not semester_courses:
                semester_index += 1
                skipped_terms += 1

                if skipped_terms >= max_skipped_terms:
                    generation_warnings.append(
                        "Some courses need advisor review because they could not fit while following DB rules."
                    )
                    break

                continue
            
            semester_credits = get_semester_credits(semester_courses)

            if (
                current_term != "summer"
                and semester_courses
                and semester_credits < MIN_FALL_SPRING_CREDITS
            ):
                generation_warnings.append(
                    f"{current_term.capitalize()} semester is below full-time credit load."
                )

            skipped_terms = 0
            semesters.append(semester_courses)

            for c in semester_courses:
                taken.add(c)
                remaining_courses.remove(c)

            semester_index += 1

        if remaining_courses:
            generation_warnings.append(
                "Some courses may need advisor review."
            )
            
        semesters = ai_improve_degree_plan(semesters)    

        # Place senior project once, after normal courses, following DB rules.
        for senior_project in senior_project_courses:
            if senior_project in completed_set:
                continue

            if senior_project not in course_info:
                continue

            already_planned = any(
                senior_project in semester
                for semester in semesters
            )

            if already_planned:
                continue

            placed = False

            for i in range(len(semesters) - 1, -1, -1):
                term = get_term_for_index(i)
                taken_before = set(blocked_set).union(
                    set(c for sem in semesters[:i] for c in sem)
                )

                if can_place_course(
                    course_id=senior_project,
                    semester_courses=semesters[i],
                    term=term,
                    taken_course_ids=taken_before
                ):
                    semesters[i].append(senior_project)
                    placed = True
                    break

            if not placed:
                generation_warnings.append(
                    f"{senior_project} could not be placed while following DB rules."
                )

        # Place internship once, after the final academic semester.
        for internship in internship_courses:
            if internship in completed_set:
                continue

            if internship not in course_info:
                continue

            already_planned = any(
                internship in semester
                for semester in semesters
            )

            if already_planned:
                continue

            placed = False

            # Add internship after the last semester if there is room in the 6-year limit.
            if len(semesters) < MAX_PLAN_TERMS:
                next_index = len(semesters)
                next_term = get_term_for_index(next_index)

                taken_before = set(blocked_set).union(
                    set(c for sem in semesters for c in sem)
                )

                if can_place_course(
                    course_id=internship,
                    semester_courses=[],
                    term=next_term,
                    taken_course_ids=taken_before
                ):
                    semesters.append([internship])
                    placed = True

            if not placed:
                generation_warnings.append(
                    "Internship could not be placed while following DB rules."
                )

        return jsonify({
            "message": "Degree plan generated",
            "total_semesters": len(semesters),
            "max_years": MAX_PLAN_YEARS,
            "max_terms": MAX_PLAN_TERMS,
            "warnings": generation_warnings,
            "ai_used": True,
            "ai_model": "gpt-4.1-mini",
            "ai_role": "GPT interpreted preferences and attempted to improve the DB-validated plan",
            "plan": semesters
        })

    except Exception as e:
        print("DEGREE PLAN ERROR:", str(e))
        return jsonify({"error": str(e)}), 500
    
@app.route('/read-degree-audit', methods=['POST'])
def read_degree_audit():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        uploaded_file = request.files['file']

        reader = PdfReader(io.BytesIO(uploaded_file.read()))

        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
            print(text[:5000])

        course_codes = re.findall(r'\b[A-Z]{3,4}\s?\d{4}\b', text)
        
        normalized_courses = sorted(set(
            code.replace(" ", "").upper()
            for code in course_codes
        ))
        
        in_progress_courses = []

        in_progress_match = re.search(
            r'In-progress Credits applied:.*?(?=Legend|Disclaimer|$)',
            text,
            re.DOTALL | re.IGNORECASE
        )

        if in_progress_match:
            in_progress_text = in_progress_match.group(0)
            in_progress_courses = re.findall(r'\b[A-Z]{3,4}\s?\d{4}\b', in_progress_text)

        in_progress_courses = sorted(set(
            code.replace(" ", "").upper()
            for code in in_progress_courses
        ))
        
        completed_courses = [
            course for course in normalized_courses
            if course not in in_progress_courses
        ]


        return jsonify({
            "message": "Degree audit read successfully",
            "completed_courses": completed_courses,
            "in_progress_courses": in_progress_courses,
            "courses_found": normalized_courses
        })

    except Exception as e:
        print("AUDIT READ ERROR:", str(e))
        return jsonify({"error": str(e)}), 500
    
    
@app.route('/verify-override-proof', methods=['POST'])
def verify_override_proof():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        uploaded_file = request.files['file']
        image_bytes = uploaded_file.read()
        mime_type = uploaded_file.mimetype or "image/jpeg"

        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        image_data_url = f"data:{mime_type};base64,{base64_image}"

        response = client.responses.create(
            model="gpt-4.1-mini",
            instructions="""
You read screenshots of PMU approval emails.

Return ONLY JSON:

{
  "approved": true or false,
  "type": "override" or "overload",
  "course_id": "COSC4363 or null",
  "course_name": "name or null",
  "section": "section or null",
  "reason": "short explanation"
}

If it's about course override → type = "override"

If it's about credit overload approval → type = "overload"
""",
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "Verify if this screenshot confirms an approved restriction override."
                        },
                        {
                            "type": "input_image",
                            "image_url": image_data_url
                        }
                    ]
                }
            ]
        )

        result_text = response.output_text.strip()
        result = json.loads(result_text)

        return jsonify(result)

    except Exception as e:
        print("OVERRIDE VERIFY ERROR:", str(e))
        return jsonify({"error": str(e)}), 500        


if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)
    
    
