import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Register from './pages/Register.jsx';
import Returning from './pages/Returning.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      {/* Pages that share the navigation bar and footer */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/returning" element={<Returning />} />
        <Route path="/upload" element={<ComingSoon title="Photo upload" />} />
        <Route path="/success" element={<ComingSoon title="Upload success" />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Full-screen and admin pages have their own look, added in later groups */}
      <Route path="/slideshow" element={<ComingSoon title="Full-screen slideshow" />} />
      <Route path="/admin/*" element={<ComingSoon title="Admin area" />} />
    </Routes>
  );
}