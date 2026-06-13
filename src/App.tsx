import { useState } from 'react'
import { Layout, type PageKey } from './components/Layout'
import ShiftPlanner from './pages/ShiftPlanner'
import PartnerHours from './pages/PartnerHours'
import Assignment from './pages/Assignment'
import Attendance from './pages/Attendance'
import Partners from './pages/Partners'
import { ToastContainer } from './components/ui/toast'
import './index.css'

function App() {
  const [page, setPage] = useState<PageKey>('shift-planner')

  return (
    <>
      <Layout activePage={page} onNavigate={setPage}>
        {page === 'shift-planner' && <ShiftPlanner />}
        {page === 'partner-hours' && <PartnerHours />}
        {page === 'assignment'    && <Assignment />}
        {page === 'attendance'    && <Attendance />}
        {page === 'partners'      && <Partners />}
      </Layout>
      <ToastContainer />
    </>
  )
}

export default App
