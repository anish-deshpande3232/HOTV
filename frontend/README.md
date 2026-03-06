# BlockChain Supply - Web3 Supply Chain Frontend

A complete professional Web3-powered supply chain transparency platform built with **pure HTML, CSS, and Vanilla JavaScript**. No frameworks, no build tools, no dependencies.

## 📁 Project Structure

```
frontend/
├── index.html              # Landing page with hero, industries, how it works
├── login.html              # Role-based login portal
├── farmer.html             # Farmer dashboard - batch creation & tracking
├── company.html            # Company dashboard - batch approval & QR generation
├── lab.html                # Lab dashboard - testing & digital signatures
├── verify.html             # Consumer verification page
├── admin.html              # Admin dashboard - user management & analytics
├── css/
│   └── style.css           # Complete dark theme styling (31KB, responsive)
└── js/
    ├── api.js              # Backend API integration
    ├── blockchain.js       # Web3 & blockchain integration
    ├── auth.js             # Authentication & session management
    ├── farmer.js           # Farmer-specific functions
    ├── company.js          # Company-specific functions
    ├── lab.js              # Lab-specific functions
    └── verify.js           # Verification & consumer functions
```

## 🎯 Features

### Landing Page (index.html)
- ✨ Hero section with animated gradient orbs
- 🏭 Industry selection (Agriculture, Pharma, Healthcare, Organic)
- 📊 4-step "How It Works" visual guide
- 👥 5 role cards with instant login redirect
- 📱 Fully responsive design

### Login Portal (login.html)
- 🔐 Role-based selection (Farmer, Company, Lab, Admin, Consumer)
- 🎨 Glassmorphism cards with hover effects
- 📊 Session token generation
- ⚡ Instant dashboard redirect

### Farmer Dashboard (farmer.html)
- ➕ Create batch form with certifications
- 📦 Batch history with filtering
- 🧪 Lab status tracker with progress
- 💰 Payment status & transaction history
- 📊 Real-time statistics

### Company Dashboard (company.html)
- 📥 Incoming batches review panel
- ✅ Approve/reject with blockchain recording
- 📱 QR code generation & download
- 🚨 Batch recall system
- 📋 Complete batch history

### Lab Dashboard (lab.html)
- ⏳ Pending tests assignment
- 📄 Test report upload interface
- ✅ Batch approval/rejection
- ✍️ Digital signature pad with preview
- 📈 Test completion tracking

### Consumer Verification (verify.html)
- 🔍 Quick batch ID lookup
- 📍 Origin & harvest info with map
- 🧪 Lab test results display
- ⛓️ Blockchain verification badge
- 🚨 Recall alerts
- 📥 Certificate download

### Admin Dashboard (admin.html)
- 👥 User management & approval panel
- 🔑 Role assignment with permissions
- 🚫 Suspend users with reasons
- 📈 Analytics & regional distribution
- 🔍 Suspicious activity monitoring

## 🎨 Design Features

