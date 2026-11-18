import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomeRedirect, RequireRole } from './components/RequireRole';
import { AppointmentsPage } from './pages/clinic/AppointmentsPage';
import { NewAppointmentPage } from './pages/clinic/NewAppointmentPage';
import { ReportEditorPage } from './pages/clinic/ReportEditorPage';
import { LoginPage } from './pages/LoginPage';
import { MyAppointmentsPage } from './pages/patient/MyAppointmentsPage';
import { MyReportPage } from './pages/patient/MyReportPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<Layout />}>
          <Route element={<RequireRole role="CLINIC" />}>
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/appointments/new" element={<NewAppointmentPage />} />
            <Route path="/appointments/:appointmentId/report" element={<ReportEditorPage />} />
          </Route>
          <Route element={<RequireRole role="PATIENT" />}>
            <Route path="/my/appointments" element={<MyAppointmentsPage />} />
            <Route path="/my/reports/:reportId" element={<MyReportPage />} />
          </Route>
        </Route>
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
