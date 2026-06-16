# FIFA Scoreboard & Tournament Bracket Tracker

A premium, glassmorphic Single Page Application (SPA) to track FIFA tournament brackets (from Round of 64 down to the Finals) and accumulate points. The application features user authentication, score submission, automatic progression of winning teams, a live leaderboard, and an Admin Control Panel to configure point weights dynamically.

---

## Features

1. **Google Authentication & Roles**:
   - Google Sign-In via Firebase Authentication.
   - Dual-user system: **Admin** (can modify points configuration, reset matches, and manage user roles) and **Players** (can record match outcomes and earn points).
   - **Offline Mock Mode**: Immediate offline testing with predefined mock Admin and Player profiles.

2. **Match Outcome Submissions**:
   - Players can click on any populated match card in the active round to enter scorelines.
   - Ties are supported in Level 1 (first round). Knockout rounds require a winner (e.g. including extra time/penalty shootout goals).
   - Winner of a match automatically propagates to the home/away slot of the corresponding match in the next round.

3. **Admin Control Panel**:
   - Dynamic point configurations for each round (defaults: Level 1 = 10 pts, Level 2 = 20 pts, Level 3 = 40 pts, Level 4 = 60 pts, Level 5 = 80 pts, Level 6/Finals = 100 pts).
   - Real-time score recalculation: updates retroactively apply to players' total scores upon modification.
   - Reset operations: options to clear match scores only or randomize the bracket with 64 teams.
   - User Promotion/Demotion tools.

4. **Live Leaderboard**:
   - Instantly showcases player rankings, total reported games, and points.

---

## How to Run Locally

### Option A: Double-Click index.html (Simplest)
Simply double-click the `index.html` file in your file explorer. It will open in your default browser. Since the project uses standard ES Modules, some strict browser environments may block modules on `file://` protocols. If that occurs, use Option B.

### Option B: Local PowerShell Server (Recommended)
We have provided a built-in server that runs without Node.js or Python.
1. Right-click the project folder and select **Open in Terminal** (or open PowerShell and navigate to the directory).
2. Run the following command:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\run_local_server.ps1
   ```
3. Open your browser and navigate to **`http://localhost:8000`**.

---

## Connecting to Firebase (Google Sign-In & Sync)

By default, the application runs in **Mock Mode** using browser `localStorage` for immediate testing. To connect it to your live cloud database with actual Google Authentication:

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and follow the prompts.
3. Once the project is created, select the Web platform icon (`</>`) to add an app. Enter a nickname (e.g., `fifa-scoreboard`) and register it.
4. Copy the `firebaseConfig` object containing variables like `apiKey`, `authDomain`, `projectId`, etc.
5. In the Firebase Project Sidebar:
   - Go to **Build > Authentication**, click **Get Started**, enable the **Google** provider, and click **Save**.
   - Go to **Build > Firestore Database**, click **Create Database**, select a region near you, start in **production mode** or **test mode**, and create the database.
6. Open your local Scoreboard app, click the **Database Icon** (`Dev Settings`) at the bottom left, paste your config values, and click **Connect DB**. The app will reload and run on Firebase!
   - *Note: The very first user to sign in to the Firebase database will be automatically promoted to Admin.*

---

## Host and Deploy to GitHub Pages

We have provided a custom utility to create a GitHub repository and push your code without Git installed on your system:

1. Generate a GitHub Personal Access Token (Classic) with the `repo` scope selected: [GitHub Token Settings](https://github.com/settings/tokens).
2. In PowerShell, execute the deployment script:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\deploy_to_github.ps1
   ```
3. Enter your **GitHub Username**, a **Repository Name**, and paste your **Personal Access Token**.
4. The script will automatically create the repository on GitHub and upload all files.
5. **Enable Free Hosting**:
   - Open your new repository on GitHub.
   - Go to **Settings > Pages**.
   - Under *Build and deployment*, set *Source* to **Deploy from a branch**.
   - Select the **main** branch and root folder (**`/`**), then click **Save**.
   - Your application will be live at `https://<username>.github.io/<repo-name>/` in a few minutes!
