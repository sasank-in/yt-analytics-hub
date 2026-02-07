"""Simple UX Testing - No Unicode Issues"""

import requests

BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

print("=" * 70)
print("YOUTUBE ANALYTICS - UX TESTING")
print("=" * 70)

tests_passed = 0
tests_failed = 0

# Test 1: Health Check
print("\n[1] HEALTH CHECK")
print("-" * 70)
try:
    r = requests.get(f"{API_BASE}/health")
    if r.status_code == 200:
        data = r.json()
        print(f"Status: {r.status_code}")
        print(f"Service: {data.get('service')}")
        print(f"Version: {data.get('version')}")
        print("Result: PASS")
        tests_passed += 1
    else:
        print(f"Result: FAIL - Status {r.status_code}")
        tests_failed += 1
except Exception as e:
    print(f"Result: FAIL - {str(e)}")
    tests_failed += 1

# Test 2: Get All Channels with Images
print("\n[2] GET ALL CHANNELS")
print("-" * 70)
try:
    r = requests.get(f"{API_BASE}/channels")
    if r.status_code == 200:
        data = r.json()
        print(f"Status: {r.status_code}")
        print(f"Total Channels: {data.get('count')}")
        
        if data.get('channels'):
            ch = data['channels'][0]
            print(f"Sample Channel: {ch.get('title')}")
            has_profile = ch.get('profile_image') is not None
            has_banner = ch.get('banner_image') is not None
            print(f"Profile Image: {'YES' if has_profile else 'NO'}")
            print(f"Banner Image: {'YES' if has_banner else 'NO'}")
            
            if has_profile and has_banner:
                print("Result: PASS - Images present")
                tests_passed += 1
            else:
                print("Result: PARTIAL - Some images missing")
                tests_failed += 1
        else:
            print("Result: FAIL - No channels")
            tests_failed += 1
    else:
        print(f"Result: FAIL - Status {r.status_code}")
        tests_failed += 1
except Exception as e:
    print(f"Result: FAIL - {str(e)}")
    tests_failed += 1

# Test 3: Search Channel
print("\n[3] SEARCH CHANNEL")
print("-" * 70)
try:
    payload = {"query": "Google", "search_type": "name"}
    r = requests.post(f"{API_BASE}/channel/search", json=payload)
    if r.status_code == 200:
        data = r.json()
        print(f"Status: {r.status_code}")
        print(f"Found: {data.get('title', 'N/A')}")
        has_profile = data.get('profile_image') is not None
        has_banner = data.get('banner_image') is not None
        print(f"Profile Image: {'YES' if has_profile else 'NO'}")
        print(f"Banner Image: {'YES' if has_banner else 'NO'}")
        
        if has_profile and has_banner:
            print("Result: PASS - Search with images")
            tests_passed += 1
        else:
            print("Result: PARTIAL - Images missing")
            tests_failed += 1
    else:
        print(f"Result: FAIL - Status {r.status_code}")
        tests_failed += 1
except Exception as e:
    print(f"Result: FAIL - {str(e)}")
    tests_failed += 1

# Test 4: Get Channel Details
print("\n[4] GET CHANNEL DETAILS")
print("-" * 70)
try:
    r_channels = requests.get(f"{API_BASE}/channels")
    if r_channels.status_code == 200:
        channels = r_channels.json().get('channels', [])
        if channels:
            channel_id = channels[0]['channel_id']
            r = requests.get(f"{API_BASE}/channel/{channel_id}")
            
            if r.status_code == 200:
                data = r.json()
                channel = data.get('channel', {})
                print(f"Status: {r.status_code}")
                print(f"Channel: {channel.get('title')}")
                has_profile = channel.get('profile_image') is not None
                has_banner = channel.get('banner_image') is not None
                print(f"Profile Image: {'YES' if has_profile else 'NO'}")
                print(f"Banner Image: {'YES' if has_banner else 'NO'}")
                print(f"Videos: {data.get('videos_count', 0)}")
                
                if has_profile and has_banner:
                    print("Result: PASS - Details with images")
                    tests_passed += 1
                else:
                    print("Result: PARTIAL - Images missing")
                    tests_failed += 1
            else:
                print(f"Result: FAIL - Status {r.status_code}")
                tests_failed += 1
        else:
            print("Result: SKIP - No channels available")
    else:
        print("Result: SKIP - Cannot get channels")
