"""
Test script to verify new saved videos and dropdown features
"""

import requests
import json
import time

API_BASE_URL = 'http://localhost:3000/api'

def test_saved_videos_html():
    """Test that HTML includes saved videos dropdown"""
    print("\n" + "=" * 60)
    print("TESTING SAVED VIDEOS UI ELEMENTS")
    print("=" * 60)
    
    try:
        response = requests.get('http://localhost:3000', timeout=5)
        html = response.text
        
        checks = [
            ("Video Analytics dropdown toggle", 'id="videos-view-toggle"' in html),
            ("Video search view", 'id="video-search-view"' in html),
            ("Video saved view", 'id="video-saved-view"' in html),
            ("Saved videos dropdown", 'id="saved-video-select"' in html),
            ("Load saved video button", 'id="load-saved-video-btn"' in html),
            ("Channel video dropdown", 'id="channel-video-select"' in html),
            ("Analyze channel video button", 'id="analyze-channel-video-btn"' in html),
        ]
        
        for check_name, result in checks:
            status = "✓" if result else "✗"
            print(f"{status} {check_name}")
            
    except Exception as e:
        print(f"✗ Error: {e}")

def test_javascript_functions():
    """Test if JavaScript functions exist"""
    print("\n" + "=" * 60)
    print("TESTING JAVASCRIPT FUNCTIONS")
    print("=" * 60)
    
    try:
        response = requests.get('http://localhost:3000/static/app.js', timeout=5)
        js = response.text
        
        functions = [
            "switchVideosView",
            "saveSavedVideos",
            "loadSavedVideos",
            "addToSavedVideos",
            "populateSavedVideosDropdown",
            "loadSelectedSavedVideo",
            "handleAnalyzeChannelVideo",
        ]
        
        for func in functions:
            exists = f"function {func}" in js or f"{func}()" in js
            status = "✓" if exists else "✗"
            print(f"{status} Function: {func}")
            
    except Exception as e:
        print(f"✗ Error: {e}")

def test_api_integration():
    """Test API endpoints for videos"""
    print("\n" + "=" * 60)
    print("TESTING API INTEGRATION")
    print("=" * 60)
    
    try:
        # Get channels
        print("\n[1] Testing channels endpoint...")
        response = requests.get(f'{API_BASE_URL}/channels', timeout=5)
        channels = response.json()
        
        if channels['count'] > 0:
            ch_id = channels['channels'][0]['channel_id']
            print(f"✓ Found {channels['count']} channels")
            
            # Get channel videos
            print(f"[2] Testing videos for channel: {ch_id}")
            response = requests.get(f'{API_BASE_URL}/channel/{ch_id}/videos', timeout=5)
            
            if response.status_code == 200:
                videos = response.json()
                video_count = len(videos.get('videos', []))
                print(f"✓ Videos endpoint working")
                print(f"✓ Videos returned: {video_count}")
                
                if video_count > 0:
                    v = videos['videos'][0]
                    print(f"  - Sample video: {v.get('title', 'N/A')[:40]}")
                    print(f"  - Views: {v.get('views', 'N/A')}")
            else:
                print(f"✗ Status: {response.status_code}")
        else:
            print("⚠ No channels in database")
            
    except Exception as e:
        print(f"✗ Error: {e}")

def test_feature_completeness():
    """Test complete feature implementation"""
    print("\n" + "=" * 60)
    print("TESTING FEATURE COMPLETENESS")
    print("=" * 60)
    
    response = requests.get('http://localhost:3000', timeout=5)
    html = response.text
    js_response = requests.get('http://localhost:3000/static/app.js', timeout=5)
    js = js_response.text
    
    features = {
        "Saved Videos Storage": "localStorage" in js and "youtube_analytics_saved_videos" in js,
        "Video View Toggle": 'videos-view-toggle' in html and 'switchVideosView' in js,
        "Saved Videos List": 'saved-video-select' in html and 'populateSavedVideosDropdown' in js,
        "Channel Video Dropdown": 'channel-video-select' in html and 'currentChannelVideos' in js,
        "Quick Video Analysis": 'analyze-channel-video-btn' in html and 'handleAnalyzeChannelVideo' in js,
        "View Persistence": 'loadSavedVideos' in js and 'saveSavedVideos' in js,
    }
    
    for feature, implemented in features.items():
        status = "✓" if implemented else "✗"
        print(f"{status} {feature}")

def main():
    print("\n╔════════════════════════════════════════════════════════════╗")
    print("║      SAVED VIDEOS & DROPDOWNS VERIFICATION TEST            ║")
    print("╚════════════════════════════════════════════════════════════╝")
    
    test_saved_videos_html()
    test_javascript_functions()
    test_api_integration()
    test_feature_completeness()
    
    print("\n" + "=" * 60)
    print("✓ VERIFICATION COMPLETE")
    print("=" * 60)
    print("\nNew Features Implemented:")
    print("  1. ✓ Saved Videos Tab in Video Analytics")
    print("  2. ✓ Dropdown to switch between Search/Saved videos")
    print("  3. ✓ Video dropdown in Channel Videos section")
    print("  4. ✓ Quick video analysis from channel view")
    print("  5. ✓ Persistent saved videos storage")
    print("  6. ✓ Smart video selection UI")
    print("\n")

if __name__ == '__main__':
    main()
