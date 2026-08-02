Act as a world-class Creative Technologist, WebGL Developer, and AI/ML Educator. Build a premium, commercial-grade single-page web app (HTML + TailwindCSS + Three.js + JavaScript) designed as a 3D Interactive Gamified Platform for learning Python and Machine Learning.

The app must be entirely self-contained, client-side only, and save all states in localStorage so it can be deployed instantly to Netlify, Vercel, or GitHub Pages as a premium product.

Implement the following architecture perfectly:

1. Immersive 3D Space Theme UI (Three.js):

- Embed a full-screen Three.js canvas as the background or as an interactive dashboard element.
- Create a 3D "Data Nebula" or "Neural Network Constellation" using floating particles (THREE.Points).
- The 3D nodes should subtly pulse, rotate, and react to user progression (e.g., changing colors or exploding into a particle shower when a lesson is cleared).
- Use a high-end cyberpunk/space-station dashboard overlay with glowing glassmorphism panels (Tailwind arbitrary classes like backdrop-blur-md, border-cyan-500/30).

2. Skill Tiers & "Split-Screen" Hands-On Workflow:

- Structure the app into three tiers: Beginner, Apprentice, and Pro.
- Implement a strict "Read-a-line, Write-a-line" format. Split the screen: Left side shows snack-sized concept cards with interactive formulas (using clean KaTeX or math formatting); Right side features a live, interactive code editor console.
- Beginner: Core Python logic. The editor challenges them to fix or write loops/functions.
- Apprentice: Pandas & NumPy. The editor mimics operations on data matrices, showing visual changes to a mock grid.
- Pro: Scikit-learn & TensorFlow. The editor requires fixing hyperparameter structures, which updates a live, visual 2D/3D performance graph on screen.

3. Interactive Mock Compiler & Verification Engine:

- Build a robust JS-based regex and string verification system that mimics a terminal.
- Users must type the code or fill in the blank lines. Clicking "Run Code" executes a simulated output in a terminal console.
- If correct, log success, award XP, update the 3D scene, and unlock the next module. If incorrect, give targeted, helpful debug hints.

4. Gamified Commercial Loops & LocalStorage:

- Maintain a local persistent state: Level, total XP, tier progress, and unlocked badges.
- Include a visual dashboard displaying a streak counter, a profile summary, and an "Export Progress Certificate" button (generating a mock JSON completion receipt for future monetization tracking).
- Add a "Reset Progress" option.

Deliver this as a completely single-file HTML wrapper with production-ready embedded CSS and JavaScript. Include a fully populated, highly polished first lesson for each tier so the product works flawlessly immediately.