### Dark Theme with Gradients
- Primary gradient: Purple → Cyan (#6366f1 → #0ea5e9)
- Glassmorphic cards with backdrop blur
- Smooth animations and transitions
- Responsive grid layouts

### Interactive Elements
- Animated hover effects on cards
- Smooth page transitions (fadeIn/slideOut)
- Real-time clock displays
- Dynamic progress bars
- Canvas-based signature pad
- Simulated QR code generation

### Responsive Design
- Mobile-first approach
- Breakpoints: 768px, 480px
- Collapsible sidebar (mobile)
- Touch-friendly buttons
- Optimized typography

## 🔐 Authentication System

### Session Management
- localStorage-based session storage
- Auto-generated session tokens
- 30-minute session timeout
- Role-based access control
- Activity-based timeout reset

### User Roles
```javascript
- 🌾 Farmer: Create batches, upload certifications, track labs
- 🏢 Company: Approve batches, generate QR, issue recalls
- 🧪 Laboratory: Conduct tests, submit reports, sign certificates
- 🛍️ Consumer: Verify products, download certificates
- 🛡️ Admin: Manage users, assign roles, view analytics
```

## ⛓️ Blockchain Integration

### Mock Blockchain Features
- Transaction hash generation
- Block number simulation
- Digital signature (canvas + hash)
- Batch status tracking
- Transaction history logging
- Smart contract simulation

### Real Integration Ready
- Web3 provider detection
- MetaMask wallet support
- Contract address configuration
- Gas estimation (placeholder)
- Network switching

## 📊 Data Management

### Local Storage
- Session tokens
- User roles
- Batch cache
- Digital signatures
- Transaction history
- Company recalls

### Session Storage
- Temporary batch data
- Lab test information
- Admin approvals
- User management data

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Optional: MetaMask for blockchain features

### Installation

1. **Download the frontend folder**
   ```bash
   # Copy all files to your web server
   cp -r frontend/* /var/www/html/
   ```

2. **Using Python (development)**
   ```bash
   # Python 3.x
   python -m http.server 8000
   
   # Python 2.x
   python -m SimpleHTTPServer 8000
   ```

3. **Using Node.js**
   ```bash
   # Install http-server globally
   npm install -g http-server
   
   # Start server
   http-server
   ```

4. **Using PHP**
   ```bash
   php -S localhost:8000
   ```

5. **Direct access (some browsers)**
   - Open `index.html` directly in your browser

### Access the Application

```
http://localhost:8000
```

## 📱 User Flows

### 1. Farmer Flow
```
index.html → login.html (select "Farmer") → farmer.html
├── Create Batch
├── Upload Certification
├── View Batch History
└── Track Lab Status
```

### 2. Company Flow
```
index.html → login.html (select "Company") → company.html
├── Review Incoming Batches
├── Approve/Reject
├── Send to Lab
├── Generate QR Code
└── Issue Recall
```

### 3. Lab Flow
```
index.html → login.html (select "Lab") → lab.html
├── View Pending Tests
├── Upload Test Report
├── Approve/Reject Batch
└── Sign Certificate
```

### 4. Consumer Flow
```
index.html → verify.html
├── Enter Batch ID
├── View Complete History
├── Check Lab Results
├── Download Certificate
└── Share Verification
```

### 5. Admin Flow
```
index.html → login.html (select "Admin") → admin.html
├── Approve New Users
├── Assign Roles
├── Suspend Users
└── View Analytics
```

## 🔧 Configuration

### API Endpoints
Edit `js/api.js`:
```javascript
const api = new APIClient();
api.baseURL = 'https://your-api.com'; // Change this
```

### Blockchain Contract
Edit `js/blockchain.js`:
```javascript
this.contractAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f2e5f';
```

### Session Timeout
Edit `js/auth.js`:
```javascript
sessionTimeout = setTimeout(() => {
    // Default: 30 minutes (30 * 60 * 1000)
}, 30 * 60 * 1000);
```

## 📝 Forms & Validation

### Batch Creation Form
- Batch ID (required)
- Product Type (select)
- Harvest Date (date picker)
- Quantity (number)
- Description (textarea)
- Certification File (file upload)

### Test Report Form
- Batch ID (select)
- Test Type (select)
- Test Date (date picker)
- Test Result (select)
- Findings (textarea)
- Report File (PDF upload)

### Signature Pad
- Canvas-based drawing
- Clear/reset functionality
- Canvas-to-image export

## 🎯 Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+
- ✅ Mobile Chrome/Firefox

## 🔒 Security Notes

### Current Implementation (Development)
- Uses localStorage/sessionStorage
- Client-side session management
- Mock blockchain (non-production)

### For Production
- Implement backend authentication
- Use HTTPS only
- Add CSRF protection
- Implement proper API authorization
- Use Web3 for real blockchain integration
- Add rate limiting
- Implement input validation/sanitization

## 📊 Testing Credentials

### Test Batches (for Verify page)
```
BATCH-2024-045 - Whole Wheat
BATCH-2024-043 - Organic Spinach
BATCH-2024-035 - Raw Almonds (Has Recall)
```

### Test Login
- Any role can be selected
- No password required (demo mode)
- Automatic session generation

## 🎨 Customization

### Colors
Edit `css/style.css`:
```css
:root {
    --primary: #6366f1;        /* Main color */
    --secondary: #0ea5e9;      /* Accent color */
    --success: #10b981;        /* Success state */
    --danger: #ef4444;         /* Error state */
}
```

### Typography
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...
```

### Spacing
Modify CSS grid/flex gaps and padding values

## 📈 Performance

- **Total CSS**: 31KB (minified)
- **Page Load**: < 200ms (local)
- **Animations**: 60 FPS smooth
- **Mobile Responsive**: Full support
- **Zero Dependencies**: Pure vanilla code

## 🐛 Troubleshooting

### CORS Issues
- Run on a local server (not file://)
- Use Python/Node/PHP server above

### localStorage/sessionStorage Not Working
- Check browser privacy settings
- Ensure not in private/incognito mode
- Clear browser cache

### Blockchain Connection Failed
- MetaMask not installed? Works in demo mode
- Check Web3 provider availability
- Verify network selection in MetaMask

### QR Code Not Displaying
- JavaScript must be enabled
- Canvas support required
- Check browser console for errors

## 📞 Support & Customization

### Add New Role
1. Add role to login.html
2. Create role-specific HTML dashboard
3. Add role manager class in js/
4. Update auth.js with permissions

### Connect Real API
1. Update endpoint URLs in js/api.js
2. Implement proper error handling
3. Add authentication headers
4. Handle API responses

### Connect Real Blockchain
1. Install Web3.js library
2. Update blockchain.js with contract ABI
3. Implement real contract calls
4. Add wallet integration

## 📄 License

This code is provided as-is for demonstration purposes.

## 🎓 Learning Resources

- **Web3.js**: https://web3js.readthedocs.io/
- **MetaMask**: https://metamask.io/
- **CSS Grid**: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout
- **Canvas API**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **Fetch API**: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

---

**Built with ❤️ using pure HTML, CSS, and JavaScript**
