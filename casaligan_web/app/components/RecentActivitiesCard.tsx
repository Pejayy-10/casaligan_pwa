"use client";

type Activity = {
  id: string;
  name: string;
  date: string;
  action: string;
};

const recentActivities: Activity[] = [
  { id: "1", name: "Anna Mitre", date: "25 Sep 2025", action: "Posted a job" },
  { id: "2", name: "Kyle Johnson", date: "25 Sep 2025", action: "Booked Jessia Bulumbokai" },
  { id: "3", name: "Olivia Santos", date: "24 Sep 2025", action: "Marked a job as “Interested”" },
  { id: "4", name: "Olivia Santos", date: "24 Sep 2025", action: "Marked a job as “Interested”" },
];

export function RecentActivitiesCard() {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-muted p-5 text-card-foreground shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">Recent Activities</p>
      </header>

      <ul className="space-y-3">
        {recentActivities.map((activity) => (
          <li
            key={activity.id}
            className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm shadow-sm"
          >
            <p className="font-semibold text-foreground">{activity.name}</p>
            <p className="text-xs text-muted-foreground">{activity.date}</p>
            <p className="mt-1 text-sm text-foreground">{activity.action}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}


