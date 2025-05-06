import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Components/Home';
import Login from './Components/Login';
import Register from './Components/Register';

import BlogEditor from './Components/BlogEditor';

import MainSection from './Components/MainSection';
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login/>}/>
        <Route path="/register" element={<Register/>}/>
       
       
        <Route path ="blogeditor" element ={<BlogEditor/>}/>
        <Route path ="/mainsection" element ={<MainSection/>}/>
      </Routes>
    </Router>
  );
}

export default App;