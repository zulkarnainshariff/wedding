import { getSessionUser } from "@/lib/auth";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { syncEvents } from "@/lib/sync-events";
import { getCurrentUpdateId } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let onUpdate: ((updateId: string) => void) | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: { updateId: string }) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );
      };

      onUpdate = (updateId: string) => send({ updateId });
      syncEvents.on("update", onUpdate);

      send({ updateId: await getCurrentUpdateId() });

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 25000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (onUpdate) syncEvents.off("update", onUpdate);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
