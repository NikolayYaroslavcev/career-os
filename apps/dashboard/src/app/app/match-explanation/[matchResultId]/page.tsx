import { MatchExplanationPage } from '@/features/match-explanation/match-explanation-page';

export default async function MatchExplanationRoute({
  params,
}: {
  params: Promise<{ matchResultId: string }>;
}): Promise<React.JSX.Element> {
  const { matchResultId } = await params;
  return <MatchExplanationPage matchResultId={matchResultId} />;
}
