# 🧪 Keploy Chrome Extension Testing Guide
## Session 4 - Task 2: API Testing with Chrome Extension

### 📋 Task Overview
- **Objective**: Test API calls on websites using Keploy Chrome Extension
- **Requirements**: Test at least 2 different websites that make API calls
- **Deliverables**: Blog post about the experience + social media post

---

## 🚀 Setup Instructions

### Step 1: Download & Install the Extension

1. **Clone the Extension Repository**
   ```bash
   # Visit: https://github.com/keploy/extension
   # Download ZIP file and extract to a folder
   ```

2. **Load Extension in Chrome**
   ```
   1. Open Chrome and go to: chrome://extensions
   2. Enable "Developer mode" (toggle in top-right)
   3. Click "Load unpacked"
   4. Select the extracted Keploy extension folder
   5. Extension should now appear in your browser toolbar
   ```

### Step 2: Verify Installation
- Look for the Keploy icon in your Chrome toolbar
- Click on it to ensure the popup opens correctly
- You should see "Start Recording" and other options

---

## 🎯 Testing Plan: 2 Websites

### Website 1: JSONPlaceholder (Practice/Demo Site)
**URL**: `https://jsonplaceholder.typicode.com/`

**Why This Site?**
- Free testing API with predictable endpoints
- Makes AJAX calls that can be captured
- No authentication required

**Testing Steps:**
1. Navigate to: `https://jsonplaceholder.typicode.com/`
2. Open the Keploy extension and click "Start Recording"
3. Interact with the site:
   - Click on different posts
   - Try the example API calls shown on the page
   - Use their guide to make fetch requests
4. Stop recording after 2-3 minutes
5. Generate tests and copy cURL commands

**Expected API Calls to Capture:**
- `GET /posts`
- `GET /posts/1`
- `GET /posts/1/comments`
- `GET /users`

### Website 2: GitHub (Real-world Application)
**URL**: `https://github.com`

**Why This Site?**
- Makes numerous API calls for dynamic content
- Real-world application scenario
- Rich API interactions

