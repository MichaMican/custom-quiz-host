import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Display from './pages/Display'
import RemoteControl from './pages/RemoteControl'
import Buzzer from './pages/Buzzer'
import Plan from './pages/Plan'
import Merge from './pages/Merge'
import VersionBadge from './components/VersionBadge'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Display />} />
        <Route path="/display" element={<Display />} />
        <Route path="/remote" element={<RemoteControl />} />
        <Route path="/buzzer" element={<Buzzer />} />
        <Route path="/plan" element={<Plan />} />
        <Route path="/merge" element={<Merge />} />
      </Routes>
      <VersionBadge />
    </BrowserRouter>
  )
}

export default App
