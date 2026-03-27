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

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setResetEmail(session?.user?.email ?? '');
        setCurrentPage('reset-password-confirm');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>

      <Toaster />

      {currentPage === 'welcome' && (
        <WelcomePage onNavigate={setCurrentPage} />
      )}

      {currentPage === 'login' && (
        <LoginPage
          onNavigate={setCurrentPage}
          onLogin={(user) => {
            console.log('Logged in user:', user);
            setCurrentUser(user);
            setCurrentPage('dashboard');
          }}
        />
      )}

      {currentPage === 'register' && (
        <RegisterPage
          onNavigate={setCurrentPage}
          onRegister={(user) => {
            console.log('Registered user:', user);
            setCurrentPage('login');
          }}
        />
      )}

      {currentPage === 'forgot-password' && (
        <ForgotPasswordPage
          onNavigate={setCurrentPage}
          onPasswordReset={(email) => {
            console.log('Password reset requested for:', email);
            setResetEmail(email);
            setCurrentPage('reset-link-sent');
          }}
        />
      )}

      {currentPage === 'reset-link-sent' && (
        <ResetLinkSentPage
          email={resetEmail}
          onNavigate={setCurrentPage}
        />
      )}

      {currentPage === 'reset-password-confirm' && (
        <ResetPasswordConfirm
          email={resetEmail}
          onNavigate={setCurrentPage}
        />
      )}

      {currentPage === 'dashboard' && currentUser && (
        <Dashboard
          onNavigate={setCurrentPage}
          user={currentUser}
          onLogout={() => {
            setCurrentUser(null);
            setCurrentPage('welcome');
          }}
        />
      )}

      {currentPage === 'user-profile' && currentUser && (
        <UserProfile
          user={currentUser}
          onNavigate={setCurrentPage}
          onUpdateUser={(updatedUser) => {
            console.log('Updated user:', updatedUser);
            setCurrentUser(updatedUser);
          }}
        />
      )}

      {currentPage === 'edit-password' && currentUser && (
        <EditPasswordPage
          user={currentUser}
          onNavigate={setCurrentPage}
          onUpdateUser={(updatedUser) => {
            console.log('Updated user after password change:', updatedUser);
            setCurrentUser(updatedUser);
          }}
        />
      )}

    </>
  );
}

export default App;