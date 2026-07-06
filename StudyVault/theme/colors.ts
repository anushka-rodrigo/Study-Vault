// Central color palette for the whole app.


export type ThemeColors = {
  background: string;      // main screen background (was white)
  surface: string;         // cards, rows, modals (was white)
  header: string;          // top header bar (was blue)
  headerText: string;      // text/icons on the header
  text: string;            // primary text (was near-black)
  textSecondary: string;   // secondary/meta text (was gray)
  border: string;          // dividers, input borders
  primaryButton: string;   // main call-to-action buttons (FAB, Save, Create...)
  primaryButtonText: string;
  danger: string;          // destructive actions (delete, logout confirm)
  overlay: string;         // modal backdrop
  inputBackground: string; // text input fill
  placeholder: string;     // input placeholder text color
  accent: string;          // secondary icon accent (image/handwritten notes)
};

export const lightColors: ThemeColors = {
  background: '#F1F5FB',
  surface: '#FFFFFF',
  header: '#2563EB',
  headerText: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  primaryButton: '#2563EB',
  primaryButtonText: '#FFFFFF',
  danger: '#DC2626',
  overlay: 'rgba(0,0,0,0.4)',
  inputBackground: '#FFFFFF',
  placeholder: '#9CA3AF',
  accent: '#7C3AED',
};

export const darkColors: ThemeColors = {
  background: '#0F172A',
  surface: '#1E293B',
  header: '#B91C1C',
  headerText: '#FFFFFF',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  border: '#334155',
  primaryButton: '#DC2626',
  primaryButtonText: '#FFFFFF',
  danger: '#F87171',
  overlay: 'rgba(0,0,0,0.6)',
  inputBackground: '#1E293B',
  placeholder: '#64748B',
  accent: '#ed781f',
};
