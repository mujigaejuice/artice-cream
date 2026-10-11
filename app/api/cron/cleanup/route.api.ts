import { deleteExpiredUsage } from "@/lib/data-retention";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  // Destructive maintenance requires the secret even in local development.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return reply({ error: "unauthorized" }, 401);
  }
  try {
    const deleted = await deleteExpiredUsage(createAdminClient());
    return reply({ ok: true, ...deleted });
  } catch {
    // No vendor errors or user data in the response or application logs.
    // A partial run is safe to retry: both deletes use fixed age filters.
    return reply({ error: "cleanup_failed" }, 503);
  }
}
