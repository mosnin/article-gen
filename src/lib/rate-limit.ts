import { SupabaseClient } from "@supabase/supabase-js";

const MAX_CONCURRENT_GENERATIONS = 5;

/**
 * Atomically acquires a generation slot for the user.
 * Returns true if the slot was acquired, false if the user is at the limit.
 * Always pair with releaseGenerationSlot in a finally block.
 */
export async function acquireGenerationSlot(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .rpc("acquire_generation_slot", {
      p_user_id: userId,
      p_max: MAX_CONCURRENT_GENERATIONS,
    })
    .single<boolean>();

  if (error) {
    // If the RPC fails (e.g. column not yet migrated), fail open so legitimate
    // users are not blocked. Log for visibility.
    console.error("[rate-limit] acquire_generation_slot error:", error.message);
    return true;
  }
  return !!data;
}

/**
 * Releases a previously acquired generation slot.
 * Safe to call unconditionally — will not go below 0.
 */
export async function releaseGenerationSlot(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc("release_generation_slot", {
    p_user_id: userId,
  });
  if (error) {
    console.error("[rate-limit] release_generation_slot error:", error.message);
  }
}
