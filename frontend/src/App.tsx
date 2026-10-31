import { Navigate, Outlet, Route, Routes } from 'react-router'
import { PhoneFrame } from './components/PhoneFrame'
import { RequireRole } from './components/RequireRole'
import { AppLayout } from './layouts/AppLayout'
import { PatientShell } from './layouts/PatientShell'
import { Account } from './screens/Account'
import { Assess } from './screens/Assess'
import { Chat } from './screens/Chat'
import { Doctor } from './screens/Doctor'
import { DoctorDashboard } from './screens/DoctorDashboard'
import { Follow } from './screens/Follow'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Messages } from './screens/Messages'
import { Notifications } from './screens/Notifications'
import { Result } from './screens/Result'
import { Splash } from './screens/Splash'
import { Tests } from './screens/Tests'

export default function App() {
  return (
    <Routes>
      {/* Everything inside this route shows in the phone frame */}
      <Route
        element={
          <PhoneFrame>
            <Outlet />
          </PhoneFrame>
        }
      >
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />

        {/* The patient's screens: only open for a signed-in patient */}
        <Route element={<RequireRole role="patient" />}>
          {/* PatientShell keeps her file at the clinic up to date and shows the doctor's news */}
          <Route element={<PatientShell />}>
            <Route element={<AppLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/assess" element={<Assess />} />
              <Route path="/assess/result" element={<Result />} />
              <Route path="/doctor" element={<Doctor />} />
              <Route path="/tests" element={<Tests />} />
              <Route path="/follow" element={<Follow />} />
              <Route path="/follow/:seg" element={<Follow />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/account" element={<Account />} />
            </Route>
            {/* The messages arrange their own space: the list scrolls and the box to write stays put */}
            <Route element={<AppLayout bare />}>
              <Route path="/messages" element={<Messages />} />
            </Route>
            {/* Wanas has its own header, so it doesn't use the top bar and the bottom buttons */}
            <Route path="/chat" element={<Chat />} />
          </Route>
        </Route>
      </Route>

      {/* The doctor's dashboard: whole screen, only for a signed-in doctor */}
      <Route element={<RequireRole role="doctor" />}>
        <Route path="/dashboard" element={<DoctorDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}
