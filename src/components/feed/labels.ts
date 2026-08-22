import type { ContentType } from '@/lib/constants';

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  REPORTING: 'Reporting',
  OPINION: 'Opinion',
  ANALYSIS: 'Analysis',
  PRESS_RELEASE: 'Press release',
};

export const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'importance', label: 'Importance' },
  { value: 'relevance', label: 'Relevance' },
  { value: 'risk', label: 'Risk (highest first)' },
  { value: 'sentiment', label: 'Sentiment (most negative first)' },
];

export const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', SG: 'Singapore', AE: 'UAE',
  AU: 'Australia', JP: 'Japan', DE: 'Germany', FR: 'France', CN: 'China',
  NL: 'Netherlands', CA: 'Canada',
};

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', bn: 'Bengali',
  kn: 'Kannada', ml: 'Malayalam', gu: 'Gujarati', es: 'Spanish', fr: 'French',
  de: 'German', ja: 'Japanese', zh: 'Chinese',
};
