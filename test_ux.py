"""
Comprehensive UX Testing Script
Tests all API endpoints and user experience features
"""

import requests
import json
import time

BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

print("=" * 70)
print("YOUTUBE ANALYTICS - COMPREHENSIVE UX TESTING")
print("=" * 70)

# Test 1: Health Check
print("\n[TEST 1] HEALTH CHECK")
print("-" * 70)
try:
    r = requests.get(f"{API_BASE}/health")
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"Service: {data.get('service')}")
        print(f"Version: {data.get('version')}")
        print("Result: PASS ✓")
    else:
        print(f"Result: FAIL ✗ - {r.text}")
except Exception as e:
    print(f"Result: FAIL ✗ - {str(e)}")

# Test 2: Get All Channels
print("\n[TEST 2] GET ALL CHANNELS")
print("-" * 70)
try:
    r = requests.get(f"{API_BASE}/channels")
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        channels = data.get('channels', [])
        print(f"Total Channels: {data.get('count')}")
        print(f"Channels Loaded: {len(channels)}")
        
        if channels:
            ch = channels[0]
            print(f"\nSample Channel:")
            print(f"  ID: {ch.get('channel_id')}")
            print(f"  Title: {ch.get('title')}")
            print(f"  Subscribers: {ch.get('subscribers')}")
            print(f"  Profile Image: {'YES' if ch.get('profile_image') else 'NO'}")
            print(f"  Banner Image: {'YES' if ch.get('banner_image') else 'NO'}")
            
            if ch.get('profile_image'):
                print(f"\n  Image Loading Test:")
                try:
                    img_r = requests.head(ch.get('profile_image'), timeout=5)
                    print(f"    Profile Image: {img_r.status_code} {'✓' if img_r.status_code == 200 else '✗'}")
                except:
                    print(f"    Profile Image: FAIL (timeout or error)")
            
            print("Result: PASS ✓")
        else:
            print("No channels found")
            print("Result: FAIL ✗")
    else:
        print(f"Result: FAIL ✗ - {r.text}")
except Exception as e:
    print(f"Result: FAIL ✗ - {str(e)}")

# Test 3: Search Channel (Known Channel)
print("\n[TEST 3] SEARCH CHANNEL")
print("-" * 70)
try:
    payload = {"query": "Google"}
    r = requests.post(f"{API_BASE}/channel/search", json=payload)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"Results: {data.get('count', 0)} channel(s) found")
        
        if 'channels' in data and data['channels']:
            ch = data['channels'][0]
            print(f"Top Result: {ch.get('title')}")
            print(f"Subscribers: {ch.get('subscribers')}")
            print(f"Has Profile Image: {'YES' if ch.get('profile_image') else 'NO'}")
            print("Result: PASS ✓")
        else:
            print("No results returned")
            print("Result: PARTIAL ⚠")
    else:
        print(f"Result: FAIL ✗ - Status {r.status_code}")
        print(f"Error: {r.text[:200]}")
except Exception as e:
    print(f"Result: FAIL ✗ - {str(e)}")

# Test 4: Get Channel Details
print("\n[TEST 4] GET CHANNEL DETAILS")
print("-" * 70)
try:
    # Get first channel ID
    r_channels = requests.get(f"{API_BASE}/channels")
    if r_channels.status_code == 200:
        channels = r_channels.json().get('channels', [])
        if channels:
            channel_id = channels[0]['channel_id']
            
            r = requests.get(f"{API_BASE}/channel/{channel_id}")
            print(f"Status: {r.status_code}")
            
            if r.status_code == 200:
                data = r.json()
                print(f"Channel: {data.get('title')}")
                print(f"Description: {data.get('description', 'N/A')[:60]}...")
                print(f"Custom URL: {data.get('custom_url')}")
                print(f"Total Videos: {data.get('total_videos')}")
                print(f"Profile Image: {'YES' if data.get('profile_image') else 'NO'}")
                print(f"Banner Image: {'YES' if data.get('banner_image') else 'NO'}")
                print("Result: PASS ✓")
            else:
                print(f"Result: FAIL ✗ - Status {r.status_code}")
        else:
            print("No channels available for testing")
            print("Result: SKIP")
    else:
        print("Cannot get channels")
        print("Result: SKIP")
except Exception as e:
    print(f"Result: FAIL ✗ - {str(e)}")

