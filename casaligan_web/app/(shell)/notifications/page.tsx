import TableShell from "@/app/components/TableShell";

export default function NotificationsPage() {
	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
			<div>
				<h1 className="heading mb-1">Notifications</h1>
				<p className="font-sans text-body">This is a placeholder notifications page.</p>
			</div>

			<TableShell rows={[]} title="Notifications" description="Recent notification events and status." />
		</div>
	);
}


