"use client";

type Activity = {
  type: string;
  title: string;
  description: string;
  date: string;
  user_name: string;
};

type RecentActivitiesCardProps = {
  activities: Activity[];
};

export function RecentActivitiesCard({ activities = [] }: RecentActivitiesCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-muted p-5 text-card-foreground shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">Recent Activities</p>
      </header>

      <ul className="space-y-3">
        {activities.length === 0 ? (
          <li className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm shadow-sm">
            <p className="text-muted-foreground">No recent activities</p>
          </li>
        ) : (
          activities.map((activity, index) => (
            <li
              key={`${activity.type}-${index}`}
              className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm shadow-sm"
            >
              <p className="font-semibold text-foreground">{activity.user_name}</p>
              <p className="text-xs text-muted-foreground">{formatDate(activity.date)}</p>
              <p className="mt-1 text-sm text-foreground">{activity.description}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}


