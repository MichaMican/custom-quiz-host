import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Display from './pages/Display'
import RemoteControl from './pages/RemoteControl'
import Buzzer from './pages/Buzzer'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Display />} />
        <Route path="/display" element={<Display />} />
        <Route path="/remote" element={<RemoteControl />} />
        <Route path="/buzzer" element={<Buzzer />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
