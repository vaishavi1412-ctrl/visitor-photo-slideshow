import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Register from './pages/Register.jsx';
import Returning from './pages/Returning.jsx';
import Upload from './pages/Upload.jsx';
import Success from './pages/Success.jsx';
import Slideshow from './pages/Slideshow.jsx';
import NotFound from './pages/NotFound.jsx';
import { AdminProvider } from './pages/admin/AdminContext.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminPhotos from './pages/admin/AdminPhotos.jsx';
import AdminVisitors from './pages/admin/AdminVisitors.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';

export default function App() {
  return (
    <Routes>
      {/* Visitor pages share the navigation bar and footer */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/returning" element={<Returning />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/success" element={<Success />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* The TV screen has no navigation bar */}
      <Route path="/slideshow" element={<Slideshow />} />

      {/* Admin area: the login page is open, everything else needs a signed-in admin */}
      <Route path="/admin" element={<AdminProvider />}>
        <Route path="login" element={<AdminLogin />} />
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="photos" element={<AdminPhotos />} />
          <Route path="visitors" element={<AdminVisitors />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>
    </Routes>
  );
}