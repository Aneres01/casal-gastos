import { supabase } from "./supabaseClient";
import type { Profile } from "./types";

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function ensureProfileAndFamily(displayName?: string) : Promise<Profile> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Usuário não autenticado");

  const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (prof) return prof as Profile;

  // create family
  const { data: fam, error: famErr } = await supabase.from("families").insert({
    name: displayName ? `Casa ${displayName}` : "Minha Casa"
  }).select().single();
  if (famErr) throw famErr;

  const familyId = fam.id as string;

  const { data: created, error: profErr } = await supabase.from("profiles").insert({
    id: user.id,
    display_name: displayName ?? "",
    family_id: familyId
  }).select().single();
  if (profErr) throw profErr;

  // seed categories
  await supabase.from("categories").insert([
    { family_id: familyId, name: "Alimentação", icon: "🍔", color: 0xFF14B8A6 },
    { family_id: familyId, name: "Mercado", icon: "🛒", color: 0xFF60A5FA },
    { family_id: familyId, name: "Transporte", icon: "🚗", color: 0xFFA78BFA },
    { family_id: familyId, name: "Moradia", icon: "🏠", color: 0xFFFB923C },
    { family_id: familyId, name: "Saúde", icon: "🩺", color: 0xFFF87171 },
    { family_id: familyId, name: "Lazer", icon: "🎬", color: 0xFF34D399 }
  ]);

  return created as Profile;
}

export async function joinFamily(familyId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Usuário não autenticado");

  const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!prof) {
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      display_name: "",
      family_id: familyId
    });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("profiles").update({ family_id: familyId }).eq("id", user.id);
    if (error) throw error;
  }
}
