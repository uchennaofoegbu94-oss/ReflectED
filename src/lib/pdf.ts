import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ReflectED brand colors (RGB)
const BRAND_BLUE: [number, number, number] = [7, 31, 59];
const BRAND_GOLD: [number, number, number] = [212, 175, 55];
const BRAND_TEAL: [number, number, number] = [20, 184, 166];
const BRAND_LIGHT: [number, number, number] = [243, 245, 249];

export interface SchoolBrand {
  name: string;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tagline?: string | null;
  principal_signature_url?: string | null;
  school_stamp_url?: string | null;
}

interface LoadedImage {
  dataUrl: string;
  format: 'PNG' | 'JPEG' | 'WEBP';
}

async function loadImageAsDataUrl(url: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    // jsPDF's addImage needs the format to match the actual bytes — passing a
    // hardcoded format when the upload was a different type silently fails
    // (caught by the addImage try/catch at each call site, so nothing renders
    // and nothing errors either). Detect it from the data URL's mime prefix
    // instead of assuming.
    const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
    let format: LoadedImage['format'] = 'PNG';
    if (mime.includes('jpeg') || mime.includes('jpg')) format = 'JPEG';
    else if (mime.includes('webp')) format = 'WEBP';
    return { dataUrl, format };
  } catch {
    return null;
  }
}

/**
 * Small circular icon badge for section headers — simple vector glyphs (no
 * external icon assets), matching the app's existing brand palette rather than
 * literally recoloring to any reference mockup's teal/orange/green scheme.
 */
function drawIconBadge(doc: jsPDF, x: number, y: number, size: number, color: [number, number, number], icon: 'book' | 'calendar' | 'trend' | 'heart' | 'activity' | 'grade') {
  const r = size / 2;
  const cx = x + r;
  const cy = y + r;
  doc.setFillColor(...color);
  doc.circle(cx, cy, r, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.35);

  switch (icon) {
    case 'book':
      doc.line(cx - r * 0.5, cy - r * 0.35, cx, cy - r * 0.1);
      doc.line(cx, cy - r * 0.1, cx + r * 0.5, cy - r * 0.35);
      doc.line(cx - r * 0.5, cy - r * 0.35, cx - r * 0.5, cy + r * 0.35);
      doc.line(cx + r * 0.5, cy - r * 0.35, cx + r * 0.5, cy + r * 0.35);
      doc.line(cx, cy - r * 0.1, cx, cy + r * 0.55);
      break;
    case 'calendar':
      doc.roundedRect(cx - r * 0.5, cy - r * 0.4, r, r * 0.85, 0.3, 0.3, 'S');
      doc.line(cx - r * 0.5, cy - r * 0.1, cx + r * 0.5, cy - r * 0.1);
      doc.line(cx - r * 0.25, cy - r * 0.55, cx - r * 0.25, cy - r * 0.3);
      doc.line(cx + r * 0.25, cy - r * 0.55, cx + r * 0.25, cy - r * 0.3);
      break;
    case 'trend':
      doc.line(cx - r * 0.5, cy + r * 0.3, cx - r * 0.1, cy - r * 0.1);
      doc.line(cx - r * 0.1, cy - r * 0.1, cx + r * 0.2, cy + r * 0.15);
      doc.line(cx + r * 0.2, cy + r * 0.15, cx + r * 0.55, cy - r * 0.4);
      break;
    case 'heart':
      doc.circle(cx - r * 0.22, cy - r * 0.12, r * 0.28, 'S');
      doc.circle(cx + r * 0.22, cy - r * 0.12, r * 0.28, 'S');
      doc.line(cx - r * 0.45, cy - r * 0.02, cx, cy + r * 0.45);
      doc.line(cx + r * 0.45, cy - r * 0.02, cx, cy + r * 0.45);
      break;
    case 'activity':
      doc.line(cx - r * 0.5, cy, cx - r * 0.15, cy);
      doc.line(cx - r * 0.15, cy, cx, cy - r * 0.5);
      doc.line(cx, cy - r * 0.5, cx + r * 0.2, cy + r * 0.25);
      doc.line(cx + r * 0.2, cy + r * 0.25, cx + r * 0.5, cy);
      break;
    case 'grade':
      doc.setFontSize(size * 1.4);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('A', cx, cy + r * 0.35, { align: 'center' });
      break;
  }
}

