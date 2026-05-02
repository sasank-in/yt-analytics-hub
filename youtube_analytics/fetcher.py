"""YouTube Data Fetcher Module

Provides functionality to fetch YouTube channel and video data
using the official YouTube Data API v3.
"""

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from youtube_analytics.config import YOUTUBE_API_KEY


class YouTubeFetcher:
    """Fetch YouTube channel and video data from YouTube API v3"""
    
    def __init__(self):
        """Initialize YouTube API client"""
        if not YOUTUBE_API_KEY:
            raise ValueError("YOUTUBE_API_KEY not found in .env file")
        self.youtube = build(
            serviceName="youtube",
            version="v3",
            developerKey=YOUTUBE_API_KEY
        )
    
    def get_channel_by_id(self, channel_id):
        """Fetch channel data by channel ID"""
        try:
            request = self.youtube.channels().list(
                part="snippet,statistics,contentDetails",
                id=channel_id
            )
            response = request.execute()
            return self._parse_response(response)
        except Exception as e:
            return {"error": str(e)}
    
    def get_channel_videos(self, channel_id, max_results=None):
        """Fetch videos from a channel. If max_results is None, fetch all."""
        try:
            # Get uploads playlist ID
            channel_request = self.youtube.channels().list(
                part="contentDetails",
                id=channel_id
            )
            channel_response = channel_request.execute()
            
            if not channel_response.get('items'):
                return {"error": "Channel not found"}
            
            uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists']['uploads']
            
            # Get videos from uploads playlist
            videos = []
            next_page_token = None
            
            while True:
                playlist_request = self.youtube.playlistItems().list(
                    part="snippet",
                    playlistId=uploads_playlist_id,
                    maxResults=min(50, (max_results - len(videos)) if max_results else 50),
                    pageToken=next_page_token
                )
                playlist_response = playlist_request.execute()
                
                # Check if there are items in the response
                if not playlist_response.get('items'):
                    break  # No more videos
                
                video_ids = [item['snippet']['resourceId']['videoId'] for item in playlist_response['items']]
                
                # Only fetch if we have video IDs
                if video_ids:
                    # Get video statistics
                    videos_request = self.youtube.videos().list(
                        part="snippet,statistics,contentDetails",
                        id=','.join(video_ids)
                    )
                    videos_response = videos_request.execute()
                    
                    for video in videos_response.get('items', []):
                        parsed = self._parse_video_response({'items': [video]})
                        if "error" not in parsed:
                            videos.append(parsed)
                
                next_page_token = playlist_response.get('nextPageToken')
                if not next_page_token:
                    break
                if max_results and len(videos) >= max_results:
                    break
            
            # Return empty list if no videos, not error
            return videos if videos else []
        except Exception as e:
            return {"error": str(e)}

    def get_channel_top_videos(self, channel_id, max_results=50, return_debug=False):
        """Fetch top videos for a channel using search (order by view count)."""
        try:
            videos = []
            next_page_token = None
            debug = {
                "channel_id": channel_id,
                "max_results": max_results,
                "pages": 0,
                "video_ids": 0,
                "api_errors": []
            }

            while len(videos) < max_results:
                search_request = self.youtube.search().list(
                    part="id",
                    channelId=channel_id,
                    type="video",
                    order="viewCount",
                    maxResults=min(50, max_results - len(videos)),
                    pageToken=next_page_token
                )
                search_response = search_request.execute()
                debug["pages"] += 1

                items = search_response.get("items", [])
                if not items:
                    break

                video_ids = [item["id"]["videoId"] for item in items if item.get("id", {}).get("videoId")]
                debug["video_ids"] += len(video_ids)
                if video_ids:
                    videos_request = self.youtube.videos().list(
                        part="snippet,statistics,contentDetails",
                        id=",".join(video_ids)
                    )
                    videos_response = videos_request.execute()
                    for video in videos_response.get("items", []):
                        parsed = self._parse_video_response({"items": [video]})
                        if "error" not in parsed:
                            videos.append(parsed)

                next_page_token = search_response.get("nextPageToken")
                if not next_page_token:
                    break

            if return_debug:
                return {"videos": videos if videos else [], "debug": debug}
            return videos if videos else []
        except Exception as e:
            if return_debug:
                return {"error": str(e), "debug": {"channel_id": channel_id, "max_results": max_results}}
            return {"error": str(e)}
    
    def get_channel_by_username(self, username):
        """Fetch channel data by username"""
        try:
            request = self.youtube.channels().list(
                part="snippet,statistics,contentDetails",
                forUsername=username
            )
            response = request.execute()
            return self._parse_response(response)
        except Exception as e:
            return {"error": str(e)}
    
    def get_channel_by_name(self, channel_name):
        """Fetch channel data by searching channel name"""
        try:
            search_request = self.youtube.search().list(
                q=channel_name,
                part="snippet",
                type="channel",
                maxResults=1
            )
            search_response = search_request.execute()
            
            if search_response['items']:
                channel_id = search_response['items'][0]['id']['channelId']
                return self.get_channel_by_id(channel_id)
            else:
                return {"error": f"Channel '{channel_name}' not found"}
        except Exception as e:
            return {"error": str(e)}
    
    def get_video_by_id(self, video_id):
        """Fetch video data by video ID"""
        try:
            request = self.youtube.videos().list(
                part="snippet,statistics,contentDetails",
                id=video_id
            )
            response = request.execute()
            return self._parse_video_response(response)
        except Exception as e:
            return {"error": str(e)}
    
    def get_video_by_title(self, title, channel_id=None):
        """Fetch video data by searching video title"""
        try:
            search_params = {
                "q": title,
                "part": "snippet",
                "type": "video",
                "maxResults": 1
            }
            if channel_id:
                search_params["channelId"] = channel_id
            
            search_request = self.youtube.search().list(**search_params)
            search_response = search_request.execute()
            
            if search_response['items']:
                video_id = search_response['items'][0]['id']['videoId']
                return self.get_video_by_id(video_id)
            else:
                return {"error": f"Video '{title}' not found"}
        except Exception as e:
            return {"error": str(e)}
    
    def _parse_response(self, response):
        """Parse and format channel API response"""
        if not response.get('items'):
            return {"error": "No channel data found"}
        
        channel = response['items'][0]
        
        stats = {
            "channel_id": channel['id'],
            "title": channel['snippet']['title'],
            "description": channel['snippet']['description'][:200] + "..." if len(channel['snippet']['description']) > 200 else channel['snippet']['description'],
            "custom_url": channel['snippet'].get('customUrl', 'N/A'),
            "published_at": channel['snippet']['publishedAt'],
            "subscribers": channel['statistics'].get('subscriberCount', 'Private'),
            "total_views": channel['statistics'].get('viewCount', '0'),
            "total_videos": channel['statistics'].get('videoCount', '0'),
            "profile_image": channel['snippet']['thumbnails']['default']['url'],
            "banner_image": channel['snippet']['thumbnails'].get('high', {}).get('url', 'N/A')
        }
        
        return stats
    
    def _parse_video_response(self, response):
        """Parse and format video API response"""
        if not response.get('items'):
            return {"error": "No video data found"}
        
        video = response['items'][0]
        duration = video['contentDetails']['duration']
        
        stats = {
            "video_id": video['id'],
            "title": video['snippet']['title'],
            "description": video['snippet']['description'][:300] + "..." if len(video['snippet']['description']) > 300 else video['snippet']['description'],
            "channel_id": video['snippet']['channelId'],
            "channel_title": video['snippet']['channelTitle'],
            "published_at": video['snippet']['publishedAt'],
            "duration": duration,
            "views": video['statistics'].get('viewCount', '0'),
            "likes": video['statistics'].get('likeCount', 'Private'),
            "comments": video['statistics'].get('commentCount', 'Private'),
            "thumbnail": video['snippet']['thumbnails']['high']['url']
        }
        
        return stats
