"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Star, Users, Calendar, TrendingUp, CheckSquare, ArrowRight } from 'lucide-react';
import { getTasksByUser } from '@/lib/tasks';
import { Task } from '@/types/task';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  useEffect(() => {
    if (user) {
      loadAssignedTasks();
    }
  }, [user]);

  const loadAssignedTasks = async () => {
    if (!user) return;
    
    try {
      setLoadingTasks(true);
      const tasks = await getTasksByUser(user.id);
      // Get latest 5 tasks
      const latestTasks = tasks.slice(0, 5);
      setAssignedTasks(latestTasks);
    } catch (error) {
      console.error('Error loading assigned tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const stats = [
    { title: 'Clock In Today', value: '08:30 AM', icon: Clock, color: 'text-blue-600' },
    { title: 'This Week Rating', value: '4.5/5', icon: Star, color: 'text-yellow-600' },
    { title: 'Active Leads', value: '23', icon: Users, color: 'text-green-600' },
    { title: 'Leave Requests', value: '5 Pending', icon: Calendar, color: 'text-purple-600' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New':
        return 'bg-blue-500';
      case 'Progress':
        return 'bg-yellow-500';
      case 'Complete':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Welcome, {user?.name}</h1>
        <p className="text-muted-foreground mt-1">We Will Australia Operations Dashboard</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm space-y-1">
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Clock in/out for time tracking</span>
              </p>
              <p className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                <span>Submit weekly ratings</span>
              </p>
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>View and manage leads</span>
              </p>
              <p className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                <span>View assigned tasks</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates and notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 mt-0.5 text-green-600" />
                <div>
                  <p className="font-medium">New lead added</p>
                  <p className="text-muted-foreground text-xs">Sydney - 2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Star className="h-4 w-4 mt-0.5 text-yellow-600" />
                <div>
                  <p className="font-medium">Rating submitted</p>
                  <p className="text-muted-foreground text-xs">Weekly review - 1 day ago</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-blue-600" />
                <div>
                  <p className="font-medium">Clock in recorded</p>
                  <p className="text-muted-foreground text-xs">Today at 08:30 AM</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Tasks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>My Assigned Tasks</CardTitle>
            <CardDescription>Latest tasks assigned to you</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/tasks')}>
            View All
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardHeader>
        <CardContent>
          {loadingTasks ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assignedTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tasks assigned to you yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => router.push('/tasks')}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">#{task.taskId}</span>
                    </div>
                    <h4 className="font-medium text-sm">{task.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {task.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {format(task.date, 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-4" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {user?.role === 'itteam' && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="text-yellow-800 dark:text-yellow-200">Limited Access Notice</CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-300">
              IT team has restricted access by default. Contact an admin to request specific permissions.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
