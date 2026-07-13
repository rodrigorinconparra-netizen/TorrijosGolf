import { TorrijosMark } from "@/components/torrijos-mark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-[calc(2rem_+_env(safe-area-inset-top))]">
      <div className="mb-8 flex flex-col items-center gap-2">
        <TorrijosMark height={64} />
        <p className="text-sm text-muted">La app de la escuela y el club</p>
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 text-center text-xs text-faint">
        Club de Golf Torrijos · A 45 min de Madrid
      </p>
    </div>
  );
}
