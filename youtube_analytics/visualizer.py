"""Visualization Module

Provides functions to create interactive charts and visualizations
using Plotly and Pandas for YouTube analytics data.
"""

import pandas as pd
import plotly.graph_objects as go

from youtube_analytics.database import DatabaseManager


class YouTubeVisualizer:
    """Generate visualizations for YouTube channel and video data"""

    def __init__(self):
        self.db = DatabaseManager()

    def _fig_to_dict(self, fig):
        if fig is None:
            return None
        return fig.to_dict()

    def create_channel_stats_card(self, channel_data):
        """Create metrics cards for channel statistics"""
        return {
            "Subscribers": channel_data.get("subscribers", "N/A"),
            "Total Views": channel_data.get("total_views", "0"),
            "Total Videos": channel_data.get("total_videos", "0")
        }

    def create_video_performance_chart(self, channel_id):
        """Create bar chart for top 10 videos by views"""
        videos = self.db.get_channel_videos(channel_id)
        if not videos:
            return None

        df = pd.DataFrame(videos)
        df['views'] = pd.to_numeric(df['views'], errors='coerce').fillna(0)
        df = df.nlargest(10, 'views')

        fig = go.Figure()
        fig.add_trace(go.Bar(
            x=df['title'],
            y=df['views'],
            name='Views',
            marker_color='#1f77b4'
        ))

        fig.update_layout(
            title='Top 10 Videos by Views',
            xaxis_title='Video Title',
            yaxis_title='Views',
            hovermode='x unified',
            height=400,
            showlegend=True
        )
        return fig

    def plot_top_videos(self, channel_id):
        """Compatibility wrapper for legacy API"""
        return self._fig_to_dict(self.create_video_performance_chart(channel_id))

    def create_engagement_ratio_chart(self, channel_id):
        """Create chart for engagement metrics"""
        videos = self.db.get_channel_videos(channel_id)
        if not videos:
            return None

        df = pd.DataFrame(videos)
        df['views'] = pd.to_numeric(df['views'], errors='coerce').fillna(1)
        df['likes'] = pd.to_numeric(df['likes'], errors='coerce').fillna(0)
        df['comments'] = pd.to_numeric(df['comments'], errors='coerce').fillna(0)

        df['like_rate'] = (df['likes'] / df['views'] * 100).round(2)
        df['comment_rate'] = (df['comments'] / df['views'] * 100).round(2)
        df = df.nlargest(10, 'views')

        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=df['title'],
            y=df['like_rate'],
            name='Like Rate (%)',
            mode='lines+markers'
        ))

        fig.add_trace(go.Scatter(
            x=df['title'],
            y=df['comment_rate'],
            name='Comment Rate (%)',
            mode='lines+markers'
        ))

        fig.update_layout(
            title='Engagement Rates Over Top Videos',
            xaxis_title='Video Title',
            yaxis_title='Engagement Rate (%)',
            height=400,
            hovermode='x unified'
        )
        return fig

    def plot_engagement_metrics(self, channel_id):
        """Compatibility wrapper for legacy API"""
        return self._fig_to_dict(self.create_engagement_ratio_chart(channel_id))

    def create_views_distribution_chart(self, channel_id):
        """Create distribution chart for video views"""
        videos = self.db.get_channel_videos(channel_id)
        if not videos:
            return None

        df = pd.DataFrame(videos)
        df['views'] = pd.to_numeric(df['views'], errors='coerce').fillna(0)

        fig = go.Figure()
        fig.add_trace(go.Histogram(
            x=df['views'],
            nbinsx=20,
            marker_color='#2ca02c'
        ))

        fig.update_layout(
            title='Video Views Distribution',
            xaxis_title='Views',
            yaxis_title='Number of Videos',
            height=400,
            showlegend=False
        )
        return fig

    def create_comparison_chart(self, channel_ids):
        """Compare statistics across multiple channels"""
        channels_data = [self.db.get_channel(ch_id) for ch_id in channel_ids if self.db.get_channel(ch_id)]

        if not channels_data:
            return None

        df = pd.DataFrame(channels_data)
        df['total_views'] = pd.to_numeric(df['total_views'], errors='coerce').fillna(0)
        df['total_videos'] = pd.to_numeric(df['total_videos'], errors='coerce').fillna(0)

        fig = go.Figure()

        fig.add_trace(go.Bar(
            x=df['title'],
            y=df['total_views'],
            name='Total Views',
            yaxis='y'
        ))

        fig.add_trace(go.Bar(
            x=df['title'],
            y=df['total_videos'],
            name='Total Videos',
            yaxis='y2'
        ))

        fig.update_layout(
            title='Channel Comparison',
            xaxis_title='Channel',
            yaxis_title='Total Views',
            yaxis2=dict(
                title='Total Videos',
                overlaying='y',
                side='right'
            ),
            height=400,
            hovermode='x unified'
        )
        return fig

    def get_channel_summary_table(self, channel_id):
        """Get summary table of channel information"""
        channel = self.db.get_channel(channel_id)
        if not channel:
            return None

        return pd.DataFrame([
            {'Metric': 'Title', 'Value': channel['title']},
            {'Metric': 'Channel ID', 'Value': channel['channel_id']},
            {'Metric': 'Subscribers', 'Value': channel['subscribers']},
            {'Metric': 'Total Views', 'Value': channel['total_views']},
            {'Metric': 'Total Videos', 'Value': channel['total_videos']},
            {'Metric': 'Published', 'Value': str(channel['published_at'])}
        ])

    def get_videos_dataframe(self, channel_id):
        """Get all videos as a dataframe"""
        videos = self.db.get_channel_videos(channel_id)
        if not videos:
            return pd.DataFrame()

        df = pd.DataFrame(videos)
        return df[['video_id', 'title', 'views', 'likes', 'comments', 'published_at']]

    def create_posting_frequency_chart(self, channel_id):
        """Create chart showing posting frequency over time"""
        videos = self.db.get_channel_videos(channel_id)
        if not videos:
            return None

        df = pd.DataFrame(videos)
        df['published_at'] = pd.to_datetime(df['published_at'])
        df['month'] = df['published_at'].dt.to_period('M').astype(str)

        monthly_posts = df.groupby('month').size().reset_index(name='count')

        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=monthly_posts['month'],
            y=monthly_posts['count'],
            mode='lines+markers',
            name='Videos Posted',
            line=dict(color='#667eea', width=3),
            marker=dict(size=8)
        ))

        fig.update_layout(
            title='Posting Frequency Over Time',
            xaxis_title='Month',
            yaxis_title='Number of Videos',
            height=350,
            hovermode='x unified'
        )
        return fig

    def plot_publishing_timeline(self, channel_id):
        """Compatibility wrapper for legacy API"""
        return self._fig_to_dict(self.create_posting_frequency_chart(channel_id))

    def create_engagement_overview_chart(self, channel_id):
        """Create comprehensive engagement overview"""
        videos = self.db.get_channel_videos(channel_id)
        if not videos:
            return None

        df = pd.DataFrame(videos)
        df['views'] = pd.to_numeric(df['views'], errors='coerce').fillna(0)
        df['likes'] = pd.to_numeric(df['likes'], errors='coerce').fillna(0)
        df['comments'] = pd.to_numeric(df['comments'], errors='coerce').fillna(0)

        # Get top 15 videos
        df = df.nlargest(15, 'views')

        fig = go.Figure()

        fig.add_trace(go.Bar(
            name='Views',
            x=df['title'],
            y=df['views'],
            marker_color='#667eea'
        ))

        fig.add_trace(go.Bar(
            name='Likes',
            x=df['title'],
            y=df['likes'],
            marker_color='#f093fb'
        ))

        fig.add_trace(go.Bar(
            name='Comments',
            x=df['title'],
            y=df['comments'],
            marker_color='#764ba2'
        ))

        fig.update_layout(
            title='Top 15 Videos - Engagement Overview',
            xaxis_title='Video Title',
            yaxis_title='Count',
            barmode='group',
            height=450,
            hovermode='x unified',
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        return fig

    def get_content_insights(self, channel_id):
        """Get detailed content performance insights"""
        videos = self.db.get_channel_videos(channel_id)
        if not videos:
            return None

        df = pd.DataFrame(videos)
        df['views'] = pd.to_numeric(df['views'], errors='coerce').fillna(0)
        df['likes'] = pd.to_numeric(df['likes'], errors='coerce').fillna(0)
        df['comments'] = pd.to_numeric(df['comments'], errors='coerce').fillna(0)

        # Calculate engagement metrics
        df['engagement_rate'] = ((df['likes'] + df['comments']) / df['views'] * 100).fillna(0)
        df['like_rate'] = (df['likes'] / df['views'] * 100).fillna(0)
        df['comment_rate'] = (df['comments'] / df['views'] * 100).fillna(0)

        insights = {
            'total_videos': len(df),
            'total_views': int(df['views'].sum()),
            'total_likes': int(df['likes'].sum()),
            'total_comments': int(df['comments'].sum()),
            'avg_views': int(df['views'].mean()),
            'avg_likes': int(df['likes'].mean()),
            'avg_comments': int(df['comments'].mean()),
            'avg_engagement_rate': round(df['engagement_rate'].mean(), 2),
            'avg_like_rate': round(df['like_rate'].mean(), 2),
            'avg_comment_rate': round(df['comment_rate'].mean(), 2),
            'best_video': df.loc[df['views'].idxmax()]['title'] if len(df) > 0 else 'N/A',
            'best_video_views': int(df['views'].max()) if len(df) > 0 else 0,
            'most_engaging': df.loc[df['engagement_rate'].idxmax()]['title'] if len(df) > 0 else 'N/A',
            'most_engaging_rate': round(df['engagement_rate'].max(), 2) if len(df) > 0 else 0
        }

        return insights

    def create_performance_heatmap(self, channel_id):
        """Create heatmap showing video performance patterns"""
        videos = self.db.get_channel_videos(channel_id)
        if not videos:
            return None

        df = pd.DataFrame(videos)
        df['views'] = pd.to_numeric(df['views'], errors='coerce').fillna(0)
        df['likes'] = pd.to_numeric(df['likes'], errors='coerce').fillna(0)
        df['comments'] = pd.to_numeric(df['comments'], errors='coerce').fillna(0)
        df['published_at'] = pd.to_datetime(df['published_at'])

        # Get top 20 videos
        df = df.nlargest(20, 'views')

        # Normalize metrics for comparison
        df['views_norm'] = (df['views'] - df['views'].min()) / (df['views'].max() - df['views'].min())
        df['likes_norm'] = (df['likes'] - df['likes'].min()) / (df['likes'].max() - df['likes'].min())
        df['comments_norm'] = (df['comments'] - df['comments'].min()) / (df['comments'].max() - df['comments'].min())

        fig = go.Figure(data=go.Heatmap(
            z=[df['views_norm'].values, df['likes_norm'].values, df['comments_norm'].values],
            x=df['title'].values,
            y=['Views', 'Likes', 'Comments'],
            colorscale='Viridis',
            hoverongaps=False
        ))

        fig.update_layout(
            title='Performance Heatmap - Top 20 Videos',
            xaxis_title='Video Title',
            height=300
        )
        return fig
