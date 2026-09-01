import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './lib/session.jsx';
import Shell from './ui/Shell.jsx';

import Login from './pages/Login.jsx';
import Me from './pages/Me.jsx';
import Chat from './pages/Chat.jsx';

import MemberHome from './pages/member/Home.jsx';
import GymDetail from './pages/member/GymDetail.jsx';
import MyGym from './pages/member/MyGym.jsx';
import RoutineView from './pages/member/RoutineView.jsx';
import WorkoutSession from './pages/member/WorkoutSession.jsx';
import Body from './pages/member/Body.jsx';
import Refund from './pages/member/Refund.jsx';
import PtRequestNew from './pages/member/PtRequestNew.jsx';
import PtRequestList from './pages/member/PtRequestList.jsx';
import PtRequestDetail from './pages/member/PtRequestDetail.jsx';
import FindTrainers from './pages/member/FindTrainers.jsx';
import TrainerPublic from './pages/member/TrainerPublic.jsx';
import PtBook from './pages/member/PtBook.jsx';
import Checkout from './pages/member/Checkout.jsx';

import WorkoutHome from './pages/workout/WorkoutHome.jsx';
import ProgramEdit from './pages/workout/ProgramEdit.jsx';
import WorkoutLive from './pages/workout/WorkoutLive.jsx';
import WorkoutAnalyze from './pages/workout/WorkoutAnalyze.jsx';
import WorkoutSettings from './pages/workout/WorkoutSettings.jsx';
import DayHistory from './pages/workout/DayHistory.jsx';

import TrainerHome from './pages/trainer/Home.jsx';
import Clients from './pages/trainer/Clients.jsx';
import ClientDetail from './pages/trainer/ClientDetail.jsx';
import ProxyEntry from './pages/trainer/ProxyEntry.jsx';
import SendRoutine from './pages/trainer/SendRoutine.jsx';
import TrainerRoutineEdit from './pages/trainer/TrainerRoutineEdit.jsx';
import ClientOverload from './pages/trainer/ClientOverload.jsx';
import ClientWorkout from './pages/trainer/ClientWorkout.jsx';
import RequestBoard from './pages/trainer/RequestBoard.jsx';
import RequestApply from './pages/trainer/RequestApply.jsx';
import TrainerProfileEdit from './pages/trainer/TrainerProfileEdit.jsx';
import TrainerSchedule from './pages/trainer/TrainerSchedule.jsx';
import TrainerSettings from './pages/trainer/Settings.jsx';

import OwnerHome from './pages/owner/Home.jsx';
import Machines from './pages/owner/Machines.jsx';
import Roster from './pages/owner/Roster.jsx';
import OwnerRecommend from './pages/owner/RecommendRoutine.jsx';
import Prices from './pages/owner/Prices.jsx';
import OwnerPayments from './pages/owner/Payments.jsx';
import AdminHome from './pages/admin/Home.jsx';

/* 역할이 첫 화면을 정한다.
   회원은 "주변/내 헬스장", 트레이너는 "오늘 일정", 관장은 "현황". */
const HOME = { member: '/', trainer: '/t', owner: '/o', admin: '/admin' };

function RoleRoute({ session, allow, children }) {
  return allow.includes(session.role) ? children : <Navigate to={HOME[session.role]} replace />;
}

