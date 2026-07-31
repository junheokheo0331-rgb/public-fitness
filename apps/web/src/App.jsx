import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './lib/session.jsx';
import Shell from './ui/Shell.jsx';

import Login from './pages/Login.jsx';
import Me from './pages/Me.jsx';

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

import TrainerHome from './pages/trainer/Home.jsx';
import Clients from './pages/trainer/Clients.jsx';
import ClientDetail from './pages/trainer/ClientDetail.jsx';
import ProxyEntry from './pages/trainer/ProxyEntry.jsx';
import SendRoutine from './pages/trainer/SendRoutine.jsx';
import TrainerRoutineEdit from './pages/trainer/TrainerRoutineEdit.jsx';
import RequestBoard from './pages/trainer/RequestBoard.jsx';
import RequestApply from './pages/trainer/RequestApply.jsx';
import TrainerProfileEdit from './pages/trainer/TrainerProfileEdit.jsx';

import OwnerHome from './pages/owner/Home.jsx';
import Machines from './pages/owner/Machines.jsx';
import Roster from './pages/owner/Roster.jsx';

/* 역할이 첫 화면을 정한다.
   회원은 "주변/내 헬스장", 트레이너는 "오늘 일정", 관장은 "현황". */
const HOME = { member: '/', trainer: '/t', owner: '/o' };

export default function App() {
  const { session } = useSession();
  if (!session) return <Login />;

  return (
    <Routes>
      <Route element={<Shell />}>
        {/* 공통 */}
        <Route path="/me" element={<Me />} />

        {/* 회원 */}
        <Route path="/" element={session.role === 'member' ? <MemberHome /> : <Navigate to={HOME[session.role]} replace />} />
        <Route path="/gym/:gymId" element={<GymDetail />} />
        <Route path="/my" element={<MyGym />} />
        <Route path="/my/routine/:routineId" element={<RoutineView />} />
        <Route path="/my/routine/:routineId/workout" element={<WorkoutSession />} />
        <Route path="/body" element={<Body />} />
        <Route path="/refund" element={<Refund />} />
        <Route path="/pt" element={<PtRequestList />} />
        <Route path="/pt/new" element={<PtRequestNew />} />
        <Route path="/pt/:requestId" element={<PtRequestDetail />} />
        <Route path="/find" element={<FindTrainers />} />
        <Route path="/trainers/:trainerId" element={<TrainerPublic />} />

        {/* 트레이너 */}
        <Route path="/t" element={<TrainerHome />} />
        <Route path="/t/profile" element={<TrainerProfileEdit />} />
        <Route path="/t/requests" element={<RequestBoard />} />
        <Route path="/t/requests/:requestId" element={<RequestApply />} />
        <Route path="/t/clients" element={<Clients />} />
        <Route path="/t/clients/:memberId" element={<ClientDetail />} />
        <Route path="/t/clients/:memberId/body" element={<ProxyEntry />} />
        <Route path="/t/clients/:memberId/send" element={<SendRoutine />} />
        <Route path="/t/routines/new" element={<TrainerRoutineEdit />} />
        <Route path="/t/routines/:routineId" element={<TrainerRoutineEdit />} />

        {/* 관장 */}
        <Route path="/o" element={<OwnerHome />} />
        <Route path="/o/machines" element={<Machines />} />
        <Route path="/o/roster" element={<Roster />} />

        <Route path="*" element={<Navigate to={HOME[session.role]} replace />} />
      </Route>
    </Routes>
  );
}
