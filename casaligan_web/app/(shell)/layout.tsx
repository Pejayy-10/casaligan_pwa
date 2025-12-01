import Shell from "../ui/Shell";
import { AdminProfileProvider } from "../contexts/AdminProfileContext";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
	return (
		<AdminProfileProvider>
			<Shell>{children}</Shell>
		</AdminProfileProvider>
	);
}