export default function App() {
  const { session, loading } = useSession();
  if (loading) return <div className="boot"><strong>GymLink</strong><span>안전하게 연결하는 중…</span></div>;
  if (!session) return <Login />;

  return (
    <Routes>
      <Route element={<Shell />}>
        {/* 공통 */}
        <Route path="/me" element={<Me />} />
        <Route path="/chat" element={<Chat />} />

        {/* 회원 */}
        <Route path="/" element={session.role === 'member' ? <MemberHome /> : <Navigate to={HOME[session.role]} replace />} />
        <Route path="/gym/:gymId" element={<RoleRoute session={session} allow={['member']}><GymDetail /></RoleRoute>} />
        <Route path="/my" element={<RoleRoute session={session} allow={['member']}><MyGym /></RoleRoute>} />
        <Route path="/my/routine/:routineId" element={<RoleRoute session={session} allow={['member']}><RoutineView /></RoleRoute>} />
        <Route path="/my/routine/:routineId/workout" element={<RoleRoute session={session} allow={['member']}><WorkoutSession /></RoleRoute>} />
        <Route path="/body" element={<RoleRoute session={session} allow={['member']}><Body /></RoleRoute>} />
        <Route path="/refund" element={<RoleRoute session={session} allow={['member']}><Refund /></RoleRoute>} />
        <Route path="/pt" element={<RoleRoute session={session} allow={['member']}><PtRequestList /></RoleRoute>} />
        <Route path="/pt/new" element={<RoleRoute session={session} allow={['member']}><PtRequestNew /></RoleRoute>} />
        <Route path="/pt/:requestId" element={<RoleRoute session={session} allow={['member']}><PtRequestDetail /></RoleRoute>} />
        <Route path="/book" element={<RoleRoute session={session} allow={['member']}><PtBook /></RoleRoute>} />
        <Route path="/find" element={<RoleRoute session={session} allow={['member']}><FindTrainers /></RoleRoute>} />
        <Route path="/trainers/:trainerId" element={<RoleRoute session={session} allow={['member']}><TrainerPublic /></RoleRoute>} />
        <Route path="/checkout/:planId" element={<RoleRoute session={session} allow={['member']}><Checkout /></RoleRoute>} />

        {/* 운동 */}
        <Route path="/workout" element={<RoleRoute session={session} allow={['member', 'trainer']}><WorkoutHome /></RoleRoute>} />
        <Route path="/workout/programs/new" element={<RoleRoute session={session} allow={['member']}><ProgramEdit /></RoleRoute>} />
        <Route path="/workout/programs/:id" element={<RoleRoute session={session} allow={['member']}><ProgramEdit /></RoleRoute>} />
        <Route path="/workout/live" element={<RoleRoute session={session} allow={['member', 'trainer']}><WorkoutLive /></RoleRoute>} />
        <Route path="/workout/analyze" element={<RoleRoute session={session} allow={['member', 'trainer']}><WorkoutAnalyze /></RoleRoute>} />
        <Route path="/workout/settings" element={<RoleRoute session={session} allow={['member', 'trainer']}><WorkoutSettings /></RoleRoute>} />
        <Route path="/workout/day/:date" element={<RoleRoute session={session} allow={['member', 'trainer']}><DayHistory /></RoleRoute>} />

        {/* 트레이너 */}
        <Route path="/t" element={<RoleRoute session={session} allow={['trainer']}><TrainerHome /></RoleRoute>} />
        <Route path="/t/schedule" element={<RoleRoute session={session} allow={['trainer']}><TrainerSchedule /></RoleRoute>} />
        <Route path="/t/settings" element={<RoleRoute session={session} allow={['trainer']}><TrainerSettings /></RoleRoute>} />
        <Route path="/t/profile" element={<RoleRoute session={session} allow={['trainer']}><TrainerProfileEdit /></RoleRoute>} />
        <Route path="/t/requests" element={<RoleRoute session={session} allow={['trainer']}><RequestBoard /></RoleRoute>} />
        <Route path="/t/requests/:requestId" element={<RoleRoute session={session} allow={['trainer']}><RequestApply /></RoleRoute>} />
        <Route path="/t/clients" element={<RoleRoute session={session} allow={['trainer']}><Clients /></RoleRoute>} />
        <Route path="/t/clients/:memberId" element={<RoleRoute session={session} allow={['trainer']}><ClientDetail /></RoleRoute>} />
        <Route path="/t/clients/:memberId/body" element={<RoleRoute session={session} allow={['trainer']}><ProxyEntry /></RoleRoute>} />
        <Route path="/t/clients/:memberId/send" element={<RoleRoute session={session} allow={['trainer']}><SendRoutine /></RoleRoute>} />
        <Route path="/t/clients/:memberId/overload" element={<RoleRoute session={session} allow={['trainer']}><ClientOverload /></RoleRoute>} />
        <Route path="/t/clients/:memberId/workout/:routineId" element={<RoleRoute session={session} allow={['trainer']}><ClientWorkout /></RoleRoute>} />
        <Route path="/t/routines/new" element={<RoleRoute session={session} allow={['trainer']}><TrainerRoutineEdit /></RoleRoute>} />
        <Route path="/t/routines/:routineId" element={<RoleRoute session={session} allow={['trainer']}><TrainerRoutineEdit /></RoleRoute>} />

        {/* 관장 */}
        <Route path="/o" element={<RoleRoute session={session} allow={['owner']}><OwnerHome /></RoleRoute>} />
        <Route path="/o/machines" element={<RoleRoute session={session} allow={['owner']}><Machines /></RoleRoute>} />
        <Route path="/o/recommend" element={<RoleRoute session={session} allow={['owner']}><OwnerRecommend /></RoleRoute>} />
        <Route path="/o/prices" element={<RoleRoute session={session} allow={['owner']}><Prices /></RoleRoute>} />
        <Route path="/o/payments" element={<RoleRoute session={session} allow={['owner']}><OwnerPayments /></RoleRoute>} />
        <Route path="/o/roster" element={<RoleRoute session={session} allow={['owner']}><Roster /></RoleRoute>} />

        {/* 본사 */}
        <Route path="/admin" element={<RoleRoute session={session} allow={['admin']}><AdminHome /></RoleRoute>} />

        <Route path="*" element={<Navigate to={HOME[session.role]} replace />} />
      </Route>
    </Routes>
  );
}
