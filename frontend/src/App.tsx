import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import SplashPage from './pages/SplashPage';
import LoginPage from './pages/LoginPage';
import RegisterStep1Page from './pages/RegisterStep1Page';
import RegisterStep2AddressPage from './pages/RegisterStep2AddressPage';
import RegisterStep3DocumentsPage from './pages/RegisterStep3DocumentsPage';
import DashboardPage from './pages/DashboardPage';
import JobsPage from './pages/JobsPage';
import MessagesPage from './pages/MessagesPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import ApplyHousekeeperPage from './pages/ApplyHousekeeperPage';
import CreateJobPage from './pages/CreateJobPage';
import BrowseWorkersPage from './pages/BrowseWorkersPage';
import WorkerProfilePage from './pages/WorkerProfilePage';
import ProtectedRoute from './components/ProtectedRoute';

const router = createBrowserRouter([
  {
    path: '/',
    element: <SplashPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterStep1Page />,
  },
  {
    path: '/register/address',
    element: (
      <ProtectedRoute>
        <RegisterStep2AddressPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/register/documents',
    element: (
      <ProtectedRoute>
        <RegisterStep3DocumentsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/jobs',
    element: (
      <ProtectedRoute>
        <JobsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/messages',
    element: (
      <ProtectedRoute>
        <MessagesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/chat/:conversationId',
    element: (
      <ProtectedRoute>
        <ChatPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/chat/new',
    element: (
      <ProtectedRoute>
        <ChatPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/apply-housekeeper',
    element: (
      <ProtectedRoute>
        <ApplyHousekeeperPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/jobs/create',
    element: (
      <ProtectedRoute>
        <CreateJobPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/browse-workers',
    element: (
      <ProtectedRoute>
        <BrowseWorkersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/worker/:workerId',
    element: (
      <ProtectedRoute>
        <WorkerProfilePage />
      </ProtectedRoute>
    ),
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
