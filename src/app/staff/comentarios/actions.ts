"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export async function moderateCommentAction(commentId:string,reportId:string,formData:FormData){await requireRole(["staff","admin"]);if(!z.uuid().safeParse(commentId).success||!z.uuid().safeParse(reportId).success)return;const action=z.enum(["hidden","restored","report_reviewed","report_dismissed","report_actioned"]).safeParse(formData.get("action"));if(!action.success)return;const supabase=await createClient();await supabase.rpc("moderate_listing_comment",{target_comment_id:commentId,target_action:action.data,target_report_id:action.data.startsWith("report_")?reportId:null,target_notes:String(formData.get("notes")??"").slice(0,1000)||null});revalidatePath("/staff/comentarios");}
