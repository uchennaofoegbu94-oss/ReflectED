import { Student } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, Mail, Phone, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StudentRowProps {
  student: Student;
  className?: string;
  onView?: () => void;
}

export function StudentRow({ student, className, onView }: StudentRowProps) {
  const statusColors = {
    active: 'bg-success/10 text-success border-success/20',
    graduated: 'bg-secondary/10 text-secondary border-secondary/20',
    transferred: 'bg-accent/10 text-accent-foreground border-accent/20',
    suspended: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  return (
    <tr className="table-row">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={student.avatar} />
            <AvatarFallback>
              {student.firstName.charAt(0)}
              {student.lastName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">
              {student.lastName}, {student.firstName} {student.middleName?.[0]}.
            </p>
            <p className="text-xs text-muted-foreground">{student.admissionNumber}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-foreground">{className || 'JSS 2A'}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm capitalize text-foreground">{student.gender}</span>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={statusColors[student.enrollmentStatus]}>
          {student.enrollmentStatus}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="More options">
              <MoreVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye size={14} className="mr-2" />
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Mail size={14} className="mr-2" />
              Contact Parent
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Phone size={14} className="mr-2" />
              Call Parent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
