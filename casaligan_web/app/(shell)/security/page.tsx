import Security from "@/app/components/Security";
import TableShell from "@/app/components/TableShell";

export default function SecurityPage() {
	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">

      <Security />

      <TableShell rows={[]} title="Security Records" description="Audit and security-related events." />
		</div>
	);
}


