import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Navbar } from "./components/Navbar";
import { ScrollToTop } from "./components/ScrollToTop";
import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Labs from "./pages/Labs";
import BlogIndex from "./pages/BlogIndex";
import BlogPost from "./pages/BlogPost";
import "./styles/global.css";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename="/">
        <ScrollToTop />
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/labs" element={<Labs />} />
          <Route path="/blogs" element={<BlogIndex />} />
          <Route path="/blogs/:slug" element={<BlogPost />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
