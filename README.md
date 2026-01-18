# Alchemy Factory Blueprints

<div style="display: flex; align-items: center;">
    <div style="margin-right: 20px;">
        <h3>A community-driven blueprint sharing platform for <b>Alchemy Factory</b>. Users can upload their <code>.af</code> blueprint files, share factory designs, and discover optimized production setups created by other players.</h3>
    </div>
    <img src="https://raw.githubusercontent.com/realisotope/alchemy-factory-blueprints/refs/heads/main/public/logo.jpg" width="300" height="300">
</div>

## 🎯 Features

- **Blueprint Upload & Sharing**: Upload your factory blueprints with descriptions, tags, and preview images
- **Blueprint Data Parsing**: Parsed Blueprint data with detailed breakdown on the materials/buildings used.
- **SaveGame Data Parsing/Syncing**: Blueprints will be updated to show which items you may not have unlocked yet in red text.
- **Blueprint Folder Sync**: Sync your local blueprints with the site to see installation status and any possible/future updates
- **Advanced Search & Filtering**: Search by name, tags, or creator with smart filtering
- **Sorting Options**: Sort blueprints by newest, oldest, alphabetical, most popular, most downloaded, or recently updated
- **User Authentication**: Secure Discord OAuth login for uploading and liking blueprints
- **Like System**: Like your favorite blueprints to support creators and save them
- **Creator Discovery**: Click on any creator's name to view all their blueprints
- **Responsive Design**: Fully responsive UI that works seamlessly on desktop, tablet, and mobile
- **Smart File Storage**: Automatically compresses blueprints over 100KB into ZIP files for storage optimization
- **Download Tracking**: Tracks download counts for each blueprint
- **Security**: Comprehensive file validation to prevent malicious uploads (executable detection, double extensions, etc.)
- **Pagination**: Smart pagination with a limited page range for better mobile experience
- **Readable, blueprint sharing slug links**

## 🛠️ Tech Stack

### Frontend
- **React** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework for responsive styling
- **Framer Motion** - Animation library
- **Lucide React** - Beautiful SVG icon library

### Backend & Database
- **Supabase** - PostgreSQL database and authentication provider
- **Vercel Blob** - Cloud storage for blueprint images

### Libraries & Tools
- **JSZip** - File compression for blueprint storage
- **browser-image-compression** - Client-side image optimization
- **Discord OAuth** - User authentication

### Deployment
- **Vercel** - Frontend hosting and deployment
- **Node.js** - Backend runtime for API routes

## 📞 Support

For issues, questions, or feature requests, please open an issue on GitHub.