from flask import Flask, jsonify
from scraper import scrape_courses
from sync_service import run_pmu_sync
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)

scheduler = BackgroundScheduler()
# Run once every 24 hours
scheduler.add_job(run_pmu_sync, 'interval', days=1)
scheduler.start()

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


if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)