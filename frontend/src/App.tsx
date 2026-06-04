import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import NewTask from './pages/NewTask'
import TaskView from './pages/TaskView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tasks/new" element={<NewTask />} />
        <Route path="/tasks/:id" element={<TaskView />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
