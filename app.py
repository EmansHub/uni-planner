from flask import Flask, jsonify
from scraper import scrape_courses
from sync_service import run_pmu_sync
from apscheduler.schedulers.background import BackgroundScheduler
from flask import request
from openai import OpenAI
import os
from flask_cors import CORS
from supabase_client import supabase


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


if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)
    
    
