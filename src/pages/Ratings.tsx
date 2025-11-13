import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Star, Plus, TrendingUp } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Rating {
  id: string;
  employeeName: string;
  week: string;
  rating: number;
  notes: string;
}

const Ratings = () => {
  const { user } = useAuth();
  const [ratings] = useState<Rating[]>([
    { id: '1', employeeName: 'John Smith', week: 'Week 2, 2025', rating: 4.5, notes: 'Excellent performance' },
    { id: '2', employeeName: 'Jane Doe', week: 'Week 2, 2025', rating: 4.0, notes: 'Good work quality' },
    { id: '3', employeeName: 'Mike Johnson', week: 'Week 2, 2025', rating: 5.0, notes: 'Outstanding!' },
  ]);

  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: 'Rating Submitted',
      description: 'Employee rating has been recorded successfully.',
    });
    setOpen(false);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const avgRating = (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Ratings</h1>
          <p className="text-muted-foreground mt-1">Weekly performance tracking</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'operationsstaff') && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Rating
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit Weekly Rating</DialogTitle>
                <DialogDescription>Rate employee performance for this week</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employee">Employee Name</Label>
                  <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Rating (1-5)</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="p-2 hover:bg-accent rounded"
                      >
                        <Star className="h-6 w-6 text-gray-300 hover:text-yellow-500" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" placeholder="Add notes about performance..." />
                </div>
                <Button type="submit" className="w-full">Submit Rating</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-primary">{avgRating}</span>
              <Star className="h-6 w-6 fill-yellow-500 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Ratings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{ratings.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-lg font-semibold">+12%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Ratings</CardTitle>
          <CardDescription>Weekly employee performance reviews</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Week</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ratings.map((rating) => (
                <TableRow key={rating.id}>
                  <TableCell className="font-medium">{rating.employeeName}</TableCell>
                  <TableCell>{rating.week}</TableCell>
                  <TableCell>{renderStars(rating.rating)}</TableCell>
                  <TableCell className="max-w-xs truncate">{rating.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Ratings;
