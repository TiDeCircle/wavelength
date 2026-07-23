import { LocalGameProvider } from "@/lib/store/localGame";

export default function LocalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LocalGameProvider>{children}</LocalGameProvider>;
}
