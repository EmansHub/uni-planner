# Uni Planner

Uni Planner is a web application designed to help Prince Mohammad Bin Fahd University (PMU) students plan their degree and organize their semester schedules.

## Features

* User registration, login, and profile management
* Degree planning based on the student's program and completed courses
* Drag-and-drop course planning
* Prerequisite checking
* Support for repeated courses, overrides, and credit-hour limits
* Degree audit support
* Semester schedule generation
* PMU course section information
* Course section filtering
* Schedule conflict detection
* CRN copying for registration
* AI-assisted degree planning and schedule generation
* Saved degree plans and schedules

## Tech Stack

**Frontend**

* React
* TypeScript
* Vite
* Tailwind CSS

**Backend**

* Python
* Flask

**Database & Authentication**

* Supabase
* PostgreSQL
* Supabase Authentication
* Row Level Security (RLS)

**Other**

* Selenium
* OpenAI API

## Project Structure

```text
uni-planner/
├── public/
├── src/
├── app.py
├── scraper.py
├── supabase_client.py
├── sync_service.py
├── index.html
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── eslint.config.js
└── postcss.config.mjs
```

## Getting Started

### Prerequisites

* Node.js
* Python 3
* Git

### Installation

Clone the repository:

```bash
git clone https://github.com/EmansHub/uni-planner.git
cd uni-planner
```

Install the frontend dependencies:

```bash
npm install
```

Install the required Python dependencies for the backend.

### Environment Variables

Create a `.env.local` file in the project root and add the required Supabase and OpenAI configuration.

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

Do not commit API keys or other sensitive environment variables to the repository.

### Running the Project

Start the frontend development server:

```bash
npm run dev
```

Run the Flask backend:

```bash
python app.py
```

The application runs locally using the frontend development server and Flask backend.

## Database

The application uses Supabase and PostgreSQL to store user data, degree plans, courses, course sections, and saved schedules.

Row Level Security (RLS) is used to control access to user-specific data.

## Notes

The course section data is collected from PMU's course schedule website using Selenium. The scraper depends on the structure and availability of the PMU website.

The application is currently intended for local use.

## Authors

**Eman Al Matar**

**Furat Al Omran**

Prince Mohammad Bin Fahd University

Senior Project
