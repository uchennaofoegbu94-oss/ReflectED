import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function JoinClassroomDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleJoin = async () => {
    if (!code.trim()) {
      toast.error('Please enter a classroom code');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to join a classroom');
      return;
    }

    setIsLoading(true);

    try {
      // Find the classroom by code using security definer function
      // (students can't see classrooms via RLS until they're members)
      const { data: classroomResults, error: classroomError } = await supabase
        .rpc('find_classroom_by_code', { _code: code.trim().toUpperCase() });

      if (classroomError) throw classroomError;

      const classroom = classroomResults?.[0] || null;

      if (!classroom) {
        toast.error('Classroom not found. Please check the code and try again.');
        setIsLoading(false);
        return;
      }

      // Find the student record for this user
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, school_id, class_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (studentError) throw studentError;

      if (!student) {
        toast.error('Student record not found. Please contact your administrator.');
        setIsLoading(false);
        return;
      }

      if (!student.class_id) {
        toast.error("You haven't been enrolled in a class yet — contact your administrator before joining a classroom.");
        setIsLoading(false);
        return;
      }

      if ((classroom as any).class_id && (classroom as any).class_id !== student.class_id) {
        toast.error("This classroom isn't for your class.");
        setIsLoading(false);
        return;
      }

      // Check if already enrolled
      const { data: existingMember } = await supabase
        .from('classroom_members')
        .select('id')
        .eq('classroom_id', classroom.id)
        .eq('student_id', student.id)
        .maybeSingle();

      if (existingMember) {
        toast.info('You are already enrolled in this classroom!');
        setOpen(false);
        setCode('');
        setIsLoading(false);
        return;
      }

      // Enroll the student
      const { error: enrollError } = await supabase
        .from('classroom_members')
        .insert({
          classroom_id: classroom.id,
          student_id: student.id,
          school_id: (classroom as any).school_id || student.school_id,
        });

      if (enrollError) throw enrollError;

      toast.success(`Successfully joined ${classroom.name}!`);
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['my-classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['student-classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['student-pending-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      setOpen(false);
      setCode('');
    } catch (error: any) {
      console.error('Error joining classroom:', error);
      if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
        toast.error("You can't join this classroom — it isn't for your class, or you haven't been enrolled in a class yet.");
      } else {
        toast.error(error.message || 'Failed to join classroom');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus size={18} />
          Join Classroom
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join a Classroom</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Classroom Code</Label>
            <Input
              id="code"
              placeholder="Enter classroom code (e.g., MATH-SS1-2025)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <p className="text-sm text-muted-foreground">
              Ask your teacher for the classroom code to join their class.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleJoin} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
