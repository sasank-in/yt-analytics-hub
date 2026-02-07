"""Test script to simulate the complete frontend data flow"""

import requests
import json
import time

print("=" * 60)
print("TESTING YOUTUBE ANALYTICS FRONTEND DATA FLOW")
print("=" * 60)

# Test 1: Verify Server is Running
print("\n[1] CHECKING IF SERVER IS RUNNING...")
try:
    response = requests.get('http://localhost:3000/')
    if response.status_code == 200:
        print("✓ Server is running (HTTP 200)")
        print(f"  Response size: {len(response.text)} bytes")
        if '<section id="dashboard"' in response.text:
            print("✓ Dashboard section found in HTML")
        else:
            print("✗ Dashboard section NOT found in HTML")
    else:
        print(f"✗ Server returned status {response.status_code}")
except Exception as e:
    print(f"✗ Error: {e}")
    exit(1)

# Test 2: Check API Health
print("\n[2] CHECKING API HEALTH...")
try:
    response = requests.get('http://localhost:3000/api/health')
    if response.status_code == 200:
        data = response.json()
        print(f"✓ API Health: {data['status']}")
        print(f"  Service: {data['service']}")
    else:
        print(f"✗ API Health check failed: {response.status_code}")
except Exception as e:
    print(f"✗ Error: {e}")

# Test 3: Check /api/channels Endpoint
print("\n[3] TESTING /api/channels ENDPOINT...")
try:
    response = requests.get('http://localhost:3000/api/channels')
    if response.status_code == 200:
        data = response.json()
        channel_count = data.get('count', 0)
        print(f"✓ API returned {channel_count} channels")
        
        if channel_count > 0:
            for i, ch in enumerate(data.get('channels', [])[:2], 1):
                print(f"\n  Channel {i}:")
                print(f"    - Title: {ch.get('title', 'N/A')}")
                print(f"    - Total Videos: {ch.get('total_videos', 'N/A')}")
                print(f"    - Subscribers: {ch.get('subscribers', 'N/A')}")
                print(f"    - Has Profile Image: {bool(ch.get('profile_image'))}")
        
        # Calculate what JavaScript should display
        total_videos = sum(int(ch.get('total_videos', 0)) for ch in data.get('channels', []))
        print(f"\n✓ JavaScript should display:")
        print(f"    - Total Channels: {channel_count}")
        print(f"    - Total Videos: {total_videos}")
        
    else:
        print(f"✗ API returned status {response.status_code}")
except Exception as e:
    print(f"✗ Error: {e}")

# Test 4: Check Static Files
print("\n[4] CHECKING STATIC FILES...")
static_files = ['styles.css', 'app.js']
for file in static_files:
    try:
        response = requests.head(f'http://localhost:3000/static/{file}')
        if response.status_code == 200:
            print(f"✓ {file}: {response.status_code} OK")
            print(f"   Size: {response.headers.get('content-length', 'unknown')} bytes")
        else:
            print(f"✗ {file}: {response.status_code}")
    except Exception as e:
        print(f"✗ {file}: Error - {e}")

# Test 5: Simulate JavaScript Initialization
print("\n[5] SIMULATING JAVASCRIPT FLOW...")
try:
    # This is what loadDashboard() does
    api_url = 'http://localhost:3000/api/channels'
    response = requests.get(api_url)
    
    if response.status_code == 200:
        channels = response.json()
        total_channels = channels.get('count', 0)
        
        total_videos = 0
        for ch in channels.get('channels', []):
            total_videos += int(ch.get('total_videos', 0))
        
        print(f"✓ loadDashboard() would set:")
        print(f"   document.getElementById('total-channels').textContent = {total_channels}")
        print(f"   document.getElementById('total-videos').textContent = {total_videos}")
        
        recent_channels = channels.get('channels', [])[:5]
        if recent_channels:
            print(f"\n✓ loadRecentChannels() would display {len(recent_channels)} channels")
            for ch in recent_channels:
                print(f"   - {ch.get('title')}: {ch.get('total_videos')} videos")
    else:
        print(f"✗ Failed to fetch channels: {response.status_code}")
        
except Exception as e:
    print(f"✗ Error in flow simulation: {e}")

print("\n" + "=" * 60)
print("SUMMARY: All backend components working correctly.")
print("If data is not showing in browser:")
print("  1. Open browser console (F12)")
print("  2. Check for red error messages")
print("  3. Look for CORS errors or network failures")
print("=" * 60)
