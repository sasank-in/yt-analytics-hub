"""Detailed diagnostic to check database and API responses"""

import requests
import json
from youtube_analytics.database import DatabaseManager

print("=" * 70)
print("DETAILED DIAGNOSTICS")
print("=" * 70)

# Test 1: Check database content
print("\n[1] CHECKING DATABASE CONTENT")
print("-" * 70)

db = DatabaseManager()
channels = db.get_all_channels()

print(f"Total Channels in DB: {len(channels)}")
if channels:
    ch = channels[0]
    print(f"\nFirst Channel:")
    print(f"  Channel ID: {ch.get('channel_id')}")
    print(f"  Title: {ch.get('title')}")
    print(f"  Subscribers: {ch.get('subscribers')}")
    print(f"  Total Videos: {ch.get('total_videos')}")
    print(f"  Profile Image: {ch.get('profile_image')}")
    print(f"  Banner Image: {ch.get('banner_image')}")
    print(f"  Description: {ch.get('description')[:50] if ch.get('description') else 'N/A'}...")

# Test 2: Check API response
print("\n\n[2] CHECKING API RESPONSES")
print("-" * 70)

BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

print("\n[A] GET /api/channels")
r = requests.get(f"{API_BASE}/channels")
print(f"Status Code: {r.status_code}")
data = r.json()

print(f"Response Keys: {list(data.keys())}")
print(f"Channels Count: {data.get('count', 'N/A')}")

if data.get('channels'):
    ch = data['channels'][0]
    print(f"\nFirst Channel in Response:")
    print(f"  Keys: {list(ch.keys())}")
    print(f"  Channel ID: {ch.get('channel_id')}")
    print(f"  Title: {ch.get('title')}")
    print(f"  Profile Image: {ch.get('profile_image')}")
    print(f"  Banner Image: {ch.get('banner_image')}")

# Test 3: Check channel details endpoint
print("\n\n[B] GET /api/channel/{channel_id}")
print("-" * 70)

if channels:
    channel_id = channels[0]['channel_id']
    print(f"Testing with Channel ID: {channel_id}\n")
    
    r = requests.get(f"{API_BASE}/channel/{channel_id}")
    print(f"Status Code: {r.status_code}")
    
    if r.status_code == 200:
        data = r.json()
        print(f"Response Keys: {list(data.keys())}")
        
        if 'channel' in data:
            ch = data['channel']
            print(f"\nChannel Object Keys: {list(ch.keys())}")
            print(f"  Channel ID: {ch.get('channel_id')}")
            print(f"  Title: {ch.get('title')}")
            print(f"  Profile Image: {ch.get('profile_image')}")
            print(f"  Banner Image: {ch.get('banner_image')}")
    else:
        print(f"Error: {r.text}")

# Test 4: Check channel search
print("\n\n[C] POST /api/channel/search")
print("-" * 70)

payload = {"query": "Google", "search_type": "name"}
print(f"Payload: {payload}\n")

r = requests.post(f"{API_BASE}/channel/search", json=payload)
print(f"Status Code: {r.status_code}")

if r.status_code == 200:
    data = r.json()
    print(f"Response Type: {type(data)}")
    
    if isinstance(data, dict):
        print(f"Response Keys: {list(data.keys())}")
        print(f"Full Response (first 300 chars): {str(data)[:300]}")
    elif isinstance(data, list):
        print(f"Response is a list with {len(data)} items")
        if data:
            print(f"First item keys: {list(data[0].keys())}")
else:
    print(f"Error: {r.text}")

print("\n" + "=" * 70)
print("DIAGNOSTIC COMPLETE")
print("=" * 70)
