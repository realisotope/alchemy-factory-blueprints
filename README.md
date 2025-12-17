# Alchemy Factory Blueprints

A community-driven blueprint sharing platform for **Alchemy Factory**. Users can upload their `.af` blueprint files, share factory designs, and discover optimized production setups created by other players.

![](https://raw.githubusercontent.com/realisotope/alchemy-factory-blueprints/refs/heads/main/public/logo.jpg)

## 🎯 Features

- **Blueprint Upload & Sharing**: Upload your factory blueprints with descriptions, tags, and preview images
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

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- Supabase account
- Vercel Blob token
- Discord OAuth application

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/realisotope/alchemy-factory-blueprints.git
   cd alchemy-factory-blueprints
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

## 📋 Project Structure

```
src/
├── components/
│   ├── BlueprintDetail.jsx      # Detailed blueprint view modal
│   ├── BlueprintGallery.jsx     # Main gallery with search and filtering
│   ├── BlueprintUpload.jsx      # Upload form and file handling
│   ├── DiscordLogin.jsx         # Discord OAuth login
│   ├── EditBlueprint.jsx        # Edit existing blueprint
│   └── UploadModal.jsx          # Modal wrapper for upload
├── lib/
│   ├── supabase.js             # Supabase client configuration
│   ├── discordUtils.js         # Discord helper functions
│   ├── sanitization.js         # XSS prevention and input validation
│   └── metaTags.js             # Open Graph meta tags
├── App.jsx                      # Main app component
└── main.jsx                     # Entry point
public/
├── manifest.json
├── robots.txt
└── sitemap.xml
api/
└── og-meta.js                  # Open Graph metadata API
```

## 🔐 Security Features

- **File Validation**: Comprehensive magic number checking to prevent executable uploads
- **Double Extension Detection**: Blocks files like `malware.exe.af`
- **XSS Protection**: Sanitization of user input and HTML entity escaping
- **Safe Character Support**: Allows special characters (`&`, `<`, `>`, `/`, etc.) while protecting against XSS
- **CORS Configuration**: Secure cross-origin requests
- **Database Row Level Security**: Supabase RLS policies for data protection

## 💾 File Storage Strategy

- **Blueprints ≤100KB**: Stored directly as `.af` files
- **Blueprints >100KB**: Automatically compressed into ZIP format using DEFLATE compression (level 9)
- **Images**: Optimized and stored on Vercel Blob with automatic cleanup

## 🎮 How to Use Blueprints

1. Download a blueprint file (`.af` or `.zip`)
2. Extract if it's a ZIP file
3. Place the .af blueprint file into AppData\Local\AlchemyFactory\Saved\Blueprints

## ⚖️ License

This project is not affiliated with Alchemy Factory. All blueprint content is user-generated and owned by their respective creators.

## 📞 Support

For issues, questions, or feature requests, please open an issue on GitHub.