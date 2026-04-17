from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time


def normalize_course_code(course_code):
    return course_code.replace(" ", "").strip()


def convert_time_format(raw_time):
    parts = raw_time.split("-")

    if len(parts) != 2:
        return "", ""

    start_raw = parts[0].strip()
    end_raw = parts[1].strip()

    start_time = start_raw[:2] + ":" + start_raw[2:] if len(start_raw) == 4 else ""
    end_time = end_raw[:2] + ":" + end_raw[2:] if len(end_raw) == 4 else ""

    return start_time, end_time


def split_days(days_text):
    return list(days_text.strip())


def scrape_courses():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )

    wait = WebDriverWait(driver, 30)

    try:
        driver.execute_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )

        print("Opening PMU website...")
        driver.get("https://masterschedule.pmu.edu.sa/")

        wait.until(
            EC.presence_of_element_located((By.ID, "TermList"))
        )

        current_url = driver.current_url
        page_title = driver.title

        semester_dropdown = Select(driver.find_element(By.ID, "TermList"))
        college_dropdown = Select(driver.find_element(By.ID, "CollegeList"))
        gender_dropdown = Select(driver.find_element(By.ID, "GenderList"))

        semester_dropdown.select_by_value("202620")
        college_dropdown.select_by_value("ALL")
        gender_dropdown.select_by_value("F1")

        print("Selected filters")

        search_button = wait.until(
            EC.element_to_be_clickable((By.ID, "submitbtn"))
        )
        search_button.click()
        print("Clicked search")

        time.sleep(3)

        all_data = driver.execute_async_script("""
            const callback = arguments[arguments.length - 1];

            function collectData() {
                try {
                    const table = $('.datatables-basic').DataTable();
                    if (!table) {
                        callback({ error: 'DataTable not found' });
                        return;
                    }

                    const allData = [];
                    const pageCount = table.page.info().pages;

                    for (let i = 0; i < pageCount; i++) {
                        table.page(i).draw(false);

                        const rows = Array.from(table.rows({ page: 'current' }).nodes());

                        rows.forEach(row => {
                            const cells = row.querySelectorAll('td');
                            allData.push([
                                cells[0]?.innerText.trim() || "",
                                cells[1]?.innerText.trim() || "",
                                cells[2]?.innerText.trim() || "",
                                cells[3]?.innerText.trim() || "",
                                cells[4]?.innerText.trim() || "",
                                cells[5]?.innerText.trim() || "",
                                cells[6]?.innerText.trim() || "",
                                cells[7]?.innerText.trim() || "",
                                cells[8]?.innerText.trim() || ""
                            ]);
                        });
                    }

                    callback({
                        pageCount: pageCount,
                        rows: allData
                    });
                } catch (err) {
                    callback({ error: String(err) });
                }
            }

            setTimeout(collectData, 1000);
        """)

        if not all_data:
            return {
                "message": "PMU DataTable scrape failed",
                "error": "No data returned from JavaScript",
                "sections_data": [],
                "meetings_data": []
            }

        if all_data.get("error"):
            return {
                "message": "PMU DataTable scrape failed",
                "error": all_data["error"],
                "sections_data": [],
                "meetings_data": []
            }

        raw_rows = all_data.get("rows", [])
        total_pages = all_data.get("pageCount", 0)

        print("Total pages found:", total_pages)
        print("Raw rows found:", len(raw_rows))

        cleaned_rows = []

        for row in raw_rows:
            if len(row) == 9:
                raw_course_code = row[1].strip()
                raw_days = row[4].strip()
                raw_time = row[5].strip()

                start_time, end_time = convert_time_format(raw_time)
                days_list = split_days(raw_days)

                cleaned_rows.append({
                    "crn": row[0].strip(),
                    "course_code_raw": raw_course_code,
                    "course_id": normalize_course_code(raw_course_code),
                    "course_title": row[2].strip(),
                    "section": row[3].strip(),
                    "days_raw": raw_days,
                    "days_list": days_list,
                    "time_raw": raw_time,
                    "start_time": start_time,
                    "end_time": end_time,
                    "instructor": row[6].strip(),
                    "room": row[7].strip(),
                    "status": row[8].strip()
                })

        # Dedupe cleaned rows by CRN
        cleaned_rows_map = {}
        for item in cleaned_rows:
            crn = item.get("crn")
            if crn:
                cleaned_rows_map[crn] = item

        cleaned_rows = list(cleaned_rows_map.values())

        # Build sections_data
        sections_map = {}
        for item in cleaned_rows:
            crn = item["crn"]
            sections_map[crn] = {
                "crn": item["crn"],
                "course_id": item["course_id"],
                "course_title": item["course_title"],
                "section": item["section"],
                "section_type": "LEC",
                "instructor": item["instructor"],
                "room": item["room"],
                "credits": 3
            }

        sections_data = list(sections_map.values())

        # Build meetings_data
        meetings_map = {}
        for item in cleaned_rows:
            for day in item["days_list"]:
                key = (item["crn"], day, item["start_time"])
                meetings_map[key] = {
                    "crn": item["crn"],
                    "day": day,
                    "start_time": item["start_time"],
                    "end_time": item["end_time"]
                }

        meetings_data = list(meetings_map.values())

        return {
            "message": "PMU DataTable scrape finished",
            "current_url": current_url,
            "page_title": page_title,
            "pages_scraped": total_pages,
            "cleaned_row_count": len(cleaned_rows),
            "section_count": len(sections_data),
            "meeting_count": len(meetings_data),
            "sample_sections": sections_data[:5],
            "sections_data": sections_data,
            "meetings_data": meetings_data
        }

    finally:
        driver.quit()