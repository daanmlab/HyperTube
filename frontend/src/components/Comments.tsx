import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MessageSquare, Send, Trash2, Edit2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface Comment {
  id: string;
  content: string;
  imdbId: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface CommentsProps {
  imdbId: string;
  currentUserId?: string;
}

export const Comments: React.FC<CommentsProps> = ({ imdbId, currentUserId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/comments/movie/${imdbId}`);
      setComments(response.data || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [imdbId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await apiClient.post('/comments', {
        imdbId,
        content: newComment.trim(),
      });
      setNewComment('');
      await loadComments();
    } catch (error: any) {
      console.error('Failed to post comment:', error);
      alert(error.response?.data?.message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    setIsSubmitting(true);
    try {
      await apiClient.put(`/comments/${commentId}`, {
        content: editContent.trim(),
      });
      setEditingId(null);
      setEditContent('');
      await loadComments();
    } catch (error: any) {
      console.error('Failed to update comment:', error);
      alert(error.response?.data?.message || 'Failed to update comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await apiClient.delete(`/comments/${commentId}`);
      await loadComments();
    } catch (error: any) {
      console.error('Failed to delete comment:', error);
      alert(error.response?.data?.message || 'Failed to delete comment');
    }
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({comments.length})
        </CardTitle>
        <CardDescription>
          Share your thoughts about this movie
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Comment Form */}
        <form onSubmit={handleSubmitComment} className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full min-h-[80px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            maxLength={1000}
            disabled={isSubmitting}
          />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {newComment.length}/1000
            </span>
            <Button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              size="sm"
            >
              <Send className="h-4 w-4 mr-2" />
              Post Comment
            </Button>
          </div>
        </form>

        {/* Comments List */}
        <div className="space-y-4 mt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No comments yet. Be the first to comment!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="border rounded-lg p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {comment.user.firstName[0]}{comment.user.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {comment.user.firstName} {comment.user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{comment.user.username} · {formatDate(comment.createdAt)}
                      </p>
                    </div>
                  </div>
                  {currentUserId === comment.user.id && (
                    <div className="flex gap-2">
                      {editingId === comment.id ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(comment)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {editingId === comment.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full min-h-[60px] p-2 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      maxLength={1000}
                      disabled={isSubmitting}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateComment(comment.id)}
                        disabled={!editContent.trim() || isSubmitting}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
