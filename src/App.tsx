import { useState, useEffect } from 'react';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordConfirm } from './pages/ResetPasswordConfirm';
import { Dashboard } from './pages/Dashboard';
import { UserProfile } from './pages/UserProfile';
import { EditPasswordPage } from './pages/EditPasswordPage';
import { Toaster } from './ui/sonner'; 
import { ResetLinkSentPage } from './pages/ResetLinkSentPage';
import { supabase } from './lib/supabase';
import { Routes, Route } from 'react-router-dom';
import { SemesterSchedule } from './pages/SemesterSchedule';
import { PlanSelection } from './pages/PlanSelection';
import { CourseSelectionPage } from './pages/CourseSelectionPage';
import { SavedPlanView } from './pages/SavedPlanView';
import { DragDropPlanning } from './pages/DragDropPlanning';

export type Page =
  | 'welcome'
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-link-sent'
  | 'reset-password-confirm'
  | 'dashboard'
  | 'user-profile'
  | 'edit-password'
  | 'plan-selection'
  | 'semester-schedule';

export type User = {
  email: string;
  name: string;
  major: string;
  enrollmentSemester: string;
  password: string;
  gender: string;
};


function App() {
  const [currentPage, setCurrentPage] = useState<Page>('welcome');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const loadUserProfile = async (authUser: {
    id: string;
    email?: string | null;
    user_metadata?: {
      name?: string;
      major?: string;
      enrollmentSemester?: string;
      gender?: string;
    };
  }) => {
    const { data, error } = await supabase
      .from('users')
      .select('email, name, major, enrollment_semester, gender')
      .eq('id', authUser.id)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);

      setCurrentUser({
        email: authUser.email ?? '',
        name: authUser.user_metadata?.name ?? 'User',
        major: authUser.user_metadata?.major ?? '',
        enrollmentSemester: authUser.user_metadata?.enrollmentSemester ?? '',
        password: '',
        gender: authUser.user_metadata?.gender ?? '',
      });

      return;
    }

    setCurrentUser({
      email: data.email,
      name: data.name,
      major: data.major,
      enrollmentSemester: data.enrollment_semester,
      password: '',
      gender: data.gender ?? '',
    });
  };

  //Password recovery + auth events 
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setResetEmail(session?.user?.email ?? '');
        setCurrentPage('reset-password-confirm');
      }

      if (event === 'SIGNED_IN' && window.location.pathname === '/edit-password') {
      localStorage.setItem('passwordChangeVerified', 'true');
      }

    });

    return () => subscription.unsubscribe();
  }, []);

  //Session restore on load
  useEffect(() => {
    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session error:', error);
        return;
      }

      const user = data.session?.user;

      if (user) {
        await loadUserProfile(user);

        setCurrentPage('dashboard');

        if (window.location.pathname === '/') {
          window.history.replaceState({}, '', '/dashboard');
        }
      }

    };

    getSession();
  }, []);

  useEffect(() => {
    const protectedPages: Page[] = ['dashboard', 'user-profile', 'edit-password'];

    if (protectedPages.includes(currentPage) && !currentUser) {
      setCurrentPage('login');
    }
  }, [currentPage, currentUser]);

  return (
    <>
      <Toaster />

      <Routes>

        <Route path="/" element={<WelcomePage />} />

        <Route
          path="/login"
          element={
            <LoginPage
              onNavigate={setCurrentPage}
              onLogin={async (user) => {
                console.log('Logged in user:', user);

                const { data } = await supabase.auth.getUser();
                const authUser = data.user;

                if (authUser) {
                  await loadUserProfile(authUser);
                } else {
                  setCurrentUser(user);
                }

                setCurrentPage('dashboard');
              }}
            />
          }
        />

        <Route
          path="/register"
          element={
            <RegisterPage
              onNavigate={setCurrentPage}
              onRegister={async (user) => {
                console.log('Registered user:', user);

                const { data } = await supabase.auth.getUser();
                const authUser = data.user;

                if (authUser) {
                  await loadUserProfile(authUser);
                }

                setCurrentPage('login');
              }}
            />
          }
        />

        <Route
          path="/forgot-password"
          element={
            <ForgotPasswordPage
              onNavigate={setCurrentPage}
              onPasswordReset={(email) => {
                console.log('Password reset requested for:', email);
                setResetEmail(email);
                setCurrentPage('reset-link-sent');
              }}
            />
          }
        />

        <Route
          path="/reset-link-sent"
          element={
            <ResetLinkSentPage
              email={resetEmail}
              onNavigate={setCurrentPage}
            />
          }
        />

        <Route
          path="/reset-password"
          element={
            <ResetPasswordConfirm
              email={resetEmail}
              onNavigate={setCurrentPage}
            />
          }
        />

        <Route
          path="/dashboard"
          element={
            currentUser ? (
              <Dashboard
                onNavigate={setCurrentPage}
                user={currentUser}
                onLogout={async () => {
                  const { error } = await supabase.auth.signOut();

                  if (error) {
                    console.error('Logout error:', error);
                  }

                  setCurrentUser(null);
                  setCurrentPage('welcome');
                  window.location.href = '/';
                }}
              />
            ) : (
              <LoginPage
                onNavigate={setCurrentPage}
                onLogin={(user) => {
                  console.log('Logged in user:', user);
                  setCurrentUser(user);
                  setCurrentPage('dashboard');
                }}
              />
            )
          }
        />

        <Route
          path="/user-profile"
          element={
            currentUser ? (
              <UserProfile
                user={currentUser}
                onNavigate={setCurrentPage}
                onUpdateUser={(updatedUser) => {
                  console.log('Updated user:', updatedUser);
                  setCurrentUser(updatedUser);
                }}
              />
            ) : (
              <LoginPage
                onNavigate={setCurrentPage}
                onLogin={(user) => {
                  console.log('Logged in user:', user);
                  setCurrentUser(user);
                  setCurrentPage('dashboard');
                }}
              />
            )
          }
        />

        <Route
          path="/edit-password"
          element={
            currentUser ? (
              <EditPasswordPage
                user={currentUser}
              />
            ) : (
              <LoginPage
                onNavigate={setCurrentPage}
                onLogin={(user) => {
                  console.log('Logged in user:', user);
                  setCurrentUser(user);
                  setCurrentPage('dashboard');
                }}
              />
            )
          }
        />
        <Route
          path="/semester-schedule"
          element={
            currentUser ? (
              <SemesterSchedule
                user={currentUser}
              />
            ) : (
              <LoginPage
                onNavigate={setCurrentPage}
                onLogin={async (user) => {
                  console.log('Logged in user:', user);

                  const { data } = await supabase.auth.getUser();
                  const authUser = data.user;

                  if (authUser) {
                    await loadUserProfile(authUser);
                  } else {
                    setCurrentUser(user);
                  }

                  setCurrentPage('dashboard');
                }}
              />
            )
          }
        />
        <Route
          path="/plan-selection"
          element={
            currentUser ? (
              <PlanSelection
                onSelectPlan={setSelectedPlanId}
              />
            ) : (
              <LoginPage
                onNavigate={setCurrentPage}
                onLogin={(user) => {
                  console.log('Logged in user:', user);
                  setCurrentUser(user);
                  setCurrentPage('dashboard');
                }}
              />
            )
          }
        />
        <Route
          path="/course-selection"
          element={
            currentUser ? (
              <CourseSelectionPage
                user={currentUser}
                onContinue={(planId) => {
                  setSelectedPlanId(planId);
                }}
              />
            ) : (
              <LoginPage
                onNavigate={setCurrentPage}
                onLogin={(user) => {
                  console.log('Logged in user:', user);
                  setCurrentUser(user);
                  setCurrentPage('dashboard');
                }}
              />
            )
          }
        />
        <Route
          path="/saved-plan-view"
          element={
            currentUser && selectedPlanId ? (
              <SavedPlanView
                onNavigate={setCurrentPage}
                planId={selectedPlanId}
              />
            ) : (
              <PlanSelection
                onSelectPlan={setSelectedPlanId}
              />
            )
          }
        />
        <Route
          path="/drag-drop-planning"
          element={
            currentUser ? (
              <DragDropPlanning
                user={currentUser}
                planId={selectedPlanId}
              />
            ) : (
              <LoginPage
                onNavigate={setCurrentPage}
                onLogin={(user) => {
                  console.log('Logged in user:', user);
                  setCurrentUser(user);
                  setCurrentPage('dashboard');
                }}
              />
            )
          }
        />
        <Route
          path="*"
  
          element={
            <>

            </>
          }
        />
      </Routes>
    </>
  );
}

export default App;