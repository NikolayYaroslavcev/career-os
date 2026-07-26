import { RegisterForm } from '@/features/auth/register-form';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export default function RegisterPage(): React.JSX.Element {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <RegisterForm />
    </main>
  );
}
