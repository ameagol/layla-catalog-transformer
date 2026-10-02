import { Navigate, Route, Routes } from 'react-router-dom'

import { DatasetScreen } from '@/features/dataset'
import { FindingsScreen } from '@/features/findings'
import { ProjectsScreen } from '@/features/projects'
import { RulesScreen } from '@/features/rules'

import { AppShell } from './AppShell'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/projects" element={<ProjectsScreen />} />
        <Route path="/rules" element={<RulesScreen />} />
        <Route path="/dataset" element={<DatasetScreen />} />
        <Route path="/analysis" element={<Navigate replace to="/findings" />} />
        <Route path="/copilot" element={<Navigate replace to="/findings" />} />
        <Route path="/findings" element={<FindingsScreen />} />
        <Route path="/export" element={<Navigate replace to="/findings" />} />
        <Route path="/settings" element={<Navigate replace to="/projects" />} />
        <Route path="*" element={<Navigate replace to="/projects" />} />
      </Route>
    </Routes>
  )
}
