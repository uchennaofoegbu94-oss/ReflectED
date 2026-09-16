// CBT bulk question parser.
// Supports two formats:
//   1) Block text — one question per block, separated by a blank line.
//      Question on first line (optional leading "1." numbering).
//      Multiple choice: lines starting with A) B) C) D)  (or A. B. ...).
//      Mark the correct line with ANSWER: <letter|True|False>.
//      Optional POINTS: <n>  (defaults to 1).
//      A true/false question is recognised when the only option lines are
//      TRUE / FALSE (case-insensitive) — or just an ANSWER line of True/False.
//   2) CSV — header row:
//      question,type,option_a,option_b,option_c,option_d,correct,points
//      type ∈ multiple_choice | true_false | short_answer | essay
//      correct: letter (A-D) or True/False or the literal answer for short_answer

export type ParsedQuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'essay';

export interface ParsedQuestion {
  question_text: string;
  question_type: ParsedQuestionType;
  options: string[] | null;
  correct_answer: number | string | boolean | null;
  points: number;
  order_index: number;
  grading_rubric: string | null;
}

const LETTER_RE = /^\s*([A-Da-d])\s*[\)\.\:]\s*(.+)$/;

function parseBlock(block: string, index: number): ParsedQuestion | null {
  const rawLines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return null;

  let points = 1;
  let answerRaw: string | null = null;
  const optionLines: { letter: string; text: string }[] = [];
  const textLines: string[] = [];
  let sawTrueFalseMarker = false;

  for (const line of rawLines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('ANSWER:')) {
      answerRaw = line.slice(7).trim();
      continue;
    }
    if (upper.startsWith('POINTS:')) {
      const n = parseInt(line.slice(7).trim(), 10);
      if (!isNaN(n) && n > 0) points = n;
      continue;
    }
    if (upper === 'TRUE/FALSE' || upper === 'TRUEFALSE') {
      sawTrueFalseMarker = true;
      continue;
    }
    const m = line.match(LETTER_RE);
    if (m) {
      optionLines.push({ letter: m[1].toUpperCase(), text: m[2].trim() });
      continue;
    }
    textLines.push(line);
  }

  if (textLines.length === 0) return null;

  // Strip leading numbering like "1." or "1)" from question text.
  let questionText = textLines.join(' ').replace(/^\s*\d+\s*[\)\.\:]\s*/, '').trim();
  if (!questionText) return null;

  const base = {
    question_text: questionText,
    points,
    order_index: index,
    grading_rubric: null as string | null,
  };

  // True/False
  const isTF =
    sawTrueFalseMarker ||
    (optionLines.length === 0 && answerRaw && /^(true|false)$/i.test(answerRaw));
  if (isTF) {
    const correct = answerRaw && /^true$/i.test(answerRaw);
    return {
      ...base,
      question_type: 'true_false',
      options: ['True', 'False'],
      correct_answer: correct ? 0 : 1,
    };
  }

  // Multiple choice
  if (optionLines.length >= 2) {
    optionLines.sort((a, b) => a.letter.charCodeAt(0) - b.letter.charCodeAt(0));
    const options = optionLines.map((o) => o.text);
    let correctIndex: number | null = null;
    if (answerRaw) {
      const a = answerRaw.trim().toUpperCase();
      if (/^[A-D]$/.test(a)) correctIndex = a.charCodeAt(0) - 65;
    }
    return {
      ...base,
      question_type: 'multiple_choice',
      options,
      correct_answer: correctIndex ?? 0,
    };
  }

  // Fallback: short answer if an answer was provided, else essay
  if (answerRaw) {
    return {
      ...base,
      question_type: 'short_answer',
      options: null,
      correct_answer: answerRaw,
    };
  }
  return {
    ...base,
    question_type: 'essay',
    options: null,
    correct_answer: null,
  };
}

export function parseQuestionBlocks(input: string): ParsedQuestion[] {
  const blocks = input
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: ParsedQuestion[] = [];
  blocks.forEach((b, i) => {
    const q = parseBlock(b, i);
    if (q) out.push({ ...q, order_index: out.length });
  });
  return out;
}

// Very small CSV parser that handles quoted fields with embedded commas.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') inQuotes = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseQuestionsCsv(input: string): ParsedQuestion[] {
  const lines = input.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const qIdx = col('question');
  const tIdx = col('type');
  const aIdx = col('option_a');
  const bIdx = col('option_b');
  const cIdx = col('option_c');
  const dIdx = col('option_d');
  const corrIdx = col('correct');
  const ptsIdx = col('points');

  const out: ParsedQuestion[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const question_text = cells[qIdx] || '';
    if (!question_text.trim()) continue;
    const type = (cells[tIdx] || 'multiple_choice').toLowerCase() as ParsedQuestionType;
    const points = Math.max(1, parseInt(cells[ptsIdx] || '1', 10) || 1);
    const correctRaw = (cells[corrIdx] || '').trim();

    if (type === 'true_false') {
      out.push({
        question_text,
        question_type: 'true_false',
        options: ['True', 'False'],
        correct_answer: /^true$/i.test(correctRaw) ? 0 : 1,
        points,
        order_index: out.length,
        grading_rubric: null,
      });
    } else if (type === 'short_answer' || type === 'essay') {
      out.push({
        question_text,
        question_type: type,
        options: null,
        correct_answer: type === 'short_answer' ? (correctRaw || null) : null,
        points,
        order_index: out.length,
        grading_rubric: null,
      });
    } else {
      const options = [cells[aIdx], cells[bIdx], cells[cIdx], cells[dIdx]]
        .map((s) => (s || '').trim())
        .filter(Boolean);
      let correctIndex = 0;
      if (/^[A-Da-d]$/.test(correctRaw)) {
        correctIndex = correctRaw.toUpperCase().charCodeAt(0) - 65;
      }
      out.push({
        question_text,
        question_type: 'multiple_choice',
        options,
        correct_answer: Math.min(correctIndex, Math.max(0, options.length - 1)),
        points,
        order_index: out.length,
        grading_rubric: null,
      });
    }
  }
  return out;
}

export function parseQuestionsAuto(input: string): ParsedQuestion[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const firstLine = trimmed.split(/\r?\n/, 1)[0].toLowerCase();
  if (firstLine.includes('question') && firstLine.includes(',')) {
    return parseQuestionsCsv(trimmed);
  }
  return parseQuestionBlocks(trimmed);
}