async function drawHeader(doc: jsPDF, school: SchoolBrand, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  // Blue banner
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, pageWidth, 28, 'F');
  // Gold accent
  doc.setFillColor(...BRAND_GOLD);
  doc.rect(0, 28, pageWidth, 1.2, 'F');

  // Logo
  if (school.logo_url) {
    const img = await loadImageAsDataUrl(school.logo_url);
    if (img) {
      try { doc.addImage(img.dataUrl, img.format, 10, 5, 18, 18); } catch { /* ignore bad image */ }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const nameY = school.tagline ? 11 : 13;
  doc.text(school.name || 'School', school.logo_url ? 32 : 12, nameY);

  if (school.tagline) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND_GOLD);
    doc.text(school.tagline, school.logo_url ? 32 : 12, 16);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  const meta = [school.address, school.phone, school.email].filter(Boolean).join('  •  ');
  if (meta) doc.text(meta, school.logo_url ? 32 : 12, school.tagline ? 21 : 19);

  doc.setTextColor(...BRAND_GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title.toUpperCase(), pageWidth - 12, 13, { align: 'right' });
  if (subtitle) {
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(subtitle, pageWidth - 12, 19, { align: 'right' });
  }
}

/**
 * Closing signatures section — one static Principal signature + one school
 * stamp, both uploaded once in Settings (per the earlier-confirmed resolution:
 * not per-class-teacher). Shared by report cards and transcripts. Returns the Y
 * position after the block so callers can continue layout beneath it.
 */
async function drawSignatureBlock(doc: jsPDF, school: SchoolBrand, startY: number): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = 55;
  const sigX = 14;
  const stampX = pageWidth - 14 - boxWidth;
  const imgH = 14;

  if (school.principal_signature_url) {
    const img = await loadImageAsDataUrl(school.principal_signature_url);
    if (img) {
      try { doc.addImage(img.dataUrl, img.format, sigX, startY, boxWidth, imgH); } catch { /* ignore bad image */ }
    }
  }
  if (school.school_stamp_url) {
    const img = await loadImageAsDataUrl(school.school_stamp_url);
    if (img) {
      try { doc.addImage(img.dataUrl, img.format, stampX, startY, imgH, imgH); } catch { /* ignore bad image */ }
    }
  }

  const lineY = startY + imgH + 4;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(sigX, lineY, sigX + boxWidth, lineY);
  doc.line(stampX, lineY, stampX + boxWidth, lineY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text('Principal', sigX, lineY + 4);
  doc.text('School Stamp', stampX, lineY + 4);

  return lineY + 4;
}

