# 2K Services Website - Troubleshooting Guide

## File Structure

### Main Pages
- `index.html` - Home page (contains Hero, How it Works, FAQ sections)
- `services.html` - Services page
- `zen-scripts.html` - Zen Scripts products page
- `contact.html` - Contact page with Discord, email, phone info

### Assets
- `style.css` - All styling (dark/light themes, animations, responsive design)
- `script.js` - All JavaScript functionality (cart, theme toggle, animations)
- `images/logo.png` - Dark mode logo
- `images/whitelogo.png` - Light mode logo

## Key Features

### Global Cart System
- Cart persists across pages using `localStorage`
- Accessible from header on all pages
- Cart items stored with: `id`, `name`, `price`
- Cart functions: `Cart.addItem()`, `Cart.remove()`, `Cart.clear()`, `Cart.getTotal()`

### Theme System
- Dark mode (default): Red/black theme
- Light mode: White/light red theme
- Theme preference saved in `localStorage` as `theme`
- Toggle button in header (moon/sun icons)

### Logo Positioning
- Logos positioned absolutely in header
- Dark logo: `logo.png` (visible in dark mode)
- Light logo: `whitelogo.png` (visible in light mode)
- Current position: `left: -150px`, `top: 52.5%`

## Common Issues & Solutions

### Cart Not Working
1. Check browser console for JavaScript errors
2. Verify `localStorage` is enabled in browser
3. Check that `script.js` is loaded on all pages
4. Ensure cart toggle button has ID: `site-cart-toggle`

### Theme Not Persisting
1. Check `localStorage.getItem('theme')` in console
2. Verify `body` has class `theme-light` when light mode is active
3. Check CSS variables are defined in `:root` and `body.theme-light`

### Logo Not Showing
1. Verify image files exist: `images/logo.png` and `images/whitelogo.png`
2. Check CSS classes: `.logo-dark` (displayed in dark mode), `.logo-light` (displayed in light mode)
3. Verify logo positioning CSS (`.logo-image`)

### Animations Not Working
1. Check that `IntersectionObserver` is supported (modern browsers)
2. Verify elements have `data-scroll-section` or `data-scroll-item` attributes
3. Check CSS transitions/animations are defined in `style.css`

### Navbar Positioning Issues
1. Logo position: Adjust `left` value in `.logo-image` (currently `-150px`)
2. Nav buttons: Check `.header-right` flexbox properties
3. Action buttons: Check `.header-actions` margin-left for spacing

### Light Mode Colors Not Matching
1. Check CSS variables in `body.theme-light` section
2. Verify gradient backgrounds match theme
3. Navbar fade: Check `body.theme-light .site-header` background gradient

## CSS Variables Reference

### Dark Mode (default)
- `--bg`: `#020106`
- `--panel`: `#050509`
- `--accent`: `#f87171`
- `--accent-2`: `#ef4444`
- `--text`: `#f8fafc`

### Light Mode
- `--bg`: `#fef2f2`
- `--panel`: `#ffffff`
- `--accent`: `#b91c1c`
- `--accent-2`: `#dc2626`
- `--text`: `#111827`

## JavaScript Functions

### Cart Module (`Cart`)
- `Cart.addItem(id, name, price)` - Add item to cart
- `Cart.remove(id)` - Remove item by ID
- `Cart.clear()` - Clear all items
- `Cart.getItems()` - Get all cart items
- `Cart.getTotal()` - Calculate total price

### Theme Toggle
- `setupThemeToggle()` - Initializes theme toggle button
- Reads/writes to `localStorage.theme`
- Toggles `body.theme-light` class

### Scroll Animations
- `setupScrollReveal()` - Basic scroll reveal
- `setupEnhancedScrollReveal()` - Enhanced animations with IntersectionObserver

## Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires `localStorage` support
- Requires `IntersectionObserver` for scroll animations
- CSS Grid and Flexbox support needed

## Testing Checklist
- [ ] Cart adds/removes items correctly
- [ ] Cart persists across page navigation
- [ ] Theme toggle works and persists
- [ ] Logos display correctly in both themes
- [ ] Navbar buttons are properly positioned
- [ ] Animations trigger on scroll
- [ ] Responsive design works on mobile
- [ ] All links navigate correctly

## Notes
- Cart data is stored in browser `localStorage` - clearing browser data will clear cart
- Theme preference is saved per browser/device
- Logo positioning may need adjustment based on screen size (consider media queries)

