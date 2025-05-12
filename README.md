# YTView

YTView is an Electron-based YouTube viewer application that enhances the YouTube experience with built-in features that don't rely on browser extensions.

## Features

- **Ad Blocking**: Network-level and content-script ad blocking with visual indicators for detected ads
- **SponsorBlock Integration**: Native API integration to skip sponsored segments in videos
- **DeArrow Integration**: Eliminates clickbait titles and thumbnails using the DeArrow API
- **Return YouTube Dislike**: Shows dislike counts on videos using the Return YouTube Dislike API
- **Video Downloads**: Download videos as MP3 or MP4 using ytdl-core
- **Customizable Features**: Toggle features on/off through the features panel

## Installation

### Prerequisites

- Node.js (16+)
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the application:
   ```
   npm start
   ```

### Building the Application

To build the application for your platform:

```
npm run build
```

The built application will be available in the `dist` directory.

## Usage

- Navigate with the address bar or use the back/forward/refresh/home buttons
- Toggle the download panel using the button at the bottom right
- Enter a YouTube URL and select MP3 or MP4 format to download videos
- Downloaded files can be opened directly from the application

## Known Issues

- **Bluetooth Audio Mode Switching**: When using Bluetooth headphones/earbuds, the application may cause them to switch to call/headset mode (lower audio quality). This appears to be related to how Electron handles audio contexts and media devices. This issue is being tracked and will be addressed in a future update.

- **Ad Blocking Refinement**: The ad blocking implementation continues to be refined. Some ads may still appear in certain scenarios, particularly during page refreshes or when YouTube changes its ad delivery mechanisms.

## Development

The application structure:

- `index.js` - Main process
- `preload.js` - Preload script for the renderer process
- `webview-preload.js` - Preload script for the webview
- `index.html` - Main application UI
- `renderer.js` - Handles UI interactions
- `styles.css` - Application styling

## Technologies Used

- Electron
- electron-extensions - For integrating Chrome extensions
- ytdl-core - For YouTube video downloading
- fluent-ffmpeg - For audio extraction
- electron-store - For persistent settings
