# 📚 Practium

<div align="center">
  
  **AI-powered study assistant that turns your homework/notes into unlimited practice problems**

  <div align="center">
    <img width="600" height="600" alt="image" src="https://github.com/user-attachments/assets/bc285c8e-5198-42b7-87c4-a67c5e07759b" />
  </div>

  [Live Demo](https://practium.vercel.app)
  
</div>

## 📦 Technologies

* `Frontend`: Next.js, TypeScript, Tailwind CSS, Radix UI
* `Backend`: Flask (Python), Server-Sent Events (SSE)
* `Database`: Supabase (PostgreSQL)
* `AI/ML`: OpenAI GPT-4o, KaTeX for math rendering
* `Authentication`: Clerk
* `PDF Processing`: PyMuPDF (Fitz)
* `Deployment`: Docker, Vercel

## 🦄 Features

* **Practice Problem Generation**: Upload homework PDFs and get AI-generated similar practice problems tailored to your course material
* **Course/Assessment Organization**: Keep your study materials organized by course and assessment type for easy access
* **ChatGPT Tutor**: Get real-time help with step-by-step explanations for any problem you're stuck on
* **YouTube Suggestions**: Discover relevant tutorial videos based on the current problem topic
* **AI Grading**: Receive instant feedback on your practice problem solutions with detailed explanations

## 🎯 Why I Built This

It was nearing the end of the semester, I was struggling in one of my classes and failing in another (calc and chemistry specifically). I needed to lock in and fast.

I knew the best way I learn is through repetition, but these classes provided little way of doing that after you've already done the homework. So my idea was to create an app that would let me take pictures of the homework and have AI generate similar practice problems.

**The problem:**
* Limited practice material after completing homework
* Expensive tutoring services
* No personalized practice at scale
* Finals approaching in 2 weeks

**The solution:** Build Practium in 1 month while still attending classes.

## 👩🏽‍🍳 The Process

### Defining Core Features

<div align="center">
  <img width="1280" height="720" alt="image" src="https://github.com/user-attachments/assets/7da8eb38-c947-4dc2-9372-46500ccee95e" />
</div>

I listed out every possible feature I wanted into ChatGPT 4o and it suggested how I could go about each. But for the MVP, I narrowed down to five essential features:

1. **Practice Problem Generation** - The core feature
2. **Course/Assessment Organization** - Keep things structured
3. **ChatGPT Tutor** - Instant help when stuck
4. **Youtube Suggestions** - Visual learning support
5. **AI grading** - Immediate feedback loop

Although some of the other features seemed useful, I knew school would give me little time, so I had to focus on the necessities.

### Choosing the Tech Stack

<table>
<tr>
<td><strong>Technology</strong></td>
<td><strong>Category</strong></td>
<td><strong>Used in MVP?</strong></td>
<td><strong>Reason for Inclusion/Exclusion</strong></td>
</tr>
<tr>
<td><strong>Next.js</strong></td>
<td>Frontend</td>
<td>✅ Yes</td>
<td>Provided robust server-side rendering and routing for a fast, modular UI</td>
</tr>
<tr>
<td><strong>Tailwind CSS</strong></td>
<td>Frontend Styling</td>
<td>✅ Yes</td>
<td>Allowed rapid development of a responsive, modern UI with utility-first classes</td>
</tr>
<tr>
<td><strong>TypeScript</strong></td>
<td>Language</td>
<td>✅ Yes</td>
<td>Helped catch bugs early and improved developer experience with type safety</td>
</tr>
<tr>
<td><strong>Flask</strong></td>
<td>Backend</td>
<td>✅ Yes</td>
<td>Lightweight and simple to use — perfect for rapid prototyping of the API</td>
</tr>
<tr>
<td><strong>Server-Sent Events (SSE)</strong></td>
<td>Real-time Communication</td>
<td>✅ Yes</td>
<td>Enabled real-time updates to the frontend without complex WebSocket setup</td>
</tr>
<tr>
<td><strong>OpenAI (GPT-4o)</strong></td>
<td>AI Model</td>
<td>✅ Yes</td>
<td>Powered core AI features for user interaction and data interpretation</td>
</tr>
<tr>
<td><strong>Supabase</strong></td>
<td>Database</td>
<td>✅ Yes</td>
<td>Fast, hosted Postgres database with built-in auth support and real-time sync</td>
</tr>
<tr>
<td><strong>Clerk</strong></td>
<td>Authentication</td>
<td>✅ Yes</td>
<td>Simplified user auth and session management, reducing time spent building login flows</td>
</tr>
<tr>
<td><strong>PyMuPDF/Fitz</strong></td>
<td>OCR/Data Parsing</td>
<td>✅ Yes</td>
<td>Reliable, lightweight PDF text extraction without heavy setup or dependencies</td>
</tr>
<tr>
<td><strong>Docker</strong></td>
<td>Containerization</td>
<td>✅ Yes</td>
<td>Ensured consistent local and production environments and simplified deployment</td>
</tr>
<tr>
<td><strong>Radix UI</strong></td>
<td>UI Library</td>
<td>✅ Yes</td>
<td>Low-level, accessible components that worked seamlessly with Tailwind</td>
</tr>
<tr>
<td><strong>Framer Motion</strong></td>
<td>Animation Library</td>
<td>❌ No</td>
<td><strong>Deferred</strong> due to time constraints; animations not essential for MVP</td>
</tr>
<tr>
<td><strong>RAG</strong></td>
<td>AI Architecture</td>
<td>❌ No</td>
<td><strong>Not necessary for MVP</strong> — GPT-4o sufficed without external knowledge retrieval</td>
</tr>
</table>

### Technical Challenges I Faced

#### 1. Official YouTube API Rate Limits

**The Problem:** The YouTube Data API offers only 10,000 free quota units per day, with each search request costing 450 units. That's only ~22 searches per day. To increase the limit, I would've had to submit a request form or start paying.

**The Solution:** I switched to using a direct fetch request to YouTube's search endpoint, which handled over 100 requests per second without triggering rate limits in testing.
```python
# Instead of official API:
# youtube.search().list(q=query, part='snippet')

# Direct fetch approach:
response = requests.get(f'https://www.youtube.com/results?search_query={query}')
```

#### 2. ChatGPT Output Formatting

**The Problem:** While testing the ChatGPT API, I initially assumed there would be a straightforward way to replicate the formatting used on the official ChatGPT site. That wasn't the case. The documentation on formatting — especially around math and rich output — was buried.

**The Solution:** After digging through ChatGPT's actual website code, I discovered they use **KaTeX** for rendering math. I incorporated that into my project along with custom CSS for formatting.
```typescript
// Added KaTeX rendering for math expressions
import katex from 'katex';

// Detect and render inline math: $equation$
// Detect and render block math: $$equation$$
const renderMath = (text: string) => {
  return text.replace(/\$\$(.*?)\$\$/g, (_, equation) => 
    katex.renderToString(equation, { displayMode: true })
  );
};
```

#### 3. PDF Rendering Issues

**The Problem:** I initially used `pdf2image` to convert PDF pages into images. However, some pages would render completely blank because `pdf2image` depends on the system having the **exact fonts** used in the PDF installed.

**The Solution:** Switched to **PyMuPDF (`fitz`)**, which doesn't rely on system fonts and is much more robust.
```python
# Old approach (unreliable):
# from pdf2image import convert_from_path
# images = convert_from_path('homework.pdf')

# New approach (robust):
import fitz  # PyMuPDF
doc = fitz.open('homework.pdf')
for page in doc:
    text = page.get_text()  # Extracts text reliably
```

### UI/UX Challenge: The Layout Problem

<div align="center">
  <img width="3840" height="2160" alt="image" src="https://github.com/user-attachments/assets/e8159eab-fbc7-4625-905b-aac8b76bceac" />
</div>

On the practice problem page, I wanted to fit three key elements simultaneously:
- The **main question** (left)
- A **ChatGPT tutor** (right)
- **YouTube video suggestions** (bottom left)

This layout worked well for short or moderately sized questions. However, as questions became longer or included complex formatting (math, multi-line scenarios), the space quickly became constrained, and the YouTube suggestions would disappear from view.

**My workaround:**
- Reduced the question font size slightly to maximize vertical space
- Added a **dropdown toggle** for YouTube suggestions so users could access them on demand
- Still working on better solutions for multiple choice and image-based problems

## 📚 What I Learned

### 🔧 Technical Skills

* **API Limitations Are Real**: Sometimes the "official" API isn't the best solution. Being creative with workarounds (like direct fetching) can save your project when rate limits or costs become prohibitive.

* **Documentation Isn't Always Complete**: The ChatGPT API docs didn't cover formatting well. I had to reverse-engineer their website to discover KaTeX. This taught me to dig deeper when official docs fall short.

* **Font Dependencies Matter**: Learned the hard way that PDF rendering libraries can have hidden system dependencies. Now I evaluate libraries based on their actual dependencies, not just their advertised features.

* **Real-time Streaming**: Implementing Server-Sent Events (SSE) for GPT-4o responses taught me about handling asynchronous data streams and providing better UX during long-running AI operations.

### 🎯 Project Management

* **Scope Creep Is Deadly**: With finals approaching, I had to ruthlessly cut features (Framer Motion, RAG, advanced analytics) to ship on time. Learning to say "not now" was crucial for actually finishing.

* **MVP ≠ Perfect**: Shipped with known UI issues (layout constraints) because the core functionality worked. Perfection is the enemy of done, especially with hard deadlines.

### 🧠 Technical Highlights

* **Real-time AI Streaming**: Implemented Server-Sent Events (SSE) to stream GPT-4o responses in real-time, creating a ChatGPT-like experience without WebSocket complexity

* **PDF Text Extraction Pipeline**: Built a robust pipeline using PyMuPDF that handles various PDF formats and fonts without system dependencies

* **Math Rendering Engine**: Integrated KaTeX to properly display mathematical equations in both problems and AI responses, with support for inline and block equations

* **YouTube API Workaround**: Created a scraping solution that bypassed rate limits while staying within acceptable use, handling 100+ requests/second

## 💭 How It Could Be Improved

* **Better Layout System**: Implement collapsible sections or modals for complex multi-part questions and image-based problems
* **Animations**: Add Framer Motion for better UX once core features are stable
* **Advanced AI**: Implement RAG for more contextual problem generation based on course materials
* **Spaced Repetition**: Add algorithm to optimize practice scheduling based on user performance
* **Mobile Support**: Create responsive layouts for studying on-the-go
* **Offline Mode**: Cache problems for studying without internet connection

## 🚦 Running the Project

### Prerequisites
```bash
Node.js 18+
Python 3.9+
Docker (recommended)
```

### Installation
```bash
# Clone the repo
git clone https://github.com/yourusername/practium.git
cd practium

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
```

Add your credentials to `.env`:
```bash
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
```
```bash
# Run frontend (from root directory)
npm run dev

# Run backend (in a separate terminal)
cd backend
python app.py
```

Visit `http://localhost:3000`

### 🐳 Docker
```bash
docker-compose up
```

## 📊 Project Stats

* **Timeline**: 1 month (expected: 2 weeks)
* **Lines of Code**: ~5,000+
* **AI API Calls**: ~500 during development
* **Problems Generated**: 100+ test problems
* **Final Grade Improvement**: Passed both classes! 🎉

## 🛠️ Development Tools

* **Cursor AI** – AI-powered IDE that significantly sped up development
* **Figma** – UI design and prototyping
* **Postman** – API testing and debugging
* **OpenAI Playground** – Testing prompt engineering strategies

## 🎓 Impact

This project helped me:
- ✅ Pass my calculus class
- ✅ Pass my chemistry class  
- ✅ Learn production-level AI integration
- ✅ Build a portfolio piece that demonstrates real problem-solving
- ✅ Gain 100+ hours of hands-on experience with modern web technologies

---

<div align="center">
  
Built with ❤️ by Jaedon Farr
<br>
<p align="center">
  Readme created with the help of claude <img width="20" height="20" alt="Claude AI" src="https://github.com/user-attachments/assets/ccb8345f-6f6c-455e-8246-d15297f725fb" style="vertical-align: middle;" />
</p>

[Portfolio](https://jaedonfarr.vercel.app) • [LinkedIn](https://linkedin.com/in/jaedonfarr) • [GitHub](https://github.com/altaofficial)

</div>
