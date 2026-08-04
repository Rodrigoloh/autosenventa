"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();
const bodySchema = z.string().trim().min(1).max(2000);

export async function createCommentAction(listingId: string, parentId: string | null, formData: FormData) {
  await requireUser();
  const body = bodySchema.safeParse(formData.get("body"));
  if (!uuid.safeParse(listingId).success || !body.success || (parentId && !uuid.safeParse(parentId).success)) return;
  const supabase = await createClient();
  await supabase.rpc("create_listing_comment", { target_listing_id: listingId, target_body: body.data, target_parent_id: parentId });
  revalidatePath(`/autos/${listingId}`);
}

export async function editCommentAction(listingId: string, commentId: string, formData: FormData) {
  await requireUser(); const body=bodySchema.safeParse(formData.get("body")); if(!uuid.safeParse(commentId).success||!body.success)return;
  const supabase=await createClient(); await supabase.rpc("edit_listing_comment",{target_comment_id:commentId,target_body:body.data}); revalidatePath(`/autos/${listingId}`);
}
export async function deleteCommentAction(listingId: string, commentId: string) {
  await requireUser(); if(!uuid.safeParse(commentId).success)return; const supabase=await createClient(); await supabase.rpc("delete_listing_comment",{target_comment_id:commentId}); revalidatePath(`/autos/${listingId}`);
}
export async function voteCommentAction(listingId:string,commentId:string){await requireUser();if(!uuid.safeParse(commentId).success)return;const supabase=await createClient();await supabase.rpc("toggle_listing_comment_vote",{target_comment_id:commentId});revalidatePath(`/autos/${listingId}`);}
export async function reportCommentAction(listingId:string,commentId:string,formData:FormData){await requireUser();const reason=z.enum(["spam","harassment","false_information","personal_information","inappropriate","other"]).safeParse(formData.get("reason"));if(!uuid.safeParse(commentId).success||!reason.success)return;const details=z.string().trim().max(1000).catch("").parse(formData.get("details")??"");const supabase=await createClient();await supabase.rpc("report_listing_comment",{target_comment_id:commentId,target_reason:reason.data,target_details:details||null});revalidatePath(`/autos/${listingId}`);}
