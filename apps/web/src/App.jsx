import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './lib/session.jsx';
import Shell from './ui/Shell.jsx';

import Login from './pages/Login.jsx';
import Me from './pages/Me.jsx';

import MemberHome from './pages/member/Home.jsx';
import GymDetail from './pages/member/GymDetail.jsx';
import MyGym from './pages/member/MyGym.jsx';
import RoutineView from './pages/member/RoutineView.jsx';
import Body from './pages/member/Body.jsx';
import Refund from './pages/member/Refund.jsx';

import TrainerHome from './pages/trainer/Home.jsx';
import Clients from './pages/trainer/Clients.jsx';
import ProxyEntry from './pages/trainer/ProxyEntry.jsx';
import SendRoutine from './pages/trainer/SendRoutine.jsx';

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
        <Route path="/body" element={<Body />} />
        <Route path="/refund" element={<Refund />} />

        {/* 트레이너 */}
        <Route path="/t" element={<TrainerHome />} />
        <Route path="/t/clients" element={<Clients />} />
        <Route path="/t/clients/:memberId/body" element={<ProxyEntry />} />
        <Route path="/t/clients/:memberId/send" element={<SendRoutine />} />

        {/* 관장 */}
        <Route path="/o" element={<OwnerHome />} />
        <Route path="/o/machines" element={<Machines />} />
        <Route path="/o/roster" element={<Roster />} />

        <Route path="*" element={<Navigate to={HOME[session.role]} replace />} />
      </Route>
    </Routes>
  );
}
