import { MovieSearch } from '@/components/MovieSearch';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Search } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Search className="h-8 w-8" />
                Search Movies
              </h1>
              <p className="text-muted-foreground">Find and download movies to your library</p>
            </div>
          </div>
        </div>

        <MovieSearch />
      </div>
    </div>
  );
};
