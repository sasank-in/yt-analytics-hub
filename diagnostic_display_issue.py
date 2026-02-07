"""
Comprehensive diagnostic to find why data isn't appearing
"""

import requests
import json

print("\n" + "=" * 70)
print("COMPREHENSIVE DATA DISPLAY DIAGNOSTIC")
print("=" * 70)

# 1. Check if server is running
print("\n[1] SERVER STATUS")
try:
    r = requests.get('http://localhost:3000', timeout=5)
    print(f"✓ Frontend loading: {r.status_code}")
    
    # Check for required HTML elements
    html = r.text
    checks = {
        'Body tag': '<body>' in html,
        'Dashboard section': 'id="dashboard"' in html,
        'Total channels element': 'id="total-channels"' in html,
        'Total videos element': 'id="total-videos"' in html,
        'Recent channels container': 'id="recent-channels"' in html,
        'App.js loaded': 'static/app.js' in html,
        'Styles loaded': 'static/styles.css' in html,
    }
    
    print("\n  HTML Elements:")
    for check, found in checks.items():
        status = "✓" if found else "✗"
        print(f"  {status} {check}")
        
except Exception as e:
    print(f"✗ Frontend not accessible: {e}")

# 2. Check API endpoints
print("\n[2] API ENDPOINTS")
try:
    r = requests.get('http://localhost:3000/api/health', timeout=5)
    print(f"✓ /api/health: {r.status_code} - {r.json().get('status')}")
except Exception as e:
    print(f"✗ API health check failed: {e}")

try:
    r = requests.get('http://localhost:3000/api/channels', timeout=5)
    data = r.json()
    print(f"✓ /api/channels: {r.status_code}")
    print(f"  - Channels count: {data.get('count')}")
    print(f"  - Channels in response: {len(data.get('channels', []))}")
    
    if data.get('channels'):
        ch = data['channels'][0]
        print(f"  - Sample channel has: title={bool(ch.get('title'))}, "
              f"profile_image={bool(ch.get('profile_image'))}, "
              f"total_videos={bool(ch.get('total_videos'))}")
except Exception as e:
    print(f"✗ /api/channels failed: {e}")

# 3. Check JavaScript for errors
print("\n[3] JAVASCRIPT CODE CHECK")
try:
    r = requests.get('http://localhost:3000/static/app.js', timeout=5)
    js = r.text
    
    checks = {
        'loadDashboard function': 'function loadDashboard' in js or 'async function loadDashboard' in js,
        'fetchAPI function': 'async function fetchAPI' in js,
        'loadRecentChannels function': 'function loadRecentChannels' in js,
        'showToast function': 'function showToast' in js,
        'DOMContentLoaded listener': 'DOMContentLoaded' in js,
        'loadDashboard called': 'loadDashboard()' in js,
    }
    
    for check, found in checks.items():
        status = "✓" if found else "✗"
        print(f"  {status} {check}")
        
    # Check for common errors
    print("\n  Potential Issues:")
    if 'fetchAPI(' not in js:
        print("    ✗ fetchAPI function might not be declared")
    if 'await fetchAPI' not in js:
        print("    ✗ fetchAPI not being awaited")
    if 'addEventListener' not in js or 'DOMContentLoaded' not in js:
        print("    ✗ Page might not wait for DOM to load")
        
except Exception as e:
    print(f"✗ JavaScript check failed: {e}")

# 4. Check CSS
print("\n[4] CSS CHECK")
try:
    r = requests.get('http://localhost:3000/static/styles.css', timeout=5)
    css = r.text
    
    checks = {
        'Section styling exists': '.section' in css,
        'Active class defined': '.active' in css,
        'Dashboard display': '#dashboard' in css or '.dashboard' in css,
        'Card styling': '.card' in css,
        'Stats card styling': '.stat' in css or 'stat-value' in css,
    }
    
    for check, found in checks.items():
        status = "✓" if found else "✗"
        print(f"  {status} {check}")
        
except Exception as e:
    print(f"✗ CSS check failed: {e}")

# 5. Check index.html structure
print("\n[5] HTML STRUCTURE CHECK")
try:
    r = requests.get('http://localhost:3000', timeout=5)
    html = r.text
    
    # Count elements
    import re
    sections = len(re.findall(r'<section', html))
    buttons = len(re.findall(r'class="nav-btn"', html))
    cards = len(re.findall(r'class="card', html))
    
    print(f"  Sections found: {sections}")
    print(f"  Navigation buttons: {buttons}")
    print(f"  Card elements: {cards}")
    
    # Check for display issues
    if 'style="display: none"' in html:
        print("  ⚠ Warning: Some elements are hidden by default")
    
    if '.section { display: none' in html or '.section{display:none' in html:
        print("  ⚠ Warning: Sections might be hidden by CSS")
        
except Exception as e:
    print(f"✗ HTML structure check failed: {e}")

# 6. Test data flow
print("\n[6] DATA FLOW TEST")
print("  Simulating page load...")

try:
    # Fetch channels like the app does
    r = requests.get('http://localhost:3000/api/channels', timeout=5)
    channels = r.json()
    
    total_channels = channels.get('count', 0)
    total_videos = sum(int(ch.get('total_videos', 0)) for ch in channels.get('channels', []))
    recent = channels.get('channels', [])[:5]
    
    print(f"\n  ✓ Dashboard data would show:")
    print(f"    - Total Channels: {total_channels}")
    print(f"    - Total Videos: {total_videos}")
    print(f"    - Recent Channels: {len(recent)}")
    
    if len(recent) > 0:
        ch = recent[0]
        print(f"\n  ✓ Recent channel card would display:")
        print(f"    - Image: {bool(ch.get('profile_image'))}")
        print(f"    - Title: {ch.get('title', 'N/A')[:40]}")
        print(f"    - Subscribers: {ch.get('subscribers', 'N/A')}")
        print(f"    - Videos: {ch.get('total_videos', 'N/A')}")
        
except Exception as e:
    print(f"  ✗ Data flow test failed: {e}")

print("\n" + "=" * 70)
print("DIAGNOSIS COMPLETE")
print("=" * 70)

print("\nIf data is loading but not displaying:")
print("  → Check browser console (F12) for JavaScript errors")
print("  → Verify CSS is being applied (F12 → Elements tab)")
print("  → Check if sections have 'active' class")
print("\nIf all checks pass but no data shows:")
print("  → Take a screenshot or open http://localhost:3000 in browser")
print("  → Share browser console errors (F12 → Console tab)")
print("\n")