except Exception as e:
    print(f"Result: FAIL - {str(e)}")
    tests_failed += 1

# Test 5: Get Channel Videos
print("\n[5] GET CHANNEL VIDEOS")
print("-" * 70)
try:
    r_channels = requests.get(f"{API_BASE}/channels")
    if r_channels.status_code == 200:
        channels = r_channels.json().get('channels', [])
        if channels:
            channel_id = channels[0]['channel_id']
            r = requests.get(f"{API_BASE}/channel/{channel_id}/videos?limit=10")
            
            if r.status_code == 200:
                data = r.json()
                print(f"Status: {r.status_code}")
                print(f"Videos Found: {data.get('count', 0)}")
                
                if data.get('count', 0) > 0:
                    print("Result: PASS - Videos retrieved")
                    tests_passed += 1
                else:
                    print("Result: PARTIAL - No videos for channel")
                    tests_failed += 1
            elif r.status_code == 404:
                print(f"Status: {r.status_code} (NOT FOUND)")
                print("Result: FAIL - Videos endpoint not found")
                tests_failed += 1
            else:
                print(f"Status: {r.status_code}")
                print("Result: FAIL")
                print(f"Error: {r.text[:100]}")
                tests_failed += 1
        else:
            print("Result: SKIP - No channels available")
    else:
        print("Result: SKIP - Cannot get channels")
except Exception as e:
    print(f"Result: FAIL - {str(e)}")
    tests_failed += 1

# Test 6: Statistics
print("\n[6] GET STATISTICS")
print("-" * 70)
try:
    r_channels = requests.get(f"{API_BASE}/channels")
    if r_channels.status_code == 200:
        channels = r_channels.json().get('channels', [])
        if channels:
            channel_id = channels[0]['channel_id']
            r = requests.get(f"{API_BASE}/statistics/{channel_id}")
            
            if r.status_code == 200:
                data = r.json()
                print(f"Status: {r.status_code}")
                print(f"Total Videos: {data.get('total_videos')}")
                print(f"Total Views: {data.get('total_views')}")
                print(f"Average Likes: {data.get('avg_likes')}")
                print("Result: PASS - Statistics retrieved")
                tests_passed += 1
            elif r.status_code == 404:
                print(f"Status: {r.status_code} (NOT FOUND)")
                print("Result: FAIL - Statistics not found")
                tests_failed += 1
            else:
                print(f"Status: {r.status_code}")
                print("Result: FAIL")
                tests_failed += 1
        else:
            print("Result: SKIP")
    else:
        print("Result: SKIP")
except Exception as e:
    print(f"Result: FAIL - {str(e)}")
    tests_failed += 1

# Test 7: Frontend
print("\n[7] FRONTEND / INDEX.HTML")
print("-" * 70)
try:
    r = requests.get(f"{BASE_URL}/")
    if r.status_code == 200 and "<!DOCTYPE" in r.text:
        print(f"Status: {r.status_code}")
        has_video_analytics = "Video Analytics" in r.text or "videos" in r.text.lower()
        print(f"Frontend Loaded: YES")
        print(f"Video Analytics: {'YES' if has_video_analytics else 'NO'}")
        print("Result: PASS")
        tests_passed += 1
    else:
        print(f"Status: {r.status_code}")
        print("Result: FAIL")
        tests_failed += 1
except Exception as e:
    print(f"Result: FAIL - {str(e)}")
    tests_failed += 1

# Summary
print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)
print(f"Tests Passed: {tests_passed}")
print(f"Tests Failed: {tests_failed}")
print(f"Total Tests: {tests_passed + tests_failed}")

if tests_failed == 0:
    print("\nStatus: ALL TESTS PASSED - APPLICATION WORKING PERFECTLY")
else:
    print(f"\nStatus: {tests_failed} TESTS NEED ATTENTION")

print("=" * 70)
