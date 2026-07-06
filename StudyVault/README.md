# StudyVault – AI Powered Note Organizer

StudyVault is a mobile app that helps students bring their scattered study materials — PDFs, lecture slides, and photos of handwritten notes — into one organized, searchable place. It adds AI-powered summarization and quiz generation on top of file management so students can review material faster and retain more of it, especially during exam periods.

Built as a group project for **CCS3102 | CSE3102 – Mobile Computing**, Faculty of Computing, University of Sri Jayewardenepura.

## Features

- **Secure authentication** – register and log in with Firebase Authentication
- **Upload notes** – add PDFs or images (camera roll or document picker)
- **Folders** – group related notes together for easier navigation
- **Pin important notes** – mark key files so they're always easy to find
- **AI summarization** – summarize a PDF or image directly with Gemini, without a separate text-extraction step
- **AI-generated quizzes** – turn a note's summary into a short revision quiz to test yourself
- **Profile management** – update profile photo and account details, change password
- **Local + cloud storage** – note files are cached locally for fast access, with Firestore/Firebase Storage as the backing store

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) / React Native |
| Language | TypeScript |
| Navigation | React Navigation (native stack) |
| Backend / Auth / Database | Firebase (Authentication, Firestore, Storage) |
| AI | Google Gemini API (`gemini-2.5-flash`) — native PDF & image understanding, structured JSON output |
| Local storage | Expo FileSystem, AsyncStorage |
| File pickers | Expo Document Picker, Expo Image Picker |

## Project Structure

```
StudyVault/
├── App.tsx                 # Navigation stack & route definitions
├── index.ts                 # Entry point
├── screens/
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   ├── HomeScreen.tsx
│   ├── AddNoteScreen.tsx
│   ├── NoteDetailScreen.tsx
│   ├── FolderDetailScreen.tsx
│   ├── QuizScreen.tsx
│   ├── ProfileScreen.tsx
│   └── ChangePasswordScreen.tsx
├── services/
│   ├── noteService.ts        # Firestore CRUD for notes
│   ├── folderService.ts      # Firestore CRUD for folders
│   ├── fileStorageService.ts # Resolves local/remote file URIs
│   ├── profileService.ts     # Profile image storage
│   ├── geminiService.ts      # AI summarization (PDF/image → summary)
│   └── quizService.ts        # Summary → quiz questions
├── theme/                    # Theme context & color tokens
└── assets/                   # Icons, splash screen, etc.
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npx expo` works without a global install)
- The [Expo Go](https://expo.dev/go) app on your phone, or an Android/iOS emulator
- A Firebase project (Authentication, Firestore, and Storage enabled)
- A [Google Gemini API key](https://ai.google.dev/)

### Installation

1. Clone the repository and move into the app folder:
   ```bash
   git clone <repo-url>
   cd app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and fill in your own keys:
   ```bash
   cp .env.example .env
   ```

   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   EXPO_PUBLIC_FIREBASE_APP_ID=

   EXPO_PUBLIC_GEMINI_API_KEY=
   ```

4. Start the development server:
   ```bash
   npm start
   ```
   Then scan the QR code with Expo Go, or run:
   ```bash
   npm run android   # Android emulator/device
   npm run ios       # iOS simulator/device
   npm run web       # Web preview
   ```

## How It Works

1. A student creates an account and logs in securely.
2. They upload a PDF or image-based note, optionally into a folder.
3. Notes can be viewed, organized, renamed, moved, or pinned as important.
4. From a note's detail view, the student can request an AI summary — Gemini reads the PDF/image directly and returns a structured summary, so no separate OCR or text-extraction step is needed.
5. From a generated summary, the student can create a short AI-generated quiz to test their recall of the material.

## Team – Group 20

| Name | Role |
|---|---|
| T. G. Kithmi Pabodha | Frontend Developer |
| M. D. C. E. Gunathilaka | Backend Developer |
| M. A. O. Rodrigo | AI Integration Developer |

Developed for the Faculty of Computing, University of Sri Jayewardenepura, as part of the Mobile Computing (CCS3102 / CSE3102) module.

## License

This project was developed for academic purposes as part of a university coursework module.