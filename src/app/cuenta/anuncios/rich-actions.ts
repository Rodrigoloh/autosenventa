"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuid=z.uuid(); const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const list=(value:string)=>value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);

export async function saveRichListingAction(listingId:string,formData:FormData){
 const viewer=await requireUser(); if(!uuid.safeParse(listingId).success)return; const supabase=await createClient();
 const {data:listing}=await supabase.from("listings").select("id,status").eq("id",listingId).eq("owner_id",viewer.id).in("status",["draft","changes_requested"]).maybeSingle(); if(!listing)return;
 const vinRaw=clean(formData.get("vin")).replace(/[^a-z0-9]/gi,"").toUpperCase(); if(vinRaw&&!/^[A-HJ-NPR-Z0-9]{17}$/.test(vinRaw))return;
 const ownership={listing_id:listingId,owned_since_month:Number(clean(formData.get("owned_since_month")))||null,owned_since_year:Number(clean(formData.get("owned_since_year")))||null,known_owner_count:clean(formData.get("known_owner_count"))||"unknown",ownership_notes:clean(formData.get("ownership_notes"))||null,originality_status:clean(formData.get("originality_status"))||"unknown",vin:vinRaw||null};
 const documentation={listing_id:listingId,document_type:clean(formData.get("document_type"))||null,taxes_current:clean(formData.get("taxes_current"))||"unknown",registration_card:clean(formData.get("registration_card"))||"unknown",emissions_status:clean(formData.get("emissions_status"))||"unknown",insurance_current:clean(formData.get("insurance_current"))||"unknown",keys_count:Number(clean(formData.get("keys_count")))||null,owners_manual:clean(formData.get("owners_manual"))||"unknown",service_history_level:clean(formData.get("service_history_level"))||"unknown"};
 const equipment=list(clean(formData.get("equipment"))).map((name,sort_order)=>({listing_id:listingId,name,sort_order}));
 const included=list(clean(formData.get("included"))).map((line,sort_order)=>{const [name,description]=line.split("|").map(x=>x.trim());return{listing_id:listingId,name,description:description||null,sort_order}});
 const modCategories=new Set(["engine","suspension","wheels","brakes","exhaust","body","interior","electronics","drivetrain","other"]);
 const modifications=list(clean(formData.get("modifications"))).map((line,sort_order)=>{const [raw,name,description]=line.split("|").map(x=>x.trim());return{listing_id:listingId,category:modCategories.has(raw)?raw:"other",name,description:description||null,sort_order}}).filter(x=>x.name);
 const flawCategories=new Set(["exterior","interior","mechanical","electrical","cosmetic","other"]);
 const flaws=list(clean(formData.get("flaws"))).map((line,sort_order)=>{const [raw,title,description,photo]=line.split("|").map(x=>x.trim());return{listing_id:listingId,category:flawCategories.has(raw)?raw:"other",title,description,photo_id:uuid.safeParse(photo).success?photo:null,sort_order}}).filter(x=>x.title&&x.description);
 const services=list(clean(formData.get("services"))).map((line,sort_order)=>{const [date,km,description,document]=line.split("|").map(x=>x.trim());return{listing_id:listingId,service_date:/^\d{4}-\d{2}-\d{2}$/.test(date)?date:null,mileage_km:Number(km)||null,description,document_available:document==="yes",sort_order}}).filter(x=>x.description);
 const videoTypes=new Set(["walkaround","cold_start","engine_running","driving","exhaust","interior","other"]);
 const videos=list(clean(formData.get("videos"))).slice(0,3).map((line,sort_order)=>{const [raw,url]=line.split("|").map(x=>x.trim());return{listing_id:listingId,type:videoTypes.has(raw)?raw:"other",external_url:url,sort_order,status:"ready"}}).filter(x=>/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(x.external_url));
 const upserts=await Promise.all([supabase.from("listing_ownership_details").upsert(ownership),supabase.from("listing_documentation").upsert(documentation)]); if(upserts.some(x=>x.error))return;
 const collections:Record<string,Record<string,unknown>[]>={listing_equipment:equipment,listing_included_items:included,listing_modifications:modifications,listing_flaws:flaws,listing_service_records:services,listing_videos:videos};
 for(const [table,rows] of Object.entries(collections)){const removed=await supabase.from(table).delete().eq("listing_id",listingId);if(removed.error)return;if(rows.length){const inserted=await supabase.from(table).insert(rows);if(inserted.error)return;}}
 revalidatePath(`/cuenta/anuncios/${listingId}/editar`);revalidatePath(`/cuenta/anuncios/${listingId}/vista-previa`);redirect(`/cuenta/anuncios/${listingId}/editar?rich=saved`);
}
