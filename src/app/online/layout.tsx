import { OnlineGameProvider } from "@/lib/store/onlineGame";

export default function OnlineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnlineGameProvider>{children}</OnlineGameProvider>;
}