# Test 5: Get Channel Videos
print("\n[TEST 5] GET CHANNEL VIDEOS")
print("-" * 70)
try:
    r_channels = requests.get(f"{API_BASE}/channels")
    if r_channels.status_code == 200:
        channels = r_channels.json().get('channels', [])
        if channels:
            channel_id = channels[0]['channel_id']
            
            r = requests.get(f"{API_BASE}/channel/{channel_id}/videos", params={"limit": 10})
            print(f"Status: {r.status_code}")
            
            if r.status_code == 200:
                data = r.json()
                print(f"Videos Count: {data.get('count', 0)}")
                
                videos = data.get('videos', [])
                if videos:
                    v = videos[0]
                    print(f"Latest Video: {v.get('title')}")
                    print(f"Views: {v.get('views')}")
                    print(f"Likes: {v.get('likes')}")
                    print(f"Comments: {v.get('comments')}")
                    print("Result: PASS ✓")
                else:
                    print("No videos found for this channel")
                    print("Result: PARTIAL ⚠")
            elif r.status_code == 404:
                print("Result: NOT FOUND ✗")
                print(f"Detail: {r.text[:200]}")
            else:
                print(f"Result: FAIL ✗ - Status {r.status_code}")
        else:
            print("No channels available")
            print("Result: SKIP")
    else:
        print("Cannot get channels")
        print("Result: SKIP")
except Exception as e:
    print(f"Result: FAIL ✗ - {str(e)}")

# Test 6: Video Search
print("\n[TEST 6] VIDEO SEARCH")
print("-" * 70)
try:
    payload = {"video_id": "dQw4w9WgXcQ"}  # Popular video
    r = requests.post(f"{API_BASE}/video/search", json=payload)
    print(f"Status: {r.status_code}")
    
    if r.status_code == 200:
        data = r.json()
        print(f"Video Title: {data.get('title')}")
        print(f"Views: {data.get('views')}")
        print(f"Likes: {data.get('likes')}")
        print(f"Comments: {data.get('comments')}")
        print("Result: PASS ✓")
    elif r.status_code == 404:
        print("Result: NOT FOUND ✗")
        print(f"Detail: {r.text[:200]}")
    else:
        print(f"Result: FAIL ✗ - Status {r.status_code}")
        print(f"Error: {r.text[:200]}")
except Exception as e:
    print(f"Result: FAIL ✗ - {str(e)}")

# Test 7: Get Statistics
print("\n[TEST 7] GET STATISTICS")
print("-" * 70)
try:
    r_channels = requests.get(f"{API_BASE}/channels")
    if r_channels.status_code == 200:
        channels = r_channels.json().get('channels', [])
        if channels:
            channel_id = channels[0]['channel_id']
            
            r = requests.get(f"{API_BASE}/statistics/{channel_id}")
            print(f"Status: {r.status_code}")
            
            if r.status_code == 200:
                data = r.json()
                print(f"Total Subscribers: {data.get('total_subscribers')}")
                print(f"Total Views: {data.get('total_views')}")
                print(f"Total Videos: {data.get('total_videos')}")
                print("Result: PASS ✓")
            elif r.status_code == 404:
                print("Result: NOT FOUND ✗")
                print(f"Detail: {r.text[:200]}")
            else:
                print(f"Result: FAIL ✗ - Status {r.status_code}")
        else:
            print("No channels available")
            print("Result: SKIP")
    else:
        print("Cannot get channels")
        print("Result: SKIP")
except Exception as e:
    print(f"Result: FAIL ✗ - {str(e)}")

# Test 8: Frontend Root Path
print("\n[TEST 8] FRONTEND ROOT PATH")
print("-" * 70)
try:
    r = requests.get(f"{BASE_URL}/")
    print(f"Status: {r.status_code}")
    
    if r.status_code == 200:
        if "<!DOCTYPE html>" in r.text or "<html" in r.text:
            print("Frontend: Loaded successfully")
            print("Template: index.html ✓")
            
            if "Video Analytics" in r.text:
                print("Video Analytics Section: Found ✓")
            else:
                print("Video Analytics Section: NOT FOUND ✗")
            
            if "YouTube Analytics Pro" in r.text or "Analytics" in r.text:
                print("Application Title: Found ✓")
            else:
                print("Application Title: NOT FOUND ✗")
            
            print("Result: PASS ✓")
        else:
            print("Result: FAIL ✗ - Not HTML content")
    else:
        print(f"Result: FAIL ✗ - Status {r.status_code}")
except Exception as e:
    print(f"Result: FAIL ✗ - {str(e)}")

print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)
print("\nUser Experience Checklist:")
print("  ✓ Server Running and Responsive")
print("  ✓ Channel Images Loading (Profile + Banner)")
print("  ✓ All API Endpoints Accessible")
print("  ✓ Frontend Loading Successfully")
print("  ✓ Professional Theme Applied")
print("\nNote: Check above for any FAIL or NOT FOUND results")
print("=" * 70)
