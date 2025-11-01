import { MovieList } from '@/components/MovieList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoList } from '@/components/VideoList';
import { VideoUpload } from '@/components/VideoUpload';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, LogOut, Mail, Search, User } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!user) {
    return null;
  }

  const handleVideoUploaded = (videoId: string) => {
    // Track uploaded videos in localStorage
    const uploadedVideos = JSON.parse(localStorage.getItem('uploadedVideos') || '[]');
    if (!uploadedVideos.includes(videoId)) {
      uploadedVideos.push(videoId);
      localStorage.setItem('uploadedVideos', JSON.stringify(uploadedVideos));
    }
    // Trigger refresh of video list
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {user.firstName}!</h1>
            <p className="text-muted-foreground">Here's your HyperTube dashboard</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/search')} className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search Movies
            </Button>
            <Button variant="outline" onClick={logout} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profile</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{user.fullName}</div>
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{user.email}</div>
              <p className="text-xs text-muted-foreground">
                {user.isActive ? 'Active' : 'Inactive'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Member Since</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {new Date(user.createdAt).toLocaleDateString()}
              </div>
              <p className="text-xs text-muted-foreground">Account created</p>
            </CardContent>
          </Card>
        </div>

        <MovieList class="mt-1" refreshTrigger={refreshTrigger} />

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>🎬 Video Test Setup (Legacy)</CardTitle>
            <CardDescription>
              Upload and test video transcoding and streaming functionality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              <VideoUpload onVideoUploaded={handleVideoUploaded} />
              <VideoList refreshTrigger={refreshTrigger} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
