import { WalletProvider } from "@/components/WalletProvider";

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WalletProvider>{children}</WalletProvider>;
}
