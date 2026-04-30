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

def score_schedule(schedule):
    score = 0
    preferences = preferences.lower()

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

    
@app.route('/generate-schedule', methods=['POST'])
def generate_schedule():
    try:
        data = request.get_json(silent=True) or {}

        course_ids = data.get("course_ids", [])
        preferences = data.get("preferences", "")

        if not course_ids:
            return jsonify({"error": "course_ids is required"}), 400

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

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)
    
    