function drawFooter(doc: jsPDF, school: SchoolBrand) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND_GOLD);
    doc.setLineWidth(0.4);
    doc.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${school.name} • Powered by ReflectED`, 10, pageHeight - 6);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 10, pageHeight - 6, { align: 'right' });
  }
}

export interface ReportCardPDFData {
  student: { first_name: string; last_name: string; admission_number: string; class_name?: string; avatar_url?: string | null };
  session: { name: string };
  term: { name: string };
  subjects: Array<{
    subject_name: string;
    ca1: number | null; ca2: number | null; ca3: number | null;
    exam: number | null; total: number | null; grade: string | null; remarks?: string | null;
  }>;
  summary: { total_score: number; average_score: number; position: number; class_size: number };
  attendance?: { times_present: number; times_absent: number; times_late: number; times_excused: number; school_days_opened: number };
  behavioral_ratings?: {
    affective: Array<{ trait_name: string; rating: number }>;
    psychomotor: Array<{ trait_name: string; rating: number }>;
  };
  grade_analysis?: Array<{ grade: string; remark: string; count: number }>;
  grading_legend?: Array<{ grade: string; min_score: number; max_score: number; remark: string }>;
  remarks: { class_teacher?: string | null; principal?: string | null };
}

export async function generateReportCardPDF(school: SchoolBrand, data: ReportCardPDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await drawHeader(doc, school, 'Student Report Card', `${data.session.name} • ${data.term.name}`);

  // Student info card
  let y = 36;
  doc.setFillColor(...BRAND_LIGHT);
  doc.roundedRect(10, y, pageWidth - 20, 22, 2, 2, 'F');
  doc.setTextColor(...BRAND_BLUE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('STUDENT', 14, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${data.student.first_name} ${data.student.last_name}`, 14, y + 12);
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Adm. No: ${data.student.admission_number}`, 14, y + 18);
  if (data.student.class_name) {
    doc.text(`Class: ${data.student.class_name}`, 80, y + 18);
  }
  // Photo sits at the far right of the card, after Position/Average — card
  // height stays unchanged, the photo just fits within it.
  const photoSize = 18;
  const photoX = pageWidth - 14 - photoSize;
  const positionRightEdge = photoX - 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_BLUE);
  doc.setFontSize(9);
  doc.text(`Position: ${data.summary.position || '-'} / ${data.summary.class_size || '-'}`, positionRightEdge, y + 12, { align: 'right' });
  doc.text(`Average: ${data.summary.average_score}%`, positionRightEdge, y + 18, { align: 'right' });
  if (data.student.avatar_url) {
    const img = await loadImageAsDataUrl(data.student.avatar_url);
    if (img) {
      try { doc.addImage(img.dataUrl, img.format, photoX, y + 2, photoSize, photoSize); } catch { /* ignore bad image */ }
    }
  }

  // Performance Summary — right after student info, ahead of subjects,
  // so the headline numbers are visible before the detail table.
  const afterY = y + 28;
  const boxW = (pageWidth - 35) / 4;
  const cards: Array<[string, string]> = [
    ['Subjects', String(data.subjects.length)],
    ['Total Score', String(data.summary.total_score)],
    ['Average', `${data.summary.average_score}%`],
    ['Position', `${data.summary.position || '-'} / ${data.summary.class_size || '-'}`],
  ];
  cards.forEach(([label, value], i) => {
    const x = 10 + i * (boxW + 5);
    doc.setFillColor(...BRAND_BLUE);
    doc.roundedRect(x, afterY, boxW, 16, 2, 2, 'F');
    doc.setTextColor(...BRAND_GOLD);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + boxW / 2, afterY + 6.5, { align: 'center' });
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(value, x + boxW / 2, afterY + 12.5, { align: 'center' });
  });

  // Attendance summary
  let afterAttendanceY = afterY + 21;
  if (data.attendance) {
    const a = data.attendance;
    doc.setFillColor(...BRAND_LIGHT);
    doc.roundedRect(10, afterAttendanceY, pageWidth - 20, 12, 2, 2, 'F');
    // Icon sits at the same x=10 left edge as every other section icon, sized
    // and centered to sit behind both the heading and the detail line rather
    // than just the heading.
    drawIconBadge(doc, 10, afterAttendanceY + 3, 6, BRAND_BLUE, 'calendar');
    doc.setTextColor(...BRAND_BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('ATTENDANCE', 18, afterAttendanceY + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const attendanceLine =
      `School Opened: ${a.school_days_opened}   •   Present: ${a.times_present}   •   Absent: ${a.times_absent}   •   Late: ${a.times_late}   •   Excused: ${a.times_excused}`;
    doc.text(attendanceLine, 18, afterAttendanceY + 9.5);
    afterAttendanceY += 16;
  }

  // Subjects table — comes after Performance Summary + Attendance now.
  drawIconBadge(doc, 10, afterAttendanceY, 6, BRAND_TEAL, 'book');
  doc.setTextColor(...BRAND_BLUE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Academic Subject Performance', 18, afterAttendanceY + 4.5);
  afterAttendanceY += 9;

  autoTable(doc, {
    startY: afterAttendanceY,
    head: [['Subject', 'CA1', 'CA2', 'CA3', 'Exam', 'Total', 'Grade', 'Remarks']],
    body: data.subjects.map(s => [
      s.subject_name,
      s.ca1 ?? '-', s.ca2 ?? '-', s.ca3 ?? '-', s.exam ?? '-',
      s.total ?? '-', s.grade ?? '-', s.remarks ?? '-',
    ]),
    theme: 'grid',
    headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: BRAND_LIGHT },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 14 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 14, fontStyle: 'bold', textColor: BRAND_TEAL },
    },
  });

  let afterSubjectsY = (doc as any).lastAutoTable.finalY + 6;

  // Page-break check before the domains/grade-analysis row.
  if (afterSubjectsY > pageHeight - 70) {
    doc.addPage();
    afterSubjectsY = 16;
  }

  const halfW = (pageWidth - 25) / 2;

  // Behavioral domains (left) and Grade Analysis + Keys to Grades
  // (right), each side stacking its two sub-tables tightly so the
  // whole row occupies roughly the space one section used to — this
  // matters because a report card must stay on a single page.
  const hasBehavioral = data.behavioral_ratings &&
    (data.behavioral_ratings.affective.length > 0 || data.behavioral_ratings.psychomotor.length > 0);
  const hasGradeInfo = (data.grade_analysis && data.grade_analysis.length > 0) ||
    (data.grading_legend && data.grading_legend.length > 0);

  if (hasBehavioral || hasGradeInfo) {
    const rowStartY = afterSubjectsY;
    let leftY = rowStartY;
    let rightY = rowStartY;

    if (data.behavioral_ratings?.affective.length) {
      autoTable(doc, {
        startY: leftY,
        margin: { left: 10 },
        tableWidth: halfW,
        head: [['Affective Domain', 'Rating']],
        body: data.behavioral_ratings.affective.map(r => [r.trait_name, `${r.rating}/5`]),
        theme: 'grid',
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontSize: 7.5 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          1: { halign: 'center', cellWidth: 14 },
        },
        // Only the header cell needs room for the icon — columnStyles would
        // have padded every body row too, so this is scoped to head only.
        didParseCell: (cellData: any) => {
          if (cellData.section === 'head' && cellData.column.index === 0) {
            cellData.cell.styles.cellPadding = { top: 1.8, bottom: 1.8, left: 7, right: 1 };
          }
        },
        // Icon drawn at the literal x=10 left margin (this table's own margin.left),
        // the same reference point every other section icon in the document uses,
        // so it lines up with the Academic Performance/Attendance icons above and
        // below rather than drifting with the cell's own internal padding.
        didDrawCell: (cellData: any) => {
          if (cellData.section === 'head' && cellData.column.index === 0) {
            drawIconBadge(doc, 10, cellData.cell.y + cellData.cell.height / 2 - 2, 4, BRAND_GOLD, 'heart');
          }
        },
      });
      leftY = (doc as any).lastAutoTable.finalY + 1;
    }
    if (data.behavioral_ratings?.psychomotor.length) {
      autoTable(doc, {
        startY: leftY,
        margin: { left: 10 },
        tableWidth: halfW,
        head: [['Psychomotor Domain', 'Rating']],
        body: data.behavioral_ratings.psychomotor.map(r => [r.trait_name, `${r.rating}/5`]),
        theme: 'grid',
        headStyles: { fillColor: BRAND_TEAL, textColor: 255, fontSize: 7.5 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          1: { halign: 'center', cellWidth: 14 },
        },
        didParseCell: (cellData: any) => {
          if (cellData.section === 'head' && cellData.column.index === 0) {
            cellData.cell.styles.cellPadding = { top: 1.8, bottom: 1.8, left: 7, right: 1 };
          }
        },
        // Second domain just needs to sit tidily in its own cell — positioned
        // relative to the cell's own x rather than the document-wide x=10 line.
        didDrawCell: (cellData: any) => {
          if (cellData.section === 'head' && cellData.column.index === 0) {
            drawIconBadge(doc, cellData.cell.x + 1.5, cellData.cell.y + cellData.cell.height / 2 - 2, 4, BRAND_BLUE, 'activity');
          }
        },
      });
      leftY = (doc as any).lastAutoTable.finalY;
    }

    if (data.grade_analysis?.length) {
      autoTable(doc, {
        startY: rightY,
        margin: { left: 15 + halfW },
        tableWidth: halfW,
        head: [['Grade Analysis', 'Remark', 'Subj.']],
        body: data.grade_analysis.map(g => [g.grade, g.remark, String(g.count)]),
        theme: 'grid',
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontSize: 7.5 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 2: { halign: 'center', cellWidth: 12 } },
        didParseCell: (cellData: any) => {
          if (cellData.section === 'head' && cellData.column.index === 0) {
            cellData.cell.styles.cellPadding = { top: 1.8, bottom: 1.8, left: 7, right: 1 };
          }
        },
        didDrawCell: (cellData: any) => {
          if (cellData.section === 'head' && cellData.column.index === 0) {
            drawIconBadge(doc, cellData.cell.x + 1.5, cellData.cell.y + cellData.cell.height / 2 - 2, 4, BRAND_GOLD, 'grade');
          }
        },
      });
      rightY = (doc as any).lastAutoTable.finalY + 1;
    }
    if (data.grading_legend?.length) {
      autoTable(doc, {
        startY: rightY,
        margin: { left: 15 + halfW },
        tableWidth: halfW,
        head: [['Keys to Grades', 'Range', 'Remark']],
        body: data.grading_legend.map(g => [g.grade, `${g.min_score}-${g.max_score}`, g.remark]),
        theme: 'grid',
        headStyles: { fillColor: BRAND_TEAL, textColor: 255, fontSize: 7.5 },
        bodyStyles: { fontSize: 7 },
        didParseCell: (cellData: any) => {
          if (cellData.section === 'head' && cellData.column.index === 0) {
            cellData.cell.styles.cellPadding = { top: 1.8, bottom: 1.8, left: 7, right: 1 };
          }
        },
        didDrawCell: (cellData: any) => {
          if (cellData.section === 'head' && cellData.column.index === 0) {
            drawIconBadge(doc, cellData.cell.x + 1.5, cellData.cell.y + cellData.cell.height / 2 - 2, 4, BRAND_BLUE, 'grade');
          }
        },
      });
      rightY = (doc as any).lastAutoTable.finalY;
    }

    afterSubjectsY = Math.max(leftY, rightY) + 6;
  }

  // Remarks
  let finalY = afterSubjectsY;
  if (data.remarks.class_teacher || data.remarks.principal) {
    if (afterSubjectsY > pageHeight - 40) {
      doc.addPage();
      afterSubjectsY = 16;
    }
    let ry = afterSubjectsY;
    drawIconBadge(doc, 10, ry, 6, BRAND_BLUE, 'trend');
    doc.setTextColor(...BRAND_BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Overall Performance Summary', 18, ry + 4.5);
    ry += 9;
    if (data.remarks.class_teacher) {
      doc.setTextColor(...BRAND_BLUE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text("Class Teacher's Remarks", 10, ry);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(data.remarks.class_teacher, pageWidth - 20);
      doc.text(lines, 10, ry + 5);
      ry += 5 + lines.length * 4 + 4;
    }
    if (data.remarks.principal) {
      doc.setTextColor(...BRAND_BLUE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text("Principal's Remarks", 10, ry);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(data.remarks.principal, pageWidth - 20);
      doc.text(lines, 10, ry + 5);
      ry += 5 + lines.length * 4;
    }
    finalY = ry;
  }

  // Closing signatures — needs ~30mm; start a fresh page if it won't fit.
  let sigStartY = finalY + 10;
  if (sigStartY > pageHeight - 34) {
    doc.addPage();
    sigStartY = 20;
  }
  await drawSignatureBlock(doc, school, sigStartY);

  drawFooter(doc, school);
  const fname = `report-card-${data.student.admission_number}-${data.term.name}.pdf`.replace(/\s+/g, '_');
  doc.save(fname);
}

export interface TranscriptPDFTermEntry {
  session_name: string;
  term_name: string;
  total_subjects: number;
  total_score: number;
  average_score: number;
  position: number | null;
  class_size: number | null;
  subjects: Array<{
    subject_name: string;
    ca1: number | null; ca2: number | null; ca3: number | null;
    exam: number | null; total: number | null; grade: string | null;
  }>;
}

export interface TranscriptPDFData {
  student: { first_name: string; last_name: string; admission_number: string; class_name?: string; avatar_url?: string | null };
  terms: TranscriptPDFTermEntry[];
}

export async function generateTranscriptPDF(school: SchoolBrand, data: TranscriptPDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await drawHeader(doc, school, 'Academic Transcript');

  let y = 36;
  doc.setFillColor(...BRAND_LIGHT);
  doc.roundedRect(10, y, pageWidth - 20, 16, 2, 2, 'F');
  doc.setTextColor(...BRAND_BLUE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${data.student.first_name} ${data.student.last_name}`, 14, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Adm. No: ${data.student.admission_number}`, 14, y + 13);
  if (data.student.class_name) {
    doc.text(`Current Class: ${data.student.class_name}`, 90, y + 13);
  }
  // Photo at the far right of the bio card, after the class info — card
  // height stays unchanged.
  if (data.student.avatar_url) {
    const photoSize = 12;
    const photoX = pageWidth - 12 - photoSize;
    const img = await loadImageAsDataUrl(data.student.avatar_url);
    if (img) {
      try { doc.addImage(img.dataUrl, img.format, photoX, y + 2, photoSize, photoSize); } catch { /* ignore bad image */ }
    }
  }
  y += 22;

  if (data.terms.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No published results yet.', 14, y + 6);
  }

  data.terms.forEach((term, idx) => {
    // Page-break check: header + at least one row of table space.
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 16;
    }

    doc.setFillColor(...BRAND_BLUE);
    doc.rect(10, y, pageWidth - 20, 8, 'F');
    drawIconBadge(doc, 11, y + 1.5, 5, BRAND_GOLD, 'book');
    doc.setTextColor(...BRAND_GOLD);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`${term.session_name} • ${term.term_name}`, 19, y + 5.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      `Avg: ${term.average_score}%   Position: ${term.position ?? '-'}/${term.class_size ?? '-'}`,
      pageWidth - 13, y + 5.5, { align: 'right' },
    );
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Subject', 'CA1', 'CA2', 'CA3', 'Exam', 'Total', 'Grade']],
      body: term.subjects.length
        ? term.subjects.map(s => [
            s.subject_name, s.ca1 ?? '-', s.ca2 ?? '-', s.ca3 ?? '-',
            s.exam ?? '-', s.total ?? '-', s.grade ?? '-',
          ])
        : [['No subject-level scores recorded for this term.', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [230, 232, 236], textColor: BRAND_BLUE, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: BRAND_LIGHT },
      margin: { left: 10, right: 10 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 14 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'center', cellWidth: 16 },
        5: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
        6: { halign: 'center', cellWidth: 16, fontStyle: 'bold', textColor: BRAND_TEAL },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
    if (idx < data.terms.length - 1) {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(10, y - 4, pageWidth - 10, y - 4);
    }
  });

  // Closing signatures — needs ~30mm; start a fresh page if it won't fit.
  let sigStartY = y + 6;
  if (sigStartY > pageHeight - 34) {
    doc.addPage();
    sigStartY = 20;
  }
  await drawSignatureBlock(doc, school, sigStartY);

  drawFooter(doc, school);
  const fname = `transcript-${data.student.admission_number}.pdf`.replace(/\s+/g, '_');
  doc.save(fname);
}

export interface BroadsheetPDFEntry {
  position: number | null;
  student_name: string;
  admission_number: string;
  subjects: Array<{
    subject_name: string;
    total_ca: number | null;
    exam: number | null; total: number | null; grade: string | null;
  }>;
  total_score: number;
  average_score: number;
  final_grade: string | null;
}

const SUBJECTS_PER_PAGE = 3;

export async function generateBroadsheetPDF(
  school: SchoolBrand,
  meta: { className: string; termName: string; sessionName?: string },
  subjects: string[],
  entries: BroadsheetPDFEntry[],
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const sorted = entries.slice().sort((a, b) => (a.position || 9999) - (b.position || 9999));

  // A full subject set (e.g. 20 subjects × 4 columns each) can't fit
  // on one landscape sheet at a readable size. Instead, chunk subjects
  // into pages of a few at a time — every page repeats Pos/Student/Adm
  // for context — and only the LAST page also appends the Final
  // Total/Avg/Grade columns, once every subject has been shown.
  const chunks: string[][] = [];
  for (let i = 0; i < subjects.length; i += SUBJECTS_PER_PAGE) {
    chunks.push(subjects.slice(i, i + SUBJECTS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  for (let pageIdx = 0; pageIdx < chunks.length; pageIdx++) {
    if (pageIdx > 0) doc.addPage();
    const chunk = chunks[pageIdx];
    const isLastPage = pageIdx === chunks.length - 1;

    const pageLabel = chunks.length > 1 ? ` (Subjects ${pageIdx + 1}/${chunks.length})` : '';
    await drawHeader(doc, school, 'Class Broadsheet',
      `${meta.className} • ${meta.termName}${meta.sessionName ? ' • ' + meta.sessionName : ''}${pageLabel}`);

    const head1: any[] = [
      { content: 'Pos', rowSpan: 2 },
      { content: 'Student', rowSpan: 2 },
      { content: 'Adm.', rowSpan: 2 },
      ...chunk.map(s => ({ content: s, colSpan: 4, styles: { halign: 'center' } })),
    ];
    const head2: any[] = chunk.flatMap(() => ['Tot CA', 'Exam', 'Tot', 'Gr']);

    if (isLastPage) {
      head1.push(
        { content: 'Final Total', rowSpan: 2 },
        { content: 'Final Avg', rowSpan: 2 },
        { content: 'Final Grade', rowSpan: 2 },
      );
    }

    const body = sorted.map(e => {
      const row: any[] = [e.position ?? '-', e.student_name, e.admission_number];
      chunk.forEach(name => {
        const s = e.subjects.find(x => x.subject_name === name);
        row.push(s?.total_ca ?? '-', s?.exam ?? '-', s?.total ?? '-', s?.grade ?? '-');
      });
      if (isLastPage) {
        row.push(e.total_score, e.average_score, e.final_grade || '-');
      }
      return row;
    });

    autoTable(doc, {
      startY: 34,
      head: [head1, head2],
      body,
      theme: 'grid',
      headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: BRAND_LIGHT },
      margin: { left: 8, right: 8 },
      styles: { cellPadding: 1.5 },
      // Bold divider between the subject-block group and the Final
      // columns, lighter dividers between individual subjects —
      // mirrors the on-screen broadsheet's border treatment.
      didParseCell: (data) => {
        if (data.section !== 'body' && data.section !== 'head') return;
        const fixedCols = 3; // Pos, Student, Adm.
        const col = data.column.index;
        if (col < fixedCols) return;
        const subjectColIdx = col - fixedCols;
        if (isLastPage && subjectColIdx === chunk.length * 4) {
          data.cell.styles.lineWidth = { top: 0.1, right: 0.1, bottom: 0.1, left: 0.6 };
        } else if (subjectColIdx > 0 && subjectColIdx % 4 === 0) {
          data.cell.styles.lineWidth = { top: 0.1, right: 0.1, bottom: 0.1, left: 0.3 };
        }
      },
    });
  }

  // Closing signatures — per #11, broadsheets get the same signature/stamp
  // treatment as report cards and transcripts. Only on the final page, after
  // the last chunk's table (which is where the Final Total/Avg/Grade columns
  // also land), with the same page-break safety as the other two PDF types.
  const pageHeight = doc.internal.pageSize.getHeight();
  let sigStartY = (doc as any).lastAutoTable.finalY + 10;
  if (sigStartY > pageHeight - 34) {
    doc.addPage();
    sigStartY = 20;
  }
  await drawSignatureBlock(doc, school, sigStartY);

  drawFooter(doc, school);
  const fname = `broadsheet-${meta.className}-${meta.termName}.pdf`.replace(/\s+/g, '_');
  doc.save(fname);
}

// ─── Report Generation Hub (#19) ───

export interface AttendanceSummaryPDFData {
  range: { from: string; to: string };
  scope: string; // e.g. class name or "All Classes"
  byStatus: { present: number; absent: number; late: number; excused: number };
  byStudent: Array<{ admission_number: string; name: string; present: number; absent: number; late: number; excused: number; total: number }>;
}

export async function generateAttendanceSummaryPDF(school: SchoolBrand, data: AttendanceSummaryPDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await drawHeader(doc, school, 'Attendance Summary', `${data.scope} • ${data.range.from} to ${data.range.to}`);

  const total = Object.values(data.byStatus).reduce((a, b) => a + b, 0) || 1;
  autoTable(doc, {
    startY: 34,
    head: [['Present', 'Late', 'Absent', 'Excused']],
    body: [[
      `${data.byStatus.present} (${Math.round((data.byStatus.present / total) * 100)}%)`,
      `${data.byStatus.late} (${Math.round((data.byStatus.late / total) * 100)}%)`,
      `${data.byStatus.absent} (${Math.round((data.byStatus.absent / total) * 100)}%)`,
      `${data.byStatus.excused} (${Math.round((data.byStatus.excused / total) * 100)}%)`,
    ]],
    theme: 'grid',
    headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
    styles: { halign: 'center', fontSize: 10, cellPadding: 3 },
  });

  const afterSummaryY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_BLUE);
  doc.text('By Student', 12, afterSummaryY);

  autoTable(doc, {
    startY: afterSummaryY + 3,
    head: [['Adm. No.', 'Student', 'Present', 'Late', 'Absent', 'Excused', 'Total Records']],
    body: data.byStudent.map(s => [s.admission_number, s.name, s.present, s.late, s.absent, s.excused, s.total]),
    theme: 'grid',
    headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: BRAND_LIGHT },
    margin: { left: 10, right: 10 },
  });

  drawFooter(doc, school);
  doc.save(`attendance-summary-${data.range.from}-to-${data.range.to}.pdf`.replace(/\s+/g, '_'));
}

export interface FeesSummaryPDFData {
  asOfDate: string;
  students: Array<{ admission_number: string; name: string; class_name: string; total_owed: number; total_paid: number; balance: number }>;
}

export async function generateFeesSummaryPDF(school: SchoolBrand, data: FeesSummaryPDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await drawHeader(doc, school, 'Outstanding Fees Report', `As of ${data.asOfDate}`);

  const totalOwed = data.students.reduce((sum, s) => sum + s.total_owed, 0);
  const totalPaid = data.students.reduce((sum, s) => sum + s.total_paid, 0);
  const totalBalance = data.students.reduce((sum, s) => sum + s.balance, 0);
  const owingCount = data.students.filter(s => s.balance > 0).length;

  autoTable(doc, {
    startY: 34,
    head: [['Total Owed', 'Total Paid', 'Total Outstanding', 'Students Owing']],
    body: [[totalOwed.toLocaleString(), totalPaid.toLocaleString(), totalBalance.toLocaleString(), owingCount]],
    theme: 'grid',
    headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
    styles: { halign: 'center', fontSize: 10, cellPadding: 3 },
  });

  const afterSummaryY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_BLUE);
  doc.text('By Student (highest balance first)', 12, afterSummaryY);

  const owing = data.students.filter(s => s.balance > 0).sort((a, b) => b.balance - a.balance);
  autoTable(doc, {
    startY: afterSummaryY + 3,
    head: [['Adm. No.', 'Student', 'Class', 'Owed', 'Paid', 'Balance']],
    body: owing.map(s => [s.admission_number, s.name, s.class_name, s.total_owed.toLocaleString(), s.total_paid.toLocaleString(), s.balance.toLocaleString()]),
    theme: 'grid',
    headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: BRAND_LIGHT },
    margin: { left: 10, right: 10 },
  });

  drawFooter(doc, school);
  doc.save(`outstanding-fees-${data.asOfDate}.pdf`.replace(/\s+/g, '_'));
}

export interface EnrollmentPDFData {
  scope: string; // e.g. class name or "All Classes"
  classes: Array<{ class_name: string; students: Array<{ admission_number: string; name: string; gender: string }> }>;
}

export async function generateEnrollmentPDF(school: SchoolBrand, data: EnrollmentPDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const totalStudents = data.classes.reduce((sum, c) => sum + c.students.length, 0);
  await drawHeader(doc, school, 'Class Enrollment Report', `${data.scope} • ${totalStudents} students`);

  let startY = 34;
  data.classes.forEach((cls, idx) => {
    if (idx > 0) {
      startY = (doc as any).lastAutoTable.finalY + 8;
      if (startY > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        startY = 20;
      }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_BLUE);
    doc.text(`${cls.class_name} (${cls.students.length})`, 12, startY);

    autoTable(doc, {
      startY: startY + 3,
      head: [['#', 'Adm. No.', 'Student', 'Gender']],
      body: cls.students.map((s, i) => [i + 1, s.admission_number, s.name, s.gender]),
      theme: 'grid',
      headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: BRAND_LIGHT },
      margin: { left: 10, right: 10 },
    });
  });

  drawFooter(doc, school);
  doc.save(`class-enrollment-${data.scope}.pdf`.replace(/\s+/g, '_'));
}
