Smart Health Finance

Live Website: https://smart-health-finance.onrender.com/
Smart Health Finance is a web application designed to help young adults understand and manage healthcare expenses. It provides tools for budgeting, comparing healthcare options, and exploring financial planning strategies through a clear and user-friendly interface.
If you would like to use the application without setting it up locally, you can access it directly using the live website link above.

Features:
- Interactive financial dashboard
- Healthcare budgeting tools
- Comparison of healthcare options
- AI-powered assistant for guidance
- Responsive design for both desktop and mobile devices

Running the Website Locally (Step-by-Step for Beginners)

These steps are only necessary if you want to run or modify the code on your own computer.


1. Install Required Software

  You need to install Node.js, which allows your computer to run the application.
  Download it here: https://nodejs.org/
  Choose the LTS (recommended) version
  Install it like a normal application
  Restart your computer after installation


2. Download the Project Code

  If you have the project as a ZIP file:
  Right-click the ZIP file
  Select "Extract All"
  Open the extracted folder


3. Open the Project in Terminal

  On Windows (Recommended Method)
    Open the project folder
    Hold Shift and right-click inside the folder (on empty space)
    Click "Open PowerShell window here" or "Open in Terminal"
    
  On Mac
    Right-click inside the folder
    Select "Open Terminal"


4. Install Dependencies

  In the terminal, run:
  npm install
  This installs all required dependencies for the project.


5. Run the Website

  In the terminal, run:
  npm start
  If that does not work, try:
  node server.js


6. Open the Website

  After running the server, you should see a message similar to:
  Server running on http://localhost:3000

  Open your browser and go to:
  http://localhost:3000


Optional: AI Features Setup

  If the application includes an AI assistant, you may need to configure an API key.
  Create a file named .env in the project folder
  Add the following line:
  OPENAI_API_KEY=your_api_key_here
  Save the file


This application is deployed using Render and can be accessed at:
https://smart-health-finance.onrender.com/
