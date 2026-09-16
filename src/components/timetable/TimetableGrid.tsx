import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, Clock, MapPin, User } from 'lucide-react';
import { TimetableSlotWithDetails, DAYS_OF_WEEK, TIME_SLOTS } from '@/hooks/useTimetable';
import { cn } from '@/lib/utils';

interface TimetableGridProps {
  slots: TimetableSlotWithDetails[];
  onEdit?: (slot: TimetableSlotWithDetails) => void;
  onDelete?: (slot: TimetableSlotWithDetails) => void;
  onAddSlot?: (day: number, startTime: string) => void;
  isEditable?: boolean;
  showTeacher?: boolean;
  showClass?: boolean;
}

export function TimetableGrid({
  slots,
  onEdit,
  onDelete,
  onAddSlot,
  isEditable = false,
  showTeacher = true,
  showClass = false,
}: TimetableGridProps) {
  // Group slots by day and time
  const slotsByDayTime = useMemo(() => {
    const map = new Map<string, TimetableSlotWithDetails>();
    slots.forEach((slot) => {
      const key = `${slot.day_of_week}-${slot.start_time.slice(0, 5)}`;
      map.set(key, slot);
    });
    return map;
  }, [slots]);

  // Filter out break times from display time slots
  const displayTimeSlots = TIME_SLOTS.filter(
    (slot) => !slot.label.includes('Break') && !slot.label.includes('Lunch')
  );

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getSubjectColor = (subjectCode: string) => {
    const colors = [
      'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
      'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
      'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700',
      'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700',
      'bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700',
      'bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700',
      'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700',
      'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
    ];
    const index = subjectCode.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header */}
        <div className="grid grid-cols-6 gap-2 mb-2">
          <div className="p-3 text-center font-medium text-muted-foreground">
            <Clock className="h-4 w-4 mx-auto mb-1" />
            Time
          </div>
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day.value}
              className="p-3 text-center font-semibold bg-muted/50 rounded-lg"
            >
              {day.label}
            </div>
          ))}
        </div>

        {/* Grid Body */}
        <div className="space-y-2">
          {displayTimeSlots.map((timeSlot) => (
            <div key={timeSlot.start} className="grid grid-cols-6 gap-2">
              {/* Time Column */}
              <div className="p-3 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg flex flex-col justify-center">
                <div className="font-medium">{formatTime(timeSlot.start)}</div>
                <div className="text-xs">to {formatTime(timeSlot.end)}</div>
              </div>

              {/* Day Columns */}
              {DAYS_OF_WEEK.map((day) => {
                const slot = slotsByDayTime.get(`${day.value}-${timeSlot.start}`);

                if (slot) {
                  return (
                    <Card
                      key={`${day.value}-${timeSlot.start}`}
                      className={cn(
                        'group relative border-2 transition-all hover:shadow-md',
                        getSubjectColor(slot.subjects?.code || 'XX')
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="space-y-1">
                          <div className="font-semibold text-sm truncate">
                            {slot.subjects?.name}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {slot.subjects?.code}
                          </Badge>
                          {showTeacher && slot.staff && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                              <User className="h-3 w-3" />
                              {slot.staff.first_name} {slot.staff.last_name}
                            </div>
                          )}
                          {showTeacher && !slot.staff && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500 mt-2" title="This period has no teacher assigned — it won't show up in By Teacher view">
                              <User className="h-3 w-3" />
                              No teacher assigned
                            </div>
                          )}
                          {showClass && slot.class_arms && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {slot.class_arms.name} {slot.class_arms.arm}
                            </div>
                          )}
                          {slot.room_number && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {slot.room_number}
                            </div>
                          )}
                        </div>

                        {isEditable && (
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => onEdit?.(slot)}
                             title="Edit slot">
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => onDelete?.(slot)}
                             title="Delete slot">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                }

                // Empty slot
                return (
                  <div
                    key={`${day.value}-${timeSlot.start}`}
                    className={cn(
                      'rounded-lg border-2 border-dashed border-muted min-h-[80px] flex items-center justify-center',
                      isEditable && 'hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors'
                    )}
                    onClick={() => isEditable && onAddSlot?.(day.value, timeSlot.start)}
                  >
                    {isEditable && (
                      <Plus className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
