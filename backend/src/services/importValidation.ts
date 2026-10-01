export const importEntities = [
  'institutions',
  'departments',
  'programs',
  'academic_years',
  'semesters',
  'sections',
  'subjects',
  'subject_offerings',
  'students',
  'teachers',
  'enrollments',
  'teaching_assignments',
] as const;

export const supportedImportEntities = ['institutions', 'students', 'teachers'] as const;
export type SupportedImportEntity = (typeof supportedImportEntities)[number];
export type ImportEntity = (typeof importEntities)[number];

export function isCommitSupported(entity: string): entity is SupportedImportEntity {
  return (supportedImportEntities as readonly string[]).includes(entity);
}

type ImportRow = Record<string, unknown>;

const requiredFields: Record<ImportEntity, string[]> = {
  institutions: ['code', 'name'],
  departments: ['code', 'name'],
  programs: ['departmentCode', 'code', 'name', 'level', 'durationSemesters'],
  academic_years: ['label', 'startDate', 'endDate'],
  semesters: ['academicYearLabel', 'number', 'label'],
  sections: ['programCode', 'academicYearLabel', 'semesterNumber', 'name'],
  subjects: ['departmentCode', 'code', 'name'],
  subject_offerings: ['subjectCode', 'sectionName', 'semesterNumber'],
  students: ['studentId', 'fullName', 'contactEmail'],
  teachers: ['employeeId', 'fullName', 'contactEmail'],
  enrollments: ['studentId', 'sectionName', 'academicYearLabel', 'semesterNumber'],
  teaching_assignments: ['employeeId', 'subjectCode', 'sectionName', 'semesterNumber'],
};

function isRecord(value: unknown): value is ImportRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValue(row: ImportRow, field: string): boolean {
  const value = row[field];
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
}

function duplicateKey(entity: ImportEntity, row: ImportRow): string | null {
  const keys: Record<ImportEntity, string[]> = {
    institutions: ['code'],
    departments: ['code'],
    programs: ['departmentCode', 'code'],
    academic_years: ['label'],
    semesters: ['academicYearLabel', 'number'],
    sections: ['programCode', 'academicYearLabel', 'semesterNumber', 'name'],
    subjects: ['departmentCode', 'code'],
    subject_offerings: ['subjectCode', 'sectionName', 'semesterNumber'],
    students: ['studentId'],
    teachers: ['employeeId'],
    enrollments: ['studentId', 'sectionName', 'academicYearLabel', 'semesterNumber'],
    teaching_assignments: ['employeeId', 'subjectCode', 'sectionName', 'semesterNumber'],
  };
  return keys[entity].map((key) => String(row[key] ?? '').trim().toLowerCase()).join('|');
}

export interface ImportRowError {
  row: number;
  fields: string[];
  message: string;
}

export interface ImportPreview {
  entity: ImportEntity;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ImportRowError[];
}

export function validateImportPreview(entity: string, rows: unknown): ImportPreview | { error: string } {
  if (!isCommitSupported(entity)) {
    return { error: `Unsupported import entity: "${entity}". Supported entities for import and commit are: ${supportedImportEntities.join(', ')}` };
  }
  if (!Array.isArray(rows)) return { error: 'rows must be an array of objects' };
  if (rows.length > 1000) return { error: 'A single preview cannot contain more than 1000 rows' };

  const typedEntity = entity as SupportedImportEntity;
  const required = requiredFields[typedEntity];
  const seen = new Set<string>();
  const errors: ImportRowError[] = [];

  rows.forEach((value, index) => {
    const rowNumber = index + 1;
    if (!isRecord(value)) {
      errors.push({ row: rowNumber, fields: [], message: 'Row must be an object' });
      return;
    }

    const missing = required.filter((field) => !hasValue(value, field));
    if (missing.length > 0) {
      errors.push({ row: rowNumber, fields: missing, message: `Missing required field(s): ${missing.join(', ')}` });
    }

    if (typedEntity === 'students' || typedEntity === 'teachers') {
      const email = String(value.contactEmail ?? '').trim();
      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        errors.push({ row: rowNumber, fields: ['contactEmail'], message: 'Contact email is not valid' });
      }
    }

    const key = duplicateKey(typedEntity, value);
    if (key && seen.has(key)) {
      errors.push({ row: rowNumber, fields: [], message: 'Duplicate record in this import' });
    }
    if (key) seen.add(key);
  });

  const invalidRows = new Set(errors.map((error) => error.row)).size;
  return {
    entity: typedEntity,
    totalRows: rows.length,
    validRows: rows.length - invalidRows,
    invalidRows,
    errors,
  };
}
