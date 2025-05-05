import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Components/Home';
import Login from './Components/Login';
import Register from './Components/Register';
import Success from './Components/Success';
import BlogEditor from './Components/BlogEditor';

import MainSection from './Components/MainSection';
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login/>}/>
        <Route path="/register" element={<Register/>}/>
        <Route path="/success" element={<Success/>}/>
       
        <Route path ="blogeditor" element ={<BlogEditor/>}/>
        <Route path ="/mainsection" element ={<MainSection/>}/>
      </Routes>
    </Router>
  );
}

export default App;