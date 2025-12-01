import { createClient } from "./client";

export interface MatchingRecord {
  match_id: number;
  employer_id: number;
  worker_id: number;
  package_id: number | null;
  match_score: number;
  match_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  employer_name?: string;
  worker_name?: string;
  package_title?: string;
}

/**
 * Get all matching records with related employer, worker, and package info
 */
export async function getMatchingRecords(
  limit = 50,
  offset = 0,
  status?: string
): Promise<MatchingRecord[]> {
  const supabase = createClient();

  let query = supabase
    .from("matching_records")
    .select(
      `
      match_id,
      employer_id,
      worker_id,
      package_id,
      match_score,
      match_date,
      status,
      notes,
      created_at,
      employers:employer_id (
        employer_id,
        users:user_id (
          name,
          role
        )
      ),
      workers:worker_id (
        worker_id,
        users:user_id (
          name,
          role
        )
      ),
      packages:package_id (
        title
      )
    `
    )
    .order("match_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching matching records:", error);
    throw error;
  }

  // Transform the data to flatten the nested structure and filter out admin users
  return (data || [])
    .filter((record: any) => {
      const employerRole = record.employers?.users?.role;
      const workerRole = record.workers?.users?.role;
      // Only include records where employer role is 'employer' and worker role is 'worker'
      return employerRole === 'employer' && workerRole === 'worker';
    })
    .map((record: any) => ({
      match_id: record.match_id,
      employer_id: record.employer_id,
      worker_id: record.worker_id,
      package_id: record.package_id,
      match_score: record.match_score,
      match_date: record.match_date,
      status: record.status,
      notes: record.notes,
      created_at: record.created_at,
      employer_name: record.employers?.users?.name || "Unknown Employer",
      worker_name: record.workers?.users?.name || "Unknown Worker",
      package_title: record.packages?.title || "N/A",
    }));
}

/**
 * Get a single matching record by ID
 */
export async function getMatchingRecordById(
  matchId: number
): Promise<MatchingRecord | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("matching_records")
    .select(
      `
      match_id,
      employer_id,
      worker_id,
      package_id,
      match_score,
      match_date,
      status,
      notes,
      created_at,
      employers:employer_id (
        employer_id,
        users:user_id (
          name,
          role
        )
      ),
      workers:worker_id (
        worker_id,
        users:user_id (
          name,
          role
        )
      ),
      packages:package_id (
        title
      )
    `
    )
    .eq("match_id", matchId)
    .single();

  if (error) {
    console.error("Error fetching matching record:", error);
    return null;
  }

  if (!data) return null;

  // Check if the users have the correct roles
  const employerRole = data.employers?.users?.role;
  const workerRole = data.workers?.users?.role;
  
  if (employerRole !== 'employer' || workerRole !== 'worker') {
    console.warn("Matching record contains admin user, skipping");
    return null;
  }

  return {
    match_id: data.match_id,
    employer_id: data.employer_id,
    worker_id: data.worker_id,
    package_id: data.package_id,
    match_score: data.match_score,
    match_date: data.match_date,
    status: data.status,
    notes: data.notes,
    created_at: data.created_at,
    employer_name: data.employers?.users?.name || "Unknown Employer",
    worker_name: data.workers?.users?.name || "Unknown Worker",
    package_title: data.packages?.title || "N/A",
  };
}

/**
 * Delete a matching record
 */
export async function deleteMatchingRecord(matchId: number): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from("matching_records")
    .delete()
    .eq("match_id", matchId);

  if (error) {
    console.error("Error deleting matching record:", error);
    throw error;
  }

  return true;
}

/**
 * Get matching statistics
 */
export async function getMatchingStats(): Promise<{
  totalMatches: number;
  successfulMatches: number;
  failedMatches: number;
  averageScore: number;
}> {
  const supabase = createClient();

  const { data, error } = await supabase.from("matching_records").select("*");

  if (error) {
    console.error("Error fetching matching stats:", error);
    throw error;
  }

  const totalMatches = data?.length || 0;
  const successfulMatches =
    data?.filter((m) => m.status === "successful").length || 0;
  const failedMatches =
    data?.filter((m) => m.status === "failed").length || 0;
  const averageScore =
    data?.reduce((sum, m) => sum + parseFloat(m.match_score || 0), 0) /
      totalMatches || 0;

  return {
    totalMatches,
    successfulMatches,
    failedMatches,
    averageScore: Math.round(averageScore * 100) / 100,
  };
}

/**
 * Get matching analytics by date range
 */
export async function getMatchingAnalytics(
  startDate?: string,
  endDate?: string
): Promise<{
  date: string;
  successful: number;
  failed: number;
}[]> {
  const supabase = createClient();

  let query = supabase
    .from("matching_records")
    .select("match_date, status")
    .order("match_date", { ascending: true });

  if (startDate) {
    query = query.gte("match_date", startDate);
  }
  if (endDate) {
    query = query.lte("match_date", endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching matching analytics:", error);
    throw error;
  }

  // Group by date and count by status
  const groupedData: Record<
    string,
    { successful: number; failed: number }
  > = {};

  data?.forEach((record) => {
    const date = new Date(record.match_date).toLocaleDateString();
    if (!groupedData[date]) {
      groupedData[date] = { successful: 0, failed: 0 };
    }
    if (record.status === "successful") {
      groupedData[date].successful++;
    } else if (record.status === "failed") {
      groupedData[date].failed++;
    }
  });

  return Object.entries(groupedData).map(([date, counts]) => ({
    date,
    ...counts,
  }));
}