**Testing Steps:**
1. Navigate to: `https://github.com`
2. Start Keploy recording
3. Perform these actions:
   - Search for repositories
   - Browse a repository (e.g., https://github.com/microsoft/vscode)
   - View issues and pull requests
   - Check user profiles
   - Look at commit history
4. Stop recording
5. Analyze captured API calls

**Expected API Calls to Capture:**
- Search API calls
- Repository metadata requests
- User profile API calls
- Issue/PR data requests

### Alternative Website Options:

#### Option A: Reddit
- **URL**: `https://www.reddit.com`
- **API Calls**: Post loading, comments, voting
- **Benefits**: Rich content loading, infinite scroll APIs

#### Option B: News Website (e.g., Hacker News)
- **URL**: `https://news.ycombinator.com`
- **API Calls**: Story loading, comment threads
- **Benefits**: Simple API structure, easy to understand

#### Option C: Social Media Platform
- **URL**: `https://twitter.com` or `https://linkedin.com`
- **API Calls**: Feed loading, profile data, notifications
- **Benefits**: Complex API interactions, real-time updates

---

## 📝 Testing Workflow

### Pre-Recording Checklist
- [ ] Extension installed and working
- [ ] Website loads properly
- [ ] Developer tools open (F12) to monitor network activity
- [ ] Clear browser cache for clean testing

### During Recording
1. **Start Recording**: Click Keploy extension → "Start Recording"
2. **Natural Browsing**: Use the website as a normal user would
3. **Diverse Actions**: Click different elements, navigate pages, interact with features
4. **Monitor Duration**: Record for 2-5 minutes per site
5. **Stop Recording**: Click extension → "Stop Recording"

### Post-Recording
1. **Review Captured Calls**: Check what APIs were captured
2. **Generate Tests**: Use Keploy's "Generate Tests" feature
3. **Copy cURL Commands**: Extract commands for manual testing
4. **Analyze Results**: Understand what types of APIs were discovered

---

## 📊 Documentation Template

### Testing Results Log

#### Website 1: [Website Name]
- **URL**: 
- **Testing Duration**: 
- **APIs Captured**: 
  - API Call 1: `GET /endpoint1`
  - API Call 2: `POST /endpoint2`
  - [List all captured calls]
- **Interesting Findings**:
  - Authentication methods used
  - API response patterns
  - Error handling observed
- **Screenshots**: [Include screenshots of extension in action]

#### Website 2: [Website Name]
- **URL**: 
- **Testing Duration**: 
- **APIs Captured**: 
- **Interesting Findings**:
- **Screenshots**: 

---

## ✍️ Blog Post Template

# From Manual API Testing to AI-Powered Automation: My Journey with Keploy Chrome Extension

## Introduction
Today I explored the Keploy Chrome Extension as part of Session 4 of the API Fellowship program. This tool promises to revolutionize how we test APIs by automatically capturing real-world API calls from websites and generating comprehensive test suites.

## The Challenge
Traditional API testing requires:
- Manual endpoint discovery
- Writing test cases from scratch
- Maintaining test suites as APIs evolve
- Understanding complex authentication flows

## The Solution: Keploy Chrome Extension
The extension automatically:
- Captures live API calls while browsing
- Generates test cases with real request/response data
- Provides cURL commands for immediate testing
- Offers insights into API behavior patterns

## Testing Experience

### Website 1: [Website Name]
I tested [website] and discovered [number] different API endpoints, including:
- [Key API 1]: Used for [purpose]
- [Key API 2]: Handles [functionality]

**Surprising Discovery**: [Share something unexpected you learned]

### Website 2: [Website Name]
On [second website], the extension captured [number] API calls, revealing:
- [Interesting pattern 1]
- [Authentication method used]
- [Performance characteristics]

## Key Insights

### What I Loved
1. **Zero Setup**: No configuration needed, just install and start recording
2. **Real-world Data**: Captures actual API calls with real payloads
3. **Instant Results**: Immediate access to cURL commands and test cases
4. **Learning Tool**: Great for understanding how modern web apps work

### Challenges Faced
1. [Any difficulty you encountered]
2. [How you solved it]
3. [Suggestions for improvement]

## Manual vs AI-Powered Testing

### Before Keploy
- ⏰ Hours spent reading API documentation
- 🔍 Manual endpoint discovery
- ✍️ Writing tests from scratch
- 🐛 Missing edge cases

### With Keploy
- ⚡ Instant API discovery
- 🤖 AI-generated test cases
- 📊 Real-world data patterns
- 🎯 Comprehensive coverage

## The Future of API Testing
This experience showed me that AI-powered testing tools like Keploy are not just convenient—they're necessary for modern development. The ability to instantly understand and test any API by simply browsing a website is game-changing.

## Conclusion
Going from 0 to 100% API test coverage in minutes instead of hours is transformative. The Keploy Chrome Extension democratizes API testing, making it accessible to developers, QA engineers, and anyone curious about how the web works.

### Next Steps
- Integrate Keploy into my regular development workflow
- Explore the platform's advanced features
- Share this knowledge with my team

**Have you tried AI-powered API testing? Share your experience in the comments!**

---

*This blog post was written as part of the Keploy API Fellowship Session 4. Try the extension yourself at [github.com/keploy/extension](https://github.com/keploy/extension)*

---

## 📱 Social Media Post Template

### LinkedIn Post
🚀 Just completed Session 4 of the @Keploy API Fellowship!

✨ Discovered the power of AI-driven API testing using the Keploy Chrome Extension

🎯 What I learned:
• Captured [X] APIs from [2] different websites in minutes
• Generated comprehensive test suites automatically  
• Went from manual testing to AI-powered automation
• Discovered hidden API patterns I never knew existed

💡 The difference is incredible:
❌ Before: Hours of manual API discovery and test writing
✅ Now: Instant API capture and AI-generated tests

This is the future of API testing! 🔮

#APITesting #AI #Keploy #WebDevelopment #Automation #TechFellowship

[Include screenshots of extension in action]

### Twitter Post
🧪 Just used the @keploy_io Chrome Extension to test APIs on real websites!

🔥 Results:
• [X] APIs captured automatically
• Zero setup time
• Instant test generation
• Real-world data patterns

From 0 to 100% API coverage in minutes! 🚀

This is why AI-powered testing is the future 

#APITesting #AI #WebDev #Keploy

### Dev.to Post Tags
```
#api #testing #ai #automation #webdev #chrome #keploy
```

---

## 🎯 Submission Checklist

### Task 2 Requirements
- [ ] ✅ Chrome extension installed successfully
- [ ] ✅ Tested at least 2 different websites
- [ ] ✅ Captured API calls from both websites
- [ ] ✅ Generated tests and cURL commands
- [ ] ✅ Documented findings and screenshots
- [ ] ✅ Blog post written and published
- [ ] ✅ Social media post shared
- [ ] ✅ Tagged Keploy team in social posts

### Blog Post Publishing
- [ ] Published on Dev.to with proper tags
- [ ] Published on Medium (optional)
- [ ] Shared on LinkedIn with professional insights
- [ ] Posted on Twitter with relevant hashtags
- [ ] Included screenshots and code examples

### Documentation
- [ ] Screenshots of extension in action
- [ ] List of captured API endpoints
- [ ] Performance observations
- [ ] Comparison with manual testing approach

---

## 🏆 Expected Outcomes

After completing this task, you should have:

1. **Practical Experience** with AI-powered API testing
2. **Documentation** of real-world API discovery
3. **Published Content** sharing your learning journey
4. **Technical Skills** in modern testing approaches
5. **Network Growth** through social media engagement

**Remember**: The goal is not just to complete the task, but to genuinely explore and understand how AI can revolutionize API testing workflows! 🚀 