import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "sonner";
import Index from "./pages/Index.tsx";
import AdminPageComponent from "./pages/AdminPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import PlatformPage from "./pages/PlatformPage.tsx";

const App = () => (
  <BrowserRouter>
    <Sonner />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminPageComponent />} />
      <Route path="/plataforma" element={<PlatformPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
