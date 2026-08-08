import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Navbar } from "./components/Navbar";
import { ScrollToTop } from "./components/ScrollToTop";
import { CursorRocket } from "./components/CursorRocket";
import { SpaceBackground } from "./components/SpaceBackground";
import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Labs from "./pages/Labs";
import BlogIndex from "./pages/BlogIndex";
import BlogPost from "./pages/BlogPost";
import Apps from "./pages/Apps";
import "./styles/global.css";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename="/">
        <SpaceBackground />
        <ScrollToTop />
        <Navbar />
        <CursorRocket />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/labs" element={<Labs />} />
          <Route path="/blogs" element={<BlogIndex />} />
          <Route path="/blogs/:slug" element={<BlogPost />} />
          <Route path="/apps" element={<Apps />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
