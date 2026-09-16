// User Roles
export type UserRole = 'admin' | 'principal' | 'teacher' | 'student' | 'parent' | 'accountant';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
}

// Academic Structure
export interface AcademicSession {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Term {
  id: string;
  sessionId: string;
  name: string;
  number: 1 | 2 | 3;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface ClassArm {
  id: string;
  name: string;
  arm: string;
  level: 'primary' | 'junior-secondary' | 'senior-secondary';
  teacherId?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  classIds: string[];
}

// Student Information
export interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  classId: string;
  parentId?: string;
  avatar?: string;
  enrollmentStatus: 'active' | 'graduated' | 'transferred' | 'suspended';
  enrollmentDate: string;
}

// Attendance
export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  markedBy: string;
  period?: number;
}

// Results & Grades
export interface AssessmentScore {
  id: string;
  studentId: string;
  subjectId: string;
  termId: string;
  ca1?: number;
  ca2?: number;
  ca3?: number;
  exam?: number;
  total?: number;
  grade?: string;
  remarks?: string;
}

// Fees
export interface FeeStructure {
  id: string;
  classId: string;
  termId: string;
  description: string;
  amount: number;
}

export interface Payment {
  id: string;
  studentId: string;
  feeId: string;
  amount: number;
  paymentDate: string;
  method: 'cash' | 'bank_transfer' | 'pos';
  receiptNumber: string;
  status: 'pending' | 'confirmed';
}

// LMS - Classroom
export interface Classroom {
  id: string;
  name: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  code: string;
  description?: string;
  bannerColor?: string;
}

export interface StreamPost {
  id: string;
  classroomId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  attachments?: Attachment[];
  isPinned: boolean;
  createdAt: string;
  comments: Comment[];
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'file' | 'link' | 'video';
  url: string;
  size?: number;
}

// Assignments
export interface Assignment {
  id: string;
  classroomId: string;
  title: string;
  instructions: string;
  topic?: string;
  dueDate?: string;
  dueTime?: string;
  points?: number;
  attachments?: Attachment[];
  status: 'draft' | 'published' | 'scheduled';
  createdAt: string;
  allowLateSubmission: boolean;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  content?: string;
  attachments?: Attachment[];
  submittedAt: string;
  isLate: boolean;
  grade?: number;
  feedback?: string;
  status: 'submitted' | 'graded' | 'returned';
}

// Quiz
export interface Quiz {
  id: string;
  classroomId: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  duration?: number; // in minutes
  dueDate?: string;
  shuffleQuestions: boolean;
  showResults: boolean;
  status: 'draft' | 'published';
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'short_answer' | 'true_false';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  points: number;
}

// Notifications
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  attendanceRate: number;
  feesCollected: number;
  pendingAssignments: number;
}
