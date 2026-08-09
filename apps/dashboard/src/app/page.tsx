import type { Metadata } from 'next';
import { LandingContent } from '@/features/landing/landing-content';
import { RootAuthRedirect } from '@/features/landing/root-auth-redirect';

export const metadata: Metadata = {
  title: 'CareerOS - Your career workspace',
  description: 'Find opportunities. Track progress. Grow.',
  openGraph: {
    title: 'CareerOS - Your career workspace',
    description: 'Find opportunities. Track progress. Grow.',
    type: 'website',
  },
};

export default function RootPage(): React.JSX.Element {
  return (
    <>
      <RootAuthRedirect />
      <LandingContent />
    </>
  );
}
